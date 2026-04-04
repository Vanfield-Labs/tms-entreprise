// src/modules/maintenance/pages/ReportMaintenance.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Btn, Card, CardBody, CardHeader, Field, Select, Textarea } from "@/components/TmsUI";

type Vehicle = { id: string; plate_number: string };

export default function ReportMaintenance() {
  const [vehicles,    setVehicles]   = useState<Vehicle[]>([]);
  const [vehicleId,   setVehicleId]  = useState("");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]     = useState(false);
  const [success,     setSuccess]    = useState(false);
  const [error,       setError]      = useState<string | null>(null);

  useEffect(() => {
    supabase.from("vehicles").select("id,plate_number").eq("status","active").order("plate_number")
      .then(({ data }) => setVehicles((data as Vehicle[]) || []));
  }, []);

  const submit = async () => {
    if (!vehicleId || !description.trim()) { setError("Please select a vehicle and describe the issue."); return; }
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("submit_maintenance_request", {
        p_vehicle_id: vehicleId,
        p_issue_type: null,
        p_issue_description: description.trim(),
        p_priority: null,
        p_estimated_cost: null,
        p_scheduled_date: null,
        p_notes: null,
        p_requested_by_supervisor: false,
      });
      if (e) throw e;
      setVehicleId(""); setDescription(""); setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e.message ?? "Failed to submit.");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg space-y-4">
      {success && (
        <Alert type="success" onDismiss={() => setSuccess(false)}>
          Maintenance request submitted to Finance successfully.
        </Alert>
      )}

      <Card>
        <CardHeader title="Report a Maintenance Issue" subtitle="Flag a vehicle for inspection or repair. Finance reviews first." />
        <CardBody className="space-y-4">
          <Field label="Vehicle" required>
            <Select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
            </Select>
          </Field>

          <Field label="Issue Description" required>
            <Textarea
              rows={4}
              placeholder="Describe the problem in detail…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Field>

          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <div className="flex justify-end">
            <Btn variant="primary" onClick={submit} loading={saving}>
              Submit Report
            </Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
