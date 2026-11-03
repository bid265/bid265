"use server";

import { auth } from "../../auth";
import { db } from "@/lib/db";
import { assets, auctionItems, dailySales, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { storeAssetImage, validateImageFile } from "@/lib/imageStorage";

/**
 * 🛒 DAILY SALES LISTING ENGINE (auctioneer side)
 * Creates a DAILY_SALE asset + daily sale record with a fixed buy-now price.
 */
export async function createDailySaleListing(formData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication rejected. Please sign in." };
    }

    const role = session.user.role;
    if (role !== "AUCTIONEER" && role !== "ADMIN") {
      return { success: false, error: "Only auctioneers can publish daily sale listings." };
    }

    const title = formData.get("title");
    const description = formData.get("description");
    const category = formData.get("category");
    const price = parseFloat(formData.get("price"));
    const stockCount = parseInt(formData.get("stockCount") || "1", 10);
    const rawAttributes = formData.get("dynamicAttributes");
    const parsedAttributes = JSON.parse(rawAttributes || "[]");
    const auctioneer = await db.query.users.findFirst({
      where: eq(users.id, Number(session.user.id)),
      columns: { name: true, district: true },
    });
    const auctioneerName = auctioneer?.name || session.user.name || "Auctioneer";
    const auctioneerDistrict = auctioneer?.district || "Unknown district";

    if (!title || !description || isNaN(price) || price <= 0) {
      return { success: false, error: "Title, description, and a valid price are required." };
    }

    const formattedAttributes = {};
    if (Array.isArray(parsedAttributes)) {
      parsedAttributes.forEach((item) => {
        if (item.key && item.key.trim() !== "") {
          formattedAttributes[item.key.trim()] = item.value;
        }
      });
    }

    const file = formData.get("assetImageFile");
    validateImageFile(file);

    const result = await db.transaction(async (tx) => {
      const [newAsset] = await tx.insert(assets).values({
        title,
        description,
        location: auctioneerDistrict,
        clientName: auctioneerName,
        category: category || "OTHER",
        salesType: "DAILY_SALE",
        listingType: "SALE",
        salePrice: price,
        attributes: formattedAttributes,
        documentUrl: null,
        createdById: Number(session.user.id),
      }).returning();

      const [dailySale] = await tx.insert(dailySales).values({
        assetId: newAsset.id,
        price,
        stockCount: isNaN(stockCount) ? 1 : Math.max(1, stockCount),
        isAvailable: true,
      }).returning();

      // Daily sales keep their photo on a lightweight auction item shell
      // so the existing image pipeline renders them everywhere.
      const [auctionItem] = await tx.insert(auctionItems).values({
        assetId: newAsset.id,
        startingBid: price,
        reservePrice: price,
        depositAmount: 0,
        biddingFee: 0,
        endTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "CLOSED",
      }).returning({ id: auctionItems.id });
      await storeAssetImage(tx, auctionItem.id, file);

      return { asset: newAsset, dailySale };
    });

    return {
      success: true,
      data: {
        assetId: result.asset.id,
        dailySaleId: result.dailySale.id,
      },
    };
  } catch (error) {
    console.error("❌ Daily sale creation failure:", error);
    return { success: false, error: error.message || "Failed to publish daily sale listing." };
  }
}

/**
 * Toggle availability of a daily sale (sell out / restock).
 */
export async function toggleDailySaleAvailability(dailySaleId, isAvailable) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "AUCTIONEER" && session.user.role !== "ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const id = Number(dailySaleId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: "Invalid daily sale listing." };
    }

    const listing = await db.query.dailySales.findFirst({
      where: eq(dailySales.id, id),
      with: { asset: { columns: { createdById: true, salesType: true, isListed: true } } },
    });
    if (!listing || listing.asset?.salesType !== "DAILY_SALE" || !listing.asset.isListed) {
      return { success: false, error: "Daily sale listing not found." };
    }
    if (session.user.role !== "ADMIN" && listing.asset.createdById !== Number(session.user.id)) {
      return { success: false, error: "You can only manage your own daily sale listings." };
    }
    if (Boolean(isAvailable) && listing.stockCount < 1) {
      return { success: false, error: "Add stock by editing this listing before making it available." };
    }

    const [updated] = await db.update(dailySales)
      .set({ isAvailable: Boolean(isAvailable) })
      .where(eq(dailySales.id, id))
      .returning({ id: dailySales.id, isAvailable: dailySales.isAvailable });

    if (!updated) {
      return { success: false, error: "Daily sale listing could not be updated." };
    }
    return { success: true, data: { id: updated.id, isAvailable: updated.isAvailable } };
  } catch (error) {
    return { success: false, error: error.message || "Failed to update daily sale." };
  }
}
