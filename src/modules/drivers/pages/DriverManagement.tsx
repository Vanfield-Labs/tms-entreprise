// src/modules/drivers/pages/DriverManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner, EmptyState, Badge, Card, SearchInput,
  Field, Input, Select, Btn, Modal, ConfirmDialog, Alert, TabBar, ExpiryPill,
} from "@/components/TmsUI";

type Driver = {
  id: string; full_name: string; license_number: string; license_expiry: string | null;
  employment_status: string; user_id: string | null;
};
type FormData = { user_id: string; license_number: string; license_expiry: string; employment_status: string };
const EMPTY: FormData = { user_id:"", license_number:"", license_expiry:"", employment_status:"active" };
const EMP_STATUSES = ["all","active","inactive","suspended","on_leave"];

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
}

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

 const load = async () => {
  setLoading(true);

  const { data: driverData } = await supabase
    .from("drivers")
    .select("id, user_id, license_number, license_expiry, employment_status, created_at")
    .order("license_number");

  const rows = (driverData as any[]) || [];

  // Get profile names for drivers that have a linked user_id
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
    id: d.id,
    user_id: d.user_id,
    license_number: d.license_number,
    license_expiry: d.license_expiry,
    employment_status: d.employment_status,
    created_at: d.created_at,
    full_name: (d.user_id ? nameMap[d.user_id] ?? null : null) as string | null,
  }));

  setDrivers(enriched);
  setLoading(false);
};
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setEditingId(null); setError(null); setShowForm(true); };
  const openEdit = (d: Driver) => {
    setForm({ user_id: d.user_id||"", license_number: d.license_number, license_expiry: d.license_expiry||"", employment_status: d.employment_status });
    setEditingId(d.id); setError(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.license_number.trim()) { setError("Licence number is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = { user_id: form.user_id.trim()||null, license_number: form.license_number.trim().toUpperCase(), license_expiry: form.license_expiry||null, employment_status: form.employment_status };
      const { error: e } = editingId
        ? await supabase.from("drivers").update(payload).eq("id", editingId)
        : await supabase.from("drivers").insert(payload);
      if (e) throw e;
      setShowForm(false); await load();
    } catch (e: any) { setError(e.message ?? "Save failed."); }
    finally { setSaving(false); }
  };

  const f = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Expiry alerts
  const expired    = drivers.filter(d => { const n = daysLeft(d.license_expiry); return n !== null && n < 0; });
  const expiringSoon = drivers.filter(d => { const n = daysLeft(d.license_expiry); return n !== null && n >= 0 && n <= 30; });

  const tabs = EMP_STATUSES.map(s => ({ value: s, label: s === "all" ? "All" : s.replace("_"," ").charAt(0).toUpperCase() + s.replace("_"," ").slice(1) }));
  const counts: Record<string, number> = Object.fromEntries(EMP_STATUSES.map(s => [s, s === "all" ? drivers.length : drivers.filter(d => d.employment_status === s).length]));
  const filtered = drivers.filter(d => {
    const matchQ = !q || [d.full_name, d.license_number].join(" ").toLowerCase().includes(q.toLowerCase());
    return matchQ && (tab === "all" || d.employment_status === tab);
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{drivers.length} total</p>
        </div>
        <Btn variant="primary" onClick={openAdd}>+ Add Driver</Btn>
      </div>

      {expired.length > 0 && (
        <Alert type="error">
          <strong>Expired licences:</strong> {expired.map(d => d.full_name || d.license_number).join(", ")}
        </Alert>
      )}
      {expiringSoon.length > 0 && (
        <Alert type="amber">
          <strong>Expiring within 30 days:</strong> {expiringSoon.map(d => d.full_name || d.license_number).join(", ")}
        </Alert>
      )}

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />
      <SearchInput value={q} onChange={setQ} placeholder="Search name or licence…" />

      {filtered.length === 0 ? (
        <EmptyState title="No drivers found" />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map(d => {
              const days = daysLeft(d.license_expiry);
              return (
                <Card key={d.id}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[color:var(--text)]">{d.full_name}</p>
                      <Badge status={d.employment_status} />
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] font-mono">{d.license_number}</p>
                    {d.license_expiry && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[color:var(--text-muted)]">Expires {d.license_expiry}</span>
                        <ExpiryPill daysLeft={days} />
                      </div>
                    )}
                    {!d.user_id && <p className="text-xs text-[color:var(--text-dim)]">No login account linked</p>}
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Btn>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead><tr>{["Driver","Licence No.","Expiry","Status","Account","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(d => {
                    const days = daysLeft(d.license_expiry);
                    return (
                      <tr key={d.id}>
                        <td className="font-medium">{d.full_name}</td>
                        <td className="font-mono text-xs">{d.license_number}</td>
                        <td><div className="flex items-center gap-2">{d.license_expiry ?? "—"}<ExpiryPill daysLeft={days} /></div></td>
                        <td><Badge status={d.employment_status} /></td>
                        <td>{d.user_id ? <span className="badge badge-active">Linked</span> : <span className="badge badge-inactive">None</span>}</td>
                        <td><Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Btn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Driver" : "Add Driver"}>
        <div className="space-y-4">
          <Field label="Licence Number" required><Input placeholder="GH-1234-AB" value={form.license_number} onChange={e => f("license_number", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Licence Expiry"><Input type="date" value={form.license_expiry} onChange={e => f("license_expiry", e.target.value)} /></Field>
            <Field label="Status"><Select value={form.employment_status} onChange={e => f("employment_status", e.target.value)}>{["active","inactive","suspended","on_leave"].map(s=><option key={s} value={s}>{s.replace("_"," ").charAt(0).toUpperCase()+s.replace("_"," ").slice(1)}</option>)}</Select></Field>
          </div>
          <Field label="User Account ID (optional)" hint="Paste the auth UUID to link a login account"><Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.user_id} onChange={e => f("user_id", e.target.value)} /></Field>
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex justify-end gap-3"><Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn><Btn variant="primary" onClick={save} loading={saving}>Save</Btn></div>
        </div>
      </Modal>
    </div>
  );
}