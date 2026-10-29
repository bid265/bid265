"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset your password.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (submitError) {
      setError(submitError.message || "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = "w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]";

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">Request a new link</Link>
      </div>
    );
  }

  return done ? (
    <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-xl" role="status">
      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>Password updated. Redirecting you to sign in...</span>
    </div>
  ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl" role="alert">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="relative">
        <Lock className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-3" />
        <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password (8+ characters)" disabled={loading} className={fieldClass} />
      </div>
      <div className="relative">
        <Lock className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-3" />
        <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm new password" disabled={loading} className={fieldClass} />
      </div>
      <button type="submit" disabled={loading} className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-3 transition-all">
        {loading ? "Saving..." : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-2xl shadow-2xl shadow-[var(--color-primary)]/5 border border-[var(--color-border)] p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Choose a new password</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1 mb-6">Enter a new password for your TrustBid account.</p>
        <Suspense fallback={<p className="text-sm text-[var(--color-muted)]">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
