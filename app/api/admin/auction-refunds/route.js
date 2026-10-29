import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assets, auctionItems, auctionRefunds, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { processAutoRefunds } from "@/lib/refunds";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;

    const refunds = await db.select({
      id: auctionRefunds.id,
      amount: auctionRefunds.amount,
      reason: auctionRefunds.reason,
      status: auctionRefunds.status,
      gatewayReference: auctionRefunds.gatewayReference,
      createdAt: auctionRefunds.createdAt,
      bidderName: users.name,
      bidderEmail: users.email,
      auctionTitle: assets.title,
    }).from(auctionRefunds)
      .innerJoin(users, eq(auctionRefunds.userId, users.id))
      .innerJoin(auctionItems, eq(auctionRefunds.auctionItemId, auctionItems.id))
      .innerJoin(assets, eq(auctionItems.assetId, assets.id))
      .orderBy(desc(auctionRefunds.createdAt));
    return NextResponse.json({ refunds });
  } catch (error) {
    console.error("[Admin auction refunds GET]", error);
    return NextResponse.json({ error: "Could not load auction refunds." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const refundId = Number(body?.refundId);
    const gatewayReference = typeof body?.gatewayReference === "string" ? body.gatewayReference.trim() : "";
    if (!Number.isInteger(refundId) || refundId <= 0 || !gatewayReference || gatewayReference.length > 191) {
      return NextResponse.json({ error: "A valid refund ID and payout reference are required." }, { status: 400 });
    }

    const [refund] = await db.select({
      id: auctionRefunds.id,
      status: auctionRefunds.status,
      processedEmailSentAt: auctionRefunds.processedEmailSentAt,
      amount: auctionRefunds.amount,
      name: users.name,
      email: users.email,
      title: assets.title,
    }).from(auctionRefunds)
      .innerJoin(users, eq(auctionRefunds.userId, users.id))
      .innerJoin(auctionItems, eq(auctionRefunds.auctionItemId, auctionItems.id))
      .innerJoin(assets, eq(auctionItems.assetId, assets.id))
      .where(eq(auctionRefunds.id, refundId))
      .limit(1);
    if (!refund) return NextResponse.json({ error: "Refund record not found." }, { status: 404 });
    if (refund.status === "PROCESSED") {
      return NextResponse.json({ error: "This refund has already been processed." }, { status: 409 });
    }

    const [processed] = await db.update(auctionRefunds).set({
      status: "PROCESSED",
      gatewayReference,
      processedById: Number(access.session.user.id),
      processedAt: new Date(),
    }).where(and(eq(auctionRefunds.id, refundId), inArray(auctionRefunds.status, ["PENDING", "FAILED"])))
      .returning({ id: auctionRefunds.id });
    if (!processed) return NextResponse.json({ error: "Refund status changed. Refresh and try again." }, { status: 409 });

    let emailWarning = null;
    if (!refund.processedEmailSentAt) {
      try {
        await sendEmail({
          to: refund.email,
          subject: `Auction deposit refund processed: ${refund.title}`,
          text: `Hello ${refund.name},\n\nYour auction deposit refund of MWK ${Number(refund.amount).toLocaleString()} for "${refund.title}" has been marked as paid by the administrator.\n\nPayout reference: ${gatewayReference}\n\nThank you,\nTrustBid`,
        });
        await db.update(auctionRefunds)
          .set({ processedEmailSentAt: new Date() })
          .where(and(eq(auctionRefunds.id, refundId), isNull(auctionRefunds.processedEmailSentAt)));
      } catch (error) {
        console.error("[Admin auction refund email]", error);
        emailWarning = "Payout was recorded, but the bidder email could not be sent.";
      }
    }

    return NextResponse.json({ success: true, ...(emailWarning ? { emailWarning } : {}) });
  } catch (error) {
    console.error("[Admin auction refunds PATCH]", error);
    return NextResponse.json({ error: "Could not process auction refund." }, { status: 500 });
  }
}

/** Retry the automatic refund run for one auction (pending or failed refunds only). */
export async function POST(request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const auctionId = Number(body?.auctionId);
    if (!Number.isInteger(auctionId) || auctionId <= 0) {
      return NextResponse.json({ error: "A valid auction ID is required." }, { status: 400 });
    }
    const result = await processAutoRefunds(auctionId, { processedById: Number(access.session.user.id) });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Admin auction refunds POST]", error);
    return NextResponse.json({ error: "Could not process auction refunds." }, { status: 500 });
  }
}
