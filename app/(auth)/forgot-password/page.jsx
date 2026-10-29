"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the reset link.");
      setSent(true);
    } catch (submitError) {
      setError(submitError.message || "Could not send the reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-2xl shadow-2xl shadow-[var(--color-primary)]/5 border border-[var(--color-border)] p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1 mb-6">Enter your account email and we will send you a link to choose a new password.</p>

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-xl" role="status">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 60 minutes.</span>
            </div>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-3" />
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" disabled={loading}
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-3 transition-all">
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
