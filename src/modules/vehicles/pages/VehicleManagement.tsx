// src/modules/vehicles/pages/VehicleManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner, EmptyState, Badge, Card, CardHeader, CardBody,
  SearchInput, Field, Input, Select, Btn, Modal, ConfirmDialog, Alert, TabBar,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Vehicle = {
  id: string; plate_number: string; make: string | null; model: string | null;
  year: number | null; color: string | null; fuel_type: string | null; status: string; created_at: string;
};
type FormData = { plate_number: string; make: string; model: string; year: string; color: string; fuel_type: string; status: string };
const EMPTY: FormData = { plate_number:"", make:"", model:"", year:"", color:"", fuel_type:"petrol", status:"active" };
const STATUSES = ["all","active","inactive","maintenance"];

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,     setForm]     = useState<FormData>(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [q,        setQ]        = useState("");
  const [tab,      setTab]      = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("id,plate_number,make,model,year,color,fuel_type,status,created_at").order("plate_number");
    setVehicles((data as Vehicle[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setEditingId(null); setError(null); setShowForm(true); };
  const openEdit = (v: Vehicle) => {
    setForm({ plate_number: v.plate_number, make: v.make||"", model: v.model||"", year: v.year ? String(v.year) : "", color: v.color||"", fuel_type: v.fuel_type||"petrol", status: v.status });
    setEditingId(v.id); setError(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.plate_number.trim()) { setError("Plate number is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = { plate_number: form.plate_number.trim().toUpperCase(), make: form.make.trim()||null, model: form.model.trim()||null, year: form.year ? parseInt(form.year) : null, color: form.color.trim()||null, fuel_type: form.fuel_type, status: form.status };
      const { error: e } = editingId
        ? await supabase.from("vehicles").update(payload).eq("id", editingId)
        : await supabase.from("vehicles").insert(payload);
      if (e) throw e;
      setShowForm(false); await load();
    } catch (e: any) { setError(e.message ?? "Save failed."); }
    finally { setSaving(false); }
  };

  const deleteVehicle = async () => {
    if (!confirmId) return;
    await supabase.from("vehicles").delete().eq("id", confirmId);
    setConfirmId(null); await load();
  };

  const f = (k: keyof FormData, val: string) => setForm(p => ({ ...p, [k]: val }));

  const tabs = STATUSES.map(s => ({ value: s, label: s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1) }));
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map(s => [s, s === "all" ? vehicles.length : vehicles.filter(v => v.status === s).length]));
  const filtered = vehicles.filter(v => {
    const matchQ = !q || [v.plate_number, v.make, v.model].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
    const matchT = tab === "all" || v.status === tab;
    return matchQ && matchT;
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{vehicles.length} total</p>
        </div>
        <Btn variant="primary" onClick={openAdd}>+ Add Vehicle</Btn>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      <SearchInput value={q} onChange={setQ} placeholder="Search plate, make or model…" />

      {filtered.length === 0 ? (
        <EmptyState title="No vehicles found" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map(v => (
              <Card key={v.id}>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[color:var(--text)]">{v.plate_number}</p>
                    <Badge status={v.status} />
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)]">{[v.year, v.make, v.model, v.color].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{v.fuel_type ?? "—"}</p>
                  <div className="flex gap-2 pt-1">
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(v)}>Edit</Btn>
                    <Btn variant="danger" size="sm" onClick={() => setConfirmId(v.id)}>Delete</Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead><tr>{["Plate","Make / Model","Year","Colour","Fuel","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id}>
                      <td className="font-bold">{v.plate_number}</td>
                      <td>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                      <td>{v.year ?? "—"}</td>
                      <td>{v.color ?? "—"}</td>
                      <td className="capitalize">{v.fuel_type ?? "—"}</td>
                      <td><Badge status={v.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <Btn variant="ghost" size="sm" onClick={() => openEdit(v)}>Edit</Btn>
                          <Btn variant="danger" size="sm" onClick={() => setConfirmId(v.id)}>Delete</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Vehicle" : "Add Vehicle"}>
        <div className="space-y-4">
          <Field label="Plate Number" required><Input placeholder="GR-1234-22" value={form.plate_number} onChange={e => f("plate_number", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make"><Input placeholder="Toyota" value={form.make} onChange={e => f("make", e.target.value)} /></Field>
            <Field label="Model"><Input placeholder="Hilux" value={form.model} onChange={e => f("model", e.target.value)} /></Field>
            <Field label="Year"><Input type="number" placeholder="2022" value={form.year} onChange={e => f("year", e.target.value)} /></Field>
            <Field label="Colour"><Input placeholder="White" value={form.color} onChange={e => f("color", e.target.value)} /></Field>
            <Field label="Fuel Type"><Select value={form.fuel_type} onChange={e => f("fuel_type", e.target.value)}>{["petrol","diesel","electric","hybrid"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</Select></Field>
            <Field label="Status"><Select value={form.status} onChange={e => f("status", e.target.value)}>{["active","inactive","maintenance"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</Select></Field>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex justify-end gap-3"><Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn><Btn variant="primary" onClick={save} loading={saving}>Save</Btn></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} title="Delete Vehicle" message="This action cannot be undone." confirmLabel="Delete" variant="danger" onConfirm={deleteVehicle} onCancel={() => setConfirmId(null)} />
    </div>
  );
}