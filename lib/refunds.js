import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, auctionItems, auctionRefunds, users } from "@/lib/db/schema";
import { formatMwk, renderEmail, sendEmail } from "@/lib/email";

export const REFUND_REASON_LABELS = {
  OUTBID: "Outbid - full refund",
  NO_BIDS: "No winner - full refund",
  RESERVE_NOT_MET: "Reserve not met - full refund",
  WINNER_REMAINDER: "Highest bidder - remainder after winning bid",
};

/**
 * Sends one refund payout to the payment gateway.
 *
 * The platform currently runs against a simulated payment environment, so by default the
 * payout is simulated and receives a traceable `SIM-RF-` reference. Set
 * REFUND_PAYOUT_MODE=manual to disable automatic payouts and fall back to the
 * administrator "record completed refund" workflow.
 */
export async function issueRefundPayout(refund) {
  const mode = (process.env.REFUND_PAYOUT_MODE || "simulated").toLowerCase();
  if (mode === "manual") return { issued: false, reference: null };
  return { issued: true, reference: `SIM-RF-${refund.id}-${randomUUID().slice(0, 8).toUpperCase()}` };
}

async function loadRefundsForEmail(ids) {
  if (!ids.length) return [];
  return db.select({
    id: auctionRefunds.id,
    amount: auctionRefunds.amount,
    reason: auctionRefunds.reason,
    gatewayReference: auctionRefunds.gatewayReference,
    name: users.name,
    email: users.email,
    title: assets.title,
  }).from(auctionRefunds)
    .innerJoin(users, eq(auctionRefunds.userId, users.id))
    .innerJoin(auctionItems, eq(auctionRefunds.auctionItemId, auctionItems.id))
    .innerJoin(assets, eq(auctionItems.assetId, assets.id))
    .where(inArray(auctionRefunds.id, ids));
}

export async function sendRefundIssuedEmail(refund) {
  const { html, text } = renderEmail({
    heading: "Your auction refund has been issued",
    intro: `Hello ${refund.name},\n\nThe auction for "${refund.title}" has concluded and your refund has been issued automatically.`,
    rows: [
      ["Auction", refund.title],
      ["Refund amount", formatMwk(refund.amount)],
      ["Reason", REFUND_REASON_LABELS[refund.reason] || refund.reason],
      ["Refund reference", refund.gatewayReference || "-"],
    ],
    footer: "Outbid bidders receive their full bidding deposit. The highest bidder receives the remainder after the winning bid is deducted from the deposit.",
  });
  await sendEmail({ to: refund.email, subject: `Auction refund issued: ${refund.title}`, text, html });
}

/**
 * Automatically issues every PENDING / FAILED refund of a concluded auction.
 * Safe to call repeatedly: each refund is claimed with a conditional status update.
 */
export async function processAutoRefunds(auctionItemId, { processedById = null } = {}) {
  const candidates = await db.select({ id: auctionRefunds.id, status: auctionRefunds.status })
    .from(auctionRefunds)
    .where(and(
      eq(auctionRefunds.auctionItemId, auctionItemId),
      inArray(auctionRefunds.status, ["PENDING", "FAILED"]),
    ));

  const issuedIds = [];
  const failed = [];
  for (const candidate of candidates) {
    try {
      const payout = await issueRefundPayout(candidate);
      if (!payout.issued) continue; // manual mode: stays PENDING for the administrator
      const [updated] = await db.update(auctionRefunds).set({
        status: "PROCESSED",
        gatewayReference: payout.reference,
        processedById,
        processedAt: new Date(),
      }).where(and(
        eq(auctionRefunds.id, candidate.id),
        inArray(auctionRefunds.status, ["PENDING", "FAILED"]),
      )).returning({ id: auctionRefunds.id });
      if (updated) issuedIds.push(updated.id);
    } catch (error) {
      console.error("[Auto refund]", candidate.id, error);
      await db.update(auctionRefunds).set({ status: "FAILED" })
        .where(and(eq(auctionRefunds.id, candidate.id), eq(auctionRefunds.status, "PENDING")));
      failed.push(candidate.id);
    }
  }

  const emailErrors = [];
  for (const refund of await loadRefundsForEmail(issuedIds)) {
    try {
      await sendRefundIssuedEmail(refund);
      await db.update(auctionRefunds)
        .set({ emailSentAt: new Date(), processedEmailSentAt: new Date() })
        .where(and(eq(auctionRefunds.id, refund.id), isNull(auctionRefunds.processedEmailSentAt)));
    } catch (error) {
      console.error("[Auto refund email]", error);
      emailErrors.push(`Refund email could not be sent to ${refund.email}.`);
    }
  }
  return { issued: issuedIds.length, failed: failed.length, emailErrors };
}
