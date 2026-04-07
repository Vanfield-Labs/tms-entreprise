// src/modules/divisions/pages/DivisionManagement.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner, EmptyState, Card, SearchInput,
  Field, Input, Select, Btn, Modal, Alert, TabBar, CtxMenu, ConfirmDialog,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Division = { id: string; name: string; created_at: string; unit_count?: number };
type Unit      = { id: string; name: string; division_id: string; parent_unit_id: string | null; created_at: string; division_name?: string };
type Tab       = "divisions" | "units";

const TABS: { value: Tab; label: string }[] = [
  { value: "divisions", label: "Divisions" },
  { value: "units",     label: "Units"     },
];


// ─── Main component ───────────────────────────────────────────────────────────
export default function DivisionManagement() {
  const [tab,       setTab]      = useState<Tab>("divisions");
  const [divisions, setDivisions]= useState<Division[]>([]);
  const [units,     setUnits]    = useState<Unit[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [q,         setQ]        = useState("");

  // Division form
  const [showDivForm,  setShowDivForm]  = useState(false);
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [divName,      setDivName]      = useState("");
  const [divSaving,    setDivSaving]    = useState(false);
  const [divError,     setDivError]     = useState<string | null>(null);

  // Unit form
  const [showUnitForm,   setShowUnitForm]   = useState(false);
  const [editingUnitId,  setEditingUnitId]  = useState<string | null>(null);
  const [unitName,       setUnitName]       = useState("");
  const [unitDivisionId, setUnitDivisionId] = useState("");
  const [unitParentId,   setUnitParentId]   = useState("");
  const [unitSaving,     setUnitSaving]     = useState(false);
  const [unitError,      setUnitError]      = useState<string | null>(null);

  // Delete confirms
  const [deletingDiv,  setDeletingDiv]  = useState<Division | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [deleteActing, setDeleteActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: u }] = await Promise.all([
      supabase.from("divisions").select("id,name,created_at").order("name"),
      supabase.from("units").select("id,name,division_id,parent_unit_id,created_at").order("name"),
    ]);
    const divList  = (d as Division[]) || [];
    const unitList = (u as Unit[])     || [];
    const unitCounts: Record<string, number> = {};
    unitList.forEach(u => { unitCounts[u.division_id] = (unitCounts[u.division_id] || 0) + 1; });
    setDivisions(divList.map(div => ({ ...div, unit_count: unitCounts[div.id] || 0 })));
    setUnits(unitList.map(u => ({
      ...u,
      division_name: divList.find(d => d.id === u.division_id)?.name ?? "—",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Division CRUD ─────────────────────────────────────────────────────────
  const openAddDiv  = () => { setDivName(""); setEditingDivId(null); setDivError(null); setShowDivForm(true); };
  const openEditDiv = (d: Division) => { setDivName(d.name); setEditingDivId(d.id); setDivError(null); setShowDivForm(true); };

  const saveDiv = async () => {
    if (!divName.trim()) { setDivError("Name is required."); return; }
    setDivSaving(true); setDivError(null);
    try {
      const { error: e } = editingDivId
        ? await supabase.from("divisions").update({ name: divName.trim() }).eq("id", editingDivId)
        : await supabase.from("divisions").insert({ name: divName.trim() });
      if (e) throw e;
      setShowDivForm(false); await load();
    } catch (e: any) { setDivError(e.message ?? "Save failed."); }
    finally { setDivSaving(false); }
  };

  const deleteDiv = async () => {
    if (!deletingDiv) return;
    setDeleteActing(true);
    try {
      const { error } = await supabase.from("divisions").delete().eq("id", deletingDiv.id);
      if (error) throw error;
      setDeletingDiv(null); await load();
    } catch (e: any) { alert(e.message ?? "Delete failed — ensure no units exist first."); }
    finally { setDeleteActing(false); }
  };

  // ── Unit CRUD ─────────────────────────────────────────────────────────────
  const openAddUnit  = () => { setUnitName(""); setUnitDivisionId(""); setUnitParentId(""); setEditingUnitId(null); setUnitError(null); setShowUnitForm(true); };
  const openEditUnit = (u: Unit) => { setUnitName(u.name); setUnitDivisionId(u.division_id); setUnitParentId(u.parent_unit_id || ""); setEditingUnitId(u.id); setUnitError(null); setShowUnitForm(true); };

  const saveUnit = async () => {
    if (!unitName.trim() || !unitDivisionId) { setUnitError("Name and division are required."); return; }
    setUnitSaving(true); setUnitError(null);
    try {
      const payload = { name: unitName.trim(), division_id: unitDivisionId, parent_unit_id: unitParentId || null };
      const { error: e } = editingUnitId
        ? await supabase.from("units").update(payload).eq("id", editingUnitId)
        : await supabase.from("units").insert(payload);
      if (e) throw e;
      setShowUnitForm(false); await load();
    } catch (e: any) { setUnitError(e.message ?? "Save failed."); }
    finally { setUnitSaving(false); }
  };

  const deleteUnit = async () => {
    if (!deletingUnit) return;
    setDeleteActing(true);
    try {
      const { error } = await supabase.from("units").delete().eq("id", deletingUnit.id);
      if (error) throw error;
      setDeletingUnit(null); await load();
    } catch (e: any) { alert(e.message ?? "Delete failed."); }
    finally { setDeleteActing(false); }
  };

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filteredDivs  = divisions.filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()));
  const filteredUnits = units.filter(u => !q || [u.name, u.division_name].join(" ").toLowerCase().includes(q.toLowerCase()));

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Mobile page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Divisions & Units</h1>
          <p className="page-sub">Manage organisational structure</p>
        </div>
        <Btn variant="primary" onClick={tab === "divisions" ? openAddDiv : openAddUnit}>
          + {tab === "divisions" ? "Division" : "Unit"}
        </Btn>
      </div>

      {/* Desktop add button */}
      <div className="hidden lg:flex justify-end">
        <Btn variant="primary" onClick={tab === "divisions" ? openAddDiv : openAddUnit}>
          + Add {tab === "divisions" ? "Division" : "Unit"}
        </Btn>
      </div>

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={t => { setTab(t); setQ(""); }}
        counts={{ divisions: divisions.length, units: units.length }}
      />

      <SearchInput value={q} onChange={setQ} placeholder={`Search ${tab}…`} />

      {/* ── Divisions ── */}
      {tab === "divisions" && (
        filteredDivs.length === 0 ? <EmptyState title="No divisions found" /> : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {filteredDivs.map(d => (
                <Card key={d.id}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--text)]">{d.name}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {d.unit_count} unit{d.unit_count !== 1 ? "s" : ""} · Created {fmtDate(d.created_at)}
                      </p>
                    </div>
                    <CtxMenu items={[
                      { label: "Edit",   icon: "✏️", onClick: () => openEditDiv(d) },
                      { label: "Delete", icon: "🗑️", cls: "danger", onClick: () => setDeletingDiv(d) },
                    ]} />
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr>{["Division","Units","Created","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredDivs.map(d => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.name}</td>
                        <td>{d.unit_count}</td>
                        <td className="text-[color:var(--text-muted)]">{fmtDate(d.created_at)}</td>
                        <td>
                          <div className="flex gap-2">
                            <Btn variant="ghost" size="sm" onClick={() => openEditDiv(d)}>Edit</Btn>
                            <Btn variant="danger" size="sm" onClick={() => setDeletingDiv(d)}>Delete</Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ── Units ── */}
      {tab === "units" && (
        filteredUnits.length === 0 ? <EmptyState title="No units found" /> : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {filteredUnits.map(u => (
                <Card key={u.id}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--text)]">{u.name}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {u.division_name}{u.parent_unit_id ? " · Sub-unit" : ""}
                      </p>
                    </div>
                    <CtxMenu items={[
                      { label: "Edit",   icon: "✏️", onClick: () => openEditUnit(u) },
                      { label: "Delete", icon: "🗑️", cls: "danger", onClick: () => setDeletingUnit(u) },
                    ]} />
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr>{["Unit Name","Division","Parent Unit","Created","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredUnits.map(u => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.name}</td>
                        <td>{u.division_name}</td>
                        <td className="text-[color:var(--text-muted)]">
                          {u.parent_unit_id ? units.find(x => x.id === u.parent_unit_id)?.name ?? "—" : "—"}
                        </td>
                        <td className="text-[color:var(--text-muted)]">{fmtDate(u.created_at)}</td>
                        <td>
                          <div className="flex gap-2">
                            <Btn variant="ghost" size="sm" onClick={() => openEditUnit(u)}>Edit</Btn>
                            <Btn variant="danger" size="sm" onClick={() => setDeletingUnit(u)}>Delete</Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* Division modal */}
      <Modal open={showDivForm} onClose={() => setShowDivForm(false)} title={editingDivId ? "Edit Division" : "Add Division"} maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Division Name" required>
            <Input placeholder="e.g. News & Current Affairs" value={divName} onChange={e => setDivName(e.target.value)} />
          </Field>
          {divError && <Alert type="error">{divError}</Alert>}
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowDivForm(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveDiv} loading={divSaving}>Save</Btn>
          </div>
        </div>
      </Modal>

      {/* Unit modal */}
      <Modal open={showUnitForm} onClose={() => setShowUnitForm(false)} title={editingUnitId ? "Edit Unit" : "Add Unit"} maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Unit Name" required>
            <Input placeholder="e.g. Sports Desk" value={unitName} onChange={e => setUnitName(e.target.value)} />
          </Field>
          <Field label="Division" required>
            <Select value={unitDivisionId} onChange={e => setUnitDivisionId(e.target.value)}>
              <option value="">Select division…</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Parent Unit (optional)">
            <Select value={unitParentId} onChange={e => setUnitParentId(e.target.value)}>
              <option value="">None (top-level)</option>
              {units.filter(u => u.division_id === unitDivisionId && u.id !== editingUnitId).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
          {unitError && <Alert type="error">{unitError}</Alert>}
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowUnitForm(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveUnit} loading={unitSaving}>Save</Btn>
          </div>
        </div>
      </Modal>

      {/* Delete Division confirm */}
      <ConfirmDialog
        open={!!deletingDiv}
        title="Delete Division"
        message={`Delete "${deletingDiv?.name}"? This will fail if any units belong to this division. Remove units first.`}
        onConfirm={deleteDiv}
        onCancel={() => setDeletingDiv(null)}
        acting={deleteActing}
      />

      {/* Delete Unit confirm */}
      <ConfirmDialog
        open={!!deletingUnit}
        title="Delete Unit"
        message={`Delete unit "${deletingUnit?.name}"? This cannot be undone.`}
        onConfirm={deleteUnit}
        onCancel={() => setDeletingUnit(null)}
        acting={deleteActing}
      />
    </div>
  );
}