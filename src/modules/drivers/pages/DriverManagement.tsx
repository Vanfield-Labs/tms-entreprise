// src/modules/drivers/pages/DriverManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Driver = {
  id: string;
  user_id: string | null;
  license_number: string;
  license_expiry: string | null;
  employment_status: string;
  created_at: string;
  full_name?: string;
  email?: string;
};

type FormData = {
  user_id: string;
  license_number: string;
  license_expiry: string;
  employment_status: string;
};

const EMPTY_FORM: FormData = {
  user_id: "", license_number: "", license_expiry: "", employment_status: "active",
};

const EMP_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  suspended: "bg-red-50 text-red-600",
  on_leave: "bg-blue-50 text-blue-700",
};

const EMP_DOT: Record<string, string> = {
  active: "bg-emerald-400",
  inactive: "bg-gray-300",
  suspended: "bg-red-400",
  on_leave: "bg-blue-400",
};

function daysUntilExpiry(expiry: string | null): number | null {
  if (!expiry) return null;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [empFilter, setEmpFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    // Join drivers with profiles for names
    const { data } = await supabase
      .from("drivers")
      .select("id, user_id, license_number, license_expiry, employment_status, created_at, profiles(full_name)")
      .order("license_number");

    const enriched: Driver[] = ((data as any[]) || []).map((d) => ({
      id: d.id,
      user_id: d.user_id,
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      employment_status: d.employment_status,
      created_at: d.created_at,
      full_name: d.profiles?.full_name ?? null,
    }));
    setDrivers(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (d: Driver) => {
    setForm({
      user_id: d.user_id || "",
      license_number: d.license_number,
      license_expiry: d.license_expiry || "",
      employment_status: d.employment_status,
    });
    setEditingId(d.id);
    setError(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.license_number.trim()) { setError("License number is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        user_id: form.user_id.trim() || null,
        license_number: form.license_number.trim().toUpperCase(),
        license_expiry: form.license_expiry || null,
        employment_status: form.employment_status,
      };

      if (editingId) {
        const { error: e } = await supabase.from("drivers").update(payload).eq("id", editingId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("drivers").insert(payload);
        if (e) throw e;
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to save driver.");
    } finally {
      setSaving(false);
    }
  };

  const f = (k: keyof FormData, val: string) => setForm((p) => ({ ...p, [k]: val }));

  const filtered = drivers.filter((d) => {
    const matchQ = !q || [d.full_name, d.license_number].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
    const matchE = empFilter === "all" || d.employment_status === empFilter;
    return matchQ && matchE;
  });

  const counts = {
    all: drivers.length,
    active: drivers.filter((d) => d.employment_status === "active").length,
    inactive: drivers.filter((d) => d.employment_status === "inactive").length,
    suspended: drivers.filter((d) => d.employment_status === "suspended").length,
    on_leave: drivers.filter((d) => d.employment_status === "on_leave").length,
  };

  // Expiry alerts
  const expiringWithin30 = drivers.filter((d) => {
    const days = daysUntilExpiry(d.license_expiry);
    return days !== null && days <= 30 && days >= 0;
  });
  const expired = drivers.filter((d) => {
    const days = daysUntilExpiry(d.license_expiry);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-4">
      {/* Expiry alerts */}
      {expired.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">Expired Licences</p>
            <p className="text-xs text-red-600 mt-0.5">{expired.map((d) => d.full_name || d.license_number).join(", ")} — licence expired. Update immediately.</p>
          </div>
        </div>
      )}
      {expiringWithin30.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-700">Licences Expiring Soon</p>
            <p className="text-xs text-amber-600 mt-0.5">{expiringWithin30.map((d) => `${d.full_name || d.license_number} (${daysUntilExpiry(d.license_expiry)}d)`).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "active", "inactive", "suspended"] as const).map((s) => (
          <button key={s} onClick={() => setEmpFilter(s)}
            className={`p-3 rounded-2xl border text-left transition-all ${empFilter === s ? "bg-black text-white border-black" : "bg-white border-gray-200 hover:border-gray-300"}`}>
            <div className={`text-2xl font-bold ${empFilter === s ? "text-white" : "text-gray-900"}`}>{counts[s] ?? 0}</div>
            <div className={`text-xs mt-0.5 capitalize ${empFilter === s ? "text-gray-300" : "text-gray-500"}`}>{s.replace("_", " ")}</div>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input placeholder="Search name, licence…" value={q} onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"/>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">Add Driver</span>
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{editingId ? "Edit Driver" : "Add Driver"}</h3>
                {!editingId && <p className="text-xs text-gray-400 mt-0.5">Create auth user in Supabase first, then paste UUID below</p>}
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <svg width="16" height="16" fill="none" viewBox="0 0 18 18"><path d="M4 4L14 14M14 4L4 14" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>}

              <Field label="Auth User UUID (optional)">
                <input value={form.user_id} onChange={(e) => f("user_id", e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`${inputCls} font-mono text-xs`}/>
                <p className="text-[11px] text-gray-400 mt-1">Links this driver record to a login account. Required for the driver to see their trips & shifts.</p>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Licence Number *">
                  <input value={form.license_number} onChange={(e) => f("license_number", e.target.value)}
                    placeholder="e.g. GH-DL-12345678" className={`${inputCls} uppercase`}/>
                </Field>
                <Field label="Licence Expiry Date">
                  <input type="date" value={form.license_expiry} onChange={(e) => f("license_expiry", e.target.value)} className={inputCls}/>
                </Field>
                <Field label="Employment Status">
                  <select value={form.employment_status} onChange={(e) => f("employment_status", e.target.value)} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors">
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Add Driver"}
                </button>
              </div>
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
            {filtered.map((d) => {
              const days = daysUntilExpiry(d.license_expiry);
              const expiryAlert = days !== null && days <= 30;
              return (
                <div key={d.id} className={`bg-white rounded-2xl border overflow-hidden ${expiryAlert ? "border-amber-200" : "border-gray-200"}`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold text-gray-600`}>
                      {d.full_name ? d.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{d.full_name ?? <span className="text-gray-400 font-normal">Not linked</span>}</p>
                      <p className="text-xs text-gray-500 font-mono">{d.license_number}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${EMP_STYLES[d.employment_status] ?? "bg-gray-100 text-gray-500"}`}>
                      {d.employment_status.replace("_", " ")}
                    </span>
                  </div>
                  {d.license_expiry && (
                    <div className={`px-4 py-2 border-t text-xs flex items-center gap-1.5 ${days !== null && days < 0 ? "bg-red-50 border-red-100 text-red-600" : days !== null && days <= 30 ? "bg-amber-50 border-amber-100 text-amber-600" : "border-gray-100 text-gray-400"}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      Licence expires {new Date(d.license_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      {days !== null && days < 0 && " — EXPIRED"}
                      {days !== null && days >= 0 && days <= 30 && ` — ${days}d remaining`}
                    </div>
                  )}
                  {!d.user_id && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                      No login account linked
                    </div>
                  )}
                  <div className="border-t border-gray-100 px-4 py-2.5 flex gap-2">
                    <button onClick={() => openEdit(d)} className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Driver", "Licence No.", "Expiry", "Status", "Account", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((d) => {
                    const days = daysUntilExpiry(d.license_expiry);
                    return (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                              {d.full_name ? d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{d.full_name ?? "—"}</p>
                              {!d.user_id && <p className="text-xs text-gray-400">No account</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{d.license_number}</td>
                        <td className="px-4 py-3">
                          {d.license_expiry ? (
                            <span className={`text-sm ${days !== null && days < 0 ? "text-red-600 font-medium" : days !== null && days <= 30 ? "text-amber-600 font-medium" : "text-gray-600"}`}>
                              {new Date(d.license_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              {days !== null && days < 0 && " ⚠"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${EMP_DOT[d.employment_status] ?? "bg-gray-300"}`}/>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${EMP_STYLES[d.employment_status] ?? "bg-gray-100"}`}>{d.employment_status.replace("_", " ")}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {d.user_id ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Linked
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Not linked</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEdit(d)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">{filtered.length} of {drivers.length} drivers</div>
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

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">No drivers yet</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">Add drivers to enable dispatch assignments</p>
      <button onClick={onAdd} className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">Add Driver</button>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all";