"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CircleDollarSign, Gavel, Loader2, RefreshCw, RotateCcw } from "lucide-react";

const money = (value) => `MWK ${Number(value || 0).toLocaleString()}`;

const REASON_LABELS = {
  OUTBID: "Outbid - full refund",
  NO_BIDS: "No winner - full refund",
  RESERVE_NOT_MET: "Reserve not met - full refund",
  WINNER_REMAINDER: "Highest bidder - remainder",
};

const STATUS_STYLES = {
  PROCESSED: { label: "Refunded", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  PENDING: { label: "Pending", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  FAILED: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${style.className}`}>{style.label}</span>;
}

/**
 * Refunds tab shared by auctioneers and administrators.
 * Step 1: list the auctions. Step 2: selecting an auction shows its refunds,
 * the highest bid and the status of every refund.
 */
export default function AuctionRefunds({ role = "AUCTIONEER" }) {
  const isAdmin = role === "ADMIN";
  const [auctions, setAuctions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/refunds", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load auctions.");
      setAuctions(data.auctions || []);
    } catch (loadError) {
      setError(loadError.message || "Could not load auctions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (auctionId) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/refunds?auctionId=${auctionId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load refunds.");
      setDetail(data);
    } catch (loadError) {
      setError(loadError.message || "Could not load refunds.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (selected) loadDetail(selected); else loadAuctions(); }, 0);
    return () => clearTimeout(timer);
  }, [selected, loadAuctions, loadDetail]);

  const retryRefunds = async () => {
    setRetrying(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/auction-refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not process refunds.");
      setNotice(`${data.issued} refund(s) issued${data.failed ? `, ${data.failed} failed` : ""}.`);
      await loadDetail(selected);
    } catch (retryError) {
      setError(retryError.message || "Could not process refunds.");
    } finally {
      setRetrying(false);
    }
  };

  const recordManually = async (refundId) => {
    const gatewayReference = window.prompt("Enter the payout reference for this refund.");
    if (!gatewayReference?.trim()) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/auction-refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId, gatewayReference: gatewayReference.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record the refund.");
      setNotice(data.emailWarning || "Refund recorded and the bidder was notified.");
      await loadDetail(selected);
    } catch (recordError) {
      setError(recordError.message || "Could not record the refund.");
    }
  };

  const refresh = () => (selected ? loadDetail(selected) : loadAuctions());
  const hasOpenRefunds = detail?.refunds?.some((refund) => refund.status !== "PROCESSED");

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-3">
          {selected && (
            <button type="button" onClick={() => { setSelected(null); setDetail(null); setNotice(""); }} aria-label="Back to auctions" className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text)]">
              <CircleDollarSign className="h-5 w-5 text-[var(--color-primary)]" />
              {selected && detail ? `Refunds - ${detail.auction.title}` : "Refunds"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {selected
                ? "Outbid bidders are refunded in full; the highest bidder receives the remainder of the bidding deposit after the winning bid."
                : "Select an auction to see its refunds. Refunds are issued automatically when an auction concludes."}
            </p>
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh refunds" className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400" role="status">{notice}</p>}

      {loading && !(selected ? detail : auctions.length) ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" /></div>
      ) : !selected ? (
        auctions.length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-muted)]">
            {isAdmin ? "No auctions have been listed yet." : "You have not listed any auctions yet."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {auctions.map((auction) => (
              <button key={auction.id} type="button" onClick={() => { setDetail(null); setSelected(auction.id); }} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition hover:border-[var(--color-primary)]/50">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]"><Gavel className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />{auction.title}</h3>
                  <span className="rounded-full bg-[var(--color-input)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-muted)]">{auction.concluded ? "Concluded" : auction.status}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-[var(--color-muted)]">Highest bid</dt><dd className="font-bold text-[var(--color-text)]">{auction.highestBid != null ? money(auction.highestBid) : "No bids"}</dd></div>
                  <div><dt className="text-[var(--color-muted)]">Refunds</dt><dd className="font-bold text-[var(--color-text)]">{auction.refundCount}{auction.pendingCount ? ` (${auction.pendingCount} open)` : ""}</dd></div>
                  <div className="col-span-2"><dt className="text-[var(--color-muted)]">Total refunded value</dt><dd className="font-bold text-[var(--color-text)]">{money(auction.refundTotal)}</dd></div>
                </dl>
              </button>
            ))}
          </div>
        )
      ) : detail ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-[var(--color-muted)]">Highest bid</p><p className="font-bold text-[var(--color-text)]">{detail.auction.highestBid != null ? money(detail.auction.highestBid) : "No bids"}</p>{detail.auction.highestBidder && <p className="text-xs text-[var(--color-muted)]">{detail.auction.highestBidder}</p>}</div>
            <div><p className="text-xs text-[var(--color-muted)]">Reserve price</p><p className="font-bold text-[var(--color-text)]">{money(detail.auction.reservePrice)}</p></div>
            <div><p className="text-xs text-[var(--color-muted)]">Bidding deposit</p><p className="font-bold text-[var(--color-text)]">{money(detail.auction.biddingFee)}</p></div>
            <div><p className="text-xs text-[var(--color-muted)]">Auction status</p><p className="font-bold text-[var(--color-text)]">{detail.auction.concluded ? "Concluded" : detail.auction.status}</p></div>
          </div>

          {isAdmin && hasOpenRefunds && (
            <button type="button" onClick={retryRefunds} disabled={retrying} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Process open refunds now
            </button>
          )}

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            {detail.refunds.length === 0 ? (
              <p className="p-4 text-center text-sm text-[var(--color-muted)]">
                {detail.auction.concluded ? "No refunds were due for this auction." : "Refunds will appear here automatically once the auction concludes."}
              </p>
            ) : (
              <div className="space-y-3">
                {detail.refunds.map((refund) => (
                  <article key={refund.id} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-sm">
                      <strong className="text-[var(--color-text)]">{refund.bidderName} - {money(refund.amount)}{refund.isHighestBidder ? " (highest bidder)" : ""}</strong>
                      <p className="text-xs text-[var(--color-muted)]">{refund.bidderEmail}</p>
                      <p className="text-xs text-[var(--color-muted)]">{REASON_LABELS[refund.reason] || refund.reason}{refund.gatewayReference ? ` - Ref ${refund.gatewayReference}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={refund.status} />
                      {isAdmin && refund.status !== "PROCESSED" && (
                        <button type="button" onClick={() => recordManually(refund.id)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-text)]">Record payout</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
