import Link from "next/link";
import { Gavel } from "lucide-react";
import MarketplaceItemDetails from "@/components/dashboard/MarketplaceItemDetails";

export default async function MarketplaceItemPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const tab = ["properties", "daily-sales"].includes(query?.tab) ? query.tab : "daily-sales";

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-black">
            <Gavel className="h-5 w-5 text-[var(--color-primary)]" /> TrustBid Marketplace
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/login" className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">Sign in</Link>
            <Link href="/signup" className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-white">Register</Link>
          </div>
        </header>
        <MarketplaceItemDetails id={id} tab={tab} />
      </div>
    </main>
  );
}
