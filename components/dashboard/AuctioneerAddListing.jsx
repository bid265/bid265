"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  LayoutGrid,
  DollarSign,
  UploadCloud,
  ArrowLeft,
} from "lucide-react";
import { createAssetAndAuction } from "@/app/actions/createAssetAndAuction";
import { createDailySaleListing } from "@/app/actions/createDailySale";
import PlotAreaCapture from "@/components/dashboard/PlotAreaCapture";

/**
 * 📝 ADD LISTING FORM
 *
 * The Manage Listings section's "Add Listing" button redirects here.
 * Mode "daily-sale"  → commodity listing with a fixed buy-now price.
 * Mode "property"    → property for sale or lease.
 * Mode "auction"     → scheduled auction with entry fee and bidder security deposit.
 */
export default function AuctioneerAddListing({ initialMode = "property" }) {
  const router = useRouter();
  const mode = ["daily-sale", "auction"].includes(initialMode) ? initialMode : "property";
  const [listingType, setListingType] = useState("SALE");
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    initialMode === "daily-sale" ? "OTHER" : initialMode === "auction" ? "VEHICLE" : "LAND"
  );
  const [customCategory, setCustomCategory] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [plotMeasurement, setPlotMeasurement] = useState(null);

  const [dynamicAttributes, setDynamicAttributes] = useState([
    { key: "Condition", value: "Excellent" },
  ]);

  const [form, setForm] = useState({
    title: "", description: "", clientName: "", documentUrl: "", startTime: "", endTime: "",
    startingBid: "", reservePrice: "", entryFee: "",
    biddingDeposit: "", askingPrice: "", monthlyRent: "", rentDueDay: "1",
    price: "", stockCount: "1",
  });

  const addSpecificationRow = () => setDynamicAttributes([...dynamicAttributes, { key: "", value: "" }]);
  const removeSpecificationRow = (index) => {
    const values = [...dynamicAttributes];
    values.splice(index, 1);
    setDynamicAttributes(values);
  };

  const handleSpecChange = (index, event, field) => {
    const updatedSpecs = [...dynamicAttributes];
    updatedSpecs[index][field] = event.target.value;
    setDynamicAttributes(updatedSpecs);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    try {
      setIsPublishing(true);
      const finalCategory = selectedCategory === "OTHER" ? customCategory : selectedCategory;
      if (!finalCategory) throw new Error("Please specify your custom category name.");

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("clientName", form.clientName);
      formData.append("category", finalCategory);
      // GPS-captured plot dimensions are stored with the listing's specifications.
      const attributesToSave = [...dynamicAttributes];
      if (plotMeasurement && finalCategory === "LAND") {
        attributesToSave.push(
          { key: "Plot Area (GPS)", value: plotMeasurement.areaLabel },
          { key: "Plot Perimeter (GPS)", value: plotMeasurement.perimeterLabel },
          { key: "GPS Boundary Points", value: plotMeasurement.boundary },
        );
      }
      formData.append("dynamicAttributes", JSON.stringify(attributesToSave));

      if (uploadedFile) {
        formData.append("assetImageFile", uploadedFile);
      } else {
        throw new Error("Please attach a primary display image photograph.");
      }

      if (mode === "daily-sale") {
        formData.append("price", form.price);
        formData.append("stockCount", form.stockCount || "1");
        const res = await createDailySaleListing(formData);
        if (!res.success) throw new Error(res.error);
        alert("🎉 Daily sale listing published!");
      } else {
        const propertyType = mode === "auction" ? "AUCTION" : listingType;
        formData.append("listingType", propertyType);
        if (propertyType === "AUCTION") {
          formData.append("documentUrl", form.documentUrl);
          formData.append("startingBid", form.startingBid);
          formData.append("reservePrice", form.reservePrice);
          formData.append("entryFee", form.entryFee);
          formData.append("biddingDeposit", form.biddingDeposit);
          formData.append("startTime", new Date(form.startTime).toISOString());
          formData.append("endTime", new Date(form.endTime).toISOString());
        } else if (propertyType === "SALE") {
          formData.append("askingPrice", form.askingPrice);
        } else {
          formData.append("monthlyRent", form.monthlyRent);
          formData.append("rentDueDay", form.rentDueDay);
        }
        const res = await createAssetAndAuction(formData);
        if (!res.success) throw new Error(res.error || "Failed to publish auction listing.");
        alert(`🎉 ${propertyType === "AUCTION" ? "Auction" : `Property ${propertyType.toLowerCase()}`} listing registered!`);
      }

      router.push(mode === "auction" ? "/dashboard?tab=live-auctions" : "/dashboard?tab=manage-listings");
      router.refresh();
    } catch (err) {
      alert(err.message || "Publishing failed.");
    } finally {
      setIsPublishing(false);
    }
  };

  const inputClass = "w-full bg-[var(--color-input)] border border-[var(--color-border)] px-3 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all";

  return (
    <form onSubmit={handlePublish} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-input)]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-[var(--color-input)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
            title="Back to Manage Listings"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
              {mode === "daily-sale" ? "New Daily Sale" : mode === "auction" ? "Schedule Auction" : "New Property Listing"}
            </h3>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">
              {mode === "daily-sale" ? "Item Name / Title" : "Asset Name / Title"}
            </label>
            <input type="text" required placeholder={mode === "daily-sale" ? "e.g. Toyota Hilux 2022 — 4,500km" : "e.g. 3 Bedroom Residential Property - Area 47"} value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Client Name</label>
            <input type="text" required placeholder="e.g. John Banda" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Comprehensive Description</label>
          <textarea required placeholder={mode === "daily-sale" ? "Describe the item condition, specs, and what is included..." : "Outline legal descriptors, physical attributes, title deed statuses..."} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full bg-[var(--color-input)] border border-[var(--color-border)] px-3 py-2.5 text-xs rounded-xl h-24 resize-none focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all" />
        </div>

        {/* GPS plot measurement - land listings only */}
        {mode === "property" && selectedCategory === "LAND" && (
          <PlotAreaCapture onChange={setPlotMeasurement} />
        )}

        {/* Dynamic Specifications */}
        <div className="bg-[var(--color-input)]/30 p-4 rounded-xl border border-[var(--color-border)] space-y-3">
          <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2">
            <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Dynamic Specifications</span>
            <button type="button" onClick={addSpecificationRow} className="px-3 py-1 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-lg hover:bg-[var(--color-primary)]/90 transition-all">
              + Add Dynamic Field
            </button>
          </div>
          {dynamicAttributes.map((element, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input type="text" placeholder="Label (e.g. Plot Size)" value={element.key} onChange={(e) => handleSpecChange(index, e, "key")} className={inputClass} />
              <input type="text" placeholder="Value (e.g. 0.25 Hectares)" value={element.value} onChange={(e) => handleSpecChange(index, e, "value")} className={inputClass} />
              {dynamicAttributes.length > 1 && (
                <button type="button" onClick={() => removeSpecificationRow(index)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Display Image Upload</label>
            <div className="relative border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-input)]/30 flex flex-col items-center justify-center hover:bg-[var(--color-input)] transition-all">
              <UploadCloud className="w-6 h-6 text-[var(--color-muted)] mb-1" />
              <span className="text-[10px] font-semibold text-[var(--color-muted)] max-w-[250px] truncate">
                {uploadedFile ? `Selected: ${uploadedFile.name}` : "Click to select a photo"}
              </span>
              <input type="file" accept="image/*" onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </div>
          </div>
          {mode === "auction" && <div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Legal Document Link</label>
            <input type="url" placeholder="https://your-host-cdn.com/file.pdf" value={form.documentUrl} onChange={(e) => setForm({...form, documentUrl: e.target.value})} className={inputClass} />
          </div>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Category</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={inputClass}>
              {mode === "daily-sale" ? (
                <>
                  <option value="VEHICLE">🚗 Vehicles & Cars</option>
                  <option value="ELECTRONICS">💻 Tech & Electronics</option>
                  <option value="FURNITURE">🪑 Furniture</option>
                  <option value="OTHER">✨ OTHER / CUSTOM CATEGORY</option>
                </>
              ) : mode === "auction" ? (
                <>
                  <option value="VEHICLE">🚗 Vehicle</option>
                  <option value="MOTORBIKE">🏍️ Motorbike</option>
                  <option value="FURNITURE">🪑 Furniture</option>
                  <option value="ELECTRONICS">💻 Electronics</option>
                  <option value="OTHER">✨ Other / Custom</option>
                </>
              ) : (
                <>
                  <option value="LAND">🌍 Land / Plot</option>
                  <option value="COMMERCIAL_BUILDING">🏢 Commercial Building</option>
                  <option value="RESIDENTIAL_BUILDING">🏠 Residential Building</option>
                  <option value="OTHER">✨ OTHER / CUSTOM CATEGORY</option>
                </>
              )}
            </select>
            {selectedCategory === "OTHER" && (
              <input type="text" placeholder="Type Custom Category..." value={customCategory} onChange={(e) => setCustomCategory(e.target.value.toUpperCase())} required className="bg-[var(--color-secondary)]/10 border border-[var(--color-primary)]/20 text-xs font-bold text-[var(--color-primary)] px-3 py-2 rounded-xl focus:outline-none" />
            )}
          </div>
        </div>

        {/* Pricing */}
        {mode === "daily-sale" ? (
          <div className="bg-[var(--color-secondary)]/5 p-4 border border-[var(--color-primary)]/10 rounded-xl">
            <div className="flex items-center gap-1.5 border-b border-[var(--color-primary)]/10 pb-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="text-[10px] font-bold text-[var(--color-text)] uppercase tracking-wider">Daily Sale Pricing</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Sale Price (MWK)</label>
                <input type="number" required placeholder="15000000" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Units Available</label>
                <input type="number" min="1" placeholder="1" value={form.stockCount} onChange={(e) => setForm({...form, stockCount: e.target.value})} className={inputClass} />
              </div>
            </div>
          </div>
        ) : mode === "auction" ? (
          <div className="bg-[var(--color-secondary)]/5 p-4 border border-[var(--color-primary)]/10 rounded-xl">
            <div className="flex items-center gap-1.5 border-b border-[var(--color-primary)]/10 pb-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="text-[10px] font-bold text-[var(--color-text)] uppercase tracking-wider">Auction Schedule &amp; Financial Framework</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Auction Starts</label>
                <input type="datetime-local" required value={form.startTime} onChange={(e) => setForm({...form, startTime: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Auction Ends</label>
                <input type="datetime-local" required value={form.endTime} onChange={(e) => setForm({...form, endTime: e.target.value})} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Starting Bid (MWK)</label>
                <input type="number" min="1" required placeholder="5000000" value={form.startingBid} onChange={(e) => setForm({...form, startingBid: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Reserve Price (MWK)</label>
                <input type="number" min="1" required placeholder="7500000" value={form.reservePrice} onChange={(e) => setForm({...form, reservePrice: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Entry Fee (MWK)</label>
                <input type="number" min="1" required placeholder="250000" value={form.entryFee} onChange={(e) => setForm({...form, entryFee: e.target.value})} className={inputClass} />
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">Required to participate in this auction.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Bidding Funds / Security Deposit (MWK)</label>
                <input type="number" min="1" required placeholder="Must exceed the starting bid" value={form.biddingDeposit} onChange={(e) => setForm({...form, biddingDeposit: e.target.value})} className={inputClass} />
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">Paid funds set the maximum bid a bidder can place.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-secondary)]/5 p-4 border border-[var(--color-primary)]/10 rounded-xl">
            <div className="flex items-center gap-1.5 border-b border-[var(--color-primary)]/10 pb-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="text-[10px] font-bold text-[var(--color-text)] uppercase tracking-wider">Property Listing Type &amp; Pricing</span>
            </div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Listing Type</label>
            <select value={listingType} onChange={(e) => setListingType(e.target.value)} className={`${inputClass} mb-4`}>
              <option value="SALE">For Sale</option>
              <option value="LEASE">For Lease</option>
            </select>
            {listingType === "SALE" ? (
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Asking Price (MWK)</label>
                <input type="number" min="1" required placeholder="25000000" value={form.askingPrice} onChange={(e) => setForm({...form, askingPrice: e.target.value})} className={inputClass} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Monthly Rent (MWK)</label>
                  <input type="number" min="1" required placeholder="350000" value={form.monthlyRent} onChange={(e) => setForm({...form, monthlyRent: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-muted)] uppercase mb-1">Monthly Rent Due Day</label>
                  <input type="number" min="1" max="28" required value={form.rentDueDay} onChange={(e) => setForm({...form, rentDueDay: e.target.value})} className={inputClass} />
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">The auctioneer will receive a monthly email reminder on this day.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={isPublishing} className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">
            {isPublishing ? "Publishing..." : mode === "daily-sale" ? "Publish Daily Sale" : mode === "auction" ? "Schedule Auction" : "Publish Property Listing"}
          </button>
        </div>
      </div>
    </form>
  );
}
