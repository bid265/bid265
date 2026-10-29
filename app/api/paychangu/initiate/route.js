import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auctionAccessPayments, payments, sales } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const PAYCHANGU_BASE = "https://api.paychangu.com";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount, currency = "MWK", tx_ref, email,
      first_name, last_name, phone, method, purpose,
    } = body;

    // The webhook and browser-return URLs are always built server-side (never taken from the
    // client) so every payment, simulated or live, comes back through /api/paychangu/callback.
    const appBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const callback_url = `${appBase}/api/paychangu/callback`;
    const return_url = `${appBase}/api/paychangu/callback?tx_ref=${encodeURIComponent(String(tx_ref || ""))}`;

    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !tx_ref || !email || !purpose) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const accessFeeType = ({
      ENTRY_FEE: "ENTRY_FEE",
      SECURITY_DEPOSIT: "ENTRY_FEE",
      BIDDING_DEPOSIT: "BIDDING_DEPOSIT",
      BIDDING_FEE: "BIDDING_DEPOSIT",
    })[purpose] || null;
    if (accessFeeType) {
      const [accessPayment] = await db.select().from(auctionAccessPayments).where(and(
        eq(auctionAccessPayments.userId, Number(session.user.id)),
        eq(auctionAccessPayments.feeType, accessFeeType),
        eq(auctionAccessPayments.paymentRef, tx_ref),
      )).limit(1);

      if (
        !accessPayment ||
        accessPayment.status !== "PENDING" ||
        Number(accessPayment.amount) !== requestedAmount
      ) {
        return NextResponse.json({ error: "Auction fee does not match a pending access payment" }, { status: 400 });
      }
    }

    if (["DAILY_SALE_PURCHASE", "PROPERTY_PURCHASE", "PROPERTY_RENT"].includes(purpose)) {
      const [purchase] = await db.select().from(sales).where(and(
        eq(sales.buyerId, Number(session.user.id)),
        eq(sales.paymentRef, tx_ref),
        eq(sales.kind, purpose),
        eq(sales.status, "PENDING"),
      )).limit(1);
      if (!purchase || Number(purchase.amount) !== requestedAmount) {
        return NextResponse.json({ error: "Purchase does not match an available listing." }, { status: 400 });
      }
    }

    // Idempotency check
    const [existing] = await db.select({ id: payments.id }).from(payments).where(eq(payments.reference, tx_ref)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "Duplicate tx_ref" }, { status: 409 });
    }

    // Create pending record
    await db.insert(payments).values({
        reference: tx_ref,
        userId: parseInt(session.user.id),
        amount: requestedAmount,
        gatewayStatus: "pending",
        purpose,
      });

    const payload = {
      amount: requestedAmount,
      currency,
      tx_ref,
      callback_url,
      return_url,
      email,
      first_name,
      last_name,
      customization: {
        title: `Bid265 - ${purpose}`,
        description: `Payment for ${purpose}`,
      },
      meta: {
        user_id: session.user.id,
        purpose,
        method,
        phone,
      },
    };

    console.log("[PayChangu] Sending payload:", JSON.stringify(payload, null, 2));

    const payRes = await fetch(`${PAYCHANGU_BASE}/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const payData = await payRes.json();
    console.log("[PayChangu] Raw response:", JSON.stringify(payData, null, 2));

    if (!payRes.ok) {
      await db.update(payments).set({ gatewayStatus: "failed" }).where(eq(payments.reference, tx_ref));
      if (accessFeeType) {
        await db.update(auctionAccessPayments).set({ status: "FAILED" })
          .where(eq(auctionAccessPayments.paymentRef, tx_ref));
      }
      return NextResponse.json(
        { error: payData.message || "PayChangu error", details: payData },
        { status: 502 }
      );
    }

    // Update DB
    await db.update(payments).set({ gatewayStatus: "pending" }).where(eq(payments.reference, tx_ref));

    // Extract checkout link — PayChangu may return it under different keys
    const checkoutUrl =
      payData.data?.link ||
      payData.data?.checkout_url ||
      payData.data?.url ||
      payData.link ||
      payData.checkout_url ||
      null;

    console.log("[PayChangu] Extracted checkoutUrl:", checkoutUrl);

    return NextResponse.json({
      success: true,
      checkoutUrl,
      tx_ref,
      status: payData.data?.status || payData.status || "pending",
      raw: payData, // Send full response for client-side debugging
    });
  } catch (error) {
    console.error("[PayChangu Initiate] CRASH:", error);
    return NextResponse.json(
      { error: "Internal error", message: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}