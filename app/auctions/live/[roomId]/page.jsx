"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  closeLiveAuctionDirectly,
  getLiveKitToken,
  getAuctionItemDetails,
  submitLiveBid,
  updateAuctionControls,
} from "@/app/actions/liveAuction";
import Pusher from "pusher-js";
import { 
  ArrowLeft, 
  Clock, 
  Send,
  Loader2,
  Crown,
  User,
  MapPin,
  Power,
  Clock3,
} from "lucide-react";

export default function LiveRoomPage({ params }) {
  const unpackedParams = use(params);
  const roomId = unpackedParams.roomId;
  const searchParams = useSearchParams();
  const auctionItemId = searchParams.get("id");
  const router = useRouter();

  const [token, setToken] = useState("");
  const [bids, setBids] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState("BIDDER"); 
  const [currentUser, setCurrentUser] = useState(null);
  const [bidError, setBidError] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [bidSuccess, setBidSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [auctionItem, setAuctionItem] = useState(null);
  const [highestBid, setHighestBid] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [isAuctionClosed, setIsAuctionClosed] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [controlError, setControlError] = useState("");

  const bidInputRef = useRef(null);

  // Fetch auction item
  useEffect(() => {
    async function loadItem() {
      if (!auctionItemId) return;
      try {
        const res = await getAuctionItemDetails(auctionItemId);
        if (res.success) {
          setAuctionItem(res.data);
          setIsSettled(res.data.status === "CLOSED");
          if (res.data.status === "CLOSED") setIsAuctionClosed(true);
          setBids(res.data.bids || []);
          setHighestBid(res.data.currentHighestBid || Number(res.data.startingBid));
          setParticipants(res.data.participantCount || 0);

          const end = new Date(res.data.endTime);
          const now = new Date();
          const diff = end - now;
          if (diff <= 0) {
            setIsAuctionClosed(true);
            setTimeLeft("00:00:00");
          } else {
            const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
            setTimeLeft(`${h}:${m}:${s}`);
          }
        } else {
          setBidError(res.error || "Failed to load.");
        }
      } catch (err) {
        setBidError("Network error.");
      } finally {
        setIsLoading(false);
      }
    }
    loadItem();
  }, [auctionItemId]);

  // Countdown
  useEffect(() => {
    if (!auctionItem || isAuctionClosed) return;
    const timer = setInterval(() => {
      const end = new Date(auctionItem.endTime);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) {
        setIsAuctionClosed(true);
        setTimeLeft("00:00:00");
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        setTimeLeft(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auctionItem, isAuctionClosed]);

  // Pusher
  useEffect(() => {
    if (!auctionItemId) return;
    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || "", {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
    });
    const channel = pusherClient.subscribe(`auction-room-${auctionItemId}`);

    channel.bind("new-bid", (incomingBid) => {
      setBids((prev) => {
        const exists = prev.find(b => b.id === incomingBid.id);
        if (exists) return prev;
        return [incomingBid, ...prev];
      });
      setHighestBid(Number(incomingBid.amount));
    });
    channel.bind("auction-control-updated", (controls) => {
      setAuctionItem((current) => current ? {
        ...current,
        endTime: controls.endTime || current.endTime,
        reservePriceDisclosed: Boolean(controls.reservePriceDisclosed),
        reservePrice: controls.reservePrice ?? null,
      } : current);
    });
    channel.bind("auction-closed", () => {
      setIsAuctionClosed(true);
      setIsSettled(true);
      setTimeLeft("00:00:00");
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`auction-room-${auctionItemId}`);
    };
  }, [auctionItemId]);

  // Token
  useEffect(() => {
    async function fetchRoomPass() {
      try {
        const res = await getLiveKitToken(roomId, auctionItemId);
        if (res?.success) {
          setToken(res.token);
          try {
            const base64Url = res.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const parsedToken = JSON.parse(jsonPayload);
            if (parsedToken.sub?.startsWith("auctioneer")) setCurrentUserRole("AUCTIONEER");
            else if (parsedToken.sub?.startsWith("admin")) setCurrentUserRole("ADMIN");
            else setCurrentUserRole("BIDDER");
            setCurrentUser({ name: parsedToken.name, sub: parsedToken.sub });
          } catch (e) {}
        } else {
          setBidError(res?.error || "Auth failed.");
        }
      } catch (err) {
        setBidError("Auth failed.");
      }
    }
    if (roomId) fetchRoomPass();
  }, [roomId, auctionItemId]);

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    if (!bidAmount || isNaN(Number(bidAmount))) return;
    if (isAuctionClosed) { setBidError("Auction ended."); return; }
    if (Number(bidAmount) > Number(auctionItem.maximumBid)) {
      setBidError(`Your maximum bid is MWK ${Number(auctionItem.maximumBid).toLocaleString()}, based on your paid bidding deposit.`);
      return;
    }

    setIsPlacingBid(true);
    setBidError("");
    setBidSuccess("");

    try {
      const res = await submitLiveBid(auctionItemId, Number(bidAmount));
      if (res.success) {
        setBidSuccess(`MWK ${Number(bidAmount).toLocaleString()} placed.`);
        setBidAmount("");
        setHighestBid(Number(bidAmount));
      } else {
        setBidError(res.error || "Bid failed.");
      }
    } catch (err) {
      setBidError("Network error.");
    } finally {
      setIsPlacingBid(false);
    }
  };

  const quickBid = useCallback((amount) => {
    if (isAuctionClosed) { setBidError("Auction ended."); return; }
    if (amount > Number(auctionItem?.maximumBid)) {
      setBidError(`Your maximum bid is MWK ${Number(auctionItem?.maximumBid).toLocaleString()}, based on your paid bidding deposit.`);
      return;
    }
    setBidAmount(String(amount));
    bidInputRef.current?.focus();
  }, [auctionItem?.maximumBid, isAuctionClosed]);

  const handleControlUpdate = async (controls) => {
    setIsUpdatingControls(true);
    setControlError("");
    try {
      const result = await updateAuctionControls(auctionItemId, controls);
      if (!result.success) throw new Error(result.error || "Could not update auction controls.");
      setAuctionItem((current) => current ? { ...current, ...result.data } : current);
      if (result.notificationError) setControlError(result.notificationError);
    } catch (error) {
      setControlError(error.message || "Could not update auction controls.");
    } finally {
      setIsUpdatingControls(false);
    }
  };

  const handleCloseAuction = async () => {
    if (!window.confirm("End this live auction and settle its bids?")) return;
    setIsUpdatingControls(true);
    setControlError("");
    try {
      const result = await closeLiveAuctionDirectly(auctionItemId);
      if (!result.success) throw new Error(result.error || "Could not close this auction.");
      setIsAuctionClosed(true);
      setIsSettled(true);
      setTimeLeft("00:00:00");
      if (result.closeNotificationError) setControlError(result.closeNotificationError);
    } catch (error) {
      setControlError(error.message || "Could not close this auction.");
    } finally {
      setIsUpdatingControls(false);
    }
  };

  const handleLeaveRoom = () => window.location.assign("/dashboard?tab=live-auctions");

  const leadingBidders = new Map();
  for (const bid of [...bids].sort((left, right) => Number(right.amount) - Number(left.amount))) {
    if (bid.bidderId !== undefined && bid.bidderId !== null && !leadingBidders.has(bid.bidderId)) {
      leadingBidders.set(bid.bidderId, bid);
    }
  }
  const leaderboard = [...leadingBidders.values()];

  if (!isLoading && bidError && (!token || !auctionItem)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}>
        <p className="text-sm text-red-400">{bidError}</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard?tab=live-auctions")}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white"
        >
          Return to live auctions
        </button>
      </div>
    );
  }

  if (isLoading || !token || !auctionItem) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4"
           style={{ backgroundColor: "var(--color-bg)" }}>
        <div className="w-10 h-10 rounded-full border-4 animate-spin"
             style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-primary)" }} />
        <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>
          {isLoading ? "Loading..." : "Connecting..."}
        </p>
      </div>
    );
  }

  const isAuctioneer = currentUserRole === "AUCTIONEER" || currentUserRole === "ADMIN";
  const primaryImage = auctionItem.images?.find(img => img.isPrimary)?.url 
    || auctionItem.images?.[0]?.url 
    || "/placeholder-property.jpg";
  const attrEntries = Object.entries(auctionItem.asset?.attributes || {});

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans antialiased"
         style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
              style={{ backgroundColor: "rgba(11, 30, 38, 0.9)", borderColor: "var(--color-border)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={handleLeaveRoom}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <ArrowLeft size={13} /> Exit
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" 
                 style={{ backgroundColor: isAuctionClosed ? "#ef4444" : "var(--color-primary)" }} />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase"
                  style={{ color: isAuctionClosed ? "#ef4444" : "var(--color-primary)" }}>
              {isAuctionClosed ? "Ended" : "Live"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
            {participants} bidders
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: isAuctioneer ? "rgba(165,236,96,0.1)" : "var(--color-input)",
                  color: isAuctioneer ? "var(--color-primary)" : "var(--color-muted)",
                  border: `1px solid ${isAuctioneer ? "var(--color-primary)" : "var(--color-border)"}`
                }}>
            {isAuctioneer ? <Crown size={10} className="inline mr-1" /> : <User size={10} className="inline mr-1" />}
            {currentUserRole}
          </span>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">

        {/* LEFT: Image + Details */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">

          {/* Image */}
          <div className="relative h-[38vh] min-h-[200px] max-h-[340px] rounded-2xl overflow-hidden border flex-shrink-0"
               style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="relative h-full w-full">
              <Image
                src={primaryImage}
                alt={auctionItem.asset?.title || "Auction listing"}
                fill
                sizes="(max-width: 1024px) 100vw, 75vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1E26] via-transparent to-transparent opacity-50" />

              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold"
                      style={{ backgroundColor: "rgba(165,236,96,0.15)", color: "var(--color-primary)" }}>
                  LOT #{auctionItem.id}
                </span>
                <span className="px-2 py-1 rounded-md text-[10px]"
                      style={{ backgroundColor: "var(--color-input)", color: "var(--color-muted)" }}>
                  {auctionItem.asset?.category}
                </span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h1 className="text-2xl font-black mb-1">{auctionItem.asset?.title}</h1>
                <p className="text-xs flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                  <MapPin size={11} /> Client: {auctionItem.asset?.location || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Details - scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-0">

            <div className="rounded-xl p-5 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {auctionItem.asset?.description}
              </p>
            </div>

            {attrEntries.length > 0 && (
              <div className="rounded-xl p-5 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attrEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg p-2.5" style={{ backgroundColor: "var(--color-input)" }}>
                      <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--color-muted)" }}>{key}</p>
                      <p className="text-xs font-bold font-mono">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Starting</p>
                <p className="text-sm font-black font-mono" style={{ color: "var(--color-primary)" }}>
                  {Number(auctionItem.startingBid).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Entry Fee</p>
                <p className="text-sm font-black font-mono">{Number(auctionItem.depositAmount).toLocaleString()}</p>
              </div>
              <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Ends</p>
                <p className="text-sm font-black font-mono" style={{ color: isAuctionClosed ? "#ef4444" : "var(--color-primary)" }}>
                  {timeLeft}
                </p>
              </div>
            </div>
            {auctionItem.reservePrice !== null && auctionItem.reservePrice !== undefined && (
              <div className="rounded-xl border p-3 text-sm" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                <span style={{ color: "var(--color-muted)" }}>Reserve price: </span>
                <strong style={{ color: "var(--color-primary)" }}>MWK {Number(auctionItem.reservePrice).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="w-full lg:w-[340px] flex flex-col gap-3 min-h-0 flex-shrink-0 overflow-y-auto custom-scrollbar">

          {/* Highest Bid */}
          <div className="rounded-2xl p-5 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: "var(--color-muted)" }}>
              Current Highest Bid
            </p>
            <p className="text-3xl font-black font-mono tracking-tight" style={{ color: "var(--color-primary)" }}>
              MWK {highestBid.toLocaleString()}
            </p>
            <p className="text-[10px] mt-1.5" style={{ color: "var(--color-muted)" }}>
              {bids.length} total bids
            </p>
          </div>

          {!isAuctioneer && (
            <div className="rounded-2xl border p-4" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Remaining deposit balance</p>
              <p className="mt-1 text-xl font-black font-mono" style={{ color: "var(--color-primary)" }}>
                MWK {Number(auctionItem.bidderBalance || 0).toLocaleString()}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--color-muted)" }}>
                {auctionItem.refundStatus === "PENDING"
                  ? "Refund pending administrator payout through PayChangu."
                  : auctionItem.refundStatus === "PROCESSED"
                    ? "Refund marked paid by the administrator."
                    : "Your paid bidding deposit less your leading bid."}
              </p>
            </div>
          )}

          {/* Bidder leaderboard */}
          <div className="rounded-2xl border p-4" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
              <Crown size={13} /> Leaderboard
            </p>
            <p className="mb-2 text-[9px]" style={{ color: "var(--color-muted)" }}>
              {leaderboard.length} bidders ranked by their highest bid · {bids.length} total bids
            </p>
            {leaderboard.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>No bids have been placed yet.</p>
            ) : (
              <ol className="max-h-40 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {leaderboard.map((bid, index) => (
                  <li
                    key={bid.bidderId}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs"
                    style={{ backgroundColor: index === 0 ? "rgba(165,236,96,0.08)" : "transparent" }}
                  >
                    <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <span className="shrink-0 font-mono" style={{ color: index === 0 ? "var(--color-primary)" : "var(--color-muted)" }}>
                        {index + 1}.
                      </span>
                      <span className="truncate">{bid.bidderName || "Bidder"}</span>
                      {index === 0 && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ backgroundColor: "rgba(165,236,96,0.15)", color: "var(--color-primary)" }}>
                          Leading
                        </span>
                      )}
                    </span>
                    <strong className="shrink-0 font-mono" style={{ color: index === 0 ? "var(--color-primary)" : "var(--color-muted)" }}>
                      MWK {Number(bid.amount).toLocaleString()}
                    </strong>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Bid Form or Results */}
          {!isAuctioneer && (
            <div className="rounded-2xl p-5 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>

              {isAuctionClosed ? (
                <div className="text-center py-6">
                  <Clock size={28} className="mx-auto mb-3" style={{ color: "#ef4444" }} />
                  <p className="text-sm font-bold mb-1" style={{ color: "#ef4444" }}>Auction Ended</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Final bid: MWK {highestBid.toLocaleString()}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] mb-3" style={{ color: "var(--color-muted)" }}>
                    Maximum bid: <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                      MWK {Number(auctionItem.maximumBid).toLocaleString()}
                    </span> (your paid bidding deposit)
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[5000, 10000, 25000].filter((inc) => highestBid + inc <= Number(auctionItem.maximumBid)).map((inc) => (
                      <button key={inc} onClick={() => quickBid(highestBid + inc)}
                        className="py-2 rounded-lg text-[10px] font-bold font-mono transition-all hover:opacity-80"
                        style={{ backgroundColor: "rgba(65,147,16,0.1)", color: "var(--color-secondary)", border: "1px solid rgba(65,147,16,0.2)" }}>
                        +{inc/1000}K
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmitBid} className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold" style={{ color: "var(--color-muted)" }}>MWK</span>
                      <input
                        ref={bidInputRef}
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`${(highestBid + 1).toLocaleString()}`}
                        className="w-full pl-11 pr-3 py-2.5 rounded-lg text-sm font-mono font-bold outline-none"
                        style={{ backgroundColor: "var(--color-input)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                        min={highestBid + 1}
                        max={auctionItem.maximumBid}
                        disabled={isPlacingBid || highestBid >= Number(auctionItem.maximumBid)}
                      />
                    </div>
                    <button type="submit" disabled={isPlacingBid || !bidAmount || highestBid >= Number(auctionItem.maximumBid)}
                      className="px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-primary)", color: "var(--color-bg)" }}>
                      {isPlacingBid ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Bid
                    </button>
                  </form>
                  {highestBid >= Number(auctionItem.maximumBid) && (
                    <p className="mt-2 text-xs text-center" style={{ color: "var(--color-muted)" }}>
                      The maximum bid allowed by your paid deposit has been reached.
                    </p>
                  )}
                </>
              )}

              {bidError && (
                <p className="mt-3 text-xs text-center py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#ef4444" }}>
                  {bidError}
                </p>
              )}
              {bidSuccess && (
                <p className="mt-3 text-xs text-center py-2 rounded-lg" style={{ backgroundColor: "rgba(165,236,96,0.06)", color: "var(--color-primary)" }}>
                  {bidSuccess}
                </p>
              )}
            </div>
          )}

          {/* Auctioneer */}
          {isAuctioneer && (
            <div className="rounded-2xl p-5 border" style={{ backgroundColor: "rgba(165,236,96,0.03)", borderColor: "rgba(165,236,96,0.15)" }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--color-muted)" }}>Auction controls</p>
              <p className="text-sm font-bold mb-3">{currentUser?.name || currentUserRole}</p>
              <label className="mb-3 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(auctionItem.reservePriceDisclosed)}
                  disabled={isUpdatingControls || isAuctionClosed}
                  onChange={(event) => handleControlUpdate({ reservePriceDisclosed: event.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                Disclose reserve price to bidders
              </label>
              <div className="mb-3 rounded-xl border p-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-input)" }}>
                <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: "var(--color-muted)" }}>
                  <Clock3 size={12} /> Extend bidding time
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20].map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      disabled={isUpdatingControls || isAuctionClosed}
                      onClick={() => handleControlUpdate({ extendSeconds: seconds })}
                      className="rounded-lg border px-2 py-1.5 text-[10px] font-bold disabled:opacity-50"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      +{seconds}s
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAuction}
                disabled={isUpdatingControls || isSettled}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold disabled:opacity-50"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                {isUpdatingControls ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                {isSettled ? "Auction settled" : isAuctionClosed ? "Settle auction" : "End auction"}
              </button>
              {controlError && <p className="mt-2 text-xs text-rose-400" role="alert">{controlError}</p>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}