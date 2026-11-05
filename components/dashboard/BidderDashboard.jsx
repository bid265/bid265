"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gavel,
  Clock,
  Trophy,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Package,
  Calendar,
  Activity,
  ChevronRight,
  AlertCircle,
  Zap,
} from "lucide-react";

export default function BidderDashboard({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/dashboard/bidder");
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load dashboard");
        }

        setDashboard(json.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "MWK 0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MWK",
      minimumFractionDigits: 2,
    }).format(Number(amount));
  };

  const getAuctionHref = (auctionItem) => auctionItem.liveRoomId
    ? `/auctions/live/${encodeURIComponent(auctionItem.liveRoomId)}?id=${encodeURIComponent(auctionItem.id)}`
    : "/marketplace?tab=auctions";

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
    if (days > 0) return `${days}d ${hours}h left`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      WINNING: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      OUTBID: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      ACTIVE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      WON: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      LOST: "bg-slate-500/10 text-slate-600 border-slate-500/20",
      PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      APPROVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      REJECTED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      UPCOMING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      CLOSED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    };
    return styles[status] || styles.ACTIVE;
  };

  // ── LOADING STATE ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--color-input)] rounded w-64 mb-2" />
          <div className="h-4 bg-[var(--color-input)] rounded w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[var(--color-input)] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-[var(--color-input)] rounded-2xl" />
          <div className="h-80 bg-[var(--color-input)] rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── ERROR STATE ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-[var(--color-card)] p-8 rounded-2xl border border-[var(--color-border)] shadow-sm text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 opacity-70" />
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Failed to Load Dashboard</h2>
        <p className="text-sm text-[var(--color-muted)] mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  const {
    stats,
    recentBids,
    winningBids,
    upcomingAuctions,
  } = dashboard;

  // ── MAIN DASHBOARD ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Bidder Dashboard</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            View your bidding activity, current wins, and upcoming auctions.
          </p>
        </div>
        <Link href="/dashboard?tab=live-auctions" onClick={() => onNavigate("live-auctions")}>
          <button className="inline-flex items-center gap-2 bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/20">
            <Zap className="w-4 h-4" />
            Browse Auctions
          </button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Bids",
            value: stats.totalBids,
            icon: Gavel,
            trend: null,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Winning",
            value: stats.winningBids,
            icon: Trophy,
            trend: null,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Outbid",
            value: stats.outbidCount,
            icon: TrendingDown,
            trend: null,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: "Total Spent",
            value: formatCurrency(stats.totalSpent),
            icon: Wallet,
            trend: null,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 hover:border-[var(--color-primary)]/20 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              {stat.trend !== null && stat.trend !== undefined && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                    stat.trend >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {stat.trend >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {Math.abs(stat.trend)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Recent Bids & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Bids Table */}
          <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Bids</h2>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Your latest bidding activity
                </p>
              </div>
              <Link href="/dashboard?tab=my-bids" onClick={() => onNavigate("my-bids")}>
                <button className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                  View All
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>

            {recentBids.length === 0 ? (
              <div className="p-8 border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-input)]/30 text-center">
                <Gavel className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-2 opacity-50" />
                <p className="text-sm text-[var(--color-muted)]">No bids placed yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-input)]/50 border-b border-[var(--color-border)]">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase">Asset</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase hidden sm:table-cell">Category</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase">Amount</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase">Status</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {recentBids.map((bid) => (
                      <tr key={bid.id} className="hover:bg-[var(--color-input)]/30 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-input)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
                              {bid.auctionItem.images?.[0]?.url ? (
                                <img src={bid.auctionItem.images[0].url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Package className="w-4 h-4 text-[var(--color-muted)]" />
                              )}
                            </div>
                            <p className="font-medium text-[var(--color-text)] truncate max-w-[160px]">
                              {bid.auctionItem.asset.title}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="text-xs text-[var(--color-muted)] bg-[var(--color-input)] px-2 py-1 rounded-full border border-[var(--color-border)]">
                            {bid.auctionItem.asset.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-[var(--color-text)]">
                          {formatCurrency(bid.amount)}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(bid.status)}`}>
                            {bid.status === "WINNING" ? <Trophy className="w-3 h-3" /> : bid.status === "OUTBID" ? <TrendingDown className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {bid.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[var(--color-muted)]">
                          {getTimeRemaining(bid.auctionItem.endTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Winning Bids Section */}
          {winningBids.length > 0 && (
            <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">Currently Winning</h2>
                    <p className="text-xs text-[var(--color-muted)]">Auctions where you hold the highest bid</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {winningBids.map((bid) => (
                  <div
                    key={bid.id}
                    className="border border-[var(--color-border)] rounded-xl p-4 hover:border-emerald-500/30 transition-all bg-emerald-500/5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-input)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
                          {bid.auctionItem.images?.[0]?.url ? (
                            <img src={bid.auctionItem.images[0].url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <Package className="w-5 h-5 text-[var(--color-muted)]" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-text)] text-sm">{bid.auctionItem.asset.title}</p>
                          <p className="text-xs text-[var(--color-muted)]">{bid.auctionItem.asset.category}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <Trophy className="w-3 h-3" />
                        Winning
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-[var(--color-muted)]">Your Bid</p>
                        <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(bid.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--color-muted)]">Time Left</p>
                        <p className="text-sm font-semibold text-amber-500">{getTimeRemaining(bid.auctionItem.endTime)}</p>
                      </div>
                    </div>
                    <Link href={getAuctionHref(bid.auctionItem)}>
                      <button className="w-full mt-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20">
                        View Auction
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Auctions */}
          {upcomingAuctions.length > 0 && (
            <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">Upcoming Auctions</h2>
                    <p className="text-xs text-[var(--color-muted)]">Auctions starting soon you may be interested in</p>
                  </div>
                </div>
                <Link href="/dashboard?tab=live-auctions" onClick={() => onNavigate("live-auctions")}>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                    View All
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingAuctions.map((auction) => (
                  <div
                    key={auction.id}
                    className="border border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-primary)]/30 transition-all group"
                  >
                    <div className="h-32 bg-[var(--color-input)] relative overflow-hidden">
                      {auction.images?.[0]?.url ? (
                        <img
                          src={auction.images[0].url}
                          alt={auction.asset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-[var(--color-muted)] opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 backdrop-blur-sm">
                          <Calendar className="w-3 h-3" />
                          {auction.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-[var(--color-text)] text-sm mb-1 truncate">{auction.asset.title}</p>
                      <p className="text-xs text-[var(--color-muted)] mb-3">{auction.asset.category} &bull; {auction.asset.location}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[var(--color-muted)]">Starting Bid</p>
                          <p className="font-bold text-[var(--color-text)]">{formatCurrency(auction.startingBid)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--color-muted)]">Starts</p>
                          <p className="text-xs font-semibold text-blue-500">{formatDate(auction.startTime)}</p>
                        </div>
                      </div>
                      <Link href={getAuctionHref(auction)}>
                        <button className="w-full mt-3 py-2 rounded-lg text-xs font-semibold bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white transition-all">
                          View Details
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4 uppercase tracking-wider">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Browse Auctions", href: "/dashboard?tab=live-auctions", tab: "live-auctions", icon: Gavel, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "My Bids", href: "/dashboard?tab=my-bids", tab: "my-bids", icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "My Receipts", href: "/dashboard?tab=payments", tab: "payments", icon: Receipt, color: "text-violet-500", bg: "bg-violet-500/10" },
              ].map((action) => (
                <Link key={action.label} href={action.href} onClick={action.tab ? () => onNavigate(action.tab) : undefined}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-input)] transition-all group cursor-pointer">
                    <div className={`p-2 rounded-lg ${action.bg} group-hover:scale-110 transition-transform`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                      {action.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-muted)] ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}