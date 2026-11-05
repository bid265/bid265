"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit2, Loader2, Trash2, X } from "lucide-react";
import { deleteListing, updateListingDetails } from "@/app/actions/manageListings";

const inputClass = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";

function toLocalDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AuctioneerAuctionControls({ listing, onDeleted, onUpdated }) {
  const router = useRouter();
  const [editListing, setEditListing] = useState(null);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = () => {
    setEditError("");
    setEditListing({
      ...listing,
      startTimeLocal: toLocalDateTime(listing.startTime),
      endTimeLocal: toLocalDateTime(listing.endTime),
      viewingDateLocal: listing.viewingDate ? toLocalDateTime(listing.viewingDate) : "",
      imageFile: null,
    });
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editListing) return;
    setSaving(true);
    setEditError("");
    try {
      const details = new FormData();
      for (const key of ["title", "description", "clientName", "category", "startingBid", "reservePrice", "entryFee", "biddingDeposit"]) {
        details.append(key, String(editListing[key] ?? ""));
      }
      details.append("startTime", new Date(editListing.startTimeLocal).toISOString());
      details.append("endTime", new Date(editListing.endTimeLocal).toISOString());
      details.append("viewingDate", new Date(editListing.viewingDateLocal).toISOString());
      if (editListing.imageFile) details.append("assetImageFile", editListing.imageFile);

      const result = await updateListingDetails("AUCTION", listing.id, details);
      if (!result.success) throw new Error(result.error || "Could not update auction.");
      setEditListing(null);
      await onUpdated();
      router.refresh();
    } catch (error) {
      setEditError(error.message || "Could not update auction.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Archive "${listing.title}"? It will no longer appear publicly, but its transaction history will be retained.`)) return;
    setDeleting(true);
    try {
      const result = await deleteListing("AUCTION", listing.id);
      if (!result.success) throw new Error(result.error || "Could not archive auction.");
      onDeleted(listing.id);
      router.refresh();
    } catch (error) {
      window.alert(error.message || "Could not archive auction.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={startEdit}
          disabled={!listing.canEdit || saving || deleting}
          title={!listing.canEdit ? "This auction cannot be edited after it has activity or is no longer scheduled." : "Edit auction"}
          aria-label={`Edit ${listing.title}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-[11px] font-bold text-[var(--color-text)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!listing.canArchive || saving || deleting}
          title={!listing.canArchive ? "This auction cannot be archived after it has activity or is no longer available." : "Archive auction"}
          aria-label={`Archive ${listing.title}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-[11px] font-bold text-[var(--color-text)] hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Archive
        </button>
      </div>

      {editListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby={`edit-auction-${listing.id}-title`}>
          <form onSubmit={handleEdit} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <h2 id={`edit-auction-${listing.id}-title`} className="text-lg font-bold text-[var(--color-text)]">Edit auction</h2>
              <button type="button" onClick={() => setEditListing(null)} aria-label="Close edit form" className="rounded-lg p-1 text-[var(--color-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Title
              <input required maxLength={255} value={editListing.title} onChange={(event) => setEditListing({ ...editListing, title: event.target.value })} className={inputClass} />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Description
              <textarea required value={editListing.description} onChange={(event) => setEditListing({ ...editListing, description: event.target.value })} className={`${inputClass} min-h-24`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Client / location
                <input required maxLength={191} value={editListing.clientName || ""} onChange={(event) => setEditListing({ ...editListing, clientName: event.target.value })} className={inputClass} />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">Category
                <input required maxLength={100} value={editListing.category || ""} onChange={(event) => setEditListing({ ...editListing, category: event.target.value })} className={inputClass} />
              </label>
            </div>
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
    </>
  );
}
