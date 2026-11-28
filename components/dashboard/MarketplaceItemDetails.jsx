"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Home,
  MapPin,
  Package,
  ShoppingCart,
  Tag,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startDailySaleCartPurchase, startListingPurchase } from "@/app/actions/listingPurchase";
import { formatDateOnly } from "@/lib/dateFormatting";
import { fetchUserProfile, initiatePayment, parseName } from "@/lib/payments";
import { useDailySaleCart } from "@/lib/marketplaceCart";
import {
  savePendingMarketplacePurchase,
  takePendingMarketplacePurchase,
} from "@/lib/marketplacePurchaseIntent";

const CALLBACK_URL = process.env.NEXT_PUBLIC_PAYCHANGU_CALLBACK_URL;

export default function MarketplaceItemDetails({ id, tab, onBack }) {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [item, setItem] = useState(null);
  const [cart, setCart] = useDailySaleCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [cartPurchasing, setCartPurchasing] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const resumedPurchase = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchListing() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/marketplace?tab=${tab}&id=${encodeURIComponent(id)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load this listing.");
        if (!cancelled) {
          const listing = result.items?.[0];
          if (!listing) throw new Error("This listing is no longer available.");
          setItem(listing);
        }
      } catch (fetchError) {
        if (!cancelled) setError(fetchError.message || "Failed to load this listing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchListing();
    return () => {
      cancelled = true;
    };
  }, [id, tab]);

  const formatMoney = (value) =>
    value === null || value === undefined || !Number.isFinite(Number(value))
      ? "—"
      : `MK ${Number(value).toLocaleString()}`;

  const inCart = item && cart.some((cartItem) => cartItem.id === item.id);

  const toggleCartItem = () => {
    if (!item) return;
    if (!inCart && cart.length >= 20) {
      setPurchaseError("Your cart can contain no more than 20 daily sale listings.");
      return;
    }
    setPurchaseError("");
    setCart((current) => {
      const next = current.some((cartItem) => cartItem.id === item.id)
        ? current.filter((cartItem) => cartItem.id !== item.id)
        : [...current, { id: item.id, title: item.title, price: Number(item.price) }];
      return next;
    });
  };

  const startCheckout = async (purchase) => {
    const profile = await fetchUserProfile();
    const { firstName, lastName } = parseName(profile.name || "");
    const returnUrl = new URL("/dashboard", window.location.origin);
    returnUrl.searchParams.set("tab", "payments");
    const checkout = await initiatePayment({
      amount: purchase.data.amount,
      currency: "MWK",
      tx_ref: purchase.data.paymentRef,
      email: profile.email,
      first_name: firstName,
      last_name: lastName,
      phone: profile.phoneNumber || "",
      method: "card",
      purpose: purchase.data.kind,
      callback_url: CALLBACK_URL,
      return_url: returnUrl.toString(),
    });
    if (!checkout.checkoutUrl) throw new Error("Payment provider did not return a checkout link.");
    window.location.assign(checkout.checkoutUrl);
  };

  const handlePurchase = useCallback(async () => {
    if (!item) return;
    setPurchasing(true);
    setPurchaseError("");
    const kind = tab === "daily-sales"
      ? "DAILY_SALE"
      : item.listingType === "LEASE" ? "PROPERTY_RENT" : "PROPERTY";
    try {
      const purchase = await startListingPurchase(kind, item.id);
      if (!purchase.success) throw new Error(purchase.error);
      await startCheckout(purchase);
    } catch (purchaseFailure) {
      const message = purchaseFailure.message || "Could not start purchase.";
      if (message.includes("signed-in bidders")) {
        setPendingPurchase({ type: "listing", listingId: Number(id), kind });
        setAuthPrompt(true);
      } else {
        setPurchaseError(message);
      }
      setPurchasing(false);
    }
  }, [id, item, tab]);

  const handleCartCheckout = useCallback(async (listingIds = cart.map((cartItem) => cartItem.id)) => {
    setCartPurchasing(true);
    setPurchaseError("");
    try {
      const purchase = await startDailySaleCartPurchase(listingIds);
      if (!purchase.success) throw new Error(purchase.error);
      await startCheckout(purchase);
    } catch (purchaseFailure) {
      const message = purchaseFailure.message || "Could not start checkout.";
      if (message.includes("signed-in bidders")) {
        setPendingPurchase({ type: "cart", listingIds });
        setAuthPrompt(true);
      } else {
        setPurchaseError(message);
      }
      setCartPurchasing(false);
    }
  }, [cart]);

  useEffect(() => {
    if (loading || sessionStatus === "loading" || resumedPurchase.current) return;

    const intent = takePendingMarketplacePurchase();
    if (!intent) return;
    resumedPurchase.current = true;

    queueMicrotask(() => {
      if (intent.type === "listing" && intent.listingId === Number(id)) {
        void handlePurchase();
      } else if (intent.type === "cart") {
        void handleCartCheckout(intent.listingIds);
      }
    });
  }, [id, loading, sessionStatus, handlePurchase, handleCartCheckout]);

  const listingsHref = `/marketplace?tab=${tab}`;
  const attributes = item?.attributes && typeof item.attributes === "object"
    ? Object.entries(item.attributes).filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    : [];
  const price = item && (tab === "daily-sales"
    ? item.price
    : item.listingType === "LEASE" ? item.monthlyRent : item.askingPrice);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]" aria-label="Loading listing details">
        <div className="h-[420px] animate-pulse rounded-2xl bg-[var(--color-input)]" />
        <div className="h-[420px] animate-pulse rounded-2xl bg-[var(--color-input)]" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <h1 className="text-xl font-bold">Listing unavailable</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{error || "This listing is no longer available."}</p>
        {onBack ? (
          <button type="button" onClick={onBack} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Listings
          </button>
        ) : (
          <Link href={listingsHref} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Listings
          </Link>
        )}
      </section>
    );
  }

  const isDailySale = tab === "daily-sales";
  const isLease = item.listingType === "LEASE";
  const status = isDailySale
    ? `Available${item.stockCount > 1 ? ` · ${item.stockCount} in stock` : ""}`
    : isLease ? "For Lease" : "For Sale";

  return (
    <div className="space-y-6">
      {onBack ? (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to Listings
        </button>
      ) : (
        <Link href={listingsHref} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to Listings
        </Link>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-4">
          <div className="relative flex aspect-[4/3] max-h-[560px] items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-input)]">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
            ) : isDailySale ? (
              <Package className="h-16 w-16 text-[var(--color-muted)] opacity-40" />
            ) : (
              <Home className="h-16 w-16 text-[var(--color-muted)] opacity-40" />
            )}
            <span className="absolute left-4 top-4 rounded-lg bg-[var(--color-card)]/90 px-3 py-1.5 text-xs font-bold text-[var(--color-text)] shadow">
              {item.category || (isDailySale ? "Daily Sale" : "Property")}
            </span>
          </div>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-xl bg-violet-500/15 p-2.5 text-violet-400"><FileText className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-[var(--color-text)]">Description</h2>
                <p className="text-xs text-[var(--color-muted)]">Detailed information about this listing</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">{item.description || "No description provided."}</p>
            {attributes.length > 0 && (
              <dl className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
                {attributes.map(([name, value]) => (
                  <div key={name}>
                    <dt className="text-xs text-[var(--color-muted)]">{name}</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--color-text)]">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lg lg:sticky lg:top-6">
          <h1 className="text-2xl font-extrabold leading-tight text-[var(--color-text)]">{item.title}</h1>
          <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-5 text-center">
            <p className="text-xs text-[var(--color-muted)]">{isLease ? "Rent per Month" : "Price"}</p>
            <p className="mt-1 text-3xl font-extrabold text-[var(--color-text)]">
              {formatMoney(price)}
              {isLease && <span className="ml-1 text-sm font-semibold">/ month</span>}
            </p>
          </div>

          <dl className="mt-5 divide-y divide-[var(--color-border)] text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--color-muted)]">Reference</dt>
              <dd className="font-mono text-xs font-semibold text-[var(--color-text)]">{isDailySale ? `cash-${item.id}` : `property-${item.id}`}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--color-muted)]">Category</dt>
              <dd className="max-w-[60%] truncate rounded-full bg-blue-500/15 px-2.5 py-1 text-right text-xs font-semibold text-blue-400">{item.category || (isDailySale ? "Daily Sale" : "Property")}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--color-muted)]">Status</dt>
              <dd className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">{status}</dd>
            </div>
            {!isDailySale && item.location && (
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="flex items-center gap-1.5 text-[var(--color-muted)]"><MapPin className="h-3.5 w-3.5" /> Location</dt>
                <dd className="max-w-[60%] truncate text-right font-semibold text-[var(--color-text)]">{item.location}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-1.5 text-[var(--color-muted)]"><User className="h-3.5 w-3.5" /> Auctioneer</dt>
              <dd className="max-w-[60%] truncate text-right font-semibold text-[var(--color-text)]">{item.auctioneerName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--color-muted)]">Listed</dt>
              <dd className="text-right font-semibold text-[var(--color-text)]">{formatDateOnly(item.createdAt)}</dd>
            </div>
          </dl>

          {isDailySale ? (
            <div className="mt-4 space-y-2">
              {inCart ? (
                <>
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-bold text-emerald-400">
                    <CheckCircle className="h-4 w-4" /> Item is in your cart
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={toggleCartItem} className="rounded-xl border border-rose-400/50 px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10">Remove</button>
                    <button type="button" onClick={handleCartCheckout} disabled={cartPurchasing} className="rounded-xl bg-[var(--color-primary)] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                      {cartPurchasing ? "Starting..." : "Checkout"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={toggleCartItem} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]">
                    <ShoppingCart className="h-4 w-4" /> Add to Cart
                  </button>
                  <button type="button" onClick={handlePurchase} disabled={purchasing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                    <Tag className="h-4 w-4" /> {purchasing ? "Starting..." : "Buy Now"}
                  </button>
                </>
              )}
            </div>
          ) : (
            <button type="button" onClick={handlePurchase} disabled={purchasing} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              <Tag className="h-4 w-4" /> {purchasing ? "Starting..." : isLease ? "Pay Rent" : "Buy Now"}
            </button>
          )}
          {purchaseError && <p className="mt-3 text-sm text-red-400" role="alert">{purchaseError}</p>}
        </aside>
      </div>

      {authPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-auth-title">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 id="purchase-auth-title" className="text-lg font-bold text-[var(--color-text)]">Sign in to continue</h2>
            <p className="text-sm text-[var(--color-muted)]">Create a bidder account or sign in before purchasing this listing.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAuthPrompt(false)} className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={() => { if (pendingPurchase) savePendingMarketplacePurchase(pendingPurchase); router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`); }} className="flex-1 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-white">Sign in</button>
              <button type="button" onClick={() => { if (pendingPurchase) savePendingMarketplacePurchase(pendingPurchase); router.push(`/signup?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`); }} className="flex-1 rounded-xl bg-[var(--color-secondary)] px-3 py-2 text-sm font-bold text-white">Register</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
