// src/modules/fuel/pages/CreateFuelRequest.tsx — mobile-first
import { useEffect, useState } from "react";
import { createFuelDraft, submitFuelRequest } from "../services/fuel.service";
import { supabase } from "@/lib/supabase";

type Vehicle = { id: string; plate_number: string; status: string };
type Driver = { id: string; license_number: string; employment_status: string };

export default function CreateFuelRequest() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: v }, { data: d }] = await Promise.all([
        supabase.from("vehicles").select("id, plate_number, status").order("plate_number"),
        supabase.from("drivers").select("id, license_number, employment_status").order("license_number"),
      ]);
      setVehicles((v as Vehicle[]) ?? []);
      setDrivers((d as Driver[]) ?? []);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const draftId = await createFuelDraft({
        vehicle_id: (String(fd.get("vehicle_id") || "") || null) as any,
        driver_id: (String(fd.get("driver_id") || "") || null) as any,
        fuel_type: String(fd.get("fuel_type") || "").trim() || null,
        liters: fd.get("liters") ? Number(fd.get("liters")) : null,
        estimated_cost: fd.get("estimated_cost") ? Number(fd.get("estimated_cost")) : null,
        purpose: String(fd.get("purpose") || "").trim() || null,
        notes: String(fd.get("notes") || "").trim() || null,
      });
      await submitFuelRequest(draftId);
      (e.target as HTMLFormElement).reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-transparent transition-all";

  return (
    <div className="space-y-4 max-w-2xl">
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          Fuel request submitted successfully!
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">New Fuel Request</h3>
          <p className="text-xs text-gray-400 mt-0.5">Complete the form to submit a fuel request</p>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Vehicle (optional)</label>
              <select name="vehicle_id" className={inputCls} defaultValue="">
                <option value="">— None —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} ({v.status})</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Driver (optional)</label>
              <select name="driver_id" className={inputCls} defaultValue="">
                <option value="">— None —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.license_number} ({d.employment_status})</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Fuel Type</label>
              <select name="fuel_type" className={inputCls} defaultValue="petrol">
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Liters</label>
              <input name="liters" type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Estimated Cost (GHS)</label>
              <input name="estimated_cost" type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Purpose</label>
              <input name="purpose" placeholder="e.g. Refuel for assignment" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Notes</label>
            <textarea name="notes" className={`${inputCls} resize-none`} rows={3} placeholder="Any additional information…" />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {saving ? "Submitting…" : "Submit Fuel Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
