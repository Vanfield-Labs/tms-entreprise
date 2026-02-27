import { useEffect, useState } from "react";
import { listVehicles, createVehicle, updateVehicle, setVehicleStatus, type Vehicle } from "../services/fleet.service";
import { fmtDate, statusBadge } from "@/lib/utils";

const STATUSES = ["active", "inactive", "maintenance", "decommissioned"];
const FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric"];

type VehicleForm = {
  plate_number: string; make: string; model: string; year: string; color: string;
  fuel_type: string; capacity: string; status: string; vin: string;
  insurance_expiry: string; roadworthy_expiry: string; notes: string;
};

const EMPTY_FORM: VehicleForm = {
  plate_number: "", make: "", model: "", year: "", color: "",
  fuel_type: "petrol", capacity: "", status: "active", vin: "",
  insurance_expiry: "", roadworthy_expiry: "", notes: "",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    const data = await listVehicles();
    setVehicles(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(""); setShowForm(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      plate_number: v.plate_number || "", make: v.make || "", model: v.model || "",
      year: v.year ? String(v.year) : "", color: v.color || "",
      fuel_type: v.fuel_type || "petrol", capacity: v.capacity ? String(v.capacity) : "",
      status: v.status || "active", vin: v.vin || "",
      insurance_expiry: v.insurance_expiry || "", roadworthy_expiry: v.roadworthy_expiry || "",
      notes: v.notes || "",
    });
    setError(""); setShowForm(true);
  };

  const saveVehicle = async () => {
    if (!form.plate_number.trim()) { setError("Plate number is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        plate_number: form.plate_number.trim().toUpperCase(),
        make: form.make || null, model: form.model || null,
        year: form.year ? Number(form.year) : null,
        color: form.color || null,
        fuel_type: form.fuel_type || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        status: form.status,
        vin: form.vin || null,
        insurance_expiry: form.insurance_expiry || null,
        roadworthy_expiry: form.roadworthy_expiry || null,
        notes: form.notes || null,
      };
      if (editing) await updateVehicle(editing.id, payload);
      else await createVehicle(payload);
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (v: Vehicle) => {
    const newStatus = v.status === "active" ? "inactive" : "active";
    setActingId(v.id);
    await setVehicleStatus(v.id, newStatus);
    await load();
    setActingId(null);
  };

  const filtered = vehicles.filter(v => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [v.plate_number, v.make, v.model, v.color, v.vin].filter(Boolean).join(" ").toLowerCase().includes(q);
    }
    return true;
  });

  const now = new Date();
  const isExpiringSoon = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };
  const isExpired = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < now;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Fleet — Vehicles</h1>
          <p className="page-sub">{vehicles.length} vehicles registered</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Vehicle</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="tms-input" style={{ maxWidth: 240 }} placeholder="Search plate, make, model..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", ...STATUSES].map(s => (
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
          <div className="card" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header">
              <span className="card-title">{editing ? "Edit Vehicle" : "Add Vehicle"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <div>
                  <label className="form-label">Plate Number *</label>
                  <input className="tms-input" value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} placeholder="GR-1234-24" />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="tms-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Make</label>
                  <input className="tms-input" value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Toyota" />
                </div>
                <div>
                  <label className="form-label">Model</label>
                  <input className="tms-input" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Land Cruiser" />
                </div>
                <div>
                  <label className="form-label">Year</label>
                  <input className="tms-input" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2022" />
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <input className="tms-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="White" />
                </div>
                <div>
                  <label className="form-label">Fuel Type</label>
                  <select className="tms-select" value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                    {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Capacity (passengers)</label>
                  <input className="tms-input" type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="5" />
                </div>
                <div>
                  <label className="form-label">VIN</label>
                  <input className="tms-input" value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} placeholder="VIN number" />
                </div>
                <div>
                  <label className="form-label">Insurance Expiry</label>
                  <input className="tms-input" type="date" value={form.insurance_expiry} onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Roadworthy Expiry</label>
                  <input className="tms-input" type="date" value={form.roadworthy_expiry} onChange={e => setForm(f => ({ ...f, roadworthy_expiry: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Notes</label>
                  <textarea className="tms-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
                </div>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={saveVehicle}>
                  {saving ? "Saving..." : editing ? "Update Vehicle" : "Add Vehicle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? <div className="loading-row">Loading vehicles...</div> : (
          <table className="tms-table">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Vehicle</th>
                <th>Fuel / Cap.</th>
                <th>Insurance</th>
                <th>Roadworthy</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13 }}>{v.plate_number}</div>
                    {v.vin && <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "'IBM Plex Mono', monospace" }}>{v.vin}</div>}
                  </td>
                  <td>
                    <div>{[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}</div>
                    {v.color && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{v.color}</div>}
                  </td>
                  <td style={{ fontSize: 12, textTransform: "capitalize" }}>
                    {v.fuel_type || "—"} · {v.capacity ? `${v.capacity} seats` : "—"}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: isExpired(v.insurance_expiry) ? "var(--red)" : isExpiringSoon(v.insurance_expiry) ? "var(--amber)" : "var(--text-muted)",
                    }}>
                      {v.insurance_expiry ? fmtDate(v.insurance_expiry) : "—"}
                      {isExpired(v.insurance_expiry) && " ⚠"}
                      {!isExpired(v.insurance_expiry) && isExpiringSoon(v.insurance_expiry) && " ⏰"}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: isExpired(v.roadworthy_expiry) ? "var(--red)" : isExpiringSoon(v.roadworthy_expiry) ? "var(--amber)" : "var(--text-muted)",
                    }}>
                      {v.roadworthy_expiry ? fmtDate(v.roadworthy_expiry) : "—"}
                      {isExpired(v.roadworthy_expiry) && " ⚠"}
                      {!isExpired(v.roadworthy_expiry) && isExpiringSoon(v.roadworthy_expiry) && " ⏰"}
                    </span>
                  </td>
                  <td><span className={statusBadge(v.status)}>{v.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                      <button
                        className={`btn btn-sm ${v.status === "active" ? "btn-amber" : "btn-success"}`}
                        disabled={actingId === v.id}
                        onClick={() => toggleStatus(v)}
                      >
                        {v.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🚗</div>
                    <div>No vehicles found</div>
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
