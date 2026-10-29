"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Gavel, LogOut } from "lucide-react";
import AuctioneerPasswordChange from "@/components/dashboard/AuctioneerPasswordChange";

/**
 * Shown instead of the dashboard when an administrator-created auctioneer signs in
 * with the emailed temporary password. They must pick their own before continuing.
 */
export default function ForcePasswordChange({ name }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white"><Gavel className="h-4 w-4" /></div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Set your own password</h1>
            <p className="text-xs text-[var(--color-muted)]">Welcome{name ? `, ${name}` : ""}. Replace the temporary password from your email before continuing to your dashboard.</p>
          </div>
        </div>
        <AuctioneerPasswordChange onChanged={() => { router.replace("/dashboard"); router.refresh(); }} />
        <button type="button" onClick={async () => { await signOut({ redirect: false }); window.location.replace("/login"); }} className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
