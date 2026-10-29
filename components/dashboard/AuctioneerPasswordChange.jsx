"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

export default function AuctioneerPasswordChange({ onChanged = null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not change your password.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password changed successfully. Use your new password the next time you sign in.");
      onChanged?.();
    } catch (changeError) {
      setError(changeError.message || "Could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-secondary)]/20">
          <KeyRound className="h-4 w-4 text-[var(--color-primary)]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">Change password</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            If you signed in with the initial password from your administrator, set a new private password here.
          </p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400" role="alert">{error}</p>}
      {notice && <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400" role="status">{notice}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">
          <span>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">
          <span>New password (12–128 characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold text-[var(--color-muted)]">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-secondary)] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Updating password…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
