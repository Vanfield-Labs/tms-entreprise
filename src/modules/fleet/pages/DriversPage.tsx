import { useEffect, useState } from "react";
import { listDrivers, createDriver, updateDriver, setDriverStatus, type Driver } from "../services/fleet.service";
import { supabase } from "@/lib/supabase";
import { fmtDate, statusBadge } from "@/lib/utils";

const EMPLOYMENT_STATUSES = ["active", "inactive", "suspended", "terminated"];
const LICENSE_CLASSES = ["A", "B", "C", "D", "E", "B+C", "B+C+D", "Commercial"];

type DriverRow = Driver & { profiles?: { full_name: string } | null };

type DriverForm = {
  license_number: string; license_expiry: string; license_class: string;
  employment_status: string; phone: string; notes: string; user_id: string;
};
const EMPTY_FORM: DriverForm = {
  license_number: "", license_expiry: "", license_class: "B",
  employment_status: "active", phone: "", notes: "", user_id: "",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DriverRow | null>(null);
  const [form, setForm] = useState<DriverForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    const data = await listDrivers();
    setDrivers(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(""); setShowForm(true); };
  const openEdit = (d: DriverRow) => {
    setEditing(d);
    setForm({
      license_number: d.license_number || "", license_expiry: d.license_expiry || "",
      license_class: d.license_class || "B", employment_status: d.employment_status || "active",
      phone: d.phone || "", notes: d.notes || "", user_id: d.user_id || "",
    });
    setError(""); setShowForm(true);
  };

  const saveDriver = async () => {
    if (!form.license_number.trim()) { setError("License number is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        license_number: form.license_number.trim().toUpperCase(),
        license_expiry: form.license_expiry || null,
        license_class: form.license_class || null,
        employment_status: form.employment_status,
        phone: form.phone || null,
        notes: form.notes || null,
        user_id: form.user_id || null,
      };
      if (editing) await updateDriver(editing.id, payload);
      else await createDriver(payload);
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (d: DriverRow) => {
    const newStatus = d.employment_status === "active" ? "inactive" : "active";
    setActingId(d.id);
    await setDriverStatus(d.id, newStatus);
    await load();
    setActingId(null);
  };

  const now = new Date();
  const isExpiringSoon = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const diff = (new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };
  const isExpired = (dateStr?: string | null) => dateStr ? new Date(dateStr) < now : false;

  const filtered = drivers.filter(d => {
    if (statusFilter !== "all" && d.employment_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [d.license_number, d.phone, d.profiles?.full_name].filter(Boolean).join(" ").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Fleet — Drivers</h1>
          <p className="page-sub">{drivers.length} drivers registered</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Driver</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="tms-input" style={{ maxWidth: 240 }} placeholder="Search license, name, phone..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", ...EMPLOYMENT_STATUSES].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header">
              <span className="card-title">{editing ? "Edit Driver" : "Add Driver"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <div>
                  <label className="form-label">License Number *</label>
                  <input className="tms-input" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="GHA-DRV-12345" />
                </div>
                <div>
                  <label className="form-label">License Class</label>
                  <select className="tms-select" value={form.license_class} onChange={e => setForm(f => ({ ...f, license_class: e.target.value }))}>
                    {LICENSE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">License Expiry</label>
                  <input className="tms-input" type="date" value={form.license_expiry} onChange={e => setForm(f => ({ ...f, license_expiry: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Employment Status</label>
                  <select className="tms-select" value={form.employment_status} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))}>
                    {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="tms-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 24 000 0000" />
                </div>
                <div>
                  <label className="form-label">User Account ID (optional)</label>
                  <input className="tms-input" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} placeholder="Auth user UUID" />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Notes</label>
                  <textarea className="tms-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
                </div>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={saveDriver}>
                  {saving ? "Saving..." : editing ? "Update Driver" : "Add Driver"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? <div className="loading-row">Loading drivers...</div> : (
          <table className="tms-table">
            <thead>
              <tr>
                <th>License</th>
                <th>Name</th>
                <th>Class</th>
                <th>License Expiry</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13 }}>
                    {d.license_number}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {d.profiles?.full_name || <span style={{ color: "var(--text-dim)" }}>No account linked</span>}
                  </td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                    {d.license_class || "—"}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: isExpired(d.license_expiry) ? "var(--red)" : isExpiringSoon(d.license_expiry) ? "var(--amber)" : "var(--text-muted)",
                    }}>
                      {d.license_expiry ? fmtDate(d.license_expiry) : "—"}
                      {isExpired(d.license_expiry) && " ⚠ EXPIRED"}
                      {!isExpired(d.license_expiry) && isExpiringSoon(d.license_expiry) && " ⏰ Soon"}
                    </span>
                  </td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--text-muted)" }}>
                    {d.phone || "—"}
                  </td>
                  <td><span className={statusBadge(d.employment_status)}>{d.employment_status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Edit</button>
                      <button
                        className={`btn btn-sm ${d.employment_status === "active" ? "btn-amber" : "btn-success"}`}
                        disabled={actingId === d.id}
                        onClick={() => toggleStatus(d)}
                      >
                        {d.employment_status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <div>No drivers found</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
