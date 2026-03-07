// src/modules/drivers/pages/DriverManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner, EmptyState, Badge, Card, SearchInput,
  Field, Input, Select, Btn, Modal, ConfirmDialog, TabBar, ExpiryPill,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Driver = {
  id: string;
  full_name: string | null;
  license_number: string;
  license_expiry: string | null;
  employment_status: string;
  user_id: string | null;
};

type FormData = {
  user_id: string;
  license_number: string;
  license_expiry: string;
  employment_status: string;
};

const EMPTY: FormData = {
  user_id: "", license_number: "", license_expiry: "", employment_status: "active",
};

const EMP_STATUSES = ["all", "active", "inactive", "suspended", "on_leave"];

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
}

// ─── Expiry Alert Banner ──────────────────────────────────────────────────────
// A polished card-style banner with a bold colour stripe on the left.
function ExpiryBanner({
  variant,
  drivers,
}: {
  variant: "expired" | "expiring";
  drivers: Driver[];
}) {
  if (drivers.length === 0) return null;

  const isExpired = variant === "expired";

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: isExpired
          ? "rgba(220,38,38,0.07)"
          : "rgba(217,119,6,0.07)",
        border: `1px solid ${isExpired ? "rgba(220,38,38,0.35)" : "rgba(217,119,6,0.35)"}`,
        borderLeft: `4px solid ${isExpired ? "var(--red)" : "var(--amber)"}`,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: 20, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>
        {isExpired ? "🚨" : "⏰"}
      </div>

      {/* Content */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: isExpired ? "var(--red)" : "var(--amber)",
          marginBottom: 4,
        }}>
          {isExpired
            ? `${drivers.length} licence${drivers.length > 1 ? "s" : ""} expired`
            : `${drivers.length} licence${drivers.length > 1 ? "s" : ""} expiring within 30 days`}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
          {drivers.map(d => (
            <span
              key={d.id}
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {d.full_name ?? d.license_number}
              </span>
              {d.license_expiry && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  opacity: 0.8,
                }}>
                  · {fmtDate(d.license_expiry)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DriverManagement() {
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState<FormData>(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [q,         setQ]         = useState("");
  const [tab,       setTab]       = useState("all");
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    const { data: driverData } = await supabase
      .from("drivers")
      .select("id, user_id, license_number, license_expiry, employment_status, created_at")
      .order("license_number");

    const rows = (driverData as any[]) || [];

    const userIds = rows.map(d => d.user_id).filter(Boolean);
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      nameMap = Object.fromEntries(
        ((profileData as any[]) || []).map(p => [p.user_id, p.full_name])
      );
    }

    const enriched: Driver[] = rows.map(d => ({
      id:                d.id,
      user_id:           d.user_id,
      license_number:    d.license_number,
      license_expiry:    d.license_expiry,
      employment_status: d.employment_status,
      full_name:         d.user_id ? (nameMap[d.user_id] ?? null) : null,
    }));

    setDrivers(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY); setEditingId(null); setError(null); setShowForm(true);
  };

  const openEdit = (d: Driver) => {
    setForm({
      user_id:           d.user_id ?? "",
      license_number:    d.license_number,
      license_expiry:    d.license_expiry ?? "",
      employment_status: d.employment_status,
    });
    setEditingId(d.id); setError(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.license_number.trim()) { setError("Licence number is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        user_id:           form.user_id.trim() || null,
        license_number:    form.license_number.trim().toUpperCase(),
        license_expiry:    form.license_expiry || null,
        employment_status: form.employment_status,
      };
      const { error: e } = editingId
        ? await supabase.from("drivers").update(payload).eq("id", editingId)
        : await supabase.from("drivers").insert(payload);
      if (e) throw e;
      setShowForm(false); await load();
    } catch (e: any) { setError(e.message ?? "Save failed."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("drivers").delete().eq("id", id);
    setDeleteId(null); await load();
  };

  const f = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Expiry buckets
  const expired     = drivers.filter(d => { const n = daysLeft(d.license_expiry); return n !== null && n < 0; });
  const expiringSoon= drivers.filter(d => { const n = daysLeft(d.license_expiry); return n !== null && n >= 0 && n <= 30; });

  const tabs = EMP_STATUSES.map(s => ({
    value: s,
    label: s === "all" ? "All" : s.replace("_", " ").replace(/^\w/, c => c.toUpperCase()),
  }));
  const counts: Record<string, number> = Object.fromEntries(
    EMP_STATUSES.map(s => [s, s === "all" ? drivers.length : drivers.filter(d => d.employment_status === s).length])
  );
  const filtered = drivers.filter(d => {
    const matchQ = !q || [d.full_name ?? "", d.license_number].join(" ").toLowerCase().includes(q.toLowerCase());
    return matchQ && (tab === "all" || d.employment_status === tab);
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{drivers.length} total</p>
        </div>
        <Btn variant="primary" onClick={openAdd}>+ Add Driver</Btn>
      </div>

      {/* ── Expiry banners ── */}
      <ExpiryBanner variant="expired"  drivers={expired} />
      <ExpiryBanner variant="expiring" drivers={expiringSoon} />

      {/* Filters */}
      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />
      <SearchInput value={q} onChange={setQ} placeholder="Search name or licence…" />

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState title="No drivers found" subtitle="Try adjusting your search or filters" />
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map(d => {
              const days = daysLeft(d.license_expiry);
              return (
                <Card key={d.id}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[color:var(--text)] truncate">
                          {d.full_name ?? <span className="text-[color:var(--text-dim)] italic">No account linked</span>}
                        </p>
                        <p className="text-xs text-[color:var(--text-muted)] font-mono mt-0.5">{d.license_number}</p>
                      </div>
                      <Badge status={d.employment_status} />
                    </div>
                    {d.license_expiry && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[color:var(--text-muted)]">Expires {fmtDate(d.license_expiry)}</span>
                        <ExpiryPill daysLeft={days} />
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Btn>
                      <Btn variant="danger" size="sm" onClick={() => setDeleteId(d.id)}>Delete</Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    {["Driver", "Licence No.", "Expiry", "Status", "Account", "Actions"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const days = daysLeft(d.license_expiry);
                    return (
                      <tr key={d.id}>
                        <td className="font-medium">
                          {d.full_name ?? <span className="text-[color:var(--text-dim)] italic text-xs">No account</span>}
                        </td>
                        <td className="font-mono text-xs">{d.license_number}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{d.license_expiry ? fmtDate(d.license_expiry) : "—"}</span>
                            <ExpiryPill daysLeft={days} />
                          </div>
                        </td>
                        <td><Badge status={d.employment_status} /></td>
                        <td>
                          {d.user_id
                            ? <span className="badge badge-active">Linked</span>
                            : <span className="badge badge-inactive">None</span>}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Btn>
                            <Btn variant="danger" size="sm" onClick={() => setDeleteId(d.id)}>Delete</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit modal ── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Driver" : "Add Driver"}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Field label="Licence Number" required>
            <Input
              value={form.license_number}
              onChange={e => f("license_number", e.target.value)}
              placeholder="GHA-DRV-12345"
            />
          </Field>
          <Field label="Licence Expiry">
            <Input type="date" value={form.license_expiry} onChange={e => f("license_expiry", e.target.value)} />
          </Field>
          <Field label="Employment Status">
            <Select value={form.employment_status} onChange={e => f("employment_status", e.target.value)}>
              {["active","inactive","suspended","on_leave"].map(s => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </Select>
          </Field>
          <Field label="Linked User Account ID (optional)">
            <Input
              value={form.user_id}
              onChange={e => f("user_id", e.target.value)}
              placeholder="Auth user UUID"
            />
          </Field>
          {error && (
            <p className="text-sm text-[color:var(--red)]">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save}>
              {editingId ? "Update Driver" : "Add Driver"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Driver"
        message="Remove this driver record? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}