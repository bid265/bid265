"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gavel,
  Eye,
  Clock,
  Trophy,
  ArrowUpRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Mybids() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  // Fetch bids from API
  useEffect(() => {
    async function fetchMyBids() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.append("status", statusFilter);
        if (searchQuery.trim()) params.append("search", searchQuery.trim());
        params.append("page", String(page));
        params.append("limit", "20");

        const res = await fetch(`/api/bids/my-bids?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch bids");
        }

        setBids(json.data || []);
        setMeta(json.meta || { total: 0, totalPages: 1 });
      } catch (err) {
        console.error("Failed to fetch bids:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMyBids();
  }, [statusFilter, searchQuery, page]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const getStatusBadge = (status) => {
    const styles = {
      WINNING: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      OUTBID: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      ACTIVE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      WON: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      LOST: "bg-slate-500/10 text-slate-600 border-slate-500/20",
      PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return styles[status] || styles.ACTIVE;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "WINNING":
        return <Trophy className="w-3.5 h-3.5" />;
      case "OUTBID":
        return <ArrowUpRight className="w-3.5 h-3.5" />;
      case "WON":
        return <Trophy className="w-3.5 h-3.5" />;
      case "LOST":
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "MWK 0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MWK",
      minimumFractionDigits: 2,
    }).format(Number(amount));
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (endTime) => {
    if (!endTime) return "N/A";
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  // ── LOADING STATE ─────────────────────────────────────────────────
  if (loading && bids.length === 0) {
    return (
      <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">My Active Bids</h2>
        <p className="text-xs text-[var(--color-muted)] mb-6">
          View your active bids and recent auction activity.
        </p>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--color-input)] rounded w-48" />
          <div className="h-4 bg-[var(--color-input)] rounded w-72" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-[var(--color-input)] rounded-xl" />
            ))}
          </div>
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[var(--color-input)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR STATE ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">My Active Bids</h2>
        <p className="text-xs text-[var(--color-muted)] mb-6">
          View your active bids and recent auction activity.
        </p>
        <div className="p-12 border border-dashed border-rose-500/30 rounded-xl bg-rose-500/5 text-center">
          <p className="text-sm text-rose-600 font-medium">Failed to load bids</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── EMPTY STATE ───────────────────────────────────────────────────
  if (bids.length === 0 && !loading) {
    return (
      <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">My Active Bids</h2>
        <p className="text-xs text-[var(--color-muted)] mb-6">
          View your active bids and recent auction activity.
        </p>
        <div className="p-12 border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-input)]/30 text-center">
          <Gavel className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-sm text-[var(--color-muted)] font-medium">No active bids yet</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Browse live auctions to start bidding</p>
          <Link href="/marketplace?tab=auctions">
            <button className="mt-4 bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/20">
              Browse Auctions
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // ── MAIN TABLE VIEW ─────────────────────────────────────────────
  return (
    <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">My Active Bids</h2>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            View your active bids and recent auction activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Search bids..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 w-48 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="WINNING">Winning</option>
            <option value="OUTBID">Outbid</option>
            <option value="ACTIVE">Active</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
            <option value="PENDING">Settlement Pending</option>
          </select>
        </div>
      </div>

      {/* Bids Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-input)]/50 border-b border-[var(--color-border)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Asset
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider hidden sm:table-cell">
                Category
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                My Bid
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider hidden md:table-cell">
                Current Price
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider hidden lg:table-cell">
                Time Left
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {bids.map((bid) => (
              <tr
                key={bid.id}
                className="hover:bg-[var(--color-input)]/30 transition-colors group"
              >
                {/* Asset Column */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-input)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
                      {bid.auctionItem.images?.[0]?.url ? (
                        <img
                          src={bid.auctionItem.images[0].url}
                          alt={bid.auctionItem.asset.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Gavel className="w-5 h-5 text-[var(--color-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text)] truncate max-w-[180px] group-hover:text-[var(--color-primary)] transition-colors">
                        {bid.auctionItem.asset.title}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        Lot #{bid.auctionItem.id}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="px-4 py-4 hidden sm:table-cell">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-input)] border border-[var(--color-border)] text-[var(--color-text)]">
                    {bid.auctionItem.asset.category}
                  </span>
                </td>

                {/* My Bid */}
                <td className="px-4 py-4">
                  <p className="font-bold text-[var(--color-text)]">
                    {formatCurrency(bid.amount)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatDate(bid.createdAt)}
                  </p>
                </td>

                {/* Current Price */}
                <td className="px-4 py-4 hidden md:table-cell">
                  <p className="font-semibold text-[var(--color-text)]">
                    {formatCurrency(bid.auctionItem.currentPrice)}
                  </p>
                  {bid.status === "OUTBID" && (
                    <p className="text-xs text-rose-500 font-medium">
                      +{formatCurrency(bid.auctionItem.currentPrice - bid.amount)} higher
                    </p>
                  )}
                  {bid.status === "WINNING" && (
                    <p className="text-xs text-emerald-500 font-medium">
                      You are highest
                    </p>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                      bid.status
                    )}`}
                  >
                    {getStatusIcon(bid.status)}
                    {bid.status}
                  </span>
                </td>

                {/* Time Left */}
                <td className="px-4 py-4 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5 text-[var(--color-text)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                    <span className="text-xs">
                      {getTimeRemaining(bid.auctionItem.endTime)}
                    </span>
                  </div>
                </td>

                {/* Action */}
                <td className="px-4 py-4 text-right">
                  <Link href={bid.auctionItem.liveRoomId
                    ? `/auctions/live/${encodeURIComponent(bid.auctionItem.liveRoomId)}?id=${encodeURIComponent(bid.auctionItem.id)}`
                    : "/marketplace?tab=auctions"}>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white transition-all">
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-muted)]">
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of{" "}
            {meta.total} bids
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-input)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-[var(--color-text)] font-medium px-2">
              {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-input)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty Filter State */}
      {bids.length === 0 && meta.total > 0 && (
        <div className="p-8 text-center border border-dashed border-[var(--color-border)] rounded-xl mt-4 bg-[var(--color-input)]/30">
          <Filter className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--color-muted)] font-medium">
            No bids match your filters
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setPage(1);
            }}
            className="mt-2 text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}