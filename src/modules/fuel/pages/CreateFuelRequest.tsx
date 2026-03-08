// src/modules/fuel/pages/CreateFuelRequest.tsx
// Workflow: fill form → createFuelDraft → submitFuelRequest
// DB: fuel_requests.vehicle_id is NOT NULL (required). amount = cost field.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createFuelDraft, submitFuelRequest } from "../services/fuel.service";

type Vehicle = { id: string; plate_number: string };
type Driver  = { id: string; license_number: string; full_name: string };

const FUEL_TYPES = ["petrol", "diesel", "electric"];

export default function CreateFuelRequest() {
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId,  setDriverId]  = useState("");
  const [fuelType,  setFuelType]  = useState("petrol");
  const [liters,    setLiters]    = useState("");
  const [amount,    setAmount]    = useState("");
  const [vendor,    setVendor]    = useState("");
  const [purpose,   setPurpose]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("vehicles").select("id,plate_number").eq("status", "active").order("plate_number"),
      supabase.from("drivers").select("id,license_number,full_name").eq("employment_status", "active").order("full_name"),
    ]).then(([{ data: v }, { data: d }]) => {
      setVehicles((v as Vehicle[]) ?? []);
      setDrivers((d as Driver[]) ?? []);
    });
  }, []);

  const reset = () => {
    setVehicleId(""); setDriverId(""); setFuelType("petrol");
    setLiters(""); setAmount(""); setVendor(""); setPurpose(""); setNotes("");
  };

  const submit = async () => {
    if (!vehicleId) { setError("Please select a vehicle."); return; }
    if (!purpose.trim()) { setError("Purpose is required."); return; }
    setSaving(true); setError(null);
    try {
      const id = await createFuelDraft({
        vehicle_id: vehicleId,
        driver_id:  driverId || null,
        fuel_type:  fuelType,
        liters:     liters  ? parseFloat(liters)  : null,
        amount:     amount  ? parseFloat(amount)  : null,
        vendor:     vendor.trim()  || null,
        purpose:    purpose.trim(),
        notes:      notes.trim()   || null,
      });
      await submitFuelRequest(id);
      reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e: any) {
      setError(e.message ?? "Submission failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }} className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">New Fuel Request</h1>
        <p className="page-sub">Submit a fuel request for approval</p>
      </div>

      {success && (
        <div className="alert alert-success">
          ✓ Fuel request submitted successfully and is awaiting approval.
          <button onClick={() => setSuccess(false)} style={{ marginLeft: 8, opacity: 0.6 }}>✕</button>
        </div>
      )}

      <div className="card">
        <div className="card-body space-y-4">

          {/* Vehicle — required */}
          <div>
            <label className="form-label">Vehicle <span style={{ color: "var(--red)" }}>*</span></label>
            <select className="tms-select" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">— Select vehicle —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
            </select>
          </div>

          {/* Driver */}
          <div>
            <label className="form-label">Driver (optional)</label>
            <select className="tms-select" value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">— Select driver —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name || d.license_number}</option>)}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="form-label">Purpose <span style={{ color: "var(--red)" }}>*</span></label>
            <input
              className="tms-input"
              placeholder="e.g. News assignment fuel"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
            />
          </div>

          {/* Fuel type + Litres */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fuel Type</label>
              <select className="tms-select" value={fuelType} onChange={e => setFuelType(e.target.value)}>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Litres</label>
              <input
                className="tms-input"
                type="number" min="0" step="0.5"
                placeholder="0.0"
                value={liters}
                onChange={e => setLiters(e.target.value)}
              />
            </div>
          </div>

          {/* Amount + Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Est. Amount (GHS)</label>
              <input
                className="tms-input"
                type="number" min="0" step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Vendor / Station</label>
              <input
                className="tms-input"
                placeholder="e.g. Total Energies"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea
              className="tms-textarea"
              rows={2}
              placeholder="Any additional information…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
              <button onClick={() => setError(null)} style={{ marginLeft: 8, opacity: 0.6 }}>✕</button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={reset} disabled={saving}>Clear</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving || !vehicleId || !purpose.trim()}>
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}