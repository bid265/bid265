"use client";

import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Gavel } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════
// 60A5FA  - Bright Blue       (primary accent)
// 1D4ED8  - Royal Blue        (secondary)
// 1E40AF  - Deep Blue         (dark accent)
// 58718B  - Muted Blue        (neutral)
// 10243A  - Navy              (surface)
// 081526  - Deep Navy         (background)

// ═══════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="14" stroke="#60A5FA" strokeWidth="2.5"/>
    <path d="M10 16L14 20L22 12" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchInputIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="9" cy="9" r="7" stroke="#58718B" strokeWidth="1.5"/>
    <path d="M15 15L18 18" stroke="#58718B" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M7 1.5h5.5A1.5 1.5 0 0 1 14 3v5.5L8.5 14l-7-7L7 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <circle cx="10.5" cy="5.5" r="1" fill="currentColor"/>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 16c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════
// ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ═══════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = ["Auctions", "Daily Sales", "Properties", "About", "Contact"];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? "bg-[#081526]/95 backdrop-blur-xl border-b border-[#10243A]/50" : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <LogoIcon />
          <span className="text-xl font-bold text-white tracking-tight">TrustBid</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a key={link} href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
              className="text-sm font-medium text-[#D0DDDF] hover:text-[#60A5FA] transition-colors duration-300 relative group">
              {link}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#60A5FA] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-[#D0DDDF] hover:text-[#60A5FA] px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border border-[#10243A] hover:border-[#60A5FA]/30 flex items-center gap-2">
            <UserIcon />
            Login
          </Link>
          <Link href="/signup" className="bg-[#1D4ED8] hover:bg-[#60A5FA] text-white hover:text-[#081526] px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 hover:shadow-lg hover:shadow-[#60A5FA]/20 hover:-translate-y-0.5 active:translate-y-0">
            Register
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-white p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#081526]/98 backdrop-blur-xl border-t border-[#10243A]/50 px-4 py-6 space-y-4">
          {links.map((link) => (
            <a key={link} href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
              className="block text-[#D0DDDF] hover:text-[#60A5FA] text-base font-medium py-2 transition-colors"
              onClick={() => setMenuOpen(false)}>
              {link}
            </a>
          ))}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#10243A]/50">
            <Link href="/login" className="text-center text-[#D0DDDF] hover:text-[#60A5FA] px-5 py-3 rounded-full text-sm font-semibold transition-all border border-[#10243A] hover:border-[#60A5FA]/30 flex items-center justify-center gap-2">
              <UserIcon />
              Login
            </Link>
            <Link href="/signup" className="text-center bg-[#1D4ED8] hover:bg-[#60A5FA] text-white hover:text-[#081526] px-5 py-3 rounded-full text-sm font-bold transition-all">
              Register
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO with background image slideshow
// ═══════════════════════════════════════════════════════════════════

