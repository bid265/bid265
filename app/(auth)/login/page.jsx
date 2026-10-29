"use client";

import React, { useState } from "react";
import { Mail, Lock, AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "Invalid email or password"
            : "Sign-in could not be completed. Please try again."
        );
      } else {
        const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
        const destination = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/dashboard";
        router.push(destination);
        router.refresh();
      }
    } catch {
      setError("Sign-in could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
      const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
        ? callbackUrl
        : "/dashboard";
      await signIn("google", { redirectTo });
    } catch {
      setError("Google sign-in could not be started. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-2xl shadow-2xl shadow-[var(--color-primary)]/5 border border-[var(--color-border)] p-6 sm:p-8">

        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="var(--color-primary)" strokeWidth="2.5"/>
              <path d="M10 16L14 20L22 12" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xl font-bold text-[var(--color-text)] tracking-tight">TrustBid</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Welcome Back</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Sign in to monitor live real estate auctions</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Fields */}
        <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-3" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" 
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:bg-[var(--color-card)] transition-colors"
                required 
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-3" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:bg-[var(--color-card)] transition-colors"
                required 
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-3 shadow-lg shadow-[var(--color-primary)]/20 transition-all duration-300 mt-2 hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? "Authenticating..." : "Sign In to Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--color-border)]"></div>
          </div>
          <span className="relative bg-[var(--color-card)] px-3 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
            Or connect with
          </span>
        </div>

        {/* Google Auth */}
        <button 
          type="button" 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-[var(--color-border)] hover:bg-[var(--color-input)] text-[var(--color-text)] font-semibold text-sm rounded-xl py-2.5 transition-all duration-300 disabled:cursor-wait disabled:opacity-60"
        >
          <Image 
            src="/google.svg" 
            alt="Google Logo" 
            width={18} 
            height={18} 
            priority
          />
          {loading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <p className="text-center text-sm text-[var(--color-muted)] mt-6">
          New to TrustBid?{" "}
          <Link href="/signup" className="text-[var(--color-primary)] font-semibold hover:underline">
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}