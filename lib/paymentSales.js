import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, dailySales, sales } from "@/lib/db/schema";

export async function syncListingSalePayment(paymentRef, paymentStatus) {
  const status = paymentStatus === "completed" ? "PAID" : paymentStatus === "failed" ? "FAILED" : "PENDING";
  if (status === "PENDING") return;

  await db.transaction(async (tx) => {
    const purchases = await tx.update(sales).set({
      status,
      paidAt: status === "PAID" ? new Date() : null,
    }).where(and(eq(sales.paymentRef, paymentRef), eq(sales.status, "PENDING"))).returning();
    if (!purchases.length) return;

    for (const purchase of purchases) {
      if (purchase.dailySaleId && status === "FAILED") {
        await tx.update(dailySales).set({
          stockCount: sql`${dailySales.stockCount} + ${purchase.quantity}`,
          isAvailable: true,
        }).where(eq(dailySales.id, purchase.dailySaleId));
      } else if (status === "PAID" && purchase.kind === "PROPERTY_PURCHASE") {
        await tx.update(assets).set({ isSold: true }).where(eq(assets.id, purchase.assetId));
      }
    }
  });
}