function Hero() {
  const [currentBg, setCurrentBg] = useState(0);

  const backgrounds = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop",
    "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1600&h=900&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=900&fit=crop",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&h=900&fit=crop",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgrounds.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [backgrounds.length]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background images with crossfade */}
      {backgrounds.map((bg, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: currentBg === i ? 1 : 0 }}
        >
          <img
            src={bg}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#061120]/90 via-[#081526]/88 to-[#081526]/95" />
        </div>
      ))}

      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#60A5FA]/12 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1D4ED8]/12 rounded-full blur-[100px] pointer-events-none" />

      {/* Content - perfectly centered */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center pt-20 pb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10243A]/80 border border-[#58718B]/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#60A5FA] animate-pulse" />
          <span className="text-xs sm:text-sm font-semibold text-[#DBEAFE]">Malawi&apos;s Online Auction Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
          <span className="block">Your Auction</span>
          <span className="block">Journey Starts</span>
          <span className="block bg-gradient-to-r from-[#DBEAFE] via-[#60A5FA] to-[#60A5FA] bg-clip-text text-transparent">
            Here.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[#E0E9EA] max-w-lg mx-auto leading-relaxed mb-10 px-4">
          Discover premium real estate and vehicle auctions across Malawi. 
          Register remotely, pay securely, and bid from anywhere.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/marketplace?tab=auctions" className="bg-[#60A5FA] hover:bg-[#1D4ED8] text-[#081526] hover:text-white px-8 py-4 rounded-full text-base font-bold transition-all duration-300 hover:shadow-xl hover:shadow-[#60A5FA]/20 hover:-translate-y-1 active:translate-y-0 w-full sm:w-auto text-center">
            Browse Auctions
          </Link>
          <Link href="/signup" className="flex items-center justify-center rounded-full border border-white/30 px-7 py-4 text-sm font-bold text-white transition-colors hover:border-[#60A5FA] hover:text-[#60A5FA]">
            Create Bidder Account
          </Link>
        </div>

        {/* Background image indicators */}
        <div className="flex items-center justify-center gap-2 mt-12">
          {backgrounds.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentBg(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                currentBg === i ? "w-8 bg-[#60A5FA]" : "w-1.5 bg-[#C6D4D6]/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH BAR
// ═══════════════════════════════════════════════════════════════════

function SearchBar() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-16 sm:py-20 bg-[#081526]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          Find your perfect <span className="text-[#60A5FA]">property</span>
        </h2>
        <p className={`text-[#C6D4D6] text-sm sm:text-base mb-8 sm:mb-10 transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          Browse verified real estate and vehicle listings from trusted auctioneers
        </p>

        <form action="/marketplace" method="get" className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="flex flex-col sm:flex-row items-center bg-[#10243A]/60 rounded-2xl sm:rounded-full p-2 border border-[#58718B]/20 focus-within:border-[#60A5FA]/40 focus-within:ring-2 focus-within:ring-[#60A5FA]/10 transition-all duration-300 hover:shadow-lg hover:shadow-[#60A5FA]/5 gap-2 sm:gap-0">
            <div className="pl-4 pr-3 hidden sm:block">
              <SearchInputIcon />
            </div>
            <input
              type="text"
              name="q"
              placeholder="Search by location, property type, or auctioneer..."
              className="flex-1 bg-transparent py-3 sm:py-4 px-4 sm:px-2 text-white placeholder-[#B6C8CB] outline-none text-sm w-full"
            />
            <input type="hidden" name="tab" value="properties" />
            <button type="submit" className="bg-[#1D4ED8] hover:bg-[#60A5FA] text-white hover:text-[#081526] px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-full text-sm font-bold transition-all duration-300 hover:shadow-lg hover:shadow-[#60A5FA]/20 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto">
              Search
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAILY SALES
// ═══════════════════════════════════════════════════════════════════

type LandingCategoryTab = "daily-sales" | "properties";
type LandingCategory = { name: string; count: number; imageUrl: string };
type LandingAuction = {
  id: number;
  title: string;
  description: string;
  location: string;
  status: string;
  currentBid: number | null;
  startingBid: number;
  imageUrl: string | null;
  auctioneerName: string;
  endTime: string;
};

// Category artwork lives in /public/categories. Matching is keyword based so custom
// categories (e.g. "CAR", "HOUSE", "LAPTOPS") still get a relevant picture.
const categoryArtwork: Array<{ keywords: string[]; image: string }> = [
  { keywords: ["MOTORBIKE", "MOTORCYCLE", "BIKE", "SCOOTER"], image: "/categories/motorbike.svg" },
  { keywords: ["VEHICLE", "CAR", "TRUCK", "BUS", "VAN", "AUTO", "TOYOTA"], image: "/categories/vehicle.svg" },
  { keywords: ["ELECTRONIC", "PHONE", "LAPTOP", "COMPUTER", "TECH", "TV", "APPLIANCE"], image: "/categories/electronics.svg" },
  { keywords: ["FURNITURE", "SOFA", "CHAIR", "TABLE", "BED", "DESK"], image: "/categories/furniture.svg" },
  { keywords: ["LAND", "PLOT", "FARM", "ACRE", "STAND"], image: "/categories/land.svg" },
  { keywords: ["COMMERCIAL", "OFFICE", "SHOP", "WAREHOUSE", "INDUSTRIAL"], image: "/categories/commercial.svg" },
  { keywords: ["RESIDENTIAL", "HOUSE", "HOME", "APARTMENT", "VILLA", "FLAT"], image: "/categories/residential.svg" },
];

function getCategoryImage(category: string, tab: LandingCategoryTab) {
  const name = category.toUpperCase();
  const match = categoryArtwork.find((entry) => entry.keywords.some((keyword) => name.includes(keyword)));
  if (match) return match.image;
  return tab === "properties" ? "/categories/property.svg" : "/categories/goods.svg";
}

const formatCategoryName = (name: string) =>
  name.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function useLandingCategories(tab: LandingCategoryTab) {
  const [categories, setCategories] = useState<LandingCategory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    fetch(`/api/marketplace?tab=${tab}`)
      .then(async (response) => {
        const data: { error?: string; items?: Array<{ category?: string | null; imageUrl?: string | null }>; categories?: string[] } = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load categories.");
        const counts = new Map();
        for (const item of data.items || []) {
          const category = item.category || "Other";
          counts.set(category, (counts.get(category) || 0) + 1);
        }
        if (current) {
          setError("");
          setCategories((data.categories || []).map((name) => ({
            name,
            count: counts.get(name) || 0,
            imageUrl: getCategoryImage(name, tab),
          })));
        }
      })
      .catch((loadError) => {
        console.error(`[Landing ${tab} categories]`, loadError);
        if (current) setError("Categories could not be loaded. Please try again later.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [tab]);

  return { categories, error, loading };
}

function CategoryBrowseGrid({
  tab,
  categories,
  inView,
  loading,
}: {
  tab: LandingCategoryTab;
  categories: LandingCategory[];
  inView: boolean;
  loading: boolean;
}) {
  if (loading) {
    return <p className="col-span-full rounded-2xl border border-[#58718B]/40 p-8 text-center text-sm text-[#C6D4D6]">Loading categories…</p>;
  }
  if (!categories.length) {
    return <p className="col-span-full rounded-2xl border border-dashed border-[#58718B]/40 p-8 text-center text-sm text-[#C6D4D6]">No categories are available yet.</p>;
  }

  return categories.map((category, index) => (
    <Link
      key={category.name}
      href={`/marketplace?tab=${tab}&category=${encodeURIComponent(category.name)}`}
      className={`group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-[#58718B]/40 bg-[#10243A] transition-all duration-300 hover:-translate-y-1 hover:border-[#60A5FA]/60 hover:shadow-xl hover:shadow-[#60A5FA]/10 ${inView ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      {/* The image covers the whole thumbnail; text sits on a gradient over it. */}
      <img
        src={category.imageUrl}
        alt={`${formatCategoryName(category.name)} category`}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#081526]/95 via-[#081526]/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div>
          <span className="block text-base font-bold text-white drop-shadow group-hover:text-[#BFDBFE]">{formatCategoryName(category.name)}</span>
          <span className="mt-0.5 block text-xs font-medium text-[#D0DDDF]">{category.count} {category.count === 1 ? "listing" : "listings"}</span>
        </div>
        <span className="rounded-full bg-white/15 p-2 text-white backdrop-blur transition-colors group-hover:bg-[#60A5FA] group-hover:text-[#081526]"><ArrowRightIcon /></span>
      </div>
    </Link>
  ));
}

function DailySalesSection() {
  const { ref, inView } = useInView();
  const { categories, error, loading } = useLandingCategories("daily-sales");

  return (
    <section id="daily-sales" ref={ref} className="py-16 sm:py-24 bg-[#081526]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-10 sm:mb-12">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#60A5FA]/20 bg-[#60A5FA]/10 text-[#60A5FA] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-4">
              <TagIcon /> Daily Sales
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Browse goods by <span className="text-[#60A5FA]">category</span>
            </h2>
            <p className={`text-[#C6D4D6] text-sm sm:text-base max-w-2xl transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Choose a category to browse all available daily-sale goods. Sign in or register as a bidder when you are ready to purchase.
            </p>
          </div>
          <Link href="/marketplace?tab=daily-sales" className="inline-flex items-center gap-2 text-sm font-bold text-[#BFDBFE] hover:text-white">Browse all goods <ArrowRightIcon /></Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-300" role="alert">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CategoryBrowseGrid tab="daily-sales" categories={categories} inView={inView} loading={loading} />
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURED PROPERTIES
// ═══════════════════════════════════════════════════════════════════

function FeaturedProperties() {
  const { ref, inView } = useInView();
  const { categories, error, loading } = useLandingCategories("properties");

  return (
    <section id="properties" ref={ref} className="py-16 sm:py-24 bg-[#081526]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 gap-4">
          <div>
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Featured <span className="text-[#60A5FA]">Properties</span>
            </h2>
            <p className={`text-[#C6D4D6] text-sm sm:text-base transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Browse available property listings by category, then filter by location, price, auctioneer, and listing type.
            </p>
          </div>
          <Link href="/marketplace?tab=properties" className={`flex items-center gap-2 text-[#BFDBFE] font-bold text-sm hover:gap-3 transition-all duration-300 ${inView ? "opacity-100" : "opacity-0"}`}>
            View All <ArrowRightIcon />
          </Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-300" role="alert">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CategoryBrowseGrid tab="properties" categories={categories} inView={inView} loading={loading} />
        </div>
      </div>
    </section>
  );
}

function AuctionListingsSection() {
  const { ref, inView } = useInView();
  const { data: session } = useSession();
  const [auctions, setAuctions] = useState<LandingAuction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    fetch("/api/marketplace?tab=auctions")
      .then(async (response) => {
        const data: { error?: string; items?: LandingAuction[] } = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load auctions.");
        if (current) setAuctions((data.items || []).slice(0, 3));
      })
      .catch((loadError) => {
        console.error("[Landing auctions]", loadError);
        if (current) setError("Auction listings could not be loaded. Please try again later.");
      });
    return () => { current = false; };
  }, []);

  return (
    <section id="auctions" ref={ref} className="bg-[#081526] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={`mb-3 text-2xl font-bold text-white transition-all duration-700 sm:text-3xl md:text-4xl ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              Current <span className="text-[#60A5FA]">Auctions</span>
            </h2>
            <p className="max-w-2xl text-sm text-[#C6D4D6]">Upcoming and live auctions are listed here. Sign in as a bidder to join an auction and place bids.</p>
          </div>
          <Link href="/marketplace?tab=auctions" className="inline-flex items-center gap-2 text-sm font-bold text-[#BFDBFE] hover:text-white">View all auctions <ArrowRightIcon /></Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-300" role="alert">{error}</p>}
        {auctions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#58718B]/40 p-8 text-center text-sm text-[#C6D4D6]">There are no scheduled or live auctions right now.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => (
              <article key={auction.id} className="overflow-hidden rounded-2xl border border-[#58718B]/40 bg-[#10243A]/80">
                {auction.imageUrl ? <img src={auction.imageUrl} alt={auction.title} className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-[#122932]"><Gavel className="h-10 w-10 text-[#60A5FA]" /></div>}
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#60A5FA]/15 px-2.5 py-1 text-[10px] font-bold uppercase text-[#BFDBFE]">{auction.status === "UPCOMING" ? "Upcoming" : "Live"}</span>
                    <span className="text-xs text-[#D0DDDF]">{auction.location}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{auction.title}</h3>
                  <p className="line-clamp-2 text-sm text-[#C6D4D6]">{auction.description}</p>
                  <div className="flex items-center justify-between border-t border-[#58718B]/30 pt-3 text-xs">
                    <span className="text-[#D0DDDF]">Current bid</span>
                    <strong className="text-[#BFDBFE]">MWK {Number(auction.currentBid || auction.startingBid).toLocaleString()}</strong>
                  </div>
                  <p className="text-xs text-[#C6D4D6]">By {auction.auctioneerName} · Ends {new Date(auction.endTime).toLocaleString()}</p>
                  <Link
                    href={session?.user
                      ? `/dashboard?tab=${"role" in session.user && session.user.role === "ADMIN" ? "auctioneers" : "live-auctions"}`
                      : `/login?callbackUrl=${encodeURIComponent("/dashboard?tab=live-auctions")}`}
                    className="block rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-[#60A5FA] hover:text-[#081526]"
                  >
                    {session?.user ? "Open auction dashboard" : "Sign in to view and bid"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CTA
// ═══════════════════════════════════════════════════════════════════

function CTA() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-20 sm:py-24 bg-gradient-to-br from-[#1E40AF] to-[#1D4ED8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-72 h-72 bg-[#60A5FA]/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#60A5FA]/5 rounded-full translate-x-1/3 translate-y-1/3" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
        <h2 className={`text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          Ready to Start Bidding?
        </h2>
        <p className={`text-[#60A5FA]/80 text-base sm:text-lg max-w-xl mx-auto mb-8 sm:mb-10 transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          Register as a bidder to join upcoming and live auctions across Malawi.
        </p>
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Link href="/signup" className="bg-[#60A5FA] text-[#081526] px-8 py-4 rounded-full text-base font-bold transition-all duration-300 hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1 active:translate-y-0 w-full sm:w-auto text-center">
            Create Free Account
          </Link>
          <Link href="/login" className="border-2 border-white/20 text-white px-8 py-4 rounded-full text-base font-semibold transition-all duration-300 hover:bg-white/10 hover:border-white/40 w-full sm:w-auto text-center">
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer className="bg-[#081526] border-t border-[#10243A]/50 text-[#C0D0D2] py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <LogoIcon />
              <span className="text-xl font-bold text-white">TrustBid</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed">
              Malawi&apos;s first web-based auctioning platform for real estate and vehicle agencies.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm">Platform</h4>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              {[["Browse Auctions", "/marketplace?tab=auctions"], ["Daily Sales", "/marketplace?tab=daily-sales"], ["Properties", "/marketplace?tab=properties"]].map(([item, href]) => (
                <li key={item}><Link href={href} className="hover:text-[#60A5FA] transition-colors duration-300">{item}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm">Company</h4>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              {["About Us", "For Auctioneers", "Careers", "Contact"].map(item => (
                <li key={item}><a href="#" className="hover:text-[#60A5FA] transition-colors duration-300">{item}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm">Support</h4>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              {["Help Center", "Payment Guide", "Terms of Service", "Privacy Policy"].map(item => (
                <li key={item}><a href="#" className="hover:text-[#60A5FA] transition-colors duration-300">{item}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#10243A]/50 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-center sm:text-left">&copy; 2026 TrustBid. A project by Asante Ngwira — CIS-PRJ-411.</p>
          <div className="flex items-center gap-3">
            {["T", "F", "I", "L"].map(letter => (
              <a key={letter} href="#" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10243A]/50 flex items-center justify-center hover:bg-[#60A5FA] hover:text-[#081526] transition-all duration-300 text-xs font-bold">
                {letter}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>TrustBid — Web-Based Real Estate & Vehicle Auction Platform</title>
        <meta name="description" content="Malawi's first web-based auctioning platform. Register remotely, pay securely via PayChangu, and bid on properties and vehicles from anywhere." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-[#081526] font-sans antialiased">
        <Navbar />
        <Hero />
        {/* Document order: hero → daily sales → properties */}
        <DailySalesSection />
        <FeaturedProperties />
        <AuctionListingsSection />
        <SearchBar />
        <CTA />
        <Footer />
      </main>
    </>
  );
}