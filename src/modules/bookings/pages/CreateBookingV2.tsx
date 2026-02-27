// src/modules/bookings/pages/CreateBookingV2.tsx — mobile-first
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Division = { id: string; name: string };
type Unit = { id: string; name: string; division_id: string; parent_unit_id: string | null };
type Profile = { division_id: string | null; unit_id: string | null };

const BOOKING_TYPES = ["official", "production", "event", "news", "other"];

export default function CreateBookingV2() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purpose, setPurpose] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDA, setPickupDA] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [dropoffDA, setDropoffDA] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [tripTime, setTripTime] = useState("");
  const [bookingType, setBookingType] = useState("official");
  const [units, setUnits] = useState<Unit[]>([]);
  const [relatedUnitIds, setRelatedUnitIds] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) return;
      const { data: p } = await supabase.from("profiles").select("division_id,unit_id").eq("user_id", u.user.id).single();
      setProfile(p as any);
      const { data: un } = await supabase.from("units").select("id,name,division_id,parent_unit_id").order("name");
      setUnits((un as any) || []);
    })();
  }, []);

  const myDivisionUnits = useMemo(() => {
    if (!profile?.division_id) return [];
    return units.filter((u) => u.division_id === profile.division_id);
  }, [units, profile?.division_id]);

  const toggleUnit = (id: string) => {
    setRelatedUnitIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const isStep1Valid = purpose && pickupLocation && dropoffLocation && tripDate && tripTime;

  const createDraft = async () => {
    if (!isStep1Valid || !profile?.division_id || !profile?.unit_id) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("bookings")
        .insert({
          created_by: u.user?.id,
          division_id: profile.division_id,
          unit_id: profile.unit_id,
          purpose, pickup_location: pickupLocation, pickup_digital_address: pickupDA || null,
          dropoff_location: dropoffLocation, dropoff_digital_address: dropoffDA || null,
          trip_date: tripDate, trip_time: tripTime, booking_type: bookingType, status: "draft",
        })
        .select("id").single();
      if (error) throw error;
      setDraftId(inserted.id);
      if (relatedUnitIds.length > 0) {
        await supabase.from("booking_visibility_units").insert(relatedUnitIds.map((unit_id) => ({ booking_id: inserted.id, unit_id })));
      }
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = async () => {
    if (!draftId) return;
    setSaving(true);
    try {
      await supabase.rpc("submit_booking", { p_booking_id: draftId });
      setSubmitted(true);
      // reset
      setPurpose(""); setPickupLocation(""); setPickupDA(""); setDropoffLocation("");
      setDropoffDA(""); setTripDate(""); setTripTime(""); setBookingType("official");
      setRelatedUnitIds([]); setDraftId(null); setStep(1);
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Booking Submitted!</h3>
          <p className="text-sm text-gray-500 mt-1">Your booking has been sent for approval.</p>
        </div>
        <button onClick={() => setSubmitted(false)} className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s === 2 && draftId ? setStep(2) : setStep(1)}
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors
                ${step === s ? "bg-black text-white" : s < step || (s === 2 && draftId) ? "bg-gray-900 text-white opacity-60" : "bg-gray-200 text-gray-500 cursor-default"}`}
            >
              {s}
            </button>
            {s === 1 && <div className={`h-0.5 w-10 ${draftId ? "bg-black" : "bg-gray-200"}`} />}
          </div>
        ))}
        <div className="ml-1 text-xs text-gray-500">{step === 1 ? "Trip details" : "Review & submit"}</div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Trip Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details for your transport request</p>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Purpose *">
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Site visit to Kumasi" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Pickup Location *">
                <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="e.g. Head Office" className={inputCls} />
              </Field>
              <Field label="Pickup Digital Address">
                <input value={pickupDA} onChange={(e) => setPickupDA(e.target.value)} placeholder="e.g. GA-123-4567" className={inputCls} />
              </Field>
              <Field label="Dropoff Location *">
                <input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="e.g. Kumasi office" className={inputCls} />
              </Field>
              <Field label="Dropoff Digital Address">
                <input value={dropoffDA} onChange={(e) => setDropoffDA(e.target.value)} placeholder="e.g. KS-456-7890" className={inputCls} />
              </Field>
              <Field label="Date *">
                <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Time *">
                <input type="time" value={tripTime} onChange={(e) => setTripTime(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Booking Type">
              <select value={bookingType} onChange={(e) => setBookingType(e.target.value)} className={inputCls}>
                {BOOKING_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </Field>

            {myDivisionUnits.length > 0 && (
              <Field label="Share with units (optional)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {myDivisionUnits.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={relatedUnitIds.includes(u.id)}
                        onChange={() => toggleUnit(u.id)}
                        className="rounded"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900 text-xs">{u.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={createDraft}
                disabled={!isStep1Valid || saving}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : draftId ? "Update Draft" : "Save Draft"}
              </button>
              {draftId && (
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Review →
                </button>
              )}
            </div>

            {draftId && (
              <p className="text-xs text-gray-400">Draft saved · ID: {draftId.slice(0, 8)}…</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && draftId && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Review & Submit</h3>
            <p className="text-xs text-gray-400 mt-0.5">Confirm your booking details before submitting</p>
          </div>
          <div className="p-5 space-y-3">
            <ReviewRow label="Purpose" value={purpose} />
            <ReviewRow label="From" value={pickupLocation} />
            <ReviewRow label="To" value={dropoffLocation} />
            <ReviewRow label="Date & Time" value={`${tripDate} at ${tripTime}`} />
            <ReviewRow label="Type" value={bookingType} />
            {relatedUnitIds.length > 0 && (
              <ReviewRow label="Shared with" value={`${relatedUnitIds.length} unit(s)`} />
            )}

            <div className="pt-4 flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                ← Edit
              </button>
              <button
                onClick={submitDraft}
                disabled={saving}
                className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {saving ? "Submitting…" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-transparent transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 font-medium capitalize">{value}</span>
    </div>
  );
}
