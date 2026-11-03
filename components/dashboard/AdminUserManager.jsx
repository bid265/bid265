"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw, Search, Trash2, Users, X } from "lucide-react";

const roleOptions = ["BIDDER", "AUCTIONEER", "ADMIN"];

const emptyUser = {
  id: 0,
  name: "",
  email: "",
  phoneNumber: "",
  postalAddress: "",
  addressLine1: "",
  addressLine2: "",
  district: "",
  businessName: "",
  nationalId: "",
  role: "BIDDER",
  isVerified: false,
};

const detailFields = [
  ["name", "Full name", true],
  ["email", "Email", true],
  ["phoneNumber", "Phone number", false],
  ["postalAddress", "Postal address", false],
  ["addressLine1", "Address line 1", false],
  ["addressLine2", "Address line 2", false],
  ["district", "District / city", false],
  ["businessName", "Business / agency", false],
  ["nationalId", "Certificate number", false],
];

async function fetchUsers({ query, role, page }) {
  const params = new URLSearchParams({ q: query, role, page: String(page), pageSize: "25" });
  const response = await fetch(`/api/admin/users?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load user accounts.");
  return data;
}

export default function AdminUserManager() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editFormRef = useRef(null);
  const editHeadingRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchUsers({ query, role: roleFilter, page });
      setData(result);
      setError("");
      return result;
    } catch (loadError) {
      setError(loadError.message || "Could not load user accounts.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, page]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      fetchUsers({ query, role: roleFilter, page })
        .then((result) => {
          if (current) {
            setData(result);
            setError("");
          }
        })
        .catch((loadError) => {
          if (current) setError(loadError.message || "Could not load user accounts.");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, query ? 250 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, roleFilter, page]);

  useEffect(() => {
    if (!editingUser) return;
    editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    editHeadingRef.current?.focus({ preventScroll: true });
  }, [editingUser]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingUser, userId: editingUser.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update account.");

      setNotice(`Updated account details for ${result.user.name}.`);
      setEditingUser(null);
      await refresh();
    } catch (saveError) {
      setError(saveError.message || "Could not update account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Permanently delete ${user.name}'s account and all related data, including listings, bids, sales, payments, and auction records? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete account.");

      if (editingUser?.id === user.id) setEditingUser(null);
      setNotice(`Deleted ${result.user.name}'s account and related data.`);
      const refreshed = await refresh();
      if (refreshed && page > refreshed.totalPages) setPage(refreshed.totalPages);
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete account.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const currentUserId = Number(session?.user?.id);
  const updateField = (name, value) => setEditingUser((current) => current
    ? { ...current, [name]: value }
    : current);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text)]">
          <Users className="h-5 w-5 text-[var(--color-primary)]" /> User management
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Review account details and update user roles and verification status.
        </p>
      </header>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400" role="status">{notice}</p>}

      {editingUser && (
        <form ref={editFormRef} onSubmit={handleSave} className="space-y-4 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 ref={editHeadingRef} tabIndex={-1} className="text-sm font-bold text-[var(--color-text)]">Edit {editingUser.name}</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Account ID {editingUser.id}. Passwords are changed by the account holder.</p>
            </div>
            <button type="button" aria-label="Cancel editing" onClick={() => setEditingUser(null)} className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-input)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detailFields.map(([name, label, required]) => (
              <label key={name} className="space-y-1 text-xs font-semibold text-[var(--color-muted)]">
                <span>{label}</span>
                <input
                  type={name === "email" ? "email" : "text"}
                  value={editingUser[name] || ""}
                  onChange={(event) => updateField(name, event.target.value)}
                  required={required}
                  maxLength={name === "phoneNumber" ? 20 : undefined}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
              </label>
            ))}
            <label className="space-y-1 text-xs font-semibold text-[var(--color-muted)]">
              <span>Account role</span>
              <select
                value={editingUser.role}
                disabled={editingUser.id === currentUserId}
                onChange={(event) => {
                  const role = event.target.value;
                  setEditingUser((current) => current
                    ? {
                      ...current,
                      role,
                      isVerified: role === "AUCTIONEER"
                        ? current.role === "AUCTIONEER" && current.isVerified
                        : true,
                    }
                    : current);
                }}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
              >
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            {editingUser.role === "AUCTIONEER" && (
              <label className="flex items-center gap-2 self-end rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={Boolean(editingUser.isVerified)}
                  onChange={(event) => updateField("isVerified", event.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Verified auctioneer
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-secondary)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--color-primary)] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save account changes
            </button>
            <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-xs font-bold text-[var(--color-text)]">Cancel</button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--color-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search name, email, phone, or address"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-text)]">
            <option value="ALL">All roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button type="button" onClick={refresh} aria-label="Refresh user list" className="rounded-lg border border-[var(--color-border)] p-2.5 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" /></div>
        ) : data?.users?.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {data.users.map((user) => (
              <article key={user.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-[var(--color-text)]">{user.name}</strong>
                    <span className="rounded-full bg-[var(--color-secondary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">{user.role}</span>
                    {user.role === "AUCTIONEER" ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.isVerified ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                        {user.isVerified ? "Verified" : "Unverified"}
                      </span>
                    ) : null}
                  </div>
                  <p className="break-all text-xs text-[var(--color-muted)]">{user.email}{user.phoneNumber ? ` · ${user.phoneNumber}` : ""}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {[user.businessName, user.addressLine1, user.addressLine2, user.district, user.postalAddress].filter(Boolean).join(" · ") || "No address details recorded"}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setNotice(""); setEditingUser({ ...emptyUser, ...user }); }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit account
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    disabled={user.id === currentUserId || deletingUserId !== null}
                    title={user.id === currentUserId ? "You cannot delete your own administrator account." : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {deletingUserId === user.id ? "Deleting…" : "Delete account"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-[var(--color-muted)]">No user accounts match this search.</p>
        )}

        <footer className="flex items-center justify-between border-t border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
          <span>{data ? `${data.total} account${data.total === 1 ? "" : "s"} · page ${data.page} of ${data.totalPages}` : "User list unavailable"}</span>
          <div className="flex gap-2">
            <button type="button" disabled={!data || data.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" disabled={!data || data.page >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>
    </section>
  );
}
