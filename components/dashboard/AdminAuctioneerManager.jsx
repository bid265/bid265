"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";

const emptyForm = {
  name: "",
  email: "",
  phoneNumber: "",
  postalAddress: "",
  addressLine1: "",
  addressLine2: "",
  district: "",
  businessName: "",
  nationalId: "",
};

const fields = [
  ["name", "Full name", true],
  ["email", "Email", true],
  ["phoneNumber", "Phone number", true],
  ["postalAddress", "Postal address", true],
  ["addressLine1", "Address line 1", true],
  ["addressLine2", "Address line 2", true],
  ["district", "District / city", false],
  ["businessName", "Business / agency", false],
  ["nationalId", "Certificate number", false],
];

async function fetchAuctioneerData() {
  const auctioneerResponse = await fetch("/api/admin/auctioneers");
  const auctioneerData = await auctioneerResponse.json();
  if (!auctioneerResponse.ok) throw new Error(auctioneerData.error || "Could not load auctioneers.");
  return auctioneerData.auctioneers || [];
}

export default function AdminAuctioneerManager({ onRegistrationComplete }) {
  const [auctioneers, setAuctioneers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAuctioneers = useCallback(async () => {
    try {
      const data = await fetchAuctioneerData();
      setError("");
      setAuctioneers(data);
    } catch (loadError) {
      setError(loadError.message || "Could not load auctioneers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let current = true;
    fetchAuctioneerData()
      .then((data) => {
        if (!current) return;
        setAuctioneers(data);
      })
      .catch((loadError) => {
        if (current) setError(loadError.message || "Could not load auctioneers.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/auctioneers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the account.");
      setForm(emptyForm);
      await loadAuctioneers();
      onRegistrationComplete?.(`Auctioneer account created. A temporary password was emailed to ${data.auctioneer.email}.`);
    } catch (saveError) {
      setError(saveError.message || "Could not create the account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      {!showRegistrationForm && (
        <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Users className="h-5 w-5 text-[var(--color-primary)]" /> Auctioneer accounts
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Create accounts only after verifying the auctioneer&apos;s identity and contact details. Public registration remains bidder-only.
              </p>
            </div>
            <button type="button" onClick={() => { setError(""); setNotice(""); setShowRegistrationForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white">
              <UserPlus className="h-4 w-4" /> Register auctioneer
            </button>
          </div>
        </header>
      )}

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400" role="status">{notice}</p>}

      {showRegistrationForm ? (
        <form id="auctioneer-registration" onSubmit={handleSubmit} className="scroll-mt-6 grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[var(--color-text)]">Auctioneer registration</h3>
            <button type="button" onClick={() => setShowRegistrationForm(false)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">Back to auctioneers</button>
          </div>
          {fields.map(([name, label, required]) => (
            <label key={name} className="space-y-1.5 text-xs font-semibold text-[var(--color-muted)]">
              <span>{label}{required ? " *" : ""}</span>
              <input
                name={name}
                type={name === "email" ? "email" : "text"}
                value={form[name]}
                onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                required={required}
                maxLength={name === "phoneNumber" ? 20 : undefined}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </label>
          ))}
          <p className="sm:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-3 text-xs text-[var(--color-muted)]">
            A random password is generated and emailed to the auctioneer. They will be asked to set their own password the first time they sign in.
          </p>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? "Creating account…" : "Register auctioneer"}
            </button>
          </div>
        </form>
      ) : (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h3 className="mb-4 text-sm font-bold">Registered auctioneers</h3>
          {loading ? <p className="text-sm text-[var(--color-muted)]">Loading accounts…</p> : auctioneers.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No auctioneer accounts have been registered.</p>
          ) : (
            <div className="space-y-3">
              {auctioneers.map((auctioneer) => (
                <article key={auctioneer.id} className="grid gap-1 rounded-xl border border-[var(--color-border)] p-3 text-sm sm:grid-cols-2">
                  <strong>{auctioneer.name}</strong><span className="text-[var(--color-muted)]">{auctioneer.email}</span>
                  <span className="text-[var(--color-muted)]">{auctioneer.phoneNumber}</span>
                  <span className="text-[var(--color-muted)]">{[auctioneer.addressLine1, auctioneer.addressLine2, auctioneer.district, auctioneer.postalAddress].filter(Boolean).join(", ")}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
