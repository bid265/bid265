import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auctionAccessPayments, auctionItems, payments, sales } from "@/lib/db/schema";
import { sendPaymentReceipt } from "@/lib/paymentReceipts";
import { syncListingSalePayment } from "@/lib/paymentSales";

const ACCESS_PURPOSES = ["ENTRY_FEE", "SECURITY_DEPOSIT", "BIDDING_DEPOSIT", "BIDDING_FEE"];

async function verifyWithGateway(reference, expectedAmount) {
  const key = process.env.PAYCHANGU_SECRET_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json();
    const gateway = body?.data;
    if (!gateway) return null;
    const gatewayReference = gateway.tx_ref || gateway.reference;
    if (gatewayReference && gatewayReference !== reference) return "invalid";
    if (gateway.amount != null && Number(gateway.amount) !== Number(expectedAmount)) return "invalid";
    const status = String(gateway.status || "").toLowerCase();
    return status === "success" ? "completed" : status === "failed" ? "failed" : "pending";
  } catch (error) {
    console.error("[Payment finalize] gateway verification failed:", error);
    return null;
  }
}

/**
 * Confirms a payment, records the outcome everywhere it is tracked (ledger, auction access fees,
 * listing purchases), sends the receipt, and reports where the person should land next.
 * Idempotent: safe to call again from the webhook, the return redirect or a status poll.
 *
 * `hint` is the status the gateway put on the return URL. It is only trusted in
 * PAYMENT_SIMULATION mode, when the gateway itself cannot be queried.
 */
export async function finalizePayment(reference, { hint = null, viewerId = null } = {}) {
  const [payment] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!payment) return { found: false, status: "unknown" };

  let status = String(payment.gatewayStatus || "pending").toLowerCase();
  if (status !== "completed") {
    let verified = await verifyWithGateway(reference, payment.amount);
    if (
      verified === null &&
      process.env.PAYMENT_SIMULATION === "true" &&
      viewerId != null && Number(viewerId) === payment.userId
    ) {
      const normalizedHint = String(hint || "").toLowerCase();
      verified = ["success", "successful", "completed"].includes(normalizedHint)
        ? "completed"
        : ["failed", "cancelled", "canceled"].includes(normalizedHint) ? "failed" : null;
    }
    if (verified === "completed" || verified === "failed") {
      status = verified;
      await db.transaction(async (tx) => {
        await tx.update(payments).set({ gatewayStatus: status }).where(eq(payments.reference, reference));
        await tx.update(auctionAccessPayments).set({
          status: status === "completed" ? "PAID" : "FAILED",
          paidAt: status === "completed" ? new Date() : null,
        }).where(and(
          eq(auctionAccessPayments.paymentRef, reference),
          eq(auctionAccessPayments.userId, payment.userId),
        ));
      });
    }
  }
  await syncListingSalePayment(reference, status);

  let receiptSent = false;
  if (status === "completed") {
    try {
      receiptSent = await sendPaymentReceipt(reference);
    } catch (error) {
      console.error("[Payment finalize] receipt email failed:", error);
    }
  }
  return { found: true, status, purpose: payment.purpose, userId: payment.userId, receiptSent };
}

/** Where to send the person after a payment, based on what the payment was for. */
export async function resolvePaymentRedirect(reference, outcome) {
  const query = new URLSearchParams({ payment: outcome.status === "completed" ? "success" : outcome.status, payment_ref: reference });

  if (ACCESS_PURPOSES.includes(outcome.purpose)) {
    const [access] = await db.select({
      auctionItemId: auctionAccessPayments.auctionItemId,
      liveRoomId: auctionItems.liveRoomId,
    }).from(auctionAccessPayments)
      .innerJoin(auctionItems, eq(auctionAccessPayments.auctionItemId, auctionItems.id))
      .where(eq(auctionAccessPayments.paymentRef, reference))
      .limit(1);

    if (access && outcome.status === "completed") {
      const feeRows = await db.select({ feeType: auctionAccessPayments.feeType, status: auctionAccessPayments.status })
        .from(auctionAccessPayments)
        .where(and(
          eq(auctionAccessPayments.userId, outcome.userId),
          eq(auctionAccessPayments.auctionItemId, access.auctionItemId),
        ));
      const paid = (types) => feeRows.some((row) => types.includes(row.feeType) && row.status === "PAID");
      const cleared = paid(["ENTRY_FEE", "SECURITY_DEPOSIT"]) && paid(["BIDDING_DEPOSIT", "BIDDING_FEE"]);
      if (cleared && access.liveRoomId) {
        return `/auctions/live/${encodeURIComponent(access.liveRoomId)}?id=${access.auctionItemId}`;
      }
      query.set("tab", "live-auctions");
      query.set("access_auction_id", String(access.auctionItemId));
      query.set("access_step", cleared ? "complete" : "next");
      return `/dashboard?${query}`;
    }
    query.set("tab", "live-auctions");
    return `/dashboard?${query}`;
  }

  if (outcome.purpose === "DAILY_SALE_PURCHASE" || outcome.purpose === "PROPERTY_PURCHASE" || outcome.purpose === "PROPERTY_RENT") {
    const [sale] = await db.select({ kind: sales.kind }).from(sales).where(eq(sales.paymentRef, reference)).limit(1);
    query.set("tab", "payments");
    if (sale) query.set("purchase", sale.kind);
    return `/dashboard?${query}`;
  }

  query.set("tab", "payments");
  return `/dashboard?${query}`;
}
