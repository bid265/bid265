// app/admin/dashboard/page.jsx (or your component file path)
"use client";

import React, { useState } from "react";
import { Gavel, MapPin, PlayCircle, Loader2, ShieldCheck, Layers, Landmark } from "lucide-react";
import { approveAndStartLiveAuction, getLiveKitToken } from "@/app/actions/liveAuction";
import { useRouter } from "next/navigation";

export default function AdminDashboard({ user, pendingItems = [] }) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState(null);

  const handleApproveAndLaunch = async (itemId) => {
    try {
      setApprovingId(itemId);
      
      // 1. Pushes the database state changes directly to MariaDB and fires Pusher alerts
      const approvalResult = await approveAndStartLiveAuction(Number(itemId));
      if (!approvalResult?.success) {
        throw new Error(approvalResult?.error || "Could not approve this auction.");
      }
      
      // 2. Fetch connection credentials with administrative moderator permission layers
      const tokenPayload = await getLiveKitToken(approvalResult.roomId, itemId);
      if (!tokenPayload?.success) {
        throw new Error(tokenPayload?.error || "Could not connect to the live auction.");
      }
      
      // 3. Signal layout cache changes to drop the item from the pending list
      router.refresh();

      // 4. Safe routing insertion into your premium Google Meet-style WebRTC UI space
      router.push(`/auctions/live/${approvalResult.roomId}?token=${tokenPayload.token}&id=${itemId}`);
    } catch (err) {
      alert(err.message || "Failed to process lot approval sequence inside database layers.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      
      {/* SYSTEM CONTROL STATUS HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">System Control Matrix</h2>
            <p className="text-xs text-slate-500">Review and approve pending auction listings.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-bold text-slate-700 bg-slate-50 border px-4 py-2.5 rounded-xl self-start sm:self-auto">
          <span className="flex items-center gap-1">
            <Layers className="w-4 h-4 text-slate-400" /> Pending Registry Queue: {pendingItems.length}
          </span>
        </div>
      </div>

      {/* PENDING ITEMS LISTING CONTAINER */}
      <div className="space-y-4">
        <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">Awaiting Activation Logs</h3>
        
        {pendingItems.length === 0 ? (
          <div className="bg-white border border-dashed rounded-2xl p-12 text-center text-xs text-slate-400">
            No auction campaigns currently pending in the workspace registry queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow"
              >
                {/* PRIMARY IMAGE AREA */}
                <div className="w-full md:w-52 h-44 md:h-auto relative bg-slate-50 shrink-0">
                  <img 
                    src={item.images?.[0]?.url || "/placeholder-property.jpg"} 
                    alt={item.asset?.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = "/placeholder-property.jpg"; }}
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white font-bold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Lot #{item.id}
                  </div>
                </div>

                {/* CAMPAIGN SPECIFICS AND DATA PREVIEW */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
                      <MapPin className="w-3 h-3" /> {item.asset?.location || "No Specified Location"}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 tracking-tight">{item.asset?.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.asset?.description}</p>
                    
                    {/* Render custom dynamic specifications from your JSON field if present */}
                    {item.asset?.attributes && typeof item.asset.attributes === "object" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(item.asset.attributes).map(([key, value]) => (
                          <span key={key} className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-medium">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FINANCIAL BOUNDS AND AUTHORIZATION TRIGGER BUTTONS */}
                  <div className="flex flex-wrap items-end justify-between gap-4 pt-3 border-t border-slate-100">
                    <div className="flex gap-6">
                      <div>
                        <label className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Gavel className="w-3 h-3" /> Opening Target
                        </label>
                        <p className="text-xs font-black text-slate-800 mt-0.5">
                          MWK {Number(item.startingBid).toLocaleString("en-US")}
                        </p>
                      </div>
                      <div>
                        <label className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Landmark className="w-3 h-3" /> Reserve Floor
                        </label>
                        <p className="text-xs font-bold text-amber-700 mt-0.5">
                          MWK {Number(item.reservePrice).toLocaleString("en-US")}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApproveAndLaunch(item.id)}
                      disabled={approvingId !== null}
                      className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm transition-all disabled:bg-slate-300"
                    >
                      {approvingId === item.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mutating DB States...</>
                      ) : (
                        <><PlayCircle className="w-4 h-4" /> Approve & Go Live</>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}