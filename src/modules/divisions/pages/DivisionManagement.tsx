// src/modules/divisions/pages/DivisionManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Division = { id: string; name: string; created_at: string; unit_count?: number };
type Unit = { id: string; name: string; division_id: string; parent_unit_id: string | null; created_at: string; division_name?: string };

type Tab = "divisions" | "units";

export default function DivisionManagement() {
  const [tab, setTab] = useState<Tab>("divisions");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Division form
  const [showDivForm, setShowDivForm] = useState(false);
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [divName, setDivName] = useState("");
  const [divSaving, setDivSaving] = useState(false);
  const [divError, setDivError] = useState<string | null>(null);

  // Unit form
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitDivisionId, setUnitDivisionId] = useState("");
  const [unitParentId, setUnitParentId] = useState("");
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  // Search
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: u }] = await Promise.all([
      supabase.from("divisions").select("id,name,created_at").order("name"),
      supabase.from("units").select("id,name,division_id,parent_unit_id,created_at").order("name"),
    ]);
    const divList = (d as Division[]) || [];
    const unitList = (u as Unit[]) || [];

    // Count units per division
    const unitCounts: Record<string, number> = {};
    unitList.forEach((unit) => { unitCounts[unit.division_id] = (unitCounts[unit.division_id] || 0) + 1; });

    const enrichedDivs = divList.map((div) => ({ ...div, unit_count: unitCounts[div.id] || 0 }));
    const enrichedUnits = unitList.map((unit) => ({
      ...unit,
      division_name: divList.find((d) => d.id === unit.division_id)?.name ?? "—",
    }));

    setDivisions(enrichedDivs);
    setUnits(enrichedUnits);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Division CRUD
  const openAddDiv = () => { setDivName(""); setEditingDivId(null); setDivError(null); setShowDivForm(true); };
  const openEditDiv = (d: Division) => { setDivName(d.name); setEditingDivId(d.id); setDivError(null); setShowDivForm(true); };

  const saveDiv = async () => {
    if (!divName.trim()) { setDivError("Name is required."); return; }
    setDivSaving(true); setDivError(null);
    try {
      if (editingDivId) {
        const { error: e } = await supabase.from("divisions").update({ name: divName.trim() }).eq("id", editingDivId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("divisions").insert({ name: divName.trim() });
        if (e) throw e;
      }
      setShowDivForm(false);
      await load();
    } catch (e: any) {
      setDivError(e.message ?? "Failed to save.");
    } finally {
      setDivSaving(false);
    }
  };

  // Unit CRUD
  const openAddUnit = (divisionId?: string) => {
    setUnitName(""); setUnitDivisionId(divisionId || ""); setUnitParentId(""); setEditingUnitId(null); setUnitError(null); setShowUnitForm(true);
  };
  const openEditUnit = (u: Unit) => {
    setUnitName(u.name); setUnitDivisionId(u.division_id); setUnitParentId(u.parent_unit_id || ""); setEditingUnitId(u.id); setUnitError(null); setShowUnitForm(true);
  };

  const saveUnit = async () => {
    if (!unitName.trim()) { setUnitError("Name is required."); return; }
    if (!unitDivisionId) { setUnitError("Division is required."); return; }
    setUnitSaving(true); setUnitError(null);
    try {
      const payload = {
        name: unitName.trim(),
        division_id: unitDivisionId,
        parent_unit_id: unitParentId || null,
      };
      if (editingUnitId) {
        const { error: e } = await supabase.from("units").update(payload).eq("id", editingUnitId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("units").insert(payload);
        if (e) throw e;
      }
      setShowUnitForm(false);
      await load();
    } catch (e: any) {
      setUnitError(e.message ?? "Failed to save.");
    } finally {
      setUnitSaving(false);
    }
  };

  const filteredDivisions = divisions.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()));
  const filteredUnits = units.filter((u) => !q || [u.name, u.division_name].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["divisions", "units"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setQ(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
            <span className={`ml-1.5 text-xs ${tab === t ? "text-gray-400" : "text-gray-400"}`}>
              ({t === "divisions" ? divisions.length : units.length})
            </span>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            placeholder={`Search ${tab}…`} value={q} onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"/>
        </div>
        <button
          onClick={() => tab === "divisions" ? openAddDiv() : openAddUnit()}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">Add {tab === "divisions" ? "Division" : "Unit"}</span>
        </button>
      </div>

      {/* Division form modal */}
      {showDivForm && (
        <Modal title={editingDivId ? "Edit Division" : "Add Division"} onClose={() => setShowDivForm(false)}>
          {divError && <ErrorMsg msg={divError} />}
          <Field label="Division Name *">
            <input value={divName} onChange={(e) => setDivName(e.target.value)} placeholder="e.g. News & Current Affairs" className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && saveDiv()} autoFocus/>
          </Field>
          <ModalActions onCancel={() => setShowDivForm(false)} onSave={saveDiv} saving={divSaving} label={editingDivId ? "Save Changes" : "Add Division"} />
        </Modal>
      )}

      {/* Unit form modal */}
      {showUnitForm && (
        <Modal title={editingUnitId ? "Edit Unit" : "Add Unit"} onClose={() => setShowUnitForm(false)}>
          {unitError && <ErrorMsg msg={unitError} />}
          <div className="space-y-4">
            <Field label="Unit Name *">
              <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Sports Desk" className={inputCls} autoFocus/>
            </Field>
            <Field label="Division *">
              <select value={unitDivisionId} onChange={(e) => { setUnitDivisionId(e.target.value); setUnitParentId(""); }} className={inputCls}>
                <option value="">Select division…</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            {unitDivisionId && (
              <Field label="Parent Unit (optional)">
                <select value={unitParentId} onChange={(e) => setUnitParentId(e.target.value)} className={inputCls}>
                  <option value="">None (top-level unit)</option>
                  {units
                    .filter((u) => u.division_id === unitDivisionId && u.id !== editingUnitId)
                    .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <ModalActions onCancel={() => setShowUnitForm(false)} onSave={saveUnit} saving={unitSaving} label={editingUnitId ? "Save Changes" : "Add Unit"} />
        </Modal>
      )}

      {/* Content */}
      {loading ? <LoadingSpinner /> : (
        tab === "divisions" ? (
          <DivisionsView
            divisions={filteredDivisions}
            units={units}
            onEditDiv={openEditDiv}
            onAddUnit={(divId) => openAddUnit(divId)}
            onEditUnit={openEditUnit}
          />
        ) : (
          <UnitsView units={filteredUnits} onEdit={openEditUnit} />
        )
      )}
    </div>
  );
}

function DivisionsView({ divisions, units, onEditDiv, onAddUnit, onEditUnit }: {
  divisions: Division[];
  units: Unit[];
  onEditDiv: (d: Division) => void;
  onAddUnit: (divId: string) => void;
  onEditUnit: (u: Unit) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  if (divisions.length === 0) return <EmptyState message="No divisions yet" subtitle="Create your first division to start organising units" />;

  return (
    <div className="space-y-3">
      {divisions.map((div) => {
        const divUnits = units.filter((u) => u.division_id === div.id);
        const isOpen = expanded[div.id];
        return (
          <div key={div.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <button onClick={() => toggle(div.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{div.name}</p>
                  <p className="text-xs text-gray-400">{divUnits.length} unit{divUnits.length !== 1 ? "s" : ""}</p>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onAddUnit(div.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Add unit">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                </button>
                <button onClick={() => onEditDiv(div)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Edit division">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onClick={() => toggle(div.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-100">
                {divUnits.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-gray-400 text-center">
                    No units yet.{" "}
                    <button onClick={() => onAddUnit(div.id)} className="text-black underline">Add one</button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {divUnits.map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300"/>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">{u.name}</p>
                            {u.parent_unit_id && (
                              <p className="text-xs text-gray-400">Sub-unit of {units.find((p) => p.id === u.parent_unit_id)?.name}</p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => onEditUnit(u)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UnitsView({ units, onEdit }: { units: Unit[]; onEdit: (u: Unit) => void }) {
  if (units.length === 0) return <EmptyState message="No units yet" subtitle="Switch to Divisions to add units to a division" />;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {units.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{u.division_name}</p>
            </div>
            <button onClick={() => onEdit(u)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">{units.length} units total</div>
    </div>
  );
}

// ── Shared components ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg width="16" height="16" fill="none" viewBox="0 0 18 18"><path d="M4 4L14 14M14 4L4 14" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
      <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors">
        {saving ? "Saving…" : label}
      </button>
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

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{msg}</div>;
}

function EmptyState({ message, subtitle }: { message: string; subtitle: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">{message}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all";