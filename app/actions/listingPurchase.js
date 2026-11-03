"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assets, dailySales, sales } from "@/lib/db/schema";
import { and, eq, gt, inArray, sql } from "drizzle-orm";

export async function startListingPurchase(kind, listingId) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BIDDER") {
    return { success: false, error: "Only signed-in bidders can purchase listings." };
  }

  const id = Number(listingId);
  if (!Number.isInteger(id) || id <= 0 || !["DAILY_SALE", "PROPERTY", "PROPERTY_RENT"].includes(kind)) {
    return { success: false, error: "Invalid listing purchase request." };
  }

  try {
    const result = await db.transaction(async (tx) => {
      let asset;
      let dailySaleId = null;
      let amount;

      if (kind === "DAILY_SALE") {
        const [sale] = await tx.select().from(dailySales)
          .where(eq(dailySales.id, id))
          .limit(1);
        if (!sale) throw new Error("Daily sale listing not found.");

        const [pending] = await tx.select().from(sales).where(and(
          eq(sales.buyerId, Number(session.user.id)),
          eq(sales.dailySaleId, sale.id),
          eq(sales.status, "PENDING"),
        )).limit(1);
        if (pending) {
          return { amount: Number(pending.amount), paymentRef: pending.paymentRef, kind: pending.kind, title: "Daily sale purchase" };
        }
        if (!sale.isAvailable || sale.stockCount <= 0) {
          throw new Error("This daily sale listing is no longer available.");
        }

        const [reserved] = await tx.update(dailySales)
          .set({ stockCount: sale.stockCount - 1, isAvailable: sale.stockCount > 1 })
          .where(and(eq(dailySales.id, sale.id), eq(dailySales.isAvailable, true), gt(dailySales.stockCount, 0)))
          .returning();
        if (!reserved) throw new Error("This daily sale listing just sold out.");
        dailySaleId = sale.id;
        amount = Number(sale.price);
        [asset] = await tx.select().from(assets).where(eq(assets.id, sale.assetId)).limit(1);
      } else if (kind === "PROPERTY") {
        [asset] = await tx.select().from(assets).where(and(
          eq(assets.id, id),
          eq(assets.salesType, "PROPERTY"),
          eq(assets.listingType, "SALE"),
          eq(assets.isSold, false),
        )).limit(1);
        if (!asset) throw new Error("This property is not available for purchase.");

        const [pending] = await tx.select().from(sales).where(and(
          eq(sales.buyerId, Number(session.user.id)),
          eq(sales.assetId, asset.id),
          eq(sales.status, "PENDING"),
        )).limit(1);
        if (pending) {
          return { amount: Number(pending.amount), paymentRef: pending.paymentRef, kind: pending.kind, title: asset.title };
        }
        const [otherPending] = await tx.select({ id: sales.id }).from(sales).where(and(
          eq(sales.assetId, asset.id),
          eq(sales.status, "PENDING"),
        )).limit(1);
        if (otherPending) throw new Error("A purchase for this property is already being processed.");
        amount = Number(asset.salePrice);
      } else {
        [asset] = await tx.select().from(assets).where(and(
          eq(assets.id, id),
          eq(assets.salesType, "PROPERTY"),
          eq(assets.listingType, "LEASE"),
          eq(assets.isSold, false),
        )).limit(1);
        if (!asset) throw new Error("This lease listing is no longer available.");

        const [pending] = await tx.select().from(sales).where(and(
          eq(sales.buyerId, Number(session.user.id)),
          eq(sales.assetId, asset.id),
          eq(sales.kind, "PROPERTY_RENT"),
          eq(sales.status, "PENDING"),
        )).limit(1);
        if (pending) {
          return { amount: Number(pending.amount), paymentRef: pending.paymentRef, kind: pending.kind, title: asset.title };
        }
        amount = Number(asset.monthlyRent);
      }

      if (!asset || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("This listing has invalid purchase details.");
      }

      const paymentRef = `BID265-${randomUUID()}`;
      const purchaseKind = kind === "DAILY_SALE"
        ? "DAILY_SALE_PURCHASE"
        : kind === "PROPERTY"
          ? "PROPERTY_PURCHASE"
          : "PROPERTY_RENT";
      await tx.insert(sales).values({
        assetId: asset.id,
        dailySaleId,
        buyerId: Number(session.user.id),
        sellerId: asset.createdById,
        kind: purchaseKind,
        quantity: 1,
        amount: String(amount),
        paymentRef,
      });

      return { amount, paymentRef, kind: purchaseKind, title: asset.title };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[Listing purchase]", error);
    return { success: false, error: error.message || "Could not start this purchase." };
  }
}

export async function startDailySaleCartPurchase(listingIds) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BIDDER") {
    return { success: false, error: "Only signed-in bidders can purchase listings." };
  }

  const ids = Array.isArray(listingIds) ? [...new Set(listingIds.map(Number))] : [];
  if (!ids.length || ids.length > 20 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { success: false, error: "Your cart must contain between 1 and 20 valid daily sale listings." };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: sales.id }).from(sales).where(and(
        eq(sales.buyerId, Number(session.user.id)),
        inArray(sales.dailySaleId, ids),
        eq(sales.kind, "DAILY_SALE_PURCHASE"),
        eq(sales.status, "PENDING"),
      )).limit(1);
      if (existing.length) {
        throw new Error("A purchase for one of these goods is already being processed.");
      }

      const paymentRef = `BID265-${randomUUID()}`;
      let total = 0;
      for (const id of ids) {
        const [sale] = await tx.select().from(dailySales).where(eq(dailySales.id, id)).limit(1);
        if (!sale || !sale.isAvailable || sale.stockCount <= 0) {
          throw new Error("One or more goods in your cart are no longer available.");
        }

        const [reserved] = await tx.update(dailySales)
          .set({
            stockCount: sql`${dailySales.stockCount} - 1`,
            isAvailable: sql`${dailySales.stockCount} > 1`,
          })
          .where(and(eq(dailySales.id, id), eq(dailySales.isAvailable, true), gt(dailySales.stockCount, 0)))
          .returning();
        if (!reserved) throw new Error("One or more goods in your cart just sold out.");

        const [asset] = await tx.select().from(assets).where(eq(assets.id, sale.assetId)).limit(1);
        const amount = Number(sale.price);
        if (!asset || !Number.isFinite(amount) || amount <= 0) {
          throw new Error("A listing in your cart has invalid purchase details.");
        }

        await tx.insert(sales).values({
          assetId: asset.id,
          dailySaleId: sale.id,
          buyerId: Number(session.user.id),
          sellerId: asset.createdById,
          kind: "DAILY_SALE_PURCHASE",
          quantity: 1,
          amount: String(amount),
          paymentRef,
        });
        total += amount;
      }

      return { amount: total, paymentRef, kind: "DAILY_SALE_PURCHASE" };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[Daily sale cart purchase]", error);
    return { success: false, error: error.message || "Could not start this purchase." };
  }
}
