import { NextResponse } from "next/server";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assets, auctionItems, auctionRefunds, auctionSettlements, bids, users } from "@/lib/db/schema";

/**
 * Refunds tab data for auctioneers (their own auctions) and administrators (all auctions).
 *   GET /api/refunds                -> list of auctions with refund summaries
 *   GET /api/refunds?auctionId=123  -> refunds of one auction, with the highest bid
 */
async function requireRefundViewer() {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  if (!["ADMIN", "AUCTIONEER"].includes(session.user.role)) {
    return { response: NextResponse.json({ error: "Only auctioneers and administrators can view refunds." }, { status: 403 }) };
  }
  return { session };
}

const ownerFilter = (session) => session.user.role === "AUCTIONEER"
  ? eq(assets.createdById, Number(session.user.id))
  : undefined;

export async function GET(request) {
  try {
    const access = await requireRefundViewer();
    if (access.response) return access.response;
    const { session } = access;

    const auctionIdParam = new URL(request.url).searchParams.get("auctionId");

    if (auctionIdParam) {
      const auctionId = Number(auctionIdParam);
      if (!Number.isInteger(auctionId) || auctionId <= 0) {
        return NextResponse.json({ error: "Invalid auction ID." }, { status: 400 });
      }

      const [auction] = await db.select({
        id: auctionItems.id,
        title: assets.title,
        status: auctionItems.status,
        endTime: auctionItems.endTime,
        reservePrice: auctionItems.reservePrice,
        biddingFee: auctionItems.biddingFee,
        winnerId: auctionSettlements.winnerId,
        winningBidAmount: auctionSettlements.winningBidAmount,
      }).from(auctionItems)
        .innerJoin(assets, eq(auctionItems.assetId, assets.id))
        .leftJoin(auctionSettlements, eq(auctionSettlements.auctionItemId, auctionItems.id))
        .where(and(eq(auctionItems.id, auctionId), eq(assets.listingType, "AUCTION"), ownerFilter(session)))
        .limit(1);
      if (!auction) return NextResponse.json({ error: "Auction not found." }, { status: 404 });

      const [highBid] = await db.select({
        amount: bids.amount,
        bidderName: users.name,
      }).from(bids)
        .innerJoin(users, eq(bids.bidderId, users.id))
        .where(eq(bids.auctionItemId, auctionId))
        .orderBy(desc(bids.amount), desc(bids.createdAt))
        .limit(1);

      const refunds = await db.select({
        id: auctionRefunds.id,
        userId: auctionRefunds.userId,
        amount: auctionRefunds.amount,
        reason: auctionRefunds.reason,
        status: auctionRefunds.status,
        gatewayReference: auctionRefunds.gatewayReference,
        processedAt: auctionRefunds.processedAt,
        createdAt: auctionRefunds.createdAt,
        bidderName: users.name,
        bidderEmail: users.email,
      }).from(auctionRefunds)
        .innerJoin(users, eq(auctionRefunds.userId, users.id))
        .where(eq(auctionRefunds.auctionItemId, auctionId))
        .orderBy(desc(auctionRefunds.amount), auctionRefunds.id);

      return NextResponse.json({
        auction: {
          ...auction,
          highestBid: highBid ? Number(highBid.amount) : null,
          highestBidder: highBid?.bidderName || null,
          winningBidAmount: auction.winningBidAmount == null ? null : Number(auction.winningBidAmount),
          reservePrice: Number(auction.reservePrice),
          biddingFee: Number(auction.biddingFee),
          concluded: Boolean(auction.winningBidAmount != null),
        },
        refunds: refunds.map((refund) => ({
          ...refund,
          amount: Number(refund.amount),
          isHighestBidder: auction.winnerId != null && refund.userId === auction.winnerId,
        })),
      });
    }

    const auctions = await db.select({
      id: auctionItems.id,
      title: assets.title,
      status: auctionItems.status,
      endTime: auctionItems.endTime,
      settled: auctionSettlements.id,
    }).from(auctionItems)
      .innerJoin(assets, eq(auctionItems.assetId, assets.id))
      .leftJoin(auctionSettlements, eq(auctionSettlements.auctionItemId, auctionItems.id))
      .where(and(eq(assets.listingType, "AUCTION"), eq(assets.isListed, true), ownerFilter(session)))
      .orderBy(desc(auctionItems.endTime));

    const ids = auctions.map((auction) => auction.id);
    const [highBids, refundTotals] = ids.length ? await Promise.all([
      db.select({ auctionItemId: bids.auctionItemId, highest: max(bids.amount) })
        .from(bids).where(inArray(bids.auctionItemId, ids)).groupBy(bids.auctionItemId),
      db.select({
        auctionItemId: auctionRefunds.auctionItemId,
        total: sql`count(*)`.mapWith(Number),
        pending: sql`count(*) filter (where ${auctionRefunds.status} <> 'PROCESSED')`.mapWith(Number),
        amount: sql`coalesce(sum(${auctionRefunds.amount}), 0)`.mapWith(Number),
      }).from(auctionRefunds).where(inArray(auctionRefunds.auctionItemId, ids)).groupBy(auctionRefunds.auctionItemId),
    ]) : [[], []];

    const highestByAuction = new Map(highBids.map((row) => [row.auctionItemId, Number(row.highest)]));
    const totalsByAuction = new Map(refundTotals.map((row) => [row.auctionItemId, row]));

    return NextResponse.json({
      auctions: auctions.map((auction) => {
        const totals = totalsByAuction.get(auction.id);
        return {
          id: auction.id,
          title: auction.title,
          status: auction.status,
          endTime: auction.endTime,
          concluded: Boolean(auction.settled),
          highestBid: highestByAuction.get(auction.id) ?? null,
          refundCount: totals?.total || 0,
          pendingCount: totals?.pending || 0,
          refundTotal: totals?.amount || 0,
        };
      }),
    });
  } catch (error) {
    console.error("[Refunds GET]", error);
    return NextResponse.json({ error: "Could not load refunds." }, { status: 500 });
  }
}
