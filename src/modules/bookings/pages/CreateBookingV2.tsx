// src/modules/bookings/pages/CreateBookingV2.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Btn, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/TmsUI";

type Unit    = { id: string; name: string; division_id: string; parent_unit_id: string | null };
type Profile = { division_id: string | null; unit_id: string | null };

const BOOKING_TYPES = ["official", "production", "event", "news", "other"];

export default function CreateBookingV2() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [units,   setUnits]   = useState<Unit[]>([]);
  const [purpose, setPurpose] = useState("");
  const [pickupLocation,  setPickupLocation]  = useState("");
  const [pickupDA,        setPickupDA]        = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [dropoffDA,       setDropoffDA]       = useState("");
  const [tripDate, setTripDate]   = useState("");
  const [tripTime, setTripTime]   = useState("");
  const [bookingType, setBookingType] = useState("official");
  const [relatedUnitIds, setRelatedUnitIds] = useState<string[]>([]);
  const [draftId,    setDraftId]   = useState<string | null>(null);
  const [step,       setStep]      = useState<1 | 2>(1);
  const [saving,     setSaving]    = useState(false);
  const [submitted,  setSubmitted] = useState(false);
  const [error,      setError]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) return;
      const { data: p } = await supabase.from("profiles").select("division_id,unit_id").eq("user_id", u.user.id).single();
      setProfile(p as Profile);
      const { data: un } = await supabase.from("units").select("id,name,division_id,parent_unit_id").order("name");
      setUnits((un as Unit[]) || []);
    })();
  }, []);

  const myDivisionUnits = useMemo(() => {
    if (!profile?.division_id) return [];
    return units.filter(u => u.division_id === profile.division_id);
  }, [units, profile?.division_id]);

  const toggleUnit = (id: string) =>
    setRelatedUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveDraft = async () => {
    if (!purpose.trim() || !tripDate || !tripTime || !pickupLocation.trim() || !dropoffLocation.trim()) {
      setError("Please fill all required fields.");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        purpose: purpose.trim(),
        pickup_location: pickupLocation.trim(),
        pickup_district_area: pickupDA.trim() || null,
        dropoff_location: dropoffLocation.trim(),
        dropoff_district_area: dropoffDA.trim() || null,
        trip_date: tripDate,
        trip_time: tripTime,
        booking_type: bookingType,
        related_unit_ids: relatedUnitIds.length ? relatedUnitIds : null,
      };
      if (draftId) {
        await supabase.from("bookings").update(payload).eq("id", draftId);
      } else {
        const { data } = await supabase.from("bookings").insert(payload).select("id").single();
        setDraftId((data as any)?.id ?? null);
      }
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!draftId) return;
    setSaving(true); setError(null);
    try {
      await supabase.rpc("submit_booking", { p_booking_id: draftId });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to submit.");
    } finally { setSaving(false); }
  };

  const reset = () => {
    setPurpose(""); setPickupLocation(""); setPickupDA(""); setDropoffLocation(""); setDropoffDA("");
    setTripDate(""); setTripTime(""); setBookingType("official"); setRelatedUnitIds([]);
    setDraftId(null); setStep(1); setSubmitted(false); setError(null);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-[color:var(--green)]/15 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[color:var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[color:var(--text)] mb-1">Booking Submitted</h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-6 max-w-xs">Your request has been sent for approval.</p>
        <Btn variant="ghost" onClick={reset}>New Booking</Btn>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${step >= s ? "bg-[color:var(--accent)] text-white" : "bg-[color:var(--surface-2)] text-[color:var(--text-muted)]"}`}>
              {s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? "text-[color:var(--text)]" : "text-[color:var(--text-muted)]"}`}>
              {s === 1 ? "Details" : "Review"}
            </span>
            {s < 2 && <div className="w-8 h-px bg-[color:var(--border)] mx-1"/>}
          </div>
        ))}
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {step === 1 && (
        <Card>
          <CardHeader title="Trip Details" />
          <CardBody className="space-y-4">
            <Field label="Purpose" required>
              <Input placeholder="e.g. Staff transport to studio" value={purpose} onChange={e => setPurpose(e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Trip Date" required>
                <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0,10)} />
              </Field>
              <Field label="Trip Time" required>
                <Input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)} />
              </Field>
            </div>

            <Field label="Booking Type">
              <Select value={bookingType} onChange={e => setBookingType(e.target.value)}>
                {BOOKING_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </Select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Pickup Location" required>
                <Input placeholder="GBC, Accra" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} />
              </Field>
              <Field label="Pickup District/Area">
                <Input placeholder="Greater Accra" value={pickupDA} onChange={e => setPickupDA(e.target.value)} />
              </Field>
              <Field label="Dropoff Location" required>
                <Input placeholder="Parliament House" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} />
              </Field>
              <Field label="Dropoff District/Area">
                <Input placeholder="Greater Accra" value={dropoffDA} onChange={e => setDropoffDA(e.target.value)} />
              </Field>
            </div>

            {myDivisionUnits.length > 0 && (
              <div className="space-y-2">
                <label className="form-label">Shared with units (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {myDivisionUnits.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUnit(u.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all border
                        ${relatedUnitIds.includes(u.id)
                          ? "bg-[color:var(--accent-dim)] border-[color:var(--accent)] text-[color:var(--accent)]"
                          : "bg-[color:var(--surface-2)] border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--border-bright)]"
                        }`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Btn variant="primary" onClick={saveDraft} loading={saving}>Continue →</Btn>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader title="Review & Submit" action={
            <Btn variant="ghost" size="sm" onClick={() => setStep(1)}>← Edit</Btn>
          }/>
          <CardBody className="space-y-2">
            {[
              ["Purpose",    purpose],
              ["Date",       `${tripDate} at ${tripTime}`],
              ["Type",       bookingType],
              ["Pickup",     pickupLocation + (pickupDA ? `, ${pickupDA}` : "")],
              ["Dropoff",    dropoffLocation + (dropoffDA ? `, ${dropoffDA}` : "")],
              ["Shared with", relatedUnitIds.length ? `${relatedUnitIds.length} unit(s)` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-3 py-2 border-b border-[color:var(--border)] last:border-0">
                <span className="text-xs text-[color:var(--text-muted)] w-24 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-[color:var(--text)] font-medium capitalize">{value}</span>
              </div>
            ))}
            <div className="pt-3">
              <Btn variant="primary" className="w-full" onClick={submit} loading={saving}>
                Submit for Approval
              </Btn>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}