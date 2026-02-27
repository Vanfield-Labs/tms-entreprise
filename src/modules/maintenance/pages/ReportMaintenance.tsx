import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Vehicle = { id: string; plate_number: string };

export default function ReportMaintenance() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [issue, setIssue] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("vehicles").select("id,plate_number").order("plate_number");
      setVehicles((data as Vehicle[]) || []);
    })();
  }, []);

  const submit = async () => {
    if (!vehicleId || !issue.trim()) { setError("Please select a vehicle and describe the issue."); return; }
    setSaving(true); setError("");
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("maintenance_requests").insert({
        vehicle_id: vehicleId,
        reported_by: u.user!.id,
        issue_description: issue,
      });
      setSuccess(true);
      setVehicleId(""); setIssue("");
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Report Maintenance</h1>
        <p className="page-sub">Log a vehicle issue for the transport team</p>
      </div>

      {success && (
        <div className="alert alert-success">
          ✓ Maintenance request submitted. The transport team will review it.
          <button onClick={() => setSuccess(false)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "var(--green)" }}>✕</button>
        </div>
      )}

      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-header"><span className="card-title">Issue Report</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="form-label">Vehicle *</label>
            <select className="tms-select" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Select a vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Issue Description *</label>
            <textarea
              className="tms-textarea"
              placeholder="Describe the issue in detail (e.g. 'Front-right tyre puncture, engine making unusual noise when starting')"
              value={issue}
              onChange={e => setIssue(e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
