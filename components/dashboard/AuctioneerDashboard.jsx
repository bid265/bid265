"use client";

import React, { useState } from "react";
import { PlusCircle, Video, Loader2, Trash2, LayoutGrid, DollarSign, UploadCloud, ArrowRight, Hourglass, CheckCircle2, RotateCcw, Sparkles, Users, Power, Eye } from "lucide-react";
import { createAssetAndAuction } from "@/app/actions/createAssetAndAuction";
import { getLiveKitToken, updateAuctionToLiveDirectly, closeLiveAuctionDirectly } from "@/app/actions/liveAuction"; // 👈 Connected Directly to Refactored DB Actions
import { useRouter } from "next/navigation";

const createLiveRoomId = (itemId) => `room-lot-${itemId}-${Date.now()}`;

export default function AuctioneerDashboard({ user, auctionItems: initialAuctionItems = [] }) {
  const router = useRouter();
  
  // Local state array allows UI elements to update instantly without waiting for a slow reload
  const [itemsList, setItemsList] = useState(initialAuctionItems);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isInitializingId, setIsInitializingId] = useState(null); 
  const [isActionLoadingId, setIsActionLoadingId] = useState(null);

  // Terminal state properties
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [isReinitializing, setIsReinitializing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("VEHICLE");
  const [customCategory, setCustomCategory] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);

  const [dynamicAttributes, setDynamicAttributes] = useState([
    { key: "Condition", value: "Excellent" }
  ]);

  const [form, setForm] = useState({
    title: "", description: "", clientName: "",
    startingBid: "", reservePrice: "", entryFee: "", biddingDeposit: ""
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

  const handlePublishAuction = async (e) => {
    e.preventDefault();
    try {
      setIsPublishing(true);
      const finalCategory = selectedCategory === "OTHER" ? customCategory : selectedCategory;
      if (!finalCategory) throw new Error("Please specify your custom category name.");

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("clientName", form.clientName);
      formData.append("startingBid", form.startingBid);
      formData.append("reservePrice", form.reservePrice);
      formData.append("entryFee", form.entryFee);
      formData.append("biddingDeposit", form.biddingDeposit);
      formData.append("category", finalCategory);
      formData.append("dynamicAttributes", JSON.stringify(dynamicAttributes));

      if (uploadedFile) {
        formData.append("assetImageFile", uploadedFile);
      } else {
        throw new Error("Please attach a primary display image photograph.");
      }

      const res = await createAssetAndAuction(formData);
      if (res.success) {
        alert(`🎉 Lot Registered Successfully! Added to database registry.`);
        setForm({ title: "", description: "", clientName: "", startingBid: "", reservePrice: "", entryFee: "", biddingDeposit: "" });
        setDynamicAttributes([{ key: "Condition", value: "Excellent" }]);
        setUploadedFile(null);
        e.target.reset(); 
        router.refresh();
      }
    } catch (err) {
      alert(err.message || "Binary upload failure.");
    } finally {
      setIsPublishing(false);
    }
  };

  // 📡 Direct Live Initialization (Flips status to ACTIVE in MySQL)
  const handleDirectLiveInitialization = async (itemId) => {
    if (!itemId) return;
    try {
      const isDropdownSelect = itemId === selectedInventoryId;
      if (isDropdownSelect) {
        setIsReinitializing(true);
      } else {
        setIsInitializingId(itemId);
      }
      
      const computedRoomId = createLiveRoomId(itemId);
      
      // 💾 PERSIST TO DATABASE: Flipped directly via server action
      const updateResult = await updateAuctionToLiveDirectly(itemId, computedRoomId);
      if (!updateResult?.success) {
        throw new Error(updateResult?.error || "Could not start this auction.");
      }
      
      // Get connection pass for room entrance
      const tokenPayload = await getLiveKitToken(computedRoomId, itemId);
      if (!tokenPayload?.success) {
        throw new Error(tokenPayload?.error || "Could not connect to the live auction.");
      }
      alert(`⚡ Database status successfully set to ACTIVE for Lot #${itemId}! Routing to room viewport...`);
      
      // Synchronize client interface array
      setItemsList(prevItems => 
        prevItems.map(item => 
          item.id === Number(itemId) 
            ? { ...item, status: "ACTIVE", liveRoomId: computedRoomId } 
            : item
        )
      );

      setSelectedInventoryId("");
      router.push(`/auctions/live/${computedRoomId}?token=${tokenPayload.token}&id=${itemId}`);
    } catch (err) {
      alert("Database initialization rejected: " + err.message);
    } finally {
      setIsReinitializing(false);
      setIsInitializingId(null);
    }
  };

  // 👁️ Watch Live Room Mode (Enters WebRTC space without placement rights)
  const handleWatchLiveRoom = async (item) => {
    try {
      setIsActionLoadingId(item.id);
      const targetRoomId = item.liveRoomId || `room-lot-${item.id}-active`;
      
      const tokenPayload = await getLiveKitToken(targetRoomId, item.id);
      if (!tokenPayload?.success) {
        throw new Error(tokenPayload?.error || "Could not connect to the live auction.");
      }
      router.push(`/auctions/live/${targetRoomId}?token=${tokenPayload.token}&id=${item.id}`);
    } catch (err) {
      alert("Could not pull connection pass token parameters: " + err.message);
    } finally {
      setIsActionLoadingId(null);
    }
  };

  // 🛑 Terminate Live Session (Flips status to CLOSED in MySQL permanently)
  const handleTerminateLiveSession = async (itemId) => {
    const confirmation = confirm("Are you sure you want to end this live auction session? Its status will become CLOSED in the database and disappear permanently.");
    if (!confirmation) return;

    try {
      setIsActionLoadingId(itemId);
      
      // 💾 PERSIST TO DATABASE: Writes CLOSED to MySQL row
      const result = await closeLiveAuctionDirectly(itemId);
      if (!result?.success) {
        throw new Error(result?.error || "Could not close this auction.");
      }
      
      // Instantly drop it out from our layout view by filtering local state
      setItemsList(prevItems => prevItems.map(item => item.id === itemId ? { ...item, status: "CLOSED" } : item));

      alert(`🛑 Database Record Updated! Lot #${itemId} status is now CLOSED and permanently hidden.`);
    } catch (err) {
      alert("Failed to close remote instance block: " + err.message);
    } finally {
      setIsActionLoadingId(null);
    }
  };

  // Enforces data persistence rule: Items hidden here will stay hidden on reload because status === "CLOSED"
  const visibleActiveItems = itemsList.filter(item => item.status !== "CLOSED");

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4">
      
      {/* 🔄 TERMINAL SELECT FOR EXISTING DB ITEMS RE-INITIALIZATION */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-black tracking-wider uppercase text-slate-200">Autonomous Database Live Launch Terminal</h3>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Select any closed or raw item inside your schema registry list. Activating an asset changes its database code back to <span className="text-emerald-400 font-bold"></span>, pulling it straight back onto your public listings boards.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={selectedInventoryId} 
            onChange={(e) => setSelectedInventoryId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-300 focus:outline-none"
          >
            <option value="">-- Choose an Asset from Full Inventory Pool --</option>
            {itemsList.map((item) => (
              <option key={item.id} value={item.id}>
                Lot #{item.id} - {item.asset?.title || "No Title Specified"} [{item.status || "SAVED"}]
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleDirectLiveInitialization(selectedInventoryId)}
            disabled={!selectedInventoryId || isReinitializing}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {isReinitializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /> Force Active & Launch</>}
          </button>
        </div>
      </div>

      {/* UNIVERSAL CREATION FORM */}
      <form onSubmit={handlePublishAuction} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Register Brand New Asset Campaign</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none w-full sm:w-auto">
              <option value="VEHICLE">🚗 Vehicles & Cars</option>
              <option value="LAND">🌍 Land / Plot</option>
              <option value="COMMERCIAL_BUILDING">🏢 Commercial Building</option>
              <option value="RESIDENTIAL_BUILDING">🏠 Residential Building</option>
              <option value="ELECTRONICS">💻 Tech & Electronics</option>
              <option value="OTHER">✨ OTHER / CUSTOM CATEGORY</option>
            </select>
            {selectedCategory === "OTHER" && (
              <input type="text" placeholder="Type Custom Category..." value={customCategory} onChange={(e) => setCustomCategory(e.target.value.toUpperCase())} required className="bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 px-3 py-2 rounded-xl focus:outline-none" />
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Asset Name / Title</label>
              <input type="text" required placeholder="e.g. 2022 Toyota Hilux D-4D" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client Name</label>
              <input type="text" required placeholder="e.g. John Banda" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comprehensive Lot Description</label>
            <textarea required placeholder="Outline mechanical/physical conditions..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs rounded-xl h-16 resize-none focus:outline-none" />
          </div>

          {/* Dynamic Specifications */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Dynamic Specifications Engine Block</span>
              <button type="button" onClick={addSpecificationRow} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">
                + Add Dynamic Field
              </button>
            </div>
            {dynamicAttributes.map((element, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input type="text" placeholder="Label" value={element.key} onChange={(e) => handleSpecChange(index, e, "key")} className="flex-1 bg-white border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-none" />
                <input type="text" placeholder="Value" value={element.value} onChange={(e) => handleSpecChange(index, e, "value")} className="flex-1 bg-white border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-none" />
                {dynamicAttributes.length > 1 && (
                  <button type="button" onClick={() => removeSpecificationRow(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Asset Display Image Upload</label>
              <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center hover:bg-slate-50 transition-all">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-[10px] font-semibold text-slate-600 max-w-[250px] truncate">
                  {uploadedFile ? `Selected: ${uploadedFile.name}` : "Click to select asset photo"}
                </span>
                <input type="file" accept="image/*" onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/20 p-4 border border-indigo-100/40 rounded-xl">
            <div className="flex items-center gap-1.5 border-b border-indigo-100 pb-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Financial Pricing Framework</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Starting Bid (MWK)</label>
                <input type="number" required placeholder="5000000" value={form.startingBid} onChange={(e) => setForm({...form, startingBid: e.target.value})} className="w-full bg-white border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reserve Price (MWK)</label>
                <input type="number" required placeholder="7500000" value={form.reservePrice} onChange={(e) => setForm({...form, reservePrice: e.target.value})} className="w-full bg-white border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entry Fee to Participate (MWK)</label>
                  <input type="number" min="1" required placeholder="250000" value={form.entryFee} onChange={(e) => setForm({...form, entryFee: e.target.value})} className="w-full bg-white border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bidding Funds / Security Deposit (MWK)</label>
                  <input type="number" min="1" required placeholder="Must exceed the starting bid" value={form.biddingDeposit} onChange={(e) => setForm({...form, biddingDeposit: e.target.value})} className="w-full bg-white border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none" />
                  <p className="mt-1 text-[10px] text-slate-500">Paid funds set the maximum bid a bidder can place.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={isPublishing} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md disabled:bg-slate-300">
              {isPublishing ? "Adding item..." : "Save Asset & Add to Inventory"}
            </button>
          </div>
        </div>
      </form>

      {/* 📋 MY CAMPAIGN INVENTORY SECTION (Excludes CLOSED Assets) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-black tracking-wider uppercase text-slate-700">Active Campaigns Block ({visibleActiveItems.length})</h3>
        </div>

        {visibleActiveItems.length === 0 ? (
          <div className="bg-white border border-dashed rounded-2xl p-8 text-center text-xs text-slate-400">
            No active campaigns listed. All items are saved as CLOSED or UPCOMING in MySQL database records. Use the terminal above to find and reactivate properties.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleActiveItems.map((item) => {
              const isLive = item.status === "LIVE" || item.status === "ACTIVE";
              
              return (
                <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">Lot #{item.id}</span>
                      
                      {isLive ? (
                        <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Lobby Open
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Hourglass className="w-3 h-3" /> Status: {item.status || "READY"}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">{item.asset?.title || "Unnamed Property"}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.asset?.description}</p>
                    </div>

                    <div className="text-[11px] font-medium text-slate-600 grid grid-cols-2 gap-1 pt-1">
                      <div>Starting Bid: <span className="font-bold text-slate-900">MWK {Number(item.startingBid).toLocaleString()}</span></div>
                      <div>Reserve price: <span className="font-bold text-amber-800">MWK {Number(item.reservePrice).toLocaleString()}</span></div>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 flex flex-col gap-2">
                    {!isLive ? (
                      <button
                        type="button"
                        onClick={() => handleDirectLiveInitialization(item.id)}
                        disabled={isInitializingId !== null}
                        className="w-full text-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:bg-slate-300"
                      >
                        {isInitializingId === item.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Committing database string states...</>
                        ) : (
                          <><ArrowRight className="w-3.5 h-3.5" /> Start Live Bidding Session</>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-2 w-full">
                        <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 w-full rounded-xl py-2 px-3 flex items-center justify-between border border-emerald-100">
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 animate-pulse" /> Lobby Live</span>
                          <span className="text-[10px] text-slate-500 font-medium">Bidders Connecting...</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleWatchLiveRoom(item)}
                            disabled={isActionLoadingId !== null}
                            className="flex-1 text-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:bg-slate-300"
                          >
                            {isActionLoadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Eye className="w-3.5 h-3.5" /> Go To Live Room</>}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleTerminateLiveSession(item.id)}
                            disabled={isActionLoadingId !== null}
                            className="flex-1 text-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:bg-slate-300"
                          >
                            <Power className="w-3.5 h-3.5" /> End Session
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}