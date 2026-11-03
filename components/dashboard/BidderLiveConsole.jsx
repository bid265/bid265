"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveLiveAuctions, getLiveKitToken } from "@/app/actions/liveAuction";
import { hasClearedAuctionGate } from "@/app/actions/auctionAccess";
import AuctionAccessGate from "@/components/dashboard/AuctionAccessGate";
import { 
  Tv, 
  MapPin, 
  Loader2, 
  Gavel,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react";

export default function BidderLiveConsole({ auctionItems = [] }) {
  const router = useRouter();
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [isJoiningId, setIsJoiningId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gateAuction, setGateAuction] = useState(null); // auction pending fee clearance

  // Fetch active auctions on mount
  useEffect(() => {
    async function fetchAuctions() {
      setLoading(true);
      try {
        const res = await getActiveLiveAuctions();
        if (res.success && res.items?.length > 0) {
          setActiveAuctions(res.items);
        } else if (auctionItems.length > 0) {
          // Fallback to props if API returns empty
          setActiveAuctions(auctionItems);
        }
      } catch (err) {
        console.error("Failed to fetch auctions:", err);
        if (auctionItems.length > 0) {
          setActiveAuctions(auctionItems);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAuctions();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, [auctionItems]);

  // Handle joining a live auction room — first clear the entry fee and bidding deposit.
  const handleJoinAuction = async (auction) => {
    if (!["ACTIVE", "LIVE"].includes(auction.status)) return;
    const targetRoomId = auction.roomId || auction.id;
    const itemDbId = auction.auctionItemId || auction.id;

    try {
      setIsJoiningId(targetRoomId);

      // The entry fee and bidding deposit must both be paid before joining.
      const gate = await hasClearedAuctionGate(itemDbId);
      if (!gate.success) {
        throw new Error(gate.error || "Could not verify auction access payments.");
      }

      if (!gate.cleared) {
        setIsJoiningId(null);
        setGateAuction({ roomId: String(targetRoomId), auctionItemId: itemDbId });
        return;
      }

      const tokenPromise = getLiveKitToken(targetRoomId, itemDbId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 8000)
      );

      const tokenPayload = await Promise.race([tokenPromise, timeoutPromise]);
      if (!tokenPayload?.success) {
        throw new Error(tokenPayload?.error || "Could not connect to the live auction.");
      }

      router.push(`/auctions/live/${targetRoomId}?token=${tokenPayload.token}&id=${itemDbId}`);
    } catch (err) {
      console.error("Join error:", err);
      alert(err.message || "Failed to connect to auction room. Please try again.");
    } finally {
      setIsJoiningId(null);
    }
  };

  // Called when both auction access payments have been confirmed.
  const handleAccessGranted = async () => {
    if (!gateAuction) return;
    const targetRoomId = gateAuction.roomId;
    const itemDbId = gateAuction.auctionItemId;

    try {
      const tokenPromise = getLiveKitToken(targetRoomId, itemDbId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 8000)
      );

      const tokenPayload = await Promise.race([tokenPromise, timeoutPromise]);
      if (!tokenPayload?.success) {
        throw new Error(tokenPayload?.error || "Could not connect to the live auction.");
      }
      router.push(`/auctions/live/${targetRoomId}?token=${tokenPayload.token}&id=${itemDbId}`);
    } catch (err) {
      console.error("Post-payment join error:", err);
      alert("Payments confirmed, but the room connection failed. Please tap Join Live again.");
    }
  };

  // Format time remaining
  const getTimeRemaining = (endTime) => {
    if (!endTime) return "N/A";
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6 pb-16 md:pb-6">

      {/* Two-step access payment gate (entry fee → bidding deposit) */}
      {gateAuction && (
        <AuctionAccessGate
          open={Boolean(gateAuction)}
          onClose={() => setGateAuction(null)}
          auctionItemId={gateAuction.auctionItemId}
          roomId={gateAuction.roomId}
          onAccessGranted={handleAccessGranted}
        />
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-[var(--color-bg)] rounded-2xl p-5 sm:p-6 shadow-lg shadow-[var(--color-primary)]/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
              <Tv className="w-5 h-5" /> Live Auction Floor
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--color-bg)]/70 max-w-xl leading-relaxed">
              Browse active auctions, join live streams, and place bids on premium real estate and vehicles in real-time.
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-5 py-3 shrink-0 flex items-center gap-4 self-start sm:self-center">
            <div className="text-center">
              <span className="block text-xl sm:text-2xl font-black leading-none">{activeAuctions.length}</span>
              <span className="text-[9px] uppercase tracking-wider font-bold mt-1 block opacity-70">Listings</span>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-center">
              <span className="block text-xl sm:text-2xl font-black leading-none">
                {activeAuctions.filter((auction) => ["ACTIVE", "LIVE"].includes(auction.status)).length}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold mt-1 block opacity-70">Live Now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auction Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-xs font-black tracking-wider uppercase text-[var(--color-text)]">
              Auction Listings ({activeAuctions.length})
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
            <TrendingUp className="w-3 h-3" />
            <span>Sorted by closing soon</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 animate-pulse">
                <div className="h-40 bg-[var(--color-input)] rounded-xl mb-4" />
                <div className="h-4 bg-[var(--color-input)] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[var(--color-input)] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : activeAuctions.length === 0 ? (
          <div className="bg-[var(--color-card)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
            <Tv className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4 opacity-50" />
            <p className="text-sm text-[var(--color-muted)] font-medium">
              No scheduled or live auctions at the moment. Check back soon!
            </p>
            {activeAuctions.length === 0 && (
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/20"
              >
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAuctions.map((auction) => (
              <div 
                key={auction.id || auction.roomId} 
                className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm flex flex-col group hover:border-[var(--color-primary)]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-primary)]/5"
              >
                {/* Image */}
                <div className="relative h-44 w-full overflow-hidden">
                  {auction.imageUrl || auction.asset?.images?.[0]?.url ? (
                    <img 
                      src={auction.imageUrl || auction.asset?.images?.[0]?.url} 
                      alt={auction.itemTitle || auction.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-card)] to-[var(--color-input)]">
                      <Tv className="w-10 h-10 text-[var(--color-muted)] opacity-30" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      ["ACTIVE", "LIVE"].includes(auction.status)
                        ? "bg-red-500 text-white" 
                        : "bg-[var(--color-secondary)] text-white"
                    }`}>
                      {["ACTIVE", "LIVE"].includes(auction.status) && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      {auction.status === "UPCOMING" ? "SCHEDULED" : auction.status || "ACTIVE"}
                    </span>
                  </div>

                  {/* Category Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-primary)] px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-[var(--color-primary)]/20">
                      {auction.category || auction.asset?.category || "PROPERTY"}
                    </span>
                  </div>

                  {/* Time remaining overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="bg-[var(--color-bg)]/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-[var(--color-border)]">
                      <Clock className="w-3 h-3 text-[var(--color-primary)]" />
                      {auction.status === "UPCOMING"
                        ? `Starts in ${getTimeRemaining(auction.startTime)}`
                        : `Closes in ${getTimeRemaining(auction.endTime)}`}
                    </span>
                    <span className="bg-[var(--color-bg)]/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-[var(--color-border)]">
                      <Users className="w-3 h-3 text-[var(--color-primary)]" />
                      {auction.bidCount || 0} bids
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
                      {auction.itemTitle || auction.asset?.title || auction.title || "Premium Auction Item"}
                    </h3>
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--color-muted)]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">Client: {auction.location || auction.asset?.location || "N/A"}</span>
                    </div>
                  </div>

                  {/* Price Info */}
                  <div className="bg-[var(--color-input)] p-3 rounded-xl border border-[var(--color-border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-muted)] uppercase font-bold tracking-wider">Current Bid</span>
                      <span className="text-sm font-black text-[var(--color-primary)]">
                        MWK {Number(auction.currentBid || auction.startingBid || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                      <span className="text-[10px] text-[var(--color-muted)] uppercase font-bold tracking-wider">Starting</span>
                      <span className="text-xs font-bold text-[var(--color-text)]">
                        MWK {Number(auction.startingBid || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                      <span className="text-[10px] text-[var(--color-muted)] uppercase font-bold tracking-wider">Entry Fee</span>
                      <span className="text-xs font-bold text-[var(--color-text)]">
                        MWK {Number(auction.depositAmount || 50000).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                      <span className="text-[10px] text-[var(--color-muted)] uppercase font-bold tracking-wider">Bidding Funds / Security Deposit</span>
                      <span className="text-xs font-bold text-[var(--color-text)]">
                        MWK {Number(auction.biddingFee || 5000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isJoiningId !== null || !["ACTIVE", "LIVE"].includes(auction.status)}
                      onClick={() => handleJoinAuction(auction)}
                      className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/20 flex items-center justify-center gap-1.5"
                    >
                      {isJoiningId === (auction.roomId || auction.id) ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Joining...</>
                      ) : (
                        <><Tv className="w-3.5 h-3.5" /> Join Auction</>
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