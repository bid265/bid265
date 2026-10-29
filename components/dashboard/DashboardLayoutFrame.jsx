"use client";

import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/app/providers";
import { confirmAuctionAccessPayment, hasClearedAuctionGate } from "@/app/actions/auctionAccess";
import { 
  LogOut, 
  Gavel,
  LayoutDashboard,
  Tv, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  BarChart3,
  Settings,
  Sun,
  Moon,
  ShoppingBag,
  Home,
  Users,
  CircleDollarSign,
  BadgeCheck,
} from "lucide-react";

// Component Registry Imports
import BidderDashboard from "@/components/dashboard/BidderDashboard";
import AuctioneerLiveConsole from "@/components/dashboard/AuctioneerLiveConsole";
import BidderLiveConsole from "@/components/dashboard/BidderLiveConsole";
import AuctioneerManageAssets from "@/components/dashboard/AuctioneerManageAssets";
import AuctioneerAddListing from "@/components/dashboard/AuctioneerAddListing";
import BidderMarketplace from "@/components/dashboard/BidderMarketplace";
import PaymentHistory from "@/components/dashboard/PaymentHistory";
import AuctioneerFinance from "@/components/dashboard/AuctioneerFinance";
import Mybids from "./Mybids"
import AdminAuctioneerManager from "@/components/dashboard/AdminAuctioneerManager";
import AdminRefundManager from "@/components/dashboard/AdminRefundManager";
import AuctionRefunds from "@/components/dashboard/AuctionRefunds";
import AuctioneerPasswordChange from "@/components/dashboard/AuctioneerPasswordChange";
import AdminUserManager from "@/components/dashboard/AdminUserManager";

export default function DashboardLayoutFrame({ user, serializedAuctionItems, isAuctioneer, dashboardStats = null, adminUserCounts = { BIDDER: 0, AUCTIONEER: 0, ADMIN: 0 }, recentlyApprovedAuctioneers = [], forceTab = null, addListingInitialMode = "property" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const requestedTab = forceTab || searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab === "manage-auctions" ? "live-auctions" : requestedTab || (user?.role === "ADMIN" ? "dashboard" : "live-auctions")
  );
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [accessPaymentMessage, setAccessPaymentMessage] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [paymentBannerDismissed, setPaymentBannerDismissed] = useState(false);
  const paymentOutcome = searchParams.get("payment");
  const paymentAccessStep = searchParams.get("access_step");
  const paymentBanner = paymentBannerDismissed ? null : ({
    success: {
      tone: "emerald",
      text: paymentAccessStep === "next"
        ? "Payment confirmed and your receipt has been emailed. Open the auction again to pay the next step and enter the room."
        : "Payment confirmed. Your receipt has been emailed to you.",
    },
    failed: { tone: "red", text: "The payment did not go through. No money was taken - please try again." },
    pending: { tone: "amber", text: "Your payment is still being confirmed. It will update here shortly - check Receipts in a moment." },
    error: { tone: "red", text: "We could not confirm your payment right now. Check Receipts shortly, or try again." },
    unknown: { tone: "amber", text: "We could not find that payment reference." },
  })[paymentOutcome] || null;
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === "ADMIN";
  const isBidder = user?.role === "BIDDER";

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.replace(window.location.origin);
  };

  const dropdownRef = useRef(null);
  const handledPaymentReturn = useRef("");
  const returnedPaymentRef = searchParams.get("access_payment_ref");
  const returnedAuctionId = searchParams.get("access_auction_id");
  const returnedFeeType = searchParams.get("access_fee_type");
  const returnedRoomId = searchParams.get("access_room_id");

  // Derive live count from serializedAuctionItems to avoid synchronous setState in effects.
  // Keep a state fallback for compatibility, but prefer memoized derived value.
  const liveCount = React.useMemo(() => {
    if (!serializedAuctionItems) return 0;
    return serializedAuctionItems.filter(
      (item) => item.status === "LIVE" || item.status === "ACTIVE"
    ).length;
  }, [serializedAuctionItems]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (
      !returnedPaymentRef ||
      !returnedAuctionId ||
      !["ENTRY_FEE", "BIDDING_DEPOSIT", "BIDDING_FEE", "SECURITY_DEPOSIT"].includes(returnedFeeType) ||
      !["BIDDER", "AUCTIONEER"].includes(user?.role)
    ) return;

    const returnKey = `${returnedPaymentRef}:${returnedAuctionId}:${returnedFeeType}`;
    if (handledPaymentReturn.current === returnKey) return;
    handledPaymentReturn.current = returnKey;
    let isCurrent = true;

    async function verifyReturnedPayment() {
      try {
        const result = await confirmAuctionAccessPayment(returnedAuctionId, returnedFeeType, returnedPaymentRef);
        if (!isCurrent) return;
        if (!result.success) {
          setAccessPaymentMessage(`Payment verification failed: ${result.error}`);
        } else if (result.data?.status === "PAID") {
          const access = await hasClearedAuctionGate(returnedAuctionId);
          if (access.success && access.cleared && returnedRoomId) {
            router.replace(`/auctions/live/${encodeURIComponent(returnedRoomId)}?id=${encodeURIComponent(returnedAuctionId)}`);
            return;
          }
          setAccessPaymentMessage(
            access.success && !access.cleared
              ? "Payment confirmed. Complete any remaining access payment to enter the auction."
              : "Payment confirmed. You can now join the live auction."
          );
        } else if (result.data?.status === "FAILED") {
          setAccessPaymentMessage("PayChangu reported that the payment failed. Please try again.");
        } else {
          setAccessPaymentMessage("Payment is still processing. Rejoin the auction to check again.");
        }
      } catch (error) {
        if (isCurrent) {
          console.error("[Auction access return]", error);
          setAccessPaymentMessage("Could not verify the payment. Rejoin the auction to check again.");
        }
      } finally {
        if (isCurrent) router.replace("/dashboard?tab=live-auctions");
      }
    }
    verifyReturnedPayment();

    return () => {
      isCurrent = false;
    };
  }, [returnedPaymentRef, returnedAuctionId, returnedFeeType, returnedRoomId, user?.role, router]);

  const userInitials = user?.name ? user.name.substring(0, 2).toUpperCase() : "OP";

  const getTabLabel = (tab) => {
    const labels = {
      "dashboard": "Dashboard",
      "live-auctions": isAuctioneer ? "Manage Auctions" : "Live Auction Floor",
      "daily-sales": "Daily Sales",
      "properties": "Properties",
      "my-bids": "My Bids",
      "manage-listings": "Manage Listings",
      "add-listing": "Add Listing",
      "payments": isAuctioneer ? "Payments Received" : "Receipts",
      "reports": "Reports",
      "auctioneers": "Auctioneer Administration",
      "refunds": isAdmin ? "Refund Management" : "Refunds",
      "users": "User Management",
      "settings": "Settings"
    };
    return labels[tab] || tab;
  };

  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", show: true },
    { id: "live-auctions", icon: Tv, label: isAuctioneer ? "Manage Auctions" : "Live Auction Floor", show: !isAdmin, badge: liveCount },
    { id: "daily-sales", icon: ShoppingBag, label: "Daily Sales", show: isBidder || isAuctioneer },
    { id: "properties", icon: Home, label: "Properties", show: isBidder || isAuctioneer },
    { id: "my-bids", icon: Gavel, label: "My Bids", show: isBidder },
    { id: "auctioneers", icon: User, label: "Auctioneers", show: isAdmin },
    { id: "refunds", icon: CircleDollarSign, label: "Refunds", show: isAdmin || isAuctioneer },
    { id: "users", icon: Users, label: "User Management", show: isAdmin },
    { id: "payments", icon: Wallet, label: isAuctioneer ? "Payments Received" : "Receipts", show: true },
    { id: "reports", icon: BarChart3, label: "Reports", show: isAuctioneer },
    { id: "settings", icon: Settings, label: "Settings", show: true },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] font-sans fixed inset-0 flex-col md:flex-row">

      {/* ========================================================
          DESKTOP SIDEBAR NAVIGATION
         ======================================================== */}
      <aside 
        className={`hidden md:flex flex-col h-full bg-[var(--color-card)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out relative shrink-0 z-50 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-[var(--color-border)] overflow-hidden shrink-0">
          <div className="flex aspect-square h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white shadow-sm shadow-[var(--color-primary)]/20">
            <Gavel className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-bold text-xs uppercase tracking-tight text-[var(--color-text)]">TrustBid</span>
              <span className="text-[10px] text-[var(--color-muted)] font-semibold">Auction Platform</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          <nav className="space-y-1">
            {navItems.filter(item => item.show).map((item) => (
              <React.Fragment key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 relative group ${
                    activeTab === item.id
                      ? "bg-[var(--color-secondary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-input)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${activeTab === item.id ? "text-[var(--color-primary)]" : "text-[var(--color-muted)] group-hover:text-[var(--color-text)]"}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {!isCollapsed && item.badge > 0 && (
                    <span className="absolute right-3 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Sidebar Profile Badge */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-input)]/30 shrink-0">
          <div className="flex items-center gap-2 rounded-xl bg-[var(--color-input)] p-1.5 overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-[var(--color-bg)] flex items-center justify-center font-black text-xs shrink-0">
              {userInitials}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-[11px] font-bold text-[var(--color-text)] truncate">{user?.name || "User"}</span>
                <span className="text-[9px] text-[var(--color-muted)] truncate max-w-[120px]">{user?.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-full p-1.5 text-[var(--color-muted)] hover:text-[var(--color-primary)] shadow-lg hidden md:block z-50 hover:bg-[var(--color-input)] transition-all duration-300 hover:scale-110"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ========================================================
          MAIN VIEWPORT
         ======================================================== */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden mb-16 md:mb-0">

        {/* TOP APP BAR */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 md:px-6 relative z-40">
          <div className="flex items-center gap-3 flex-1">
            <div className="md:hidden flex aspect-square h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white shadow-sm">
              <Gavel className="w-4 h-4" />
            </div>

          </div>

          <div className="flex items-center gap-3">
            {/* Active Tab Badge */}
            <span className="hidden md:inline-flex items-center text-[10px] bg-[var(--color-input)] font-bold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-primary)] uppercase tracking-wider">
              {getTabLabel(activeTab)}
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="w-9 h-9 rounded-xl bg-[var(--color-input)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all duration-300"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Desktop Logout */}
            <div className="hidden md:block">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-secondary)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[var(--color-primary)]"
              >
                <LogOut className="w-3 h-3" /> Log out
              </button>
            </div>

            {/* Mobile Profile Avatar */}
            <div className="block md:hidden relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center border-2 transition-all active:scale-95 focus:outline-none ${
                  isProfileDropdownOpen 
                    ? "bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-bg)] ring-4 ring-[var(--color-primary)]/20" 
                    : "bg-[var(--color-input)] hover:bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text)]"
                }`}
              >
                {userInitials}
              </button>

              {/* Mobile Dropdown */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl shadow-black/20 py-3 z-[100] transform origin-top-right">
                  <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5 mb-2">
                      <User className="w-3 h-3" /> Profile Info
                    </p>
                    <p className="text-sm font-bold text-[var(--color-text)] truncate">{user?.name || "User"}</p>
                    <p className="text-[10px] text-[var(--color-muted)] truncate">{user?.email || "No email"}</p>
                  </div>

                  <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-input)]/30">
                    <p className="text-[10px] font-semibold text-[var(--color-muted)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      Role: <span className="font-bold text-[var(--color-text)]">{isAdmin ? "Administrator" : isAuctioneer ? "Auctioneer" : "Bidder"}</span>
                    </p>
                  </div>

                  <div className="px-3 pt-2 pb-1">
                    {isAuctioneer && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("settings");
                          setIsProfileDropdownOpen(false);
                        }}
                        className="mb-2 flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-xs font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-input)]"
                      >
                        <Settings className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                        <span>Account settings</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        void handleLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-secondary)] px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-primary)]"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* DYNAMIC CONTENT ROUTER */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 bg-[var(--color-bg)]">
          <div className="mx-auto w-full max-w-7xl">
            {paymentBanner && (
              <p className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${paymentBanner.tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : paymentBanner.tone === "red" ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-amber-500/30 bg-amber-500/10 text-amber-500"}`} role="status">
                <span>{paymentBanner.text}</span>
                <button type="button" onClick={() => setPaymentBannerDismissed(true)} className="text-xs font-bold underline">Dismiss</button>
              </p>
            )}
            {accessPaymentMessage && (
              <p className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text)]" role="status">
                {accessPaymentMessage}
              </p>
            )}
            {adminNotice && isAdmin && (
              <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500" role="status">{adminNotice}</p>
            )}

            {/* Dashboard Overview */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {isAdmin ? (
                  <div className="space-y-6">
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text)]">Administrator dashboard</h2>
                        <p className="mt-2 text-sm text-[var(--color-muted)]">User summaries and common administration actions.</p>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[
                          ["All accounts", adminUserCounts.BIDDER + adminUserCounts.AUCTIONEER + adminUserCounts.ADMIN],
                          ["Bidders", adminUserCounts.BIDDER],
                          ["Auctioneers", adminUserCounts.AUCTIONEER],
                          ["Administrators", adminUserCounts.ADMIN],
                        ].map(([label, value]) => (
                          <article key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4">
                            <p className="text-xs font-semibold text-[var(--color-muted)]">{label}</p>
                            <p className="mt-1 text-2xl font-black text-[var(--color-primary)]">{value}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                      <h3 className="text-sm font-bold text-[var(--color-text)]">Quick actions</h3>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {[
                          { label: "Manage auctioneers", tab: "auctioneers", icon: User, color: "text-blue-500", bg: "bg-blue-500/10" },
                          { label: "Manage refunds", tab: "refunds", icon: CircleDollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
                          { label: "Manage users", tab: "users", icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                          { label: "View payments", tab: "payments", icon: Wallet, color: "text-violet-500", bg: "bg-violet-500/10" },
                        ].map((action) => (
                          <button key={action.tab} type="button" onClick={() => setActiveTab(action.tab)} className="group flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--color-input)]">
                            <span className={`rounded-lg p-2 ${action.bg} transition-transform group-hover:scale-110`}>
                              <action.icon className={`h-4 w-4 ${action.color}`} />
                            </span>
                            <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)]">{action.label}</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-text)]">Recently approved auctioneers</h3>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">Latest verified auctioneer accounts</p>
                        </div>
                        <BadgeCheck className="h-5 w-5 text-emerald-500" />
                      </div>
                      {recentlyApprovedAuctioneers.length ? (
                        <div className="space-y-2">
                          {recentlyApprovedAuctioneers.map((auctioneer) => (
                            <article key={auctioneer.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{auctioneer.name}</p>
                                <p className="mt-1 truncate text-xs text-[var(--color-muted)]">{auctioneer.businessName || "Auctioneer account"}</p>
                              </div>
                              <span className="shrink-0 text-xs text-[var(--color-muted)]">{new Date(auctioneer.createdAt).toLocaleDateString()}</span>
                            </article>
                          ))}
                        </div>
                      ) : <p className="text-sm text-[var(--color-muted)]">No verified auctioneers have been registered yet.</p>}
                    </section>
                  </div>
                ) : isAuctioneer ? (
                  <div className="space-y-4 pb-8">
                    <section className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text)]">Auctioneer Dashboard</h2>
                        <p className="text-xs text-[var(--color-muted)] mt-1">
                          Manage listings, monitor live bids, and track payments
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/20 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                      </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Active Auctions", serializedAuctionItems.filter((item) => ["ACTIVE", "LIVE"].includes(item.status)).length],
                        ["Total Bids", dashboardStats?.totalBids ?? 0],
                        ["Paid Sales", dashboardStats?.completedSales ?? 0],
                        ["Sales Revenue", `MWK ${Number(dashboardStats?.completedSalesRevenue || 0).toLocaleString()}`],
                        ["Auction Success Rate", `${dashboardStats?.auctionSuccessRate ?? 0}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-5">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
                          <p className="text-3xl font-extrabold text-[var(--color-primary)]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-sm font-bold text-[var(--color-text)]">Quick actions</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          { label: "Manage auctions", tab: "live-auctions", icon: Gavel, color: "text-blue-500", bg: "bg-blue-500/10" },
                          { label: "Manage daily sales", tab: "daily-sales", icon: ShoppingBag, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                          { label: "Payments received", tab: "payments", icon: Wallet, color: "text-violet-500", bg: "bg-violet-500/10" },
                          { label: "Properties", tab: "properties", icon: Home, color: "text-amber-500", bg: "bg-amber-500/10" },
                          { label: "Refunds", tab: "refunds", icon: CircleDollarSign, color: "text-rose-500", bg: "bg-rose-500/10" },
                        ].map((action) => (
                          <button key={action.tab} type="button" onClick={() => setActiveTab(action.tab)} className="group flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--color-input)]">
                            <span className={`rounded-lg p-2 ${action.bg} transition-transform group-hover:scale-110`}>
                              <action.icon className={`h-4 w-4 ${action.color}`} />
                            </span>
                            <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)]">{action.label}</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-[var(--color-text)]">Recent auctions</h3>
                        <button type="button" onClick={() => setActiveTab("live-auctions")} className="text-xs font-bold text-[var(--color-primary)]">View all</button>
                      </div>
                      {serializedAuctionItems.length ? (
                        <div className="space-y-2">
                          {serializedAuctionItems.slice(0, 5).map((item) => (
                            <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{item.asset.title}</p>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">{item.asset.location || "Location not provided"}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--color-primary)]">{item.status}</span>
                            </article>
                          ))}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">No auction listings yet.</p>}
                    </section>
                  </div>
                ) : (
                  <BidderDashboard />
                )}
              </div>
            )}

            {/* Auctions (Auctioneer) / Live Auction Floor (Bidder) */}
            {activeTab === "live-auctions" && !isAdmin && (
              isAuctioneer ? (
                <div className="space-y-6">
                  <AuctioneerLiveConsole
                    auctionItems={serializedAuctionItems}
                    onItemsUpdate={(updated) => console.log("Broadcaster sync: ", updated.length)}
                  />
                </div>
              ) : (
                <BidderLiveConsole auctionItems={serializedAuctionItems} />
              )
            )}

            {/* Daily sales */}
            {activeTab === "daily-sales" && isBidder && (
              <BidderMarketplace initialTab="daily-sales" />
            )}
            {activeTab === "daily-sales" && isAuctioneer && (
              <AuctioneerManageAssets initialTab="daily-sales" />
            )}

            {/* Properties */}
            {activeTab === "properties" && isBidder && (
              <BidderMarketplace initialTab="properties" />
            )}
            {activeTab === "properties" && isAuctioneer && (
              <AuctioneerManageAssets initialTab="properties" />
            )}

            {/* My Bids (Bidder only) */}
            {activeTab === "my-bids" && isBidder && (
              <Mybids/>
            )}

            {/* Manage Listings (Auctioneer only) */}
            {activeTab === "manage-listings" && isAuctioneer && (
              <AuctioneerManageAssets initialTab="daily-sales" />
            )}

            {/* Add Listing form (redirect target of the Add Listing button) */}
            {activeTab === "add-listing" && isAuctioneer && (
              <AuctioneerAddListing initialMode={addListingInitialMode} />
            )}

            {/* Payments received / bidder receipts */}
            {activeTab === "payments" && (
              isAuctioneer
                ? <AuctioneerFinance view="payments" />
                : <PaymentHistory role={user?.role} />
            )}

            {activeTab === "reports" && isAuctioneer && (
              <AuctioneerFinance view="reports" />
            )}

            {activeTab === "auctioneers" && isAdmin && (
              <AdminAuctioneerManager onRegistrationComplete={(message) => {
                setAdminNotice(message);
                setActiveTab("users");
              }} />
            )}

            {activeTab === "refunds" && isAdmin && <AdminRefundManager />}
            {activeTab === "refunds" && isAuctioneer && <AuctionRefunds role="AUCTIONEER" />}

            {activeTab === "users" && isAdmin && (
              <AdminUserManager />
            )}

            {/* Settings */}
            {activeTab === "settings" && (
              <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)] mb-1">Account Settings</h2>
                    <p className="text-xs text-[var(--color-muted)]">Manage profile, notifications, and security</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                </div>

                <div className="space-y-4">
                  {isAuctioneer && <AuctioneerPasswordChange />}

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Account details</h3>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[var(--color-muted)]">Name</dt>
                        <dd className="mt-1 font-semibold text-[var(--color-text)]">{user?.name || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--color-muted)]">Email</dt>
                        <dd className="mt-1 break-all font-semibold text-[var(--color-text)]">{user?.email || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--color-muted)]">Role</dt>
                        <dd className="mt-1 font-semibold text-[var(--color-text)]">{user?.role || "BIDDER"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ========================================================
          MOBILE BOTTOM NAVIGATION
         ======================================================== */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--color-card)]/95 backdrop-blur-md border-t border-[var(--color-border)] h-16 flex items-center justify-around px-2 z-50 shadow-lg shadow-black/20">

        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all ${
            activeTab === "dashboard" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {!isAdmin && <button
          onClick={() => setActiveTab("live-auctions")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${
            activeTab === "live-auctions" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
          }`}
        >
          <Tv className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">
            {isAuctioneer ? "Auctions" : "Bids"}
          </span>
          {liveCount > 0 && (
            <span className="absolute top-2.5 right-6 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>}

        {(isAdmin || isAuctioneer) && <button onClick={() => setActiveTab("refunds")} className={`flex flex-col items-center justify-center flex-1 h-full py-2 ${activeTab === "refunds" ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"}`}>
          <CircleDollarSign className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Refunds</span>
        </button>}

        {isAdmin && (
          <button onClick={() => setActiveTab("auctioneers")} className={`flex flex-col items-center justify-center flex-1 h-full py-2 ${activeTab === "auctioneers" ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"}`}>
            <User className="mb-0.5 h-5 w-5" />
            <span className="text-[10px] tracking-tight">Admin</span>
          </button>
        )}

        {(isBidder || isAuctioneer) && (
          <button
            onClick={() => setActiveTab("daily-sales")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all ${
              activeTab === "daily-sales" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
            }`}
          >
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Daily</span>
          </button>
        )}

        {(isBidder || isAuctioneer) && (
          <button
            onClick={() => setActiveTab("properties")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all ${
              activeTab === "properties" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Props</span>
          </button>
        )}

        {isBidder && (
          <button
            onClick={() => setActiveTab("my-bids")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all ${
              activeTab === "my-bids" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
            }`}
          >
            <Gavel className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">My Bids</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all ${
            activeTab === "payments" ? "text-[var(--color-primary)] scale-105 font-bold" : "text-[var(--color-muted)] font-medium"
          }`}
        >
          <Wallet className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{isAuctioneer ? "Payments" : "Receipts"}</span>
        </button>

      </div>

    </div>
  );
}