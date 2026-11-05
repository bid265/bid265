import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auctionItems, auctionRegistrations, auctionSettlements, bids, payments } from "@/lib/db/schema";
import { and, asc, count, desc, eq, gt, inArray, sql, sum } from "drizzle-orm";

/**
 * GET /api/dashboard/bidder
 *
 * Returns a comprehensive dashboard overview for the authenticated bidder,
 * including stats, recent bids, winning bids, upcoming auctions,
 * registrations, payments, and activity metrics.
 */
export async function GET() {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid account." }, { status: 401 });
    }

    // ── 2. FETCH ALL BIDS WITH RELATIONS ─────────────────────────────
    const allBids = await db.query.bids.findMany({
      where: eq(bids.bidderId, userId),
      with: {
        auctionItem: {
          with: {
            asset: { columns: { id: true, title: true, category: true, location: true } },
            images: {
              where: (image, { eq }) => eq(image.isPrimary, true),
              limit: 1,
            },
          },
        },
      },
      orderBy: [desc(bids.createdAt)],
    });

    const auctionItemIds = [...new Set(allBids.map((bid) => bid.auctionItemId))];
    const [allCurrentBids] = auctionItemIds.length
      ? await Promise.all([
          db.select({ id: bids.id, auctionItemId: bids.auctionItemId, amount: bids.amount, bidderId: bids.bidderId })
            .from(bids).where(inArray(bids.auctionItemId, auctionItemIds))
            .orderBy(desc(bids.amount), desc(bids.createdAt), desc(bids.id)),
        ])
      : [[]];
    const highestBids = new Map();
    for (const bid of allCurrentBids) {
      if (!highestBids.has(bid.auctionItemId)) highestBids.set(bid.auctionItemId, bid);
    }
    const settlements = auctionItemIds.length
      ? await db.select({
          auctionItemId: auctionSettlements.auctionItemId,
          winnerId: auctionSettlements.winnerId,
        }).from(auctionSettlements).where(inArray(auctionSettlements.auctionItemId, auctionItemIds))
      : [];
    const settlementByAuction = new Map(settlements.map((settlement) => [settlement.auctionItemId, settlement]));

    // ── 3. ENRICH BIDS WITH COMPUTED STATUS ──────────────────────────
    const enrichedBids = await Promise.all(
      allBids.map((bid) => {
        const highestBid = highestBids.get(bid.auctionItemId);

        const now = new Date();
        const endTime = new Date(bid.auctionItem.endTime);
        const isAuctionClosed = endTime < now || bid.auctionItem.status === "CLOSED";

        let status;
        if (isAuctionClosed) {
          const settlement = settlementByAuction.get(bid.auctionItemId);
          status = settlement
            ? settlement.winnerId === userId && highestBid?.id === bid.id ? "WON" : "LOST"
            : "PENDING";
        } else if (highestBid?.id === bid.id) {
          status = "WINNING";
        } else if (highestBid && Number(highestBid.amount) > Number(bid.amount)) {
          status = "OUTBID";
        } else {
          status = "ACTIVE";
        }

        return {
          id: bid.id,
          amount: bid.amount,
          createdAt: bid.createdAt,
          status,
          auctionItem: {
            id: bid.auctionItem.id,
            endTime: bid.auctionItem.endTime,
            status: bid.auctionItem.status,
            startingBid: bid.auctionItem.startingBid,
            currentPrice: highestBid?.amount || bid.amount,
            asset: bid.auctionItem.asset,
            images: bid.auctionItem.images,
          },
        };
      })
    );

    // ── 4. FETCH REGISTRATIONS ─────────────────────────────────────────
    const now = new Date();
    const [registrations, registrationTotals, approvedRegistrationTotals, activeRegistrationTotals, paymentTotals] = await Promise.all([
      db.query.auctionRegistrations.findMany({
      where: eq(auctionRegistrations.userId, userId),
      with: {
        auctionItem: {
          with: {
            asset: { columns: { id: true, title: true, category: true } },
            images: {
              where: (image, { eq }) => eq(image.isPrimary, true),
              limit: 1,
            },
          },
        },
      },
      orderBy: [desc(auctionRegistrations.createdAt)],
      limit: 5,
      }),
      db.select({ total: count() }).from(auctionRegistrations).where(eq(auctionRegistrations.userId, userId)),
      db.select({ total: count() }).from(auctionRegistrations).where(and(
        eq(auctionRegistrations.userId, userId),
        eq(auctionRegistrations.status, "APPROVED")
      )),
      db.select({ total: count() }).from(auctionRegistrations)
        .innerJoin(auctionItems, eq(auctionRegistrations.auctionItemId, auctionItems.id))
        .where(and(
          eq(auctionRegistrations.userId, userId),
          eq(auctionRegistrations.status, "APPROVED"),
          gt(auctionItems.endTime, now)
        )),
      db.select({
        total: count(),
        successful: sql`count(*) filter (where lower(${payments.gatewayStatus}) in ('success', 'completed'))`,
        spent: sum(sql`case when lower(${payments.gatewayStatus}) in ('success', 'completed') then ${payments.amount} else 0 end`),
      }).from(payments).where(eq(payments.userId, userId)),
    ]);

    const enrichedRegistrations = registrations.map((reg) => ({
      id: reg.id,
      status: reg.status,
      createdAt: reg.createdAt,
      auctionItem: {
        id: reg.auctionItem.id,
        endTime: reg.auctionItem.endTime,
        viewingDate: reg.auctionItem.viewingDate,
        status: reg.auctionItem.status,
        liveRoomId: reg.auctionItem.liveRoomId,
        asset: reg.auctionItem.asset,
        images: reg.auctionItem.images,
      },
    }));

    // ── 5. FETCH PAYMENTS ────────────────────────────────────────────
    const recentPayments = await db.select().from(payments).where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt)).limit(5);

    // ── 6. FETCH UPCOMING AUCTIONS ───────────────────────────────────
    const upcomingAuctions = await db.query.auctionItems.findMany({
      where: and(eq(auctionItems.status, "UPCOMING"), gt(auctionItems.startTime, now)),
      with: {
        asset: {
          columns: { id: true, title: true, category: true, location: true },
        },
        images: {
          where: (image, { eq }) => eq(image.isPrimary, true),
          limit: 1,
        },
      },
      orderBy: [asc(auctionItems.startTime)],
      limit: 6,
    });

    // ── 7. COMPUTE STATS ───────────────────────────────────────────────
    const totalBids = enrichedBids.length;
    const winningBids = enrichedBids.filter((b) => b.status === "WINNING");
    const winningCount = enrichedBids.filter((b) => b.status === "WINNING" || b.status === "WON").length;
    const outbidCount = enrichedBids.filter((b) => b.status === "OUTBID" || b.status === "LOST").length;
    const auctionsWon = enrichedBids.filter((b) => b.status === "WON").length;
    const totalSpent = Number(paymentTotals[0]?.spent || 0);
    const totalPayments = paymentTotals[0]?.total || 0;
    const successfulPayments = Number(paymentTotals[0]?.successful || 0);
    const totalRegistrations = registrationTotals[0]?.total || 0;
    const approvedRegistrations = approvedRegistrationTotals[0]?.total || 0;
    const activeRegistrations = activeRegistrationTotals[0]?.total || 0;

    // ── 8. BUILD RESPONSE ──────────────────────────────────────────────
    const dashboardData = {
      stats: {
        totalBids,
        winningBids: winningCount,
        outbidCount,
        auctionsWon,
        totalSpent,
        totalPayments,
        successfulPayments,
        totalRegistrations,
        approvedRegistrations,
        activeRegistrations,
        upcomingAuctions: upcomingAuctions.length,
      },
      recentBids: enrichedBids.slice(0, 5),
      winningBids: winningBids.slice(0, 4),
      upcomingAuctions,
      registeredAuctions: enrichedRegistrations,
      recentPayments,
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });

  } catch (error) {
    console.error("[GET /api/dashboard/bidder] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}