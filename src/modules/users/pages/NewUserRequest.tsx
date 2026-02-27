import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Division = { id: string; name: string };
type Unit = { id: string; name: string; division_id: string };

const ROLES = [
  { value: "staff", label: "Staff" },
  { value: "driver", label: "Driver" },
  { value: "unit_head", label: "Unit Head" },
  { value: "transport_supervisor", label: "Transport Supervisor" },
  { value: "corporate_approver", label: "Corporate Approver" },
];

export default function NewUserRequest() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [role, setRole] = useState("staff");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from("divisions").select("id,name").order("name");
      const { data: u } = await supabase.from("units").select("id,name,division_id").order("name");
      setDivisions((d as Division[]) || []);
      setUnits((u as Unit[]) || []);
    })();
  }, []);

  const submit = async () => {
    if (!fullName || !email || !divisionId || !unitId) { setError("Please fill in all required fields."); return; }
    setSaving(true); setError("");
    try {
      const { data: me } = await supabase.auth.getUser();
      await supabase.from("user_requests").insert({
        requested_by: me.user!.id, full_name: fullName, email, division_id: divisionId, unit_id: unitId, requested_role: role, status: "pending",
      });
      setFullName(""); setEmail("");
      setSuccess(true);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const filteredUnits = units.filter(u => !divisionId || u.division_id === divisionId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Request New User</h1>
        <p className="page-sub">Request access for a new team member</p>
      </div>

      {success && (
        <div className="alert alert-success">
          ✓ User request submitted. An admin will review it shortly.
          <button onClick={() => setSuccess(false)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "var(--green)" }}>✕</button>
        </div>
      )}

      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-header"><span className="card-title">New User Details</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="form-label">Full Name *</label>
            <input className="tms-input" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email *</label>
            <input className="tms-input" type="email" placeholder="john@organization.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid-2">
            <div>
              <label className="form-label">Division *</label>
              <select className="tms-select" value={divisionId} onChange={e => { setDivisionId(e.target.value); setUnitId(""); }}>
                <option value="">Select division</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Unit *</label>
              <select className="tms-select" value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!divisionId}>
                <option value="">Select unit</option>
                {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Role *</label>
            <select className="tms-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={saving} onClick={submit}>
              {saving ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
