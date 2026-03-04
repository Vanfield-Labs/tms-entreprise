// src/modules/fuel/pages/CreateFuelRequest.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createFuelDraft, submitFuelRequest } from "../services/fuel.service";
import { Alert, Btn, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/TmsUI";

type Vehicle = { id: string; plate_number: string };
type Driver  = { id: string; license_number: string; full_name: string };

const FUEL_TYPES = ["petrol","diesel","electric"];

export default function CreateFuelRequest() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers,  setDrivers]  = useState<Driver[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId,  setDriverId]  = useState("");
  const [fuelType,  setFuelType]  = useState("petrol");
  const [liters,    setLiters]    = useState("");
  const [estCost,   setEstCost]   = useState("");
  const [purpose,   setPurpose]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("vehicles").select("id,plate_number").eq("status","active").order("plate_number"),
      supabase.from("drivers").select("id,license_number,profiles(full_name)").eq("employment_status","active"),
    ]).then(([{ data: v }, { data: d }]) => {
      setVehicles((v as Vehicle[]) || []);
      setDrivers(((d as any[]) || []).map(dr => ({ id: dr.id, license_number: dr.license_number, full_name: dr.profiles?.full_name ?? dr.license_number })));
    });
  }, []);

  const submit = async () => {
    if (!purpose.trim()) { setError("Purpose is required."); return; }
    setSaving(true); setError(null);
    try {
      const id = await createFuelDraft({
        vehicle_id: vehicleId || null, driver_id: driverId || null,
        fuel_type: fuelType, liters: liters ? parseFloat(liters) : null,
        estimated_cost: estCost ? parseFloat(estCost) : null,
        purpose: purpose.trim(), notes: notes.trim() || null,
      });
      await submitFuelRequest(id);
      setVehicleId(""); setDriverId(""); setFuelType("petrol");
      setLiters(""); setEstCost(""); setPurpose(""); setNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e.message ?? "Submission failed.");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg space-y-4">
      {success && <Alert type="success" onDismiss={() => setSuccess(false)}>Fuel request submitted successfully.</Alert>}

      <Card>
        <CardHeader title="New Fuel Request" />
        <CardBody className="space-y-4">
          <Field label="Purpose" required>
            <Input placeholder="e.g. News assignment fuel" value={purpose} onChange={e => setPurpose(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vehicle">
              <Select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">Select…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
              </Select>
            </Field>
            <Field label="Driver">
              <Select value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">Select…</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Fuel Type">
              <Select value={fuelType} onChange={e => setFuelType(e.target.value)}>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Litres">
              <Input type="number" min="0" step="0.1" placeholder="0.0" value={liters} onChange={e => setLiters(e.target.value)} />
            </Field>
            <Field label="Estimated Cost (GHS)">
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={estCost} onChange={e => setEstCost(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={2} placeholder="Any additional info…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>

          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <div className="flex justify-end">
            <Btn variant="primary" onClick={submit} loading={saving}>Submit Request</Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}