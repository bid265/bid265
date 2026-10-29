"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Package,
  Home,
  Search,
  MapPin,
  Tag,
  User,
  Gavel,
  Clock,
  ShoppingBag,
  X,
  Filter,
  ChevronDown,
} from "lucide-react";
import { formatDate } from "@/lib/payments";
import { fetchUserProfile, initiatePayment, parseName } from "@/lib/payments";
import { startListingPurchase } from "@/app/actions/listingPurchase";

const CALLBACK_URL = process.env.NEXT_PUBLIC_PAYCHANGU_CALLBACK_URL;

/**
 * 🛍 BIDDER MARKETPLACE TABS
 *
 * Document requirements:
 *  - Daily Sales tab → regular sold commodities, searchable across all auctioneers.
 *  - Properties tab  → land & buildings, searchable by location.
 */
export default function BidderMarketplace({ initialTab = "daily-sales", initialCategory = "", initialQuery = "" }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [activeTab, setActiveTab] = useState(["properties", "auctions"].includes(initialTab) ? initialTab : "daily-sales");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [locationQuery, setLocationQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [auctioneerId, setAuctioneerId] = useState("");
  const [listingType, setListingType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [auctioneers, setAuctioneers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [authPrompt, setAuthPrompt] = useState(false);
  const [purchasingId, setPurchasingId] = useState(null);

  const handlePurchase = async (item, kind) => {
    setPurchasingId(item.id);
    setPurchaseError("");
    try {
      const purchase = await startListingPurchase(kind, item.id);
      if (!purchase.success) throw new Error(purchase.error);
      const profile = await fetchUserProfile();
      const { firstName, lastName } = parseName(profile.name || "");
      const returnUrl = new URL("/dashboard", window.location.origin);
      returnUrl.searchParams.set("tab", "payments");
      const checkout = await initiatePayment({
        amount: purchase.data.amount,
        currency: "MWK",
        tx_ref: purchase.data.paymentRef,
        email: profile.email,
        first_name: firstName,
        last_name: lastName,
        phone: profile.phoneNumber || "",
        method: "card",
        purpose: purchase.data.kind,
        callback_url: CALLBACK_URL,
        return_url: returnUrl.toString(),
      });
      if (!checkout.checkoutUrl) throw new Error("Payment provider did not return a checkout link.");
      window.location.assign(checkout.checkoutUrl);
    } catch (purchaseFailure) {
      const message = purchaseFailure.message || "Could not start purchase.";
      if (message.includes("signed-in bidders")) {
        setAuthPrompt(true);
      } else {
        setPurchaseError(message);
      }
      setPurchasingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ tab: activeTab });
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (category) params.set("category", category);
        if (auctioneerId) params.set("auctioneer", auctioneerId);
        if (locationQuery.trim()) {
          params.set("location", locationQuery.trim());
        }
        if (activeTab === "properties" && listingType) params.set("listingType", listingType);
        if (minPrice !== "") params.set("minPrice", minPrice);
        if (maxPrice !== "") params.set("maxPrice", maxPrice);

        const res = await fetch(`/api/marketplace?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || "Failed to load listings");
        if (!cancelled) {
          setItems(json.items || []);
          setCategories(json.categories || []);
          setAuctioneers(json.auctioneers || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const debounce = setTimeout(fetchListings, 250);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [activeTab, searchQuery, locationQuery, category, auctioneerId, listingType, minPrice, maxPrice]);

  const formatMoney = (value) =>
    value === null || value === undefined || isNaN(Number(value))
      ? "—"
      : `MK ${Number(value).toLocaleString()}`;

  const formatListingDate = (iso) => (iso ? `Listed ${formatDate(iso)}` : "");

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-[var(--color-bg)] rounded-2xl p-5 sm:p-6 shadow-lg shadow-[var(--color-primary)]/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
              {activeTab === "daily-sales" ? (
                <><ShoppingBag className="w-5 h-5" /> Daily Sales</>
              ) : activeTab === "properties" ? (
                <><Home className="w-5 h-5" /> Properties</>
              ) : (
                <><Gavel className="w-5 h-5" /> Auctions</>
              )}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--color-bg)]/70 max-w-xl leading-relaxed">
              {activeTab === "daily-sales"
                ? "Browse regular sold commodities — goods uploaded for quick daily sales by every auctioneer on the system."
                : activeTab === "properties"
                  ? "Explore land and buildings from all registered auctioneers. Filter by price, location, category, auctioneer, and sale or lease."
                  : "Browse scheduled and live auctions. Sign in as a bidder to join and place bids."}
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-5 py-3 shrink-0 self-start sm:self-center">
            <span className="block text-xl sm:text-2xl font-black leading-none text-center">{items.length}</span>
            <span className="text-[9px] uppercase tracking-wider font-bold mt-1 block opacity-70 text-center">Listings</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-1.5 w-fit">
        <button
          onClick={() => setActiveTab("daily-sales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "daily-sales"
              ? "bg-[var(--color-secondary)] text-white shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Daily Sales
        </button>
        <button
          onClick={() => setActiveTab("properties")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "properties"
              ? "bg-[var(--color-secondary)] text-white shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Home className="w-3.5 h-3.5" /> Properties
        </button>
        <button
          onClick={() => setActiveTab("auctions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "auctions"
              ? "bg-[var(--color-secondary)] text-white shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Gavel className="w-3.5 h-3.5" /> Auctions
        </button>
      </div>

      {/* Search and expandable filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder={activeTab === "daily-sales" ? "Search goods..." : "Search listings..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="marketplace-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)]/50"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {filtersOpen && (
          <div id="marketplace-filters" className="overflow-x-auto pb-1">
            <div className="flex min-w-max flex-nowrap gap-2">
              <div className="relative w-40 shrink-0">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-primary)]" />
                <input
                  type="text"
                  aria-label="Filter by location"
                  placeholder="Location"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category" className="w-40 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                <option value="">All categories</option>
                {categories.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}
              </select>
              <select value={auctioneerId} onChange={(event) => setAuctioneerId(event.target.value)} aria-label="Filter by auctioneer" className="w-44 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                <option value="">All auctioneers</option>
                {auctioneers.map((auctioneer) => <option key={auctioneer.id} value={auctioneer.id}>{auctioneer.name}</option>)}
              </select>
              {activeTab === "properties" && (
                <select value={listingType} onChange={(event) => setListingType(event.target.value)} aria-label="Filter by listing type" className="w-40 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="">Sale or lease</option>
                  <option value="SALE">For sale</option>
                  <option value="LEASE">For lease</option>
                </select>
              )}
              <input aria-label="Minimum price" type="number" min="0" placeholder="Min price" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="w-32 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]" />
              <input aria-label="Maximum price" type="number" min="0" placeholder="Max price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="w-32 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]" />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 animate-pulse">
              <div className="h-40 bg-[var(--color-input)] rounded-xl mb-4" />
              <div className="h-4 bg-[var(--color-input)] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[var(--color-input)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-[var(--color-card)] border border-red-500/20 rounded-2xl p-8 text-center">
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--color-card)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
          {activeTab === "daily-sales" ? (
            <Package className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4 opacity-50" />
          ) : activeTab === "properties" ? (
            <Home className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4 opacity-50" />
          ) : (
            <Gavel className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4 opacity-50" />
          )}
          <p className="text-sm text-[var(--color-muted)] font-medium">
            {searchQuery || locationQuery || category || auctioneerId || minPrice || maxPrice || listingType
              ? "No listings match your search. Try different keywords."
              : "No listings published yet. Check back soon!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm flex flex-col group hover:border-[var(--color-primary)]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-primary)]/5"
            >
              <div className="relative h-44 w-full overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-card)] to-[var(--color-input)]">
                    {activeTab === "daily-sales" ? (
                      <Package className="w-10 h-10 text-[var(--color-muted)] opacity-30" />
                    ) : activeTab === "properties" ? (
                      <Home className="w-10 h-10 text-[var(--color-muted)] opacity-30" />
                    ) : (
                      <Gavel className="w-10 h-10 text-[var(--color-muted)] opacity-30" />
                    )}
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[var(--color-secondary)] text-white">
                    {activeTab === "properties" && item.listingType === "LEASE"
                      ? "FOR LEASE"
                      : activeTab === "properties" && item.listingType === "SALE"
                        ? "FOR SALE"
                        : item.category || (activeTab === "daily-sales" ? "GOOD" : "PROPERTY")}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="bg-[var(--color-bg)]/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-[var(--color-border)]">
                    <Clock className="w-3 h-3 text-[var(--color-primary)]" />
                    {formatListingDate(item.createdAt)}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-[var(--color-muted)] line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                {item.attributes?.["Plot Area (GPS)"] && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text)]">
                    <MapPin className="w-3 h-3 text-[var(--color-primary)]" />
                    Plot area: {item.attributes["Plot Area (GPS)"]}
                  </div>
                )}

                <div className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                  <User className="w-3 h-3 text-[var(--color-primary)]" />
                  Client: {item.clientName || item.location || "N/A"}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] mt-auto">
                  <User className="w-3 h-3" />
                  {item.auctioneerName}
                </div>

                <div className="flex items-end justify-between pt-2 border-t border-[var(--color-border)] mt-1">
                  <div>
                    <p className="text-[10px] text-[var(--color-muted)] mb-0.5">
                      {activeTab === "daily-sales"
                        ? "Buy Now Price"
                        : item.listingType === "LEASE"
                          ? "Rent per Month"
                          : item.listingType === "SALE"
                            ? "Asking Price"
                            : item.currentBid ? "Current Bid" : "Starting Bid"}
                    </p>
                    <p className="text-base font-extrabold text-[var(--color-primary)]">
                      {formatMoney(activeTab === "daily-sales"
                        ? item.price
                        : item.listingType === "LEASE"
                          ? item.monthlyRent
                          : item.listingType === "SALE"
                            ? item.askingPrice
                            : (item.currentBid || item.startingBid))}
                      {item.listingType === "LEASE" && <span className="ml-1 text-[10px] font-semibold">/ month</span>}
                    </p>
                  </div>
                  {activeTab === "auctions" ? (
                    <button
                      onClick={() => {
                        const destination = "/dashboard?tab=live-auctions";
                        router.push(session?.user
                          ? destination
                          : `/login?callbackUrl=${encodeURIComponent(destination)}`);
                      }}
                      disabled={sessionStatus === "loading"}
                      className="flex items-center gap-1 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-[11px] font-bold text-white"
                    >
                      <Gavel className="h-3.5 w-3.5" /> {session?.user ? "View and bid" : "Sign in to bid"}
                    </button>
                  ) : activeTab === "properties" && item.listingType === "AUCTION" && item.auctionItemId ? (
                    <button
                      onClick={() => router.push("/dashboard?tab=live-auctions")}
                      className="flex items-center gap-1 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-[11px] font-bold transition-all active:scale-95"
                    >
                      <Gavel className="w-3.5 h-3.5" /> Bid
                    </button>
                  ) : activeTab === "daily-sales" || (activeTab === "properties" && item.listingType === "SALE") ? (
                    <button
                      onClick={() => handlePurchase(item, activeTab === "daily-sales" ? "DAILY_SALE" : "PROPERTY")}
                      disabled={purchasingId === item.id}
                      className="flex items-center gap-1 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-[11px] font-bold disabled:opacity-50"
                    >
                      <Tag className="w-3.5 h-3.5" /> {purchasingId === item.id ? "Starting..." : "Buy Now"}
                    </button>
                  ) : activeTab === "properties" && item.listingType === "LEASE" ? (
                    <button
                      onClick={() => handlePurchase(item, "PROPERTY_RENT")}
                      disabled={purchasingId === item.id}
                      className="flex items-center gap-1 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-[11px] font-bold disabled:opacity-50"
                    >
                      <Tag className="w-3.5 h-3.5" /> {purchasingId === item.id ? "Starting..." : "Pay Rent"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {purchaseError && <p className="text-sm text-red-400" role="alert">{purchaseError}</p>}
      {authPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-auth-title">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 id="purchase-auth-title" className="text-lg font-bold text-[var(--color-text)]">Sign in to continue</h2>
            <p className="text-sm text-[var(--color-muted)]">Create a bidder account or sign in before purchasing this listing.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAuthPrompt(false)} className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)} className="flex-1 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-white">Sign in</button>
              <button type="button" onClick={() => router.push(`/signup?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)} className="flex-1 rounded-xl bg-[var(--color-secondary)] px-3 py-2 text-sm font-bold text-white">Register</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
