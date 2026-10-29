import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, auctionItems, users } from "@/lib/db/schema";
import { formatDateTime, formatMwk, getAppUrl, renderEmail, sendEmail } from "@/lib/email";

const BATCH_SIZE = 10;

/**
 * Emails every registered bidder (and the listing auctioneer) when an auction is listed.
 * The listingNotifiedAt column is claimed first so an auction is never announced twice.
 */
export async function notifyAuctionListed(auctionItemId) {
  const id = Number(auctionItemId);
  if (!Number.isInteger(id) || id <= 0) return { sent: 0, failed: 0 };

  const [claimed] = await db.update(auctionItems)
    .set({ listingNotifiedAt: new Date() })
    .where(and(eq(auctionItems.id, id), isNull(auctionItems.listingNotifiedAt)))
    .returning({ id: auctionItems.id });
  if (!claimed) return { sent: 0, failed: 0 };

  const [auction] = await db.select({
    id: auctionItems.id,
    startTime: auctionItems.startTime,
    endTime: auctionItems.endTime,
    startingBid: auctionItems.startingBid,
    depositAmount: auctionItems.depositAmount,
    biddingFee: auctionItems.biddingFee,
    title: assets.title,
    description: assets.description,
    category: assets.category,
    clientName: assets.clientName,
    listingType: assets.listingType,
    auctioneerName: users.name,
    auctioneerEmail: users.email,
    businessName: users.businessName,
  }).from(auctionItems)
    .innerJoin(assets, eq(auctionItems.assetId, assets.id))
    .innerJoin(users, eq(assets.createdById, users.id))
    .where(eq(auctionItems.id, id))
    .limit(1);
  if (!auction || auction.listingType !== "AUCTION") return { sent: 0, failed: 0 };

  const bidders = await db.select({ name: users.name, email: users.email })
    .from(users).where(eq(users.role, "BIDDER"));

  const rows = [
    ["Auction", auction.title],
    ["Category", String(auction.category || "").replaceAll("_", " ")],
    ["Description", auction.description],
    ["Auctioneer", auction.businessName ? `${auction.auctioneerName} (${auction.businessName})` : auction.auctioneerName],
    ["Starts", formatDateTime(auction.startTime)],
    ["Ends", formatDateTime(auction.endTime)],
    ["Starting bid", formatMwk(auction.startingBid)],
    ["Entry fee", formatMwk(auction.depositAmount)],
    ["Bidding deposit", formatMwk(auction.biddingFee)],
  ];
  const cta = { label: "View auction", url: `${getAppUrl()}/dashboard?tab=live-auctions` };

  const recipients = [
    { name: auction.auctioneerName, email: auction.auctioneerEmail, own: true },
    ...bidders.filter((bidder) => bidder.email && bidder.email !== auction.auctioneerEmail),
  ];

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const results = await Promise.allSettled(recipients.slice(i, i + BATCH_SIZE).map((recipient) => {
      const { html, text } = renderEmail({
        heading: recipient.own ? "Your auction has been listed" : "New auction listed on TrustBid",
        intro: recipient.own
          ? `Hello ${recipient.name},\n\nYour auction was listed successfully. Here are the details bidders will see.`
          : `Hello ${recipient.name},\n\nA new auction has been scheduled. Register, pay the entry fee and bidding deposit, and join when it starts.`,
        rows, cta,
      });
      return sendEmail({ to: recipient.email, subject: `New auction: ${auction.title}`, text, html });
    }));
    for (const result of results) {
      if (result.status === "fulfilled") sent += 1;
      else { failed += 1; console.error("[Auction listed email]", result.reason?.message || result.reason); }
    }
  }
  return { sent, failed };
}
