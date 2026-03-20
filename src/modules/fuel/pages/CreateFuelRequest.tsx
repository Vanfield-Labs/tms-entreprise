// src/modules/fuel/pages/CreateFuelRequest.tsx
// Form opens in a modal triggered by a "+ New Fuel Request" button
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Btn, Field, Input, Select, Textarea } from "@/components/TmsUI";

type Vehicle = { id: string; plate_number: string; fuel_type: string | null };

export default function CreateFuelRequest() {
  const [open, setOpen]           = useState(false);
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [myName, setMyName]       = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [fuelType, setFuelType]   = useState("");
  const [purpose, setPurpose]     = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        setMyName((prof as any)?.full_name ?? "You");
      }
      const { data: v } = await supabase.from("vehicles").select("id,plate_number,fuel_type").eq("status","active").order("plate_number");
      setVehicles((v as Vehicle[]) || []);
    })();
  }, []);

  const handleVehicleChange = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find(v => v.id === id);
    setFuelType(v?.fuel_type ?? "");
  };

  const resetForm = () => {
    setVehicleId(""); setFuelType(""); setPurpose(""); setNotes("");
    setError(null); setSuccess(false);
  };

  const openModal  = () => { resetForm(); setOpen(true); };
  const closeModal = () => { resetForm(); setOpen(false); };

  const submit = async () => {
    if (!vehicleId) { setError("Please select a vehicle."); return; }
    if (!purpose.trim()) { setError("Purpose / destination is required."); return; }
    setSaving(true); setError(null);
    try {
      const { data: draftId, error: draftErr } = await supabase.rpc("create_fuel_request_draft", {
        p_vehicle_id: vehicleId, p_driver_id: null,
        p_fuel_type: fuelType || null, p_liters: null, p_amount: null,
        p_vendor: null, p_purpose: purpose.trim(), p_notes: notes.trim() || null,
      });
      if (draftErr) throw draftErr;
      const { error: subErr } = await supabase.rpc("submit_fuel_request", { p_fuel_request_id: draftId });
      if (subErr) throw subErr;
      setSuccess(true);
      setTimeout(() => { resetForm(); setOpen(false); }, 2200);
    } catch (e: any) {
      setError(e.message ?? "Submission failed.");
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* Trigger button */}
      <button className="btn btn-primary" onClick={openModal}>
        + New Fuel Request
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>New Fuel Request</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Liters and cost will be entered by transport supervisor</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 14 14" stroke="currentColor">
                  <path d="M3 3l8 8M11 3l-8 8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {success && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--green-dim)" }}>
                    <svg className="w-6 h-6" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <p className="font-semibold" style={{ color: "var(--text)" }}>Request submitted!</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Closing…</p>
                </div>
              )}

              {!success && (
                <>
                  {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

                  {/* Requester */}
                  <Field label="Requested By">
                    <div className="px-3 py-2.5 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      {myName || "Loading…"} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(you)</span>
                    </div>
                  </Field>

                  {/* Vehicle */}
                  <Field label="Vehicle" required>
                    <Select value={vehicleId} onChange={e => handleVehicleChange(e.target.value)}>
                      <option value="">— Select vehicle —</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                    </Select>
                  </Field>

                  {/* Fuel type — read only */}
                  {vehicleId && (
                    <Field label="Fuel Type">
                      <div className="px-3 py-2.5 rounded-lg text-sm capitalize" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: fuelType ? "var(--text)" : "var(--text-dim)" }}>
                        {fuelType ? <><span style={{ color: "var(--accent)" }}>⛽</span> {fuelType}</> : "Not set on vehicle profile"}
                      </div>
                    </Field>
                  )}

                  {/* Purpose */}
                  <Field label="Purpose / Destination" required>
                    <Input placeholder="e.g. Field assignment to Kumasi, Studio generator top-up" value={purpose} onChange={e => setPurpose(e.target.value)}/>
                  </Field>

                  {/* Notes */}
                  <Field label="Additional Notes">
                    <Textarea placeholder="Any additional information for the transport supervisor…" rows={3} value={notes} onChange={e => setNotes(e.target.value)}/>
                  </Field>

                  <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--accent)" }}>ℹ Note:</strong> Liters and actual cost will be entered by the transport supervisor at the time of fuelling. Your request will be reviewed by the corporate approver first.
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Btn variant="ghost" className="flex-1" onClick={closeModal}>Cancel</Btn>
                    <Btn variant="primary" className="flex-1" loading={saving} onClick={submit}>Submit Request</Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}