"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Edit2,
  Filter,
  Gavel,
  Home,
  Loader2,
  MapPin,
  PackageCheck,
  PackageX,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { deleteListing, reuseAuction, updateListingDetails } from "@/app/actions/manageListings";
import { toggleDailySaleAvailability } from "@/app/actions/createDailySale";
import { formatDateOnly } from "@/lib/dateFormatting";

const inputClass = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";

export default function AuctioneerManageAssets({ initialTab = "daily-sales" }) {
  const router = useRouter();
  const isDailySales = initialTab === "daily-sales";
  const isAuctions = initialTab === "auctions";
  const [dailySales, setDailySales] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [editError, setEditError] = useState("");
  const [reuseListing, setReuseListing] = useState(null);
  const [reuseSchedule, setReuseSchedule] = useState({ startTime: "", endTime: "" });

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/listings");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load listings.");
      setDailySales(result.dailySales || []);
      setAuctions(result.auctions || []);
      setProperties(result.properties || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadListings, 0);
    return () => clearTimeout(timer);
  }, [loadListings]);

  const source = isDailySales ? dailySales : isAuctions ? auctions : properties;
  const categories = useMemo(
    () => [...new Set(source.map((listing) => listing.category).filter(Boolean))].sort(),
    [source],
  );
  const visibleListings = useMemo(() => source.filter((listing) => {
    const text = [listing.title, listing.description, listing.clientName, listing.category]
      .filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !search.trim() || text.includes(search.trim().toLowerCase());
    const matchesCategory = !category || listing.category === category;
    const matchesStatus = !status || (isDailySales
      ? (status === "AVAILABLE" ? listing.isAvailable : !listing.isAvailable)
      : isAuctions ? listing.status === status : listing.listingType === status);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [source, search, category, status, isDailySales, isAuctions]);

  const formatMoney = (value) => `MWK ${Number(value || 0).toLocaleString()}`;

  const startEdit = (listing) => {
    setEditError("");
    setEditListing({
      ...listing,
      kind: isDailySales ? "DAILY_SALE" : isAuctions ? "AUCTION" : "PROPERTY",
      price: isDailySales ? listing.price : listing.listingType === "LEASE" ? listing.monthlyRent : listing.askingPrice,
      stockCount: listing.stockCount ?? 1,
      startTimeLocal: listing.startTime ? new Date(new Date(listing.startTime).getTime() - new Date(listing.startTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      endTimeLocal: listing.endTime ? new Date(new Date(listing.endTime).getTime() - new Date(listing.endTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      viewingDateLocal: listing.viewingDate ? new Date(new Date(listing.viewingDate).getTime() - new Date(listing.viewingDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      imageFile: null,
    });
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editListing) return;
    setSaving(true);
    setEditError("");
    try {
      const listingId = editListing.kind === "DAILY_SALE" ? editListing.id
        : editListing.kind === "AUCTION" ? editListing.id : editListing.assetId;
      const details = new FormData();
      for (const key of ["title", "description", "clientName", "category", "price", "stockCount", "rentDueDay", "startingBid", "reservePrice", "entryFee", "biddingDeposit"]) {
        if (editListing[key] !== undefined && editListing[key] !== null) {
          details.append(key, String(editListing[key]));
        }
      }
      if (editListing.startTimeLocal) details.append("startTime", new Date(editListing.startTimeLocal).toISOString());
      if (editListing.endTimeLocal) details.append("endTime", new Date(editListing.endTimeLocal).toISOString());
      if (editListing.kind === "AUCTION" && editListing.viewingDateLocal) {
        details.append("viewingDate", new Date(editListing.viewingDateLocal).toISOString());
      }
      if (editListing.imageFile) details.append("assetImageFile", editListing.imageFile);
      const result = await updateListingDetails(editListing.kind, listingId, details);
      if (!result.success) throw new Error(result.error || "Could not update listing.");
      setEditListing(null);
      await loadListings();
      router.refresh();
    } catch (saveError) {
      setEditError(saveError.message || "Could not update listing.");
    } finally {
      setSaving(false);
    }
  };

  const startReuse = (listing) => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const toLocalInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16);
    setEditError("");
    setReuseListing(listing);
    setReuseSchedule({ startTime: toLocalInput(start), endTime: toLocalInput(end), viewingDate: toLocalInput(new Date(start.getTime() - 60 * 60 * 1000)) });
  };

  const handleReuse = async (event) => {
    event.preventDefault();
    if (!reuseListing) return;
    setSaving(true);
    setEditError("");
    try {
      const schedule = new FormData();
      schedule.append("startTime", new Date(reuseSchedule.startTime).toISOString());
      schedule.append("endTime", new Date(reuseSchedule.endTime).toISOString());
      schedule.append("viewingDate", new Date(reuseSchedule.viewingDate).toISOString());
      const result = await reuseAuction(reuseListing.id, schedule);
      if (!result.success) throw new Error(result.error || "Could not schedule another auction.");
      setReuseListing(null);
      await loadListings();
      router.refresh();
    } catch (reuseError) {
      setEditError(reuseError.message || "Could not schedule another auction.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Archive "${listing.title}"? It will no longer appear publicly, but its transaction history will be retained.`)) return;
    setBusyId(listing.id);
    try {
      const kind = isDailySales ? "DAILY_SALE" : isAuctions ? "AUCTION" : "PROPERTY";
      const result = await deleteListing(kind, isDailySales || isAuctions ? listing.id : listing.assetId);
      if (!result.success) throw new Error(result.error || "Could not delete listing.");
      if (isDailySales) setDailySales((current) => current.filter((item) => item.id !== listing.id));
      else if (isAuctions) setAuctions((current) => current.filter((item) => item.id !== listing.id));
      else setProperties((current) => current.filter((item) => item.assetId !== listing.assetId));
    } catch (deleteError) {
      window.alert(deleteError.message || "Could not delete listing.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAvailability = async (listing) => {
    setBusyId(listing.id);
    try {
      const result = await toggleDailySaleAvailability(listing.id, !listing.isAvailable);
      if (!result.success) throw new Error(result.error || "Could not update availability.");
      setDailySales((current) => current.map((item) => item.id === listing.id
        ? { ...item, isAvailable: result.data.isAvailable }
        : item));
    } catch (availabilityError) {
      window.alert(availabilityError.message || "Could not update availability.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-text)]">{isDailySales ? "Daily Sales" : isAuctions ? "Manage Auctions" : "Properties"}</h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {isDailySales ? "Search, update, and manage available stock listings." : isAuctions ? "Review and manage active or upcoming auction listings." : "Search, update, and manage property and lease listings."}
          </p>
        </div>
        {!isAuctions && (
          <Link
            href={`/dashboard/add-listing?mode=${isDailySales ? "daily-sale" : "property"}`}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Add listing
          </Link>
        )}
      </header>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${isDailySales ? "daily sales" : "properties"}...`}
              aria-label="Search listings"
              className={`${inputClass} pl-10 pr-10`}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="auctioneer-listing-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)]"
          >
            <Filter className="h-4 w-4" /> Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {filtersOpen && (
          <div id="auctioneer-listing-filters" className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category" className={`${inputClass} w-44`}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {isDailySales ? (
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by availability" className={`${inputClass} w-40`}>
                  <option value="">All stock</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="SOLD_OUT">Sold out</option>
                </select>
              ) : isAuctions ? (
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by auction status" className={`${inputClass} w-40`}>
                  <option value="">All auction statuses</option>
                  {[...new Set(auctions.map((item) => item.status))].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : (
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by listing type" className={`${inputClass} w-40`}>
                  <option value="">Sale or lease</option>
                  <option value="SALE">For sale</option>
                  <option value="LEASE">For lease</option>
                </select>
              )}
              <button type="button" onClick={() => { setSearch(""); setCategory(""); setStatus(""); }} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-muted)]">
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[var(--color-primary)]" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-[var(--color-card)] p-6 text-center">
          <p className="mb-3 text-sm text-red-400">{error}</p>
          <button type="button" onClick={loadListings} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : visibleListings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          {isDailySales ? <ShoppingBag className="mx-auto mb-3 h-9 w-9 text-[var(--color-muted)]" /> : isAuctions ? <Gavel className="mx-auto mb-3 h-9 w-9 text-[var(--color-muted)]" /> : <Home className="mx-auto mb-3 h-9 w-9 text-[var(--color-muted)]" />}
          <p className="text-sm text-[var(--color-muted)]">{search || category || status ? "No listings match these filters." : `No ${isDailySales ? "daily sale" : isAuctions ? "auction" : "property"} listings yet.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleListings.map((listing) => {
            const price = isDailySales ? listing.price
              : isAuctions ? listing.startingBid
                : listing.listingType === "LEASE" ? listing.monthlyRent : listing.askingPrice;
            const available = isDailySales ? listing.isAvailable
              : isAuctions ? listing.status === "UPCOMING"
                : !listing.isSold;
            const manageable = isDailySales || isAuctions ? isDailySales || listing.canEdit : !listing.isSold;
            const archivable = isDailySales || isAuctions ? isDailySales || listing.canArchive : !listing.isSold;
            return (
              <article key={listing.id} className="flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-input)]">
                  {listing.imageUrl
                    ? <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
                    : isDailySales ? <ShoppingBag className="h-6 w-6 text-[var(--color-muted)]" /> : <Home className="h-6 w-6 text-[var(--color-muted)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-[var(--color-text)]">{listing.title}</h3>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${available ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-400"}`}>
                      {isDailySales ? (available ? `Available${listing.stockCount > 1 ? ` ×${listing.stockCount}` : ""}` : "Sold out") : isAuctions ? listing.status : listing.isSold ? "Sold" : listing.listingType === "LEASE" ? "For lease" : "For sale"}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-[var(--color-muted)]">
                    <MapPin className="h-3 w-3 shrink-0" /> {listing.clientName || "Location not set"} · {listing.category}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-[var(--color-primary)]">
                      {isAuctions ? `Starting ${formatMoney(price)}` : formatMoney(price)}{listing.listingType === "LEASE" && !isDailySales ? <span className="ml-1 text-[10px] font-semibold">/ month · due day {listing.rentDueDay}</span> : ""}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      {isAuctions && <span className="self-center pr-1 text-[10px] text-[var(--color-muted)]">{listing.bidCount} bids</span>}
                      {isDailySales && (
                        <button
                          type="button"
                          title={listing.isAvailable ? "Mark as sold out" : "Restock"}
                          aria-label={listing.isAvailable ? "Mark as sold out" : "Restock listing"}
                          onClick={() => handleAvailability(listing)}
                          disabled={busyId === listing.id || (!listing.isAvailable && listing.stockCount < 1)}
                          className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] disabled:opacity-40"
                        >
                          {busyId === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : listing.isAvailable ? <PackageCheck className="h-3.5 w-3.5 text-emerald-500" /> : <PackageX className="h-3.5 w-3.5 text-rose-400" />}
                        </button>
                      )}
                      <button type="button" onClick={() => startEdit(listing)} disabled={!manageable} aria-label={`Edit ${listing.title}`} title={!manageable ? "This listing cannot be edited after it has activity or is no longer available." : "Edit or reschedule listing"} className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-40">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {isAuctions && listing.canReuse && (
                        <button type="button" onClick={() => startReuse(listing)} disabled={saving} aria-label={`Schedule ${listing.title} again`} title="Schedule this unsold auction again" className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-40">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(listing)} disabled={busyId === listing.id || !archivable} aria-label={`Archive ${listing.title}`} title={!archivable ? "This listing cannot be archived after it has activity or is no longer available." : "Archive listing"} className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:text-rose-400 disabled:opacity-40">
                        {busyId === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isAuctions && (
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                      {listing.viewingDate ? `Viewing ${formatDateOnly(listing.viewingDate)} · ` : ""}
                      Starts {new Date(listing.startTime).toLocaleString()} · ends {new Date(listing.endTime).toLocaleString()}
                    </p>
                  )}
                  {!available && isDailySales && listing.stockCount < 1 && (
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">Edit this listing to add stock before restocking.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-listing-title">
          <form onSubmit={handleEdit} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <h2 id="edit-listing-title" className="text-lg font-bold text-[var(--color-text)]">
                Edit {editListing.kind === "AUCTION" ? "auction" : editListing.kind === "DAILY_SALE" ? "daily sale" : "property"}
              </h2>
              <button type="button" onClick={() => setEditListing(null)} aria-label="Close edit form" className="rounded-lg p-1 text-[var(--color-muted)]"><X className="h-5 w-5" /></button>
            </div>
            <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Title
              <input required maxLength={255} value={editListing.title} onChange={(event) => setEditListing({ ...editListing, title: event.target.value })} className={inputClass} />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Description
              <textarea required value={editListing.description} onChange={(event) => setEditListing({ ...editListing, description: event.target.value })} className={`${inputClass} min-h-24`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {!isDailySales && (
                <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Client / location
                  <input required maxLength={191} value={editListing.clientName || ""} onChange={(event) => setEditListing({ ...editListing, clientName: event.target.value })} className={inputClass} />
                </label>
              )}
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Category
                <input required maxLength={100} value={editListing.category || ""} onChange={(event) => setEditListing({ ...editListing, category: event.target.value })} className={inputClass} />
              </label>
            </div>
            {editListing.kind === "AUCTION" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["startingBid", "Starting bid (MWK)"],
                    ["reservePrice", "Reserve price (MWK)"],
                    ["entryFee", "Entry fee (MWK)"],
                    ["biddingDeposit", "Bidding deposit (MWK)"],
                  ].map(([field, label]) => (
                    <label key={field} className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">{label}
                      <input required type="number" min="0.01" step="0.01" value={editListing[field] ?? ""} onChange={(event) => setEditListing({ ...editListing, [field]: event.target.value })} className={inputClass} />
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Product viewing date &amp; time
                    <input required type="datetime-local" value={editListing.viewingDateLocal} onChange={(event) => setEditListing({ ...editListing, viewingDateLocal: event.target.value })} className={inputClass} />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Auction starts
                    <input required type="datetime-local" value={editListing.startTimeLocal} onChange={(event) => setEditListing({ ...editListing, startTimeLocal: event.target.value })} className={inputClass} />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Auction ends
                    <input required type="datetime-local" value={editListing.endTimeLocal} onChange={(event) => setEditListing({ ...editListing, endTimeLocal: event.target.value })} className={inputClass} />
                  </label>
                </div>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">{editListing.listingType === "LEASE" && !isDailySales ? "Monthly rent (MWK)" : "Price (MWK)"}
                  <input required type="number" min="0.01" step="0.01" value={editListing.price ?? ""} onChange={(event) => setEditListing({ ...editListing, price: event.target.value })} className={inputClass} />
                </label>
                {isDailySales ? (
                <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Available stock
                  <input required type="number" min="1" step="1" value={editListing.stockCount} onChange={(event) => setEditListing({ ...editListing, stockCount: event.target.value })} className={inputClass} />
                </label>
                ) : editListing.listingType === "LEASE" && (
                  <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Rent due day (1–28)
                    <input required type="number" min="1" max="28" step="1" value={editListing.rentDueDay ?? ""} onChange={(event) => setEditListing({ ...editListing, rentDueDay: event.target.value })} className={inputClass} />
                  </label>
                )}
              </div>
            )}
            <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Replace photo (optional)
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setEditListing({ ...editListing, imageFile: event.target.files?.[0] || null })} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-secondary)] file:px-3 file:py-1 file:text-xs file:font-semibold`} />
            </label>
            {editError && <p className="text-sm text-rose-400" role="alert">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditListing(null)} className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
      {reuseListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="reuse-auction-title">
          <form onSubmit={handleReuse} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <h2 id="reuse-auction-title" className="text-lg font-bold text-[var(--color-text)]">Schedule auction again</h2>
              <button type="button" onClick={() => setReuseListing(null)} aria-label="Close schedule form" className="rounded-lg p-1 text-[var(--color-muted)]"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Create a new auction for <span className="font-semibold text-[var(--color-text)]">{reuseListing.title}</span>.
              The previous auction and its transaction history will remain unchanged.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Auction starts
                <input required type="datetime-local" value={reuseSchedule.startTime} onChange={(event) => setReuseSchedule((current) => ({ ...current, startTime: event.target.value }))} className={inputClass} />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Product viewing date &amp; time
                <input required type="datetime-local" value={reuseSchedule.viewingDate} onChange={(event) => setReuseSchedule((current) => ({ ...current, viewingDate: event.target.value }))} className={inputClass} />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Auction ends
                <input required type="datetime-local" value={reuseSchedule.endTime} onChange={(event) => setReuseSchedule((current) => ({ ...current, endTime: event.target.value }))} className={inputClass} />
              </label>
            </div>
            {editError && <p className="text-sm text-rose-400" role="alert">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReuseListing(null)} className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Schedule again
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
