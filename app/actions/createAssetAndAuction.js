"use server";

import { auth } from "../../auth";
import { db } from "@/lib/db";
import { assets, auctionItems } from "@/lib/db/schema";
import { storeAssetImage, validateImageFile } from "@/lib/imageStorage";
import { notifyAuctionListed } from "@/lib/auctionNotifications";
import { after } from "next/server";

export async function createAssetAndAuction(formData) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      throw new Error("Authentication rejected. Please sign in.");
    }

    const title = formData.get("title");
    const description = formData.get("description");
    const clientName = formData.get("clientName");
    const category = formData.get("category");
    const documentUrl = formData.get("documentUrl");
    const listingType = formData.get("listingType") || "AUCTION";
    const startingBid = formData.get("startingBid");
    const reservePrice = formData.get("reservePrice");
    const entryFee = formData.get("entryFee");
    const biddingDeposit = formData.get("biddingDeposit");
    const askingPrice = Number(formData.get("askingPrice"));
    const monthlyRent = Number(formData.get("monthlyRent"));
    const rentDueDay = Number(formData.get("rentDueDay"));
    const requestedStartTime = formData.get("startTime");
    const requestedEndTime = formData.get("endTime");

    if (session.user.role !== "AUCTIONEER" && session.user.role !== "ADMIN") {
      throw new Error("Only auctioneers can create property listings.");
    }
    if (!title || !description || !clientName) {
      throw new Error("Title, description, and client name are required.");
    }
    if (!["AUCTION", "SALE", "LEASE"].includes(listingType)) {
      throw new Error("Invalid property listing type.");
    }
    if (listingType === "AUCTION" && (
      !Number.isFinite(Number(startingBid)) || Number(startingBid) <= 0 ||
      !Number.isFinite(Number(reservePrice)) || Number(reservePrice) <= 0 ||
      !Number.isFinite(Number(entryFee)) || Number(entryFee) <= 0 ||
      !Number.isFinite(Number(biddingDeposit)) || Number(biddingDeposit) <= 0
    )) {
      throw new Error("Enter valid auction prices and fees.");
    }
    if (listingType === "AUCTION" && Number(biddingDeposit) <= Number(startingBid)) {
      throw new Error("Bidding funds/security deposit must exceed the starting bid so bidders can place a bid.");
    }
    let auctionStartTime = new Date();
    let auctionEndTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
    if (listingType === "AUCTION" && (requestedStartTime || requestedEndTime)) {
      auctionStartTime = new Date(requestedStartTime);
      auctionEndTime = new Date(requestedEndTime);
      if (
        Number.isNaN(auctionStartTime.getTime()) ||
        Number.isNaN(auctionEndTime.getTime()) ||
        auctionStartTime <= new Date() ||
        auctionEndTime <= auctionStartTime
      ) {
        throw new Error("Choose a future auction start and an end time after it.");
      }
    }
    if (listingType === "SALE" && (!Number.isFinite(askingPrice) || askingPrice <= 0)) {
      throw new Error("Enter a valid asking price.");
    }
    if (listingType === "LEASE" && (
      !Number.isFinite(monthlyRent) || monthlyRent <= 0 ||
      !Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28
    )) {
      throw new Error("Enter a valid monthly rent and due day (1–28).");
    }
    
    const rawAttributes = formData.get("dynamicAttributes");
    const parsedAttributes = JSON.parse(rawAttributes || "[]");

    const formattedAttributes = {};
    if (Array.isArray(parsedAttributes)) {
      parsedAttributes.forEach(item => {
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
        location: clientName,
        clientName,
        category,
        salesType: "PROPERTY",
        listingType,
        salePrice: listingType === "SALE" ? String(askingPrice) : null,
        monthlyRent: listingType === "LEASE" ? String(monthlyRent) : null,
        rentDueDay: listingType === "LEASE" ? rentDueDay : null,
        attributes: formattedAttributes,
        documentUrl: listingType === "AUCTION" ? (documentUrl || null) : null,
        createdById: Number(session.user.id),
      }).returning();

      const isAuction = listingType === "AUCTION";
      const displayPrice = listingType === "SALE" ? askingPrice : monthlyRent;
      const [newAuctionItem] = await tx.insert(auctionItems).values({
        assetId: newAsset.id,
        startingBid: isAuction ? Number(startingBid) : displayPrice,
        reservePrice: isAuction ? Number(reservePrice) : displayPrice,
        depositAmount: isAuction ? Number(entryFee) : 0,
        biddingFee: isAuction ? Number(biddingDeposit) : 0,
        startTime: isAuction ? auctionStartTime : new Date(),
        endTime: isAuction ? auctionEndTime : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: isAuction ? "UPCOMING" : "CLOSED",
      }).returning();

      await storeAssetImage(tx, newAuctionItem.id, file);

      return { asset: newAsset, auctionItem: newAuctionItem };
    });

    // Announce new auctions by email (description, start/end date and time, fees) after the response.
    if (listingType === "AUCTION" && result.auctionItem) {
      const auctionItemId = result.auctionItem.id;
      after(() => notifyAuctionListed(auctionItemId).catch((error) => console.error("[Auction listed notification]", error)));
    }

    // 🎯 FIX: Sanitize the network payloads completely here before crossing the server boundary
    const serializedData = {
      asset: result.asset ? {
        ...result.asset,
        createdAt: result.asset.createdAt.toISOString(),
        updatedAt: result.asset.updatedAt.toISOString(),
      } : null,
      auctionItem: result.auctionItem ? {
        ...result.auctionItem,
        // Pull Decimal types safely into standard primitive floats / numbers
        startingBid: Number(result.auctionItem.startingBid),
        reservePrice: Number(result.auctionItem.reservePrice),
        depositAmount: Number(result.auctionItem.depositAmount),
        biddingFee: Number(result.auctionItem.biddingFee),
        // Coerce Date objects to explicit plain strings
        startTime: result.auctionItem.startTime.toISOString(),
        endTime: result.auctionItem.endTime.toISOString(),
        createdAt: result.auctionItem.createdAt.toISOString(),
        updatedAt: result.auctionItem.updatedAt.toISOString(),
      } : null
    };

    // Return the clean, lightweight, native object to your Client Component layout safely!
    return { success: true, data: serializedData };

  } catch (error) {
    console.error("❌ Action Failure:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to finalize database updates.",
    };
  }
}