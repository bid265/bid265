"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, LayoutGrid, ArrowRight, Hourglass, Eye, CalendarPlus, Search, Filter, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { getLiveKitToken, resolveAuctionApproval, updateAuctionToLiveDirectly } from "@/app/actions/liveAuction";
import { hasClearedAuctionGate } from "@/app/actions/auctionAccess";
import AuctionAccessGate from "@/components/dashboard/AuctionAccessGate";
import AuctioneerAuctionControls from "@/components/dashboard/AuctioneerAuctionControls";
import { useRouter } from "next/navigation";

const createLiveRoomId = (itemId) => `room-lot-${itemId}-${Date.now()}`;

export default function AuctioneerLiveConsole({ auctionItems = [], onItemsUpdate }) {
  const router = useRouter();
  
  const [itemsList, setItemsList] = useState(auctionItems);
  const [isInitializingId, setIsInitializingId] = useState(null); 
  const [isActionLoadingId, setIsActionLoadingId] = useState(null);
  const [gateAuction, setGateAuction] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [managementListings, setManagementListings] = useState({});
  const [managementError, setManagementError] = useState("");
  const [resolvingApprovalId, setResolvingApprovalId] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const loadManagementListings = useCallback(async () => {
    try {
      setManagementError("");
      const response = await fetch("/api/listings");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load auction controls.");
      const listings = result.auctions || [];
      const listingsById = Object.fromEntries(listings.map((listing) => [listing.id, listing]));
      setManagementListings(listingsById);
      setItemsList((current) => current.map((item) => {
        const listing = listingsById[item.id];
        if (!listing) return item;
        return {
          ...item,
          reservePrice: listing.reservePrice,
          startingBid: listing.startingBid,
          depositAmount: listing.entryFee,
          biddingFee: listing.biddingDeposit,
          startTime: listing.startTime,
          endTime: listing.endTime,
          status: listing.status,
          asset: {
            ...item.asset,
            title: listing.title,
            description: listing.description,
            location: listing.clientName,
            category: listing.category,
          },
        };
      }));
    } catch (error) {
      setManagementError(error.message || "Failed to load auction controls.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadManagementListings, 0);
    return () => clearTimeout(timer);
  }, [loadManagementListings]);

  useEffect(() => {
    const interval = setInterval(loadManagementListings, 30000);
    return () => clearInterval(interval);
  }, [loadManagementListings]);

  useEffect(() => {
    const nextEndTime = itemsList
      .map((item) => new Date(item.endTime).getTime())
      .filter((endTime) => Number.isFinite(endTime) && endTime > currentTime)
      .sort((left, right) => left - right)[0];
    if (!nextEndTime) return undefined;

    const timeout = setTimeout(() => setCurrentTime(Date.now()), nextEndTime - currentTime);
    return () => clearTimeout(timeout);
  }, [itemsList, currentTime]);

  const handleAuctionDeleted = (auctionId) => {
    const updated = itemsList.filter((item) => item.id !== auctionId);
    syncItemsList(updated);
    setManagementListings((current) => {
      const next = { ...current };
      delete next[auctionId];
      return next;
    });
  };

  const enterLiveRoom = async (roomId, auctionItemId) => {
    const access = await hasClearedAuctionGate(auctionItemId);
    if (!access.success) throw new Error(access.error || "Could not verify auction access payments.");
    if (!access.cleared) {
      setGateAuction({ roomId, auctionItemId });
      return;
    }

    const tokenPayload = await getLiveKitToken(roomId, auctionItemId);
    if (!tokenPayload.success) throw new Error(tokenPayload.error || "Could not connect to the live auction.");
    router.push(`/auctions/live/${roomId}?token=${tokenPayload.token}&id=${auctionItemId}`);
  };

  const handleAccessGranted = async () => {
    if (!gateAuction) return;
    try {
      const tokenPayload = await getLiveKitToken(gateAuction.roomId, gateAuction.auctionItemId);
      if (!tokenPayload.success) throw new Error(tokenPayload.error || "Could not connect to the live auction.");
      router.push(`/auctions/live/${gateAuction.roomId}?token=${tokenPayload.token}&id=${gateAuction.auctionItemId}`);
    } catch (error) {
      alert(error.message || "Payments confirmed, but the room connection failed. Please try again.");
    }
  };

  const syncItemsList = (updatedList) => {
    setItemsList(updatedList);
    if (onItemsUpdate) onItemsUpdate(updatedList);
  };

  const handleDirectLiveInitialization = async (itemId) => {
    if (!itemId) return;
    try {
      setIsInitializingId(itemId);
      
      const computedRoomId = createLiveRoomId(itemId);
      const updateResult = await updateAuctionToLiveDirectly(itemId, computedRoomId);
      if (!updateResult?.success) {
        throw new Error(updateResult?.error || "Could not start this auction.");
      }

      const updated = itemsList.map(item => 
        item.id === Number(itemId) ? { ...item, status: "ACTIVE", liveRoomId: computedRoomId } : item
      );
      syncItemsList(updated);
      await enterLiveRoom(computedRoomId, Number(itemId));
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("signal connection") || err.message.includes("timeout")) {
        alert("⚠️ Signaling connection lost or timed out. Refreshing workspace interface...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert("Database initialization rejected: " + err.message);
      }
    } finally {
      setIsInitializingId(null);
    }
  };

  const handleWatchLiveRoom = async (item) => {
    try {
      setIsActionLoadingId(item.id);
      const targetRoomId = item.liveRoomId || `room-lot-${item.id}-active`;
      await enterLiveRoom(targetRoomId, Number(item.id));
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("timeout")) {
        alert("🔌 Network Link Timeout. Performing interface recovery...");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert("Could not pull connection pass token parameters: " + err.message);
      }
    } finally {
      setIsActionLoadingId(null);
    }
  };

  const handleResolveApproval = async (auctionItemId, decision) => {
    try {
      setResolvingApprovalId(auctionItemId);
      const result = await resolveAuctionApproval(auctionItemId, decision);
      if (!result.success) throw new Error(result.error || "Could not resolve this auction approval.");
      await loadManagementListings();
    } catch (error) {
      setManagementError(error.message || "Could not resolve this auction approval.");
    } finally {
      setResolvingApprovalId(null);
    }
  };

  const approvalItems = itemsList.filter((item) => item.status === "PENDING_APPROVAL");
  const visibleActiveItems = itemsList.filter((item) => {
    const text = `${item.asset?.title || ""} ${item.asset?.description || ""} ${item.asset?.location || ""}`.toLowerCase();
    const isLive = item.status === "ACTIVE" || item.status === "LIVE";
    const matchesStatus = !statusFilter || (statusFilter === "LIVE" ? isLive : !isLive);
    const endTime = item.endTime ? new Date(item.endTime).getTime() : Infinity;
    return !["CLOSED", "PENDING_APPROVAL"].includes(item.status) &&
      endTime > currentTime &&
      text.includes(search.trim().toLowerCase()) &&
      matchesStatus;
  });

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-text)]">Auctions</h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">Schedule an auction or manage your scheduled and live auctions.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/dashboard/add-listing?mode=auction")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
          >
            <CalendarPlus className="h-4 w-4" /> Schedule Auction
          </button>
        </div>
      </div>

      {gateAuction && (
        <AuctionAccessGate
          open
          onClose={() => setGateAuction(null)}
          auctionItemId={gateAuction.auctionItemId}
          roomId={gateAuction.roomId}
          onAccessGranted={handleAccessGranted}
        />
      )}

      {approvalItems.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
              Below-Reserve Approvals ({approvalItems.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {approvalItems.map((item) => {
              const listing = managementListings[item.id];
              return (
                <article key={item.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/30 bg-[var(--color-card)] p-4 shadow-sm md:p-5">
                  <div className="space-y-2">
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      Lot #{item.id} · Awaiting decision
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-text)]">{item.asset?.title || listing?.title || "Auction"}</h4>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Highest bid: {listing?.currentBid == null ? "No bid" : `MWK ${Number(listing.currentBid).toLocaleString()}`}
                        {listing?.currentBidder ? ` by ${listing.currentBidder}` : ""}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        Reserve price: MWK {Number(item.reservePrice ?? listing?.reservePrice).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">
                      The reserve was not met. Accept the highest bid to award the auction below reserve, or decline it.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(item.id, "ACCEPT")}
                      disabled={resolvingApprovalId !== null}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {resolvingApprovalId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Accept bid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(item.id, "DECLINE")}
                      disabled={resolvingApprovalId !== null}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Decline bid
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      
      {/* 📋 CAMPAIGNS BLOCK */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[var(--color-muted)]" />
            <h3 className="text-xs font-black tracking-wider uppercase text-[var(--color-muted)]">Scheduled &amp; Live Auctions ({visibleActiveItems.length})</h3>
          </div>
          <div className="flex w-full gap-2 sm:max-w-lg">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search auctions..."
                aria-label="Search auctions"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="auction-status-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-xs font-semibold text-[var(--color-text)]"
            >
              <Filter className="h-4 w-4" /> Filter
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {filtersOpen && (
          <div id="auction-status-filters" className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter auctions by status"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]"
              >
                <option value="">All scheduled and live</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="LIVE">Live</option>
              </select>
              <button type="button" onClick={() => { setSearch(""); setStatusFilter(""); }} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-muted)]">
                Clear filters
              </button>
            </div>
          </div>
        )}
        {managementError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-[var(--color-card)] px-4 py-3 text-xs text-red-400" role="alert">
            <span>{managementError}</span>
            <button type="button" onClick={loadManagementListings} className="font-bold underline">Retry</button>
          </div>
        )}

        {visibleActiveItems.length === 0 ? (
          <div className="bg-[var(--color-card)] border border-dashed border-[var(--color-border)] rounded-2xl p-8 text-center text-xs text-[var(--color-muted)]">
            No scheduled or live auctions. Use Schedule Auction to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleActiveItems.map((item) => {
              const isLive = item.status === "LIVE" || item.status === "ACTIVE";
              const isScheduled = item.status === "UPCOMING" || item.status === "SCHEDULED";
              
              return (
                <div key={item.id} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-[var(--color-muted)] bg-[var(--color-input)] px-2 py-0.5 rounded-md">Lot #{item.id}</span>
                      {isLive ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                        </span>
                      ) : (
                        <span className="bg-[var(--color-secondary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Hourglass className="w-3 h-3" /> Ready
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-text)] tracking-tight">{item.asset?.title || "Unnamed Property"}</h4>
                      <p className="text-xs text-[var(--color-muted)] line-clamp-2 mt-0.5">{item.asset?.description}</p>
                    </div>

                    <div className="text-[11px] font-medium text-[var(--color-muted)] grid grid-cols-1 gap-1 pt-1 border-t border-[var(--color-border)] mt-2">
                      <div>Starting Bid: <span className="font-bold text-[var(--color-text)]">MWK {Number(item.startingBid).toLocaleString()}</span></div>
                      <div>Reserve price: <span className="font-bold text-[var(--color-primary)]">MWK {Number(item.reservePrice).toLocaleString()}</span></div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    {isScheduled && managementListings[item.id] && (
                      <AuctioneerAuctionControls
                        listing={managementListings[item.id]}
                        onDeleted={handleAuctionDeleted}
                        onUpdated={loadManagementListings}
                      />
                    )}
                    {!isLive ? (
                      <button
                        type="button"
                        onClick={() => handleDirectLiveInitialization(item.id)}
                        disabled={isInitializingId !== null}
                        className="w-full text-center px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInitializingId === item.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Starting...</>
                        ) : (
                          <><ArrowRight className="w-3.5 h-3.5" /> Start Live Bidding</>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleWatchLiveRoom(item)}
                        disabled={isActionLoadingId !== null}
                        className="w-full text-center px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActionLoadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Eye className="w-3.5 h-3.5" /> Enter Auction</>}
                      </button>
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