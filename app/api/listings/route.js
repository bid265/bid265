import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  auctionAccessPayments,
  auctionItems,
  auctionRegistrations,
  auctionSettlements,
  bids,
  dailySales,
  users,
} from "@/lib/db/schema";
import { count, desc, eq, inArray } from "drizzle-orm";

/**
 * GET /api/listings
 *
 * Auctioneer management feed with the two required columns:
 *  - dailySales: all daily sale commodity listings created by this auctioneer
 *  - properties: all property auction listings created by this auctioneer
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    if (session.user.role !== "AUCTIONEER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only auctioneers can manage listings." }, { status: 403 });
    }

    const userId = Number(session.user.id);

    const dailySaleRows = await db.query.dailySales.findMany({
      with: {
        asset: {
          with: {
            auctionItems: {
              with: { images: { where: (image, { eq }) => eq(image.isPrimary, true), limit: 1 } },
            },
          },
        },
      },
      orderBy: [desc(dailySales.createdAt)],
    });

    const properties = await db.query.auctionItems.findMany({
      with: {
        asset: true,
        images: { where: (image, { eq }) => eq(image.isPrimary, true), limit: 1 },
        bids: { orderBy: [desc(bids.amount)], limit: 1 },
      },
      orderBy: [desc(auctionItems.createdAt)],
    });

    const auctionRows = properties.filter((item) =>
      item.asset?.createdById === userId &&
      item.asset.isListed &&
      item.asset.listingType === "AUCTION"
    );
    const auctionIds = auctionRows.map((item) => item.id);
    const approvalAuctionIds = auctionRows.filter((item) => item.status === "PENDING_APPROVAL").map((item) => item.id);
    const [bidCounts, paymentCounts, registrationCounts, settlements, approvalBids] = auctionIds.length
      ? await Promise.all([
        db.select({ auctionItemId: bids.auctionItemId, total: count() })
          .from(bids).where(inArray(bids.auctionItemId, auctionIds)).groupBy(bids.auctionItemId),
        db.select({ auctionItemId: auctionAccessPayments.auctionItemId, total: count() })
          .from(auctionAccessPayments).where(inArray(auctionAccessPayments.auctionItemId, auctionIds))
          .groupBy(auctionAccessPayments.auctionItemId),
        db.select({ auctionItemId: auctionRegistrations.auctionItemId, total: count() })
          .from(auctionRegistrations).where(inArray(auctionRegistrations.auctionItemId, auctionIds))
          .groupBy(auctionRegistrations.auctionItemId),
        db.select({
          auctionItemId: auctionSettlements.auctionItemId,
          winnerId: auctionSettlements.winnerId,
        })
          .from(auctionSettlements).where(inArray(auctionSettlements.auctionItemId, auctionIds)),
        approvalAuctionIds.length
          ? db.select({
              auctionItemId: bids.auctionItemId,
              amount: bids.amount,
              bidderName: users.name,
            }).from(bids)
              .innerJoin(users, eq(bids.bidderId, users.id))
              .where(inArray(bids.auctionItemId, approvalAuctionIds))
              .orderBy(desc(bids.amount), desc(bids.createdAt), desc(bids.id))
          : Promise.resolve([]),
      ])
      : [[], [], [], [], []];
    const bidCountByAuction = new Map(bidCounts.map((row) => [row.auctionItemId, row.total]));
    const paymentCountByAuction = new Map(paymentCounts.map((row) => [row.auctionItemId, row.total]));
    const registrationCountByAuction = new Map(registrationCounts.map((row) => [row.auctionItemId, row.total]));
    const settlementByAuction = new Map(settlements.map((row) => [row.auctionItemId, row]));
    const approvalBidByAuction = new Map();
    for (const bid of approvalBids) {
      if (!approvalBidByAuction.has(bid.auctionItemId)) approvalBidByAuction.set(bid.auctionItemId, bid);
    }

    return NextResponse.json({
      success: true,
      dailySales: dailySaleRows
        .filter((sale) => sale.asset?.createdById === userId && sale.asset.isListed)
        .map((sale) => ({
          id: sale.id,
          assetId: sale.asset.id,
          title: sale.asset.title,
          description: sale.asset.description,
          category: sale.asset.category,
          clientName: sale.asset.clientName || sale.asset.location,
          price: Number(sale.price),
          stockCount: sale.stockCount,
          isAvailable: sale.isAvailable,
          imageUrl: sale.asset.auctionItems?.[0]?.images?.[0]?.url || null,
          createdAt: sale.createdAt.toISOString(),
        })),
      auctions: properties
        .filter((item) => auctionRows.some((auction) => auction.id === item.id))
        .map((item) => ({
          id: item.id,
          assetId: item.assetId,
          title: item.asset.title,
          description: item.asset.description,
          category: item.asset.category,
          clientName: item.asset.clientName || item.asset.location,
          listingType: item.asset.listingType || "AUCTION",
          askingPrice: item.asset.salePrice ? Number(item.asset.salePrice) : null,
          monthlyRent: item.asset.monthlyRent ? Number(item.asset.monthlyRent) : null,
          rentDueDay: item.asset.rentDueDay,
          startingBid: Number(item.startingBid),
          reservePrice: Number(item.reservePrice),
          entryFee: Number(item.depositAmount),
          biddingDeposit: Number(item.biddingFee),
          status: item.status,
          currentBid: item.bids[0] ? Number(item.bids[0].amount) : null,
          currentBidder: approvalBidByAuction.get(item.id)?.bidderName || null,
          bidCount: bidCountByAuction.get(item.id) || 0,
          registeredBidders: registrationCountByAuction.get(item.id) || 0,
          startTime: item.startTime.toISOString(),
          endTime: item.endTime.toISOString(),
          viewingDate: item.viewingDate?.toISOString() || null,
          canEdit: item.status === "UPCOMING" &&
            !bidCountByAuction.has(item.id) &&
            !paymentCountByAuction.has(item.id) &&
            !registrationCountByAuction.has(item.id) &&
            !settlementByAuction.has(item.id),
          canReuse: item.status === "CLOSED" &&
            !item.asset.isSold &&
            settlementByAuction.has(item.id) &&
            settlementByAuction.get(item.id).winnerId === null,
          canArchive: !["ACTIVE", "LIVE"].includes(item.status) &&
            !item.asset.isSold &&
            !bidCountByAuction.has(item.id) &&
            !paymentCountByAuction.has(item.id) &&
            !registrationCountByAuction.has(item.id) &&
            !settlementByAuction.has(item.id),
          imageUrl: item.images[0]?.url || null,
          createdAt: item.createdAt.toISOString(),
        })),
      properties: properties
        .filter((item) => item.asset?.createdById === userId && item.asset.isListed && item.asset.salesType === "PROPERTY" && ["SALE", "LEASE"].includes(item.asset.listingType))
        .map((item) => ({
          id: item.assetId,
          auctionItemId: item.id,
          assetId: item.assetId,
          title: item.asset.title,
          description: item.asset.description,
          category: item.asset.category,
          clientName: item.asset.clientName || item.asset.location,
          listingType: item.asset.listingType,
          isSold: item.asset.isSold,
          askingPrice: item.asset.salePrice ? Number(item.asset.salePrice) : null,
          monthlyRent: item.asset.monthlyRent ? Number(item.asset.monthlyRent) : null,
          rentDueDay: item.asset.rentDueDay,
          status: item.status,
          currentBid: item.bids[0] ? Number(item.bids[0].amount) : null,
          imageUrl: item.images[0]?.url || null,
          createdAt: item.createdAt.toISOString(),
        })),
    });
  } catch (error) {
    console.error("[Listings API]", error);
    return NextResponse.json(
      { error: error.message || "Failed to load listings." },
      { status: 500 }
    );
  }
}
