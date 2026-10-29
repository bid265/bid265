import { auth } from "../../auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assets, auctionItems, auctionSettlements, bids, sales, users } from "@/lib/db/schema";
import { and, count, desc, eq, inArray, sum } from "drizzle-orm";
import DashboardLayoutFrame from "@/components/dashboard/DashboardLayoutFrame";
import ForcePasswordChange from "@/components/dashboard/ForcePasswordChange";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = {
    id: Number(session.user.id) || 0,
    name: session.user.name || "N/A",
    email: session.user.email || "",
    role: session.user.role || "BIDDER"
  };
  
  if (session.user.mustChangePassword) {
    return <ForcePasswordChange name={user.name} />;
  }

  const isAuctioneer = user.role === "AUCTIONEER";
  let serializedAuctionItems = [];
  let dashboardStats = null;
  let adminUserCounts = { BIDDER: 0, AUCTIONEER: 0, ADMIN: 0 };
  let recentlyApprovedAuctioneers = [];
  
  if (isAuctioneer) {
    const rawAuctionItems = await db.select({
      id: auctionItems.id,
      assetId: auctionItems.assetId,
      reservePrice: auctionItems.reservePrice,
      reservePriceDisclosed: auctionItems.reservePriceDisclosed,
      startingBid: auctionItems.startingBid,
      depositAmount: auctionItems.depositAmount,
      status: auctionItems.status,
      liveRoomId: auctionItems.liveRoomId,
      startTime: auctionItems.startTime,
      endTime: auctionItems.endTime,
      createdAt: auctionItems.createdAt,
      updatedAt: auctionItems.updatedAt,
      title: assets.title,
      description: assets.description,
      location: assets.location,
      category: assets.category,
      documentUrl: assets.documentUrl,
      assetCreatedAt: assets.createdAt,
      assetUpdatedAt: assets.updatedAt,
    }).from(auctionItems)
      .innerJoin(assets, eq(auctionItems.assetId, assets.id))
      .where(and(eq(assets.createdById, user.id), eq(assets.listingType, "AUCTION"), eq(assets.isListed, true)))
      .orderBy(desc(auctionItems.createdAt));

    serializedAuctionItems = rawAuctionItems.map((item) => ({
      id: Number(item.id),
      assetId: Number(item.assetId),
      reservePrice: item.reservePrice ? Number(item.reservePrice) : 0,
      reservePriceDisclosed: Boolean(item.reservePriceDisclosed),
      startingBid: item.startingBid ? Number(item.startingBid) : 0,
      depositAmount: item.depositAmount ? Number(item.depositAmount) : 0,
      status: item.status || "UPCOMING",
      liveRoomId: item.liveRoomId || null,
      startTime: item.startTime ? item.startTime.toISOString() : null,
      endTime: item.endTime ? item.endTime.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      asset: {
        id: Number(item.assetId),
        title: item.title || "Unnamed Asset",
        description: item.description || "",
        location: item.location || "",
        category: item.category || "OTHER",
        documentUrl: item.documentUrl || null,
        createdAt: item.assetCreatedAt.toISOString(),
        updatedAt: item.assetUpdatedAt.toISOString(),
      },
    }));

    const auctionIds = serializedAuctionItems.map((item) => item.id);
    const [bidTotals, salesTotals, settlements] = await Promise.all([
      auctionIds.length
        ? db.select({ total: count() }).from(bids).where(inArray(bids.auctionItemId, auctionIds))
        : Promise.resolve([{ total: 0 }]),
      db.select({ total: count(), revenue: sum(sales.amount) }).from(sales)
        .where(and(eq(sales.sellerId, user.id), eq(sales.status, "PAID"))),
      auctionIds.length
        ? db.select({ winnerId: auctionSettlements.winnerId }).from(auctionSettlements)
            .where(inArray(auctionSettlements.auctionItemId, auctionIds))
        : Promise.resolve([]),
    ]);
    dashboardStats = {
      totalBids: bidTotals[0]?.total || 0,
      completedSales: salesTotals[0]?.total || 0,
      completedSalesRevenue: Number(salesTotals[0]?.revenue || 0),
      auctionSuccessRate: settlements.length
        ? Math.round((settlements.filter((settlement) => settlement.winnerId !== null).length / settlements.length) * 100)
        : 0,
    };

  } else if (user.role === "ADMIN") {
    const [roleTotals, recentAuctioneers] = await Promise.all([
      db.select({ role: users.role, total: count() })
        .from(users)
        .groupBy(users.role),
      db.select({
        id: users.id,
        name: users.name,
        businessName: users.businessName,
        createdAt: users.createdAt,
      }).from(users)
        .where(and(eq(users.role, "AUCTIONEER"), eq(users.isVerified, true)))
        .orderBy(desc(users.createdAt))
        .limit(5),
    ]);
    adminUserCounts = {
      BIDDER: roleTotals.find((entry) => entry.role === "BIDDER")?.total || 0,
      AUCTIONEER: roleTotals.find((entry) => entry.role === "AUCTIONEER")?.total || 0,
      ADMIN: roleTotals.find((entry) => entry.role === "ADMIN")?.total || 0,
    };
    recentlyApprovedAuctioneers = recentAuctioneers.map((auctioneer) => ({
      ...auctioneer,
      createdAt: auctioneer.createdAt.toISOString(),
    }));
  }

  return (
    <DashboardLayoutFrame 
      user={user} 
      serializedAuctionItems={serializedAuctionItems} 
      isAuctioneer={isAuctioneer} 
      dashboardStats={dashboardStats}
      adminUserCounts={adminUserCounts}
      recentlyApprovedAuctioneers={recentlyApprovedAuctioneers}
    />
  );
}