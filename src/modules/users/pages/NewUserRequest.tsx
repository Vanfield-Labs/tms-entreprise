// src/modules/users/pages/NewUserRequest.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Btn, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/TmsUI";

type Division = { id: string; name: string };
type Unit      = { id: string; name: string; division_id: string };

const ROLES = [
  { value: "staff",                label: "Staff"                },
  { value: "unit_head",            label: "Unit Head"            },
  { value: "driver",               label: "Driver"               },
  { value: "transport_supervisor", label: "Transport Supervisor" },
  { value: "corporate_approver",   label: "Corporate Approver"   },
];

export default function NewUserRequest() {
  const [divisions,     setDivisions]    = useState<Division[]>([]);
  const [units,         setUnits]        = useState<Unit[]>([]);
  const [fullName,      setFullName]     = useState("");
  const [email,         setEmail]        = useState("");
  const [divisionId,    setDivisionId]   = useState("");
  const [unitId,        setUnitId]       = useState("");
  const [role,          setRole]         = useState("staff");
  const [positionTitle, setPositionTitle] = useState("");
  const [saving,        setSaving]       = useState(false);
  const [success,       setSuccess]      = useState(false);
  const [error,         setError]        = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("divisions").select("id,name").order("name"),
      supabase.from("units").select("id,name,division_id").order("name"),
    ]).then(([{ data: d }, { data: u }]) => {
      setDivisions((d as Division[]) || []);
      setUnits((u as Unit[]) || []);
    });
  }, []);

  const filteredUnits = divisionId ? units.filter(u => u.division_id === divisionId) : [];

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !divisionId || !unitId) {
      setError("Please fill in all required fields."); return;
    }
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.from("user_requests").insert({
        full_name: fullName.trim(), email: email.trim().toLowerCase(),
        division_id: divisionId, unit_id: unitId,
        system_role: role, position_title: positionTitle.trim() || null,
        status: "pending",
      });
      if (e) throw e;
      setFullName(""); setEmail(""); setDivisionId(""); setUnitId("");
      setRole("staff"); setPositionTitle(""); setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Submission failed.");
    } finally { setSaving(false); }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4 max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-[color:var(--green)]/15 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[color:var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[color:var(--text)] mb-1">Request Submitted</h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-6">An admin will review it shortly.</p>
        <Btn variant="ghost" onClick={() => setSuccess(false)}>Submit Another</Btn>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader title="Request New User Account" subtitle="Admins will review and create the account" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <Input placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
            </Field>
            <Field label="Email" required>
              <Input type="email" placeholder="jane@org.com" value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Division" required>
              <Select value={divisionId} onChange={e => { setDivisionId(e.target.value); setUnitId(""); }}>
                <option value="">Select division…</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Unit" required>
              <Select value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!divisionId}>
                <option value="">Select unit…</option>
                {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Role" required>
              <Select value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
            <Field label="Position / Title">
              <Input placeholder="e.g. Senior Producer" value={positionTitle} onChange={e => setPositionTitle(e.target.value)} />
            </Field>
          </div>

          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <div className="flex justify-end">
            <Btn variant="primary" onClick={submit} loading={saving}>Submit Request</Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}