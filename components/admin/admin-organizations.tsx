"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Clipboard, KeyRound, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

type OrganizationStatus = "pending" | "active" | "inactive";
type Owner = { id: string; name: string; email: string };
type Organization = {
  id: string;
  name: string;
  tradeName: string;
  gstin: string;
  status: OrganizationStatus;
  createdAt: string;
  owners: Owner[];
};
type OrganizationResponse = { organizations: Organization[]; error?: string };
type StatusFilter = "all" | OrganizationStatus;

const statusLabel: Record<OrganizationStatus, string> = {
  pending: "Pending approval",
  active: "Active",
  inactive: "Inactive",
};

export function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteName, setDeleteName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<{ organizationName: string; user: Owner; value: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/organizations", { cache: "no-store" });
      const data = (await response.json()) as OrganizationResponse;
      if (!response.ok) throw new Error(data.error ?? "Unable to load organizations.");
      setOrganizations(data.organizations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load organizations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => { void loadOrganizations(); }, 0);
    return () => window.clearTimeout(request);
  }, [loadOrganizations]);

  const counts = useMemo(() => ({
    all: organizations.length,
    pending: organizations.filter((organization) => organization.status === "pending").length,
    active: organizations.filter((organization) => organization.status === "active").length,
    inactive: organizations.filter((organization) => organization.status === "inactive").length,
  }), [organizations]);

  const visibleOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return organizations.filter((organization) => {
      const matchesStatus = filter === "all" || organization.status === filter;
      const matchesSearch = !query || [
        organization.name,
        organization.tradeName,
        organization.gstin,
        ...organization.owners.flatMap((owner) => [owner.name, owner.email]),
      ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [filter, organizations, search]);

  async function runAction(organization: Organization, action: "approve" | "set-status" | "reset-password", extra: Record<string, string> = {}) {
    setBusyId(organization.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, organizationId: organization.id, ...extra }),
      });
      const data = await response.json() as {
        error?: string;
        message?: string;
        temporaryPassword?: string;
        user?: Owner;
      };
      if (!response.ok) throw new Error(data.error ?? "Unable to update the organization.");
      if (action === "reset-password" && data.temporaryPassword && data.user) {
        setTemporaryPassword({
          organizationName: organization.name,
          user: data.user,
          value: data.temporaryPassword,
        });
        setCopied(false);
      } else {
        setNotice(data.message ?? "Organization updated.");
      }
      await loadOrganizations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the organization.");
    } finally {
      setBusyId("");
    }
  }

  function beginDelete(organization: Organization) {
    setDeleting(organization);
    setDeleteStep(1);
    setDeleteName("");
    setError("");
    setNotice("");
  }

  async function confirmDelete() {
    if (!deleting || deleteName !== deleting.name) return;
    setBusyId(deleting.id);
    setError("");
    try {
      const response = await fetch("/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: deleting.id,
          confirmDelete: true,
          confirmationName: deleteName,
        }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete this organization.");
      setNotice(data.message ?? "Organization deleted.");
      setDeleting(null);
      setDeleteName("");
      await loadOrganizations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this organization.");
    } finally {
      setBusyId("");
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword.value);
      setCopied(true);
    } catch {
      setError("Clipboard access was denied. Select and copy the temporary password manually.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">Review registrations, manage access, and reset organization-owner passwords.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrganizations()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="All organizations" value={counts.all} />
        <SummaryCard label="Pending approval" value={counts.pending} />
        <SummaryCard label="Active" value={counts.active} />
        <SummaryCard label="Inactive" value={counts.inactive} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["pending", `Pending (${counts.pending})`],
              ["active", `Active (${counts.active})`],
              ["inactive", `Inactive (${counts.inactive})`],
              ["all", `All (${counts.all})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  filter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search organizations</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organizations or owners"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Owner account</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Loading organizations…</td></tr>
              ) : visibleOrganizations.map((organization) => (
                <tr key={organization.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Building2 className="h-4 w-4" /></div>
                      <div>
                        <p className="font-semibold text-slate-900">{organization.name}</p>
                        {organization.tradeName && <p className="mt-0.5 text-xs text-slate-500">{organization.tradeName}</p>}
                        {organization.gstin && <p className="mt-1 text-xs text-slate-500">GSTIN: {organization.gstin}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {organization.owners.length ? organization.owners.map((owner) => (
                      <div key={owner.id} className="mb-3 last:mb-0">
                        <p className="font-medium text-slate-800">{owner.name}</p>
                        <p className="text-xs text-slate-500">{owner.email}</p>
                        <button
                          type="button"
                          onClick={() => void runAction(organization, "reset-password", { userId: owner.id })}
                          disabled={Boolean(busyId)}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
                        >
                          <KeyRound className="h-3 w-3" /> Reset password
                        </button>
                      </div>
                    )) : <span className="text-xs text-slate-500">No owner account found</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {organization.createdAt
                      ? new Date(organization.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      organization.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : organization.status === "pending"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                    }`}>
                      {statusLabel[organization.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {organization.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void runAction(organization, "approve")}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void runAction(organization, "set-status", { status: "inactive" })}
                            disabled={Boolean(busyId)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void runAction(organization, "set-status", {
                            status: organization.status === "active" ? "inactive" : "active",
                          })}
                          disabled={Boolean(busyId)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {organization.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => beginDelete(organization)}
                        disabled={Boolean(busyId)}
                        aria-label={`Delete ${organization.name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visibleOrganizations.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No organizations found for this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deleting && (
        <Modal title={deleteStep === 1 ? "Delete organization?" : "Final deletion confirmation"} onClose={() => setDeleting(null)}>
          {deleteStep === 1 ? (
            <>
              <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  This permanently deletes <strong>{deleting.name}</strong>, its user accounts, customers, transactions, inventory, and trading records.
                  This action cannot be undone.
                </p>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleting(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                <button type="button" onClick={() => setDeleteStep(2)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">Continue to final confirmation</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                Confirmation 2 of 2: type the organization name exactly as shown to enable permanent deletion.
              </p>
              <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-900">{deleting.name}</p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Organization name
                <input
                  autoFocus
                  value={deleteName}
                  onChange={(event) => setDeleteName(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-rose-500"
                  autoComplete="off"
                />
              </label>
              <div className="mt-5 flex justify-between gap-2">
                <button type="button" onClick={() => setDeleteStep(1)} disabled={Boolean(busyId)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Back</button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleteName !== deleting.name || busyId === deleting.id}
                  className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === deleting.id ? "Deleting…" : "Permanently delete organization"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {temporaryPassword && (
        <Modal title="Temporary password generated" onClose={() => setTemporaryPassword(null)}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>
              Share this temporary password securely with <strong>{temporaryPassword.user.name}</strong> ({temporaryPassword.user.email}) for{" "}
              <strong>{temporaryPassword.organizationName}</strong>. It will only be shown here once.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-900">
              {temporaryPassword.value}
            </code>
            <button type="button" onClick={() => void copyTemporaryPassword()} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Clipboard className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => setTemporaryPassword(null)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Done</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="organization-modal-title" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="organization-modal-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
