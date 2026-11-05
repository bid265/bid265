import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets, auctionItems, bids, dailySales, sales } from "@/lib/db/schema";
import { and, desc, eq, gt, ilike, inArray, or } from "drizzle-orm";

/**
 * GET /api/marketplace?tab=daily-sales|properties&q=search+term
 *
 * Bidder-facing marketplace feed:
 *  - tab=daily-sales  → regular sold commodities / goods (DAILY_SALE listings)
 *  - tab=properties   → land & buildings (PROPERTY listings), searchable by location
 *
 * Both tabs search across ALL auctioneers registered on the system.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTab = searchParams.get("tab");
    const tab = ["properties", "auctions"].includes(requestedTab) ? requestedTab : "daily-sales";
    const q = (searchParams.get("q") || "").trim();
    const locationFilter = (searchParams.get("location") || "").trim();
    const categoryFilter = (searchParams.get("category") || "").trim();
    const auctioneerFilter = (searchParams.get("auctioneer") || "").trim();
    const listingTypeFilter = (searchParams.get("listingType") || "").trim().toUpperCase();
    const minPrice = searchParams.has("minPrice") ? Number(searchParams.get("minPrice")) : null;
    const maxPrice = searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : null;
    if (
      (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== null && maxPrice !== null && minPrice > maxPrice)
    ) {
      return NextResponse.json({ error: "Price filters must be non-negative numbers, with minimum no greater than maximum." }, { status: 400 });
    }
    const matchesFilters = (item, price) =>
      (!categoryFilter || item.category?.toLowerCase() === categoryFilter.toLowerCase()) &&
      (!auctioneerFilter || String(item.auctioneerId) === auctioneerFilter) &&
      (!locationFilter || item.location?.toLowerCase().includes(locationFilter.toLowerCase())) &&
      (price !== null && price !== undefined || minPrice === null && maxPrice === null) &&
      (minPrice === null || Number(price) >= minPrice) &&
      (maxPrice === null || Number(price) <= maxPrice);

    const searchFilter = q ? or(
      ilike(assets.title, `%${q}%`),
      ilike(assets.description, `%${q}%`),
      ilike(assets.category, `%${q}%`),
      ilike(assets.location, `%${q}%`),
    ) : undefined;

    // ── DAILY SALES: regular sold commodities (goods) across all auctioneers ──
    if (tab === "auctions") {
      const auctionRows = await db.query.auctionItems.findMany({
        where: and(
          inArray(auctionItems.status, ["UPCOMING", "ACTIVE", "LIVE"]),
          gt(auctionItems.endTime, new Date()),
        ),
        with: {
          asset: { with: { createdBy: { columns: { id: true, name: true } } } },
          images: { where: (image, { eq }) => eq(image.isPrimary, true), limit: 1 },
          bids: { orderBy: [desc(bids.amount)], limit: 1 },
        },
        orderBy: [desc(auctionItems.startTime)],
      });
      const available = auctionRows.filter((item) =>
        item.asset?.listingType === "AUCTION" && item.asset.isListed && !item.asset.isSold
      );
      const items = available.map((item) => ({
        id: item.id,
        assetId: item.asset.id,
        title: item.asset.title,
        description: item.asset.description,
        category: item.asset.category,
        location: item.asset.location,
        startingBid: Number(item.startingBid),
        currentBid: item.bids[0] ? Number(item.bids[0].amount) : null,
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
        viewingDate: item.viewingDate?.toISOString() || null,
        status: item.status,
        imageUrl: item.images[0]?.url || null,
        auctioneerName: item.asset.createdBy?.name || "Verified Auctioneer",
        auctioneerId: item.asset.createdBy?.id || null,
        createdAt: item.createdAt.toISOString(),
        kind: "AUCTION",
      })).filter((item) =>
        (!searchFilter || [item.title, item.description, item.category, item.location].join(" ").toLowerCase().includes(q.toLowerCase())) &&
        matchesFilters(item, item.currentBid ?? item.startingBid)
      );
      return NextResponse.json({
        success: true,
        tab,
        count: items.length,
        categories: [...new Set(available.map((item) => item.asset.category).filter(Boolean))].sort(),
        auctioneers: [...new Map(available.map((item) => [item.asset.createdBy?.id, item.asset.createdBy?.name]).filter(([id, name]) => id && name)).entries()]
          .map(([id, name]) => ({ id, name })),
        items,
      });
    }

    if (tab === "daily-sales") {
      const dailySaleRows = await db.query.dailySales.findMany({
        where: eq(dailySales.isAvailable, true),
        with: {
          asset: {
            with: {
              createdBy: { columns: { id: true, name: true, email: true, district: true } },
              auctionItems: {
                with: { images: { where: (image, { eq }) => eq(image.isPrimary, true), limit: 1 } },
              },
            },
          },
        },
        orderBy: [desc(dailySales.createdAt)],
      });

      const items = dailySaleRows
        .filter((sale) => sale.asset && sale.asset.isListed && !sale.asset.isSold && sale.asset.salesType === "DAILY_SALE")
        .filter((sale) => {
          if (!searchFilter) return true;
          const haystack = [
            sale.asset.title,
            sale.asset.description,
            sale.asset.category,
            sale.asset.location,
          ].join(" ").toLowerCase();
          return haystack.includes(q.toLowerCase());
        })
        .map((sale) => {
          const primaryImage =
            sale.asset.auctionItems?.flatMap((ai) => ai.images || [])[0]?.url || null;
          const auctioneerDistrict = sale.asset.createdBy?.district || sale.asset.location || "Unknown district";
          return {
            id: sale.id,
            assetId: sale.asset.id,
            title: sale.asset.title,
            description: sale.asset.description,
            category: sale.asset.category,
            clientName: sale.asset.clientName || sale.asset.location,
            price: Number(sale.price),
            stockCount: sale.stockCount,
            attributes: sale.asset.attributes || {},
            imageUrl: primaryImage,
            auctioneerName: sale.asset.createdBy?.name || "Verified Auctioneer",
            auctioneerId: sale.asset.createdBy?.id || null,
            location: auctioneerDistrict,
            createdAt: sale.createdAt.toISOString(),
            kind: "DAILY_SALE",
          };
        })
        .filter((item) => matchesFilters(item, item.price));

      return NextResponse.json({
        success: true,
        tab,
        count: items.length,
        categories: [...new Set(dailySaleRows.map((sale) => sale.asset?.category).filter(Boolean))].sort(),
        auctioneers: [...new Map(dailySaleRows.filter((sale) => sale.asset?.createdBy).map((sale) => [sale.asset.createdBy.id, sale.asset.createdBy.name])).entries()]
          .map(([id, name]) => ({ id, name })),
        items,
      });
    }

    // ── PROPERTIES: sale and lease listings; auctions are shown on the auction floor ──
    const pendingPropertyPurchases = await db.select({ assetId: sales.assetId }).from(sales)
      .where(and(eq(sales.kind, "PROPERTY_PURCHASE"), eq(sales.status, "PENDING")));
    const pendingPropertyIds = new Set(pendingPropertyPurchases.map((purchase) => purchase.assetId));
    const properties = await db.query.assets.findMany({
      where: and(
        eq(assets.isListed, true),
        eq(assets.isSold, false),
        eq(assets.salesType, "PROPERTY"),
        inArray(assets.listingType, ["SALE", "LEASE"]),
        ...(searchFilter ? [searchFilter] : []),
        ...(locationFilter ? [ilike(assets.location, `%${locationFilter}%`)] : []),
      ),
      with: {
        createdBy: { columns: { id: true, name: true, email: true } },
        auctionItems: {
          with: {
            images: { where: (image, { eq }) => eq(image.isPrimary, true), limit: 1 },
            bids: { orderBy: [desc(bids.amount)], limit: 1 },
          },
        },
      },
      orderBy: [desc(assets.createdAt)],
    });

    const items = properties.filter((asset) => !pendingPropertyIds.has(asset.id)).map((asset) => {
      const liveAuction =
        asset.auctionItems.find((ai) => ai.status === "ACTIVE" || ai.status === "UPCOMING") ||
        asset.auctionItems[0] ||
        null;

      return {
        id: asset.id,
      auctionItemId: asset.listingType === "AUCTION" ? liveAuction?.id || null : null,
        title: asset.title,
        description: asset.description,
        category: asset.category,
      clientName: asset.clientName || asset.location,
      listingType: asset.listingType || "AUCTION",
      askingPrice: asset.salePrice ? Number(asset.salePrice) : null,
      monthlyRent: asset.monthlyRent ? Number(asset.monthlyRent) : null,
      rentDueDay: asset.rentDueDay,
      startingBid: asset.listingType === "AUCTION" && liveAuction ? Number(liveAuction.startingBid) : null,
      viewingDate: asset.listingType === "AUCTION" ? liveAuction?.viewingDate?.toISOString() || null : null,
        currentBid: liveAuction?.bids?.[0] ? Number(liveAuction.bids[0].amount) : null,
        auctionStatus: liveAuction?.status || null,
        biddingFee: liveAuction ? Number(liveAuction.biddingFee) : 0,
        depositAmount: liveAuction ? Number(liveAuction.depositAmount) : 0,
        imageUrl: liveAuction?.images?.[0]?.url || null,
        attributes: asset.attributes || {},
        auctioneerName: asset.createdBy?.name || "Verified Auctioneer",
        auctioneerId: asset.createdBy?.id || null,
        location: asset.location,
        createdAt: asset.createdAt.toISOString(),
        kind: "PROPERTY",
      };
    }).filter((item) =>
      (!listingTypeFilter || item.listingType === listingTypeFilter) &&
      matchesFilters(item, item.listingType === "LEASE" ? item.monthlyRent : item.askingPrice)
    );

    return NextResponse.json({
      success: true,
      tab,
      count: items.length,
      categories: [...new Set(properties.map((asset) => asset.category).filter(Boolean))].sort(),
      auctioneers: [...new Map(properties.filter((asset) => asset.createdBy).map((asset) => [asset.createdBy.id, asset.createdBy.name])).entries()]
        .map(([id, name]) => ({ id, name })),
      items,
    });
  } catch (error) {
    console.error("[Marketplace API]", error);
    return NextResponse.json(
      { error: error.message || "Failed to load marketplace listings." },
      { status: 500 }
    );
  }
}
