import { NextResponse } from "next/server";
import { and, inArray, lte } from "drizzle-orm";
import Pusher from "pusher";
import { db } from "@/lib/db";
import { auctionItems } from "@/lib/db/schema";
import { settleAuction } from "@/lib/auctionSettlement";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
  useTLS: true,
});

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Auction settlements] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Auction settlement job is not configured." }, { status: 500 });
  }
  const expectedAuthorization = "Bearer " + secret;
  if (request.headers.get("authorization") !== expectedAuthorization) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const expiredAuctions = await db.query.auctionItems.findMany({
      where: and(
        inArray(auctionItems.status, ["UPCOMING", "ACTIVE", "LIVE"]),
        lte(auctionItems.endTime, new Date()),
      ),
      with: { asset: { columns: { listingType: true } } },
      columns: { id: true },
    });
    const outcomes = [];
    for (const item of expiredAuctions.filter((candidate) => candidate.asset?.listingType === "AUCTION")) {
      const result = await settleAuction(item.id);
      const outcome = {
        auctionItemId: item.id,
        settled: !result.alreadySettled && !result.pendingApproval,
        pendingApproval: Boolean(result.pendingApproval),
        refundCount: result.refundCount,
        emailErrors: result.emailResult?.errors || [],
      };
      if (!result.alreadySettled && !result.pendingApproval) {
        try {
          await pusher.trigger(`auction-room-${item.id}`, "auction-closed", { auctionItemId: item.id });
        } catch (error) {
          console.error("[Auction settlements broadcast]", item.id, error);
          outcome.notificationError = "Live participants may need to refresh to see the closed auction.";
        }
      }
      outcomes.push(outcome);
    }
    return NextResponse.json({
      success: true,
      settled: outcomes.filter((outcome) => outcome.settled).length,
      pendingApproval: outcomes.filter((outcome) => outcome.pendingApproval).length,
      outcomes,
    });
  } catch (error) {
    console.error("[Auction settlements cron]", error);
    return NextResponse.json({ error: "Could not finalize expired auctions." }, { status: 500 });
  }
}
