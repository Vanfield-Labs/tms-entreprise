// src/modules/vehicles/pages/VehicleManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Vehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  fuel_type: string | null;
  status: string;
  created_at: string;
};

type FormData = {
  plate_number: string;
  make: string;
  model: string;
  year: string;
  color: string;
  fuel_type: string;
  status: string;
};

const EMPTY_FORM: FormData = {
  plate_number: "", make: "", model: "", year: "",
  color: "", fuel_type: "petrol", status: "active",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  maintenance: "bg-amber-50 text-amber-700",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-400",
  inactive: "bg-gray-300",
  maintenance: "bg-amber-400",
};

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("id,plate_number,make,model,year,color,fuel_type,status,created_at")
      .order("plate_number");
    setVehicles((data as Vehicle[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (v: Vehicle) => {
    setForm({
      plate_number: v.plate_number,
      make: v.make || "",
      model: v.model || "",
      year: v.year ? String(v.year) : "",
      color: v.color || "",
      fuel_type: v.fuel_type || "petrol",
      status: v.status,
    });
    setEditingId(v.id);
    setError(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.plate_number.trim()) { setError("Plate number is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        plate_number: form.plate_number.trim().toUpperCase(),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? parseInt(form.year) : null,
        color: form.color.trim() || null,
        fuel_type: form.fuel_type || null,
        status: form.status,
      };

      if (editingId) {
        const { error: e } = await supabase.from("vehicles").update(payload).eq("id", editingId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("vehicles").insert(payload);
        if (e) throw e;
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to save vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (v: Vehicle) => {
    const next = v.status === "active" ? "inactive" : "active";
    await supabase.from("vehicles").update({ status: next }).eq("id", v.id);
    await load();
  };

  const setMaintenance = async (id: string) => {
    await supabase.from("vehicles").update({ status: "maintenance" }).eq("id", id);
    await load();
  };

  const filtered = vehicles.filter((v) => {
    const matchQ = !q || [v.plate_number, v.make, v.model, v.color].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || v.status === statusFilter;
    return matchQ && matchS;
  });

  const counts = { all: vehicles.length, active: vehicles.filter((v) => v.status === "active").length, inactive: vehicles.filter((v) => v.status === "inactive").length, maintenance: vehicles.filter((v) => v.status === "maintenance").length };

  const f = (k: keyof FormData, val: string) => setForm((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "active", "inactive", "maintenance"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`p-3 rounded-2xl border text-left transition-all ${statusFilter === s ? "bg-black text-white border-black" : "bg-white border-gray-200 hover:border-gray-300"}`}>
            <div className={`text-2xl font-bold ${statusFilter === s ? "text-white" : "text-gray-900"}`}>{counts[s]}</div>
            <div className={`text-xs mt-0.5 capitalize ${statusFilter === s ? "text-gray-300" : "text-gray-500"}`}>{s}</div>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input placeholder="Search plate, make, model…" value={q} onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"/>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">Add Vehicle</span>
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingId ? "Edit Vehicle" : "Add Vehicle"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <svg width="16" height="16" fill="none" viewBox="0 0 18 18"><path d="M4 4L14 14M14 4L4 14" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Plate Number *">
                  <input value={form.plate_number} onChange={(e) => f("plate_number", e.target.value)}
                    placeholder="e.g. GR-1234-24" className={`${inputCls} uppercase`}/>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => f("status", e.target.value)} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Under Maintenance</option>
                  </select>
                </Field>
                <Field label="Make">
                  <input value={form.make} onChange={(e) => f("make", e.target.value)} placeholder="e.g. Toyota" className={inputCls}/>
                </Field>
                <Field label="Model">
                  <input value={form.model} onChange={(e) => f("model", e.target.value)} placeholder="e.g. Hilux" className={inputCls}/>
                </Field>
                <Field label="Year">
                  <input type="number" value={form.year} onChange={(e) => f("year", e.target.value)}
                    placeholder="e.g. 2022" min="1990" max="2030" className={inputCls}/>
                </Field>
                <Field label="Color">
                  <input value={form.color} onChange={(e) => f("color", e.target.value)} placeholder="e.g. White" className={inputCls}/>
                </Field>
                <Field label="Fuel Type">
                  <select value={form.fuel_type} onChange={(e) => f("fuel_type", e.target.value)} className={inputCls}>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors">
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Add Vehicle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-gray-900">Deactivate Vehicle?</h3>
            <p className="text-sm text-gray-500">This vehicle will be set to inactive and won't appear in dispatch.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={async () => { await supabase.from("vehicles").update({ status: "inactive" }).eq("id", confirmDelete); setConfirmDelete(null); await load(); }}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[v.status] ?? "bg-gray-300"}`}/>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 font-mono">{v.plate_number}</p>
                      <p className="text-xs text-gray-500 truncate">{[v.make, v.model, v.year].filter(Boolean).join(" · ") || "No details"}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[v.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {v.status}
                  </span>
                </div>
                <div className="px-4 pb-3 flex items-center gap-2">
                  {v.color && <Chip>{v.color}</Chip>}
                  {v.fuel_type && <Chip className="capitalize">{v.fuel_type}</Chip>}
                </div>
                <div className="border-t border-gray-100 px-4 py-2.5 flex gap-2">
                  <button onClick={() => openEdit(v)} className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                  {v.status !== "maintenance" && (
                    <button onClick={() => setMaintenance(v.id)} className="flex-1 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">Set Maintenance</button>
                  )}
                  <button onClick={() => toggleStatus(v)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${v.status === "active" ? "text-gray-500 border-gray-200 hover:bg-gray-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}>
                    {v.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Plate", "Make / Model", "Year", "Color", "Fuel", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold font-mono text-gray-900">{v.plate_number}</td>
                      <td className="px-4 py-3 text-gray-700">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{v.year || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{v.color || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{v.fuel_type || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[v.status] ?? "bg-gray-300"}`}/>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[v.status] ?? "bg-gray-100 text-gray-500"}`}>{v.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(v)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                          {v.status !== "maintenance" && (
                            <button onClick={() => setMaintenance(v.id)} className="px-3 py-1.5 text-xs border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">Maintenance</button>
                          )}
                          <button onClick={() => toggleStatus(v)}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${v.status === "active" ? "border-gray-200 text-gray-500 hover:bg-gray-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                            {v.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} of {vehicles.length} vehicles
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full ${className}`}>{children}</span>;
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">No vehicles yet</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">Add your first vehicle to enable dispatch</p>
      <button onClick={onAdd} className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">Add Vehicle</button>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all";