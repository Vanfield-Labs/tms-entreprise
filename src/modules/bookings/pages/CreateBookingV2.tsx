// src/modules/bookings/pages/CreateBookingV2.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Btn, Card, CardBody, CardHeader, ConfirmDialog, Field, Input, Select } from "@/components/TmsUI";

type Unit    = { id: string; name: string; division_id: string; parent_unit_id: string | null };
type Profile = { division_id: string | null; unit_id: string | null; full_name: string };
type EditableBooking = {
  id: string;
  purpose: string | null;
  trip_date: string | null;
  trip_time: string | null;
  gps_address: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  call_time: string | null;
  departure_time: string | null;
  num_passengers: number | null;
  multi_vehicle: boolean | null;
  num_vehicles: number | null;
  destination: string | null;
  return_date: string | null;
  is_return_journey: boolean | null;
  booking_category: string | null;
  booking_type: string | null;
  status: string;
};
const EDIT_BOOKING_STORAGE_KEY = "tms-edit-booking-id";

// ─── Booking categories ────────────────────────────────────────────────────────
type BookingCategory = "pickup" | "dropoff" | "production" | "travelling" | "other";

const CATEGORIES: { value: BookingCategory; label: string; icon: string; desc: string }[] = [
  { value: "pickup",     icon: "🚗", label: "Pickup",     desc: "Request a pickup from a location" },
  { value: "dropoff",    icon: "📍", label: "Drop-off",   desc: "Request to be dropped at a destination" },
  { value: "production", icon: "🎬", label: "Production", desc: "Production crew transport" },
  { value: "travelling", icon: "✈️", label: "Travelling",  desc: "Official travel / out-of-town trip" },
  { value: "other",      icon: "📋", label: "Other",      desc: "Any other transport need" },
];


// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreateBookingV2() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [category, setCategory] = useState<BookingCategory | null>(null);
  const [step, setStep] = useState<"category" | "form" | "review" | "done">("category");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // ── Shared fields
  const [purpose, setPurpose] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [tripTime, setTripTime] = useState("");
  const [gpsAddress, setGpsAddress] = useState("");

  // ── Pickup / Dropoff
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");

  // ── Production
  const [callTime, setCallTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [numPassengers, setNumPassengers] = useState("1");
  const [multiVehicle, setMultiVehicle] = useState(false);
  const [numVehicles, setNumVehicles] = useState("2");
  const [relatedUnitIds, setRelatedUnitIds] = useState<string[]>([]);

  // ── Travelling
  const [destination, setDestination] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [isReturnJourney, setIsReturnJourney] = useState(true);
  const [travelCallTime, setTravelCallTime] = useState("");
  const [travelDepartureTime, setTravelDepartureTime] = useState("");
  const [travelPassengers, setTravelPassengers] = useState("1");

  const trimTime = (value: string | null | undefined) => {
    if (!value) return "";
    return value.slice(0, 5);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles")
        .select("division_id,unit_id,full_name").eq("user_id", user.id).single();
      setProfile(p as Profile);
      const { data: un } = await supabase.from("units").select("id,name,division_id,parent_unit_id").order("name");
      setUnits((un as Unit[]) || []);
    })();
  }, []);

  useEffect(() => {
    const loadExistingBooking = async () => {
      const editId = sessionStorage.getItem(EDIT_BOOKING_STORAGE_KEY);

      if (!editId) {
        setLoadingExisting(false);
        return;
      }

      try {
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .select("id,purpose,trip_date,trip_time,gps_address,pickup_location,dropoff_location,call_time,departure_time,num_passengers,multi_vehicle,num_vehicles,destination,return_date,is_return_journey,booking_category,booking_type,status")
          .eq("id", editId)
          .single();

        if (bookingError) throw bookingError;

        const row = booking as EditableBooking;
        if (!["draft", "rejected"].includes(row.status)) {
          sessionStorage.removeItem(EDIT_BOOKING_STORAGE_KEY);
          setLoadingExisting(false);
          return;
        }

        const resolvedCategory = (row.booking_category ?? row.booking_type) as BookingCategory | null;
        if (!resolvedCategory || !CATEGORIES.some((item) => item.value === resolvedCategory)) {
          sessionStorage.removeItem(EDIT_BOOKING_STORAGE_KEY);
          setLoadingExisting(false);
          return;
        }

        setDraftId(row.id);
        setCategory(resolvedCategory);
        setPurpose(row.purpose ?? "");
        setTripDate(row.trip_date ?? "");
        setTripTime(trimTime(row.trip_time));
        setGpsAddress(row.gps_address ?? "");
        setPickupLocation(row.pickup_location ?? "");
        setDropoffLocation(row.dropoff_location ?? "");
        setCallTime(trimTime(row.call_time));
        setDepartureTime(trimTime(row.departure_time));
        setNumPassengers(String(row.num_passengers ?? 1));
        setMultiVehicle(Boolean(row.multi_vehicle));
        setNumVehicles(String(row.num_vehicles ?? 2));
        setDestination(row.destination ?? "");
        setReturnDate(row.return_date ?? "");
        setIsReturnJourney(row.is_return_journey ?? true);
        setTravelCallTime(trimTime(row.call_time));
        setTravelDepartureTime(trimTime(row.departure_time || row.trip_time));
        setTravelPassengers(String(row.num_passengers ?? 1));
        setStep("form");
        setError(null);

        const { data: visibilityRows } = await supabase
          .from("booking_visibility_units")
          .select("unit_id")
          .eq("booking_id", row.id);

        setRelatedUnitIds(((visibilityRows as { unit_id: string }[] | null) ?? []).map((item) => item.unit_id));
        sessionStorage.removeItem(EDIT_BOOKING_STORAGE_KEY);
      } catch (loadError: any) {
        setError(loadError.message ?? "Failed to load booking for amendment.");
      } finally {
        setLoadingExisting(false);
      }
    };

    void loadExistingBooking();
  }, []);

  const myDivisionUnits = useMemo(() => {
    if (!profile?.division_id) return [];
    return units.filter(u => u.division_id === profile!.division_id);
  }, [units, profile?.division_id]);

  const myUnit = units.find(u => u.id === profile?.unit_id);

  const toggleUnit = (id: string) =>
    setRelatedUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const resetForm = () => {
    sessionStorage.removeItem(EDIT_BOOKING_STORAGE_KEY);
    setCategory(null); setStep("category"); setDraftId(null); setError(null);
    setPurpose(""); setTripDate(""); setTripTime(""); setGpsAddress("");
    setPickupLocation(""); setDropoffLocation(""); setCallTime(""); setDepartureTime("");
    setNumPassengers("1"); setMultiVehicle(false); setNumVehicles("2"); setRelatedUnitIds([]);
    setDestination(""); setReturnDate(""); setIsReturnJourney(true);
    setTravelCallTime(""); setTravelDepartureTime(""); setTravelPassengers("1");
  };

  const logBookingAudit = async (
    action: string,
    bookingId: string,
    metadata: Record<string, unknown> = {}
  ) => {
    const { error: auditError } = await supabase.rpc("log_audit", {
      p_action: action,
      p_entity_type: "booking",
      p_entity_id: bookingId,
      p_metadata: metadata,
    });

    if (auditError) {
      console.error("Booking audit failed:", auditError.message);
    }
  };

  // ── Validation per category ──────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!purpose.trim()) return "Purpose is required.";
    if (!tripDate) return "Trip date is required.";
    if (category === "pickup" || category === "other") {
      if (!tripTime) return "Trip time is required.";
      if (!pickupLocation.trim()) return "Pickup location is required.";
    }
    if (category === "dropoff") {
      if (!tripTime) return "Trip time is required.";
      if (!dropoffLocation.trim()) return "Drop-off location is required.";
    }
    if (category === "production") {
      if (!callTime) return "Call time is required.";
      if (!departureTime) return "Departure time is required.";
    }
    if (category === "travelling") {
      if (!destination.trim()) return "Destination is required.";
      if (!travelDepartureTime) return "Departure time is required.";
    }
    return null;
  };

  // ── Save draft & advance to review ──────────────────────────────────────────
  const saveDraft = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: prof } = await supabase.from("profiles")
        .select("division_id,unit_id,full_name").eq("user_id", user.id).single();

      const payload: Record<string, unknown> = {
        created_by:        user.id,
        division_id:       (prof as any)?.division_id ?? null,
        unit_id:           (prof as any)?.unit_id ?? null,
        purpose:           purpose.trim(),
        trip_date:         tripDate,
        trip_time:         tripTime || 
          (category === "production" ? departureTime || callTime : null) ||
          (category === "travelling" ? travelDepartureTime || travelCallTime : null) || "00:00",
        booking_type:      category,
        booking_category:  category,
        status:            "draft",
        needs_finance_approval: true,
        // pickup/dropoff — both columns are NOT NULL in DB
        pickup_location: pickupLocation.trim() || (category === "travelling" ? "Office" : "—"),
        dropoff_location: category === "dropoff"    ? dropoffLocation.trim() || "—"
                        : category === "pickup"     ? dropoffLocation.trim() || pickupLocation.trim() || "—"
                        : category === "travelling" ? destination.trim() || "—"
                        : category === "production" ? dropoffLocation.trim() || pickupLocation.trim() || "—"
                        : dropoffLocation.trim() || "—",
        gps_address:      gpsAddress.trim() || null,
        // production
        call_time:        category === "production" ? callTime : (category === "travelling" ? travelCallTime || null : null),
        departure_time:   category === "production" ? departureTime : (category === "travelling" ? travelDepartureTime || null : null),
        num_passengers:   category === "production" ? parseInt(numPassengers) || 1
                         : category === "travelling" ? parseInt(travelPassengers) || 1 : null,
        multi_vehicle:    category === "production" ? multiVehicle : false,
        num_vehicles:     category === "production" && multiVehicle ? parseInt(numVehicles) || 2 : null,
        // travelling
        destination:      category === "travelling" ? destination.trim() : null,
        return_date:      category === "travelling" && returnDate ? returnDate : null,
        is_return_journey: category === "travelling" ? isReturnJourney : null,
      };

      let id = draftId;
      if (id) {
        const { error: updErr } = await supabase.from("bookings").update(payload).eq("id", id);
        if (updErr) throw updErr;
        await logBookingAudit("booking_amended", id, { status: "draft", category });
      } else {
        const { data: ins, error: insErr } = await supabase.from("bookings").insert(payload).select("id").single();
        if (insErr) throw insErr;
        id = (ins as any)?.id ?? null;
        setDraftId(id);
        if (id) {
          await logBookingAudit("booking_draft_saved", id, { status: "draft", category });
        }
      }

      // Shared units for production
      if (id) {
        await supabase.from("booking_visibility_units").delete().eq("booking_id", id);
        if (relatedUnitIds.length > 0 && category === "production") {
          await supabase.from("booking_visibility_units").insert(
            relatedUnitIds.map(uid => ({ booking_id: id, unit_id: uid }))
          );
        }
      }

      setStep("review");
    } catch (e: any) {
      setError(e.message ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!draftId) { setError("No draft found."); return; }
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("submit_booking", { p_booking_id: draftId });
      if (e) throw e;
      setStep("done");
    } catch (e: any) {
      setError(e.message ?? "Failed to submit.");
    } finally { setSaving(false); }
  };

  // ── Render: Done ──────────────────────────────────────────────────────────────
  if (step === "done") {
    sessionStorage.removeItem(EDIT_BOOKING_STORAGE_KEY);
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--green-dim)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>Booking Submitted</h2>
        <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-muted)" }}>
          Your booking has been sent to <strong>Finance</strong> for approval first, then to the Corporate Approver.
        </p>
        <Btn variant="ghost" onClick={resetForm}>New Booking</Btn>
      </div>
    );
  }

  // ── Render: Category selection ────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div className="max-w-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>New Booking</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Select the type of transport you need</p>
        </div>
        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setStep("form"); }}
              className="w-full text-left rounded-2xl border px-4 py-4 flex items-center gap-4 transition-all hover:border-[color:var(--accent)] hover:shadow-sm group"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <span className="text-2xl shrink-0">{cat.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{cat.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{cat.desc}</p>
              </div>
              <svg className="ml-auto shrink-0 w-4 h-4" style={{ color: "var(--text-dim)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cat = CATEGORIES.find(c => c.value === category)!;

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[color:var(--text)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render: Form ──────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <div className="max-w-xl space-y-4">
        <ConfirmDialog
          open={showDiscard}
          title="Discard Booking?"
          message="Any unsaved changes will be lost. Are you sure you want to go back?"
          confirmLabel="Discard"
          variant="primary"
          onConfirm={() => { setShowDiscard(false); resetForm(); }}
          onCancel={() => setShowDiscard(false)}
        />

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDiscard(true)}
            className="p-2 rounded-xl border text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] transition-colors"
            style={{ borderColor: "var(--border)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>{cat.icon} {cat.label}</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fill in the details below</p>
          </div>
        </div>

        {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

        <Card>
          <CardBody className="space-y-4">

            {/* ── PICKUP form ── */}
            {category === "pickup" && <>
              <Field label="Purpose" required>
                <Input placeholder="e.g. Staff pickup from airport" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </Field>
              <Field label="Pickup Location" required>
                <Input placeholder="e.g. Kotoka Airport, Accra" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} />
              </Field>
              <Field label="Drop-off Location (destination)">
                <Input placeholder="e.g. GBC Studios" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required>
                  <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Time" required>
                  <Input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)} />
                </Field>
              </div>
              <Field label="GPS / Digital Address">
                <Input placeholder="e.g. GA-123-4567" value={gpsAddress} onChange={e => setGpsAddress(e.target.value)} />
              </Field>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Requester: </span>{profile?.full_name ?? "You"}
              </div>
            </>}

            {/* ── DROPOFF form ── */}
            {category === "dropoff" && <>
              <Field label="Purpose" required>
                <Input placeholder="e.g. Staff drop-off at Parliament House" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </Field>
              <Field label="Pickup Location (start point)">
                <Input placeholder="e.g. GBC Studios" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} />
              </Field>
              <Field label="Drop-off Location" required>
                <Input placeholder="e.g. Parliament House, Accra" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required>
                  <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Time" required>
                  <Input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)} />
                </Field>
              </div>
              <Field label="GPS / Digital Address">
                <Input placeholder="e.g. GA-123-4567" value={gpsAddress} onChange={e => setGpsAddress(e.target.value)} />
              </Field>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Requester: </span>{profile?.full_name ?? "You"}
              </div>
            </>}

            {/* ── PRODUCTION form ── */}
            {category === "production" && <>
              <Field label="Purpose / Assignment" required>
                <Input placeholder="e.g. News shoot at Parliament" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Call Time" required>
                  <Input type="time" value={callTime} onChange={e => setCallTime(e.target.value)} />
                </Field>
                <Field label="Departure Time" required>
                  <Input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} />
                </Field>
              </div>
              <Field label="Number of Persons">
                <Input type="number" min="1" value={numPassengers} onChange={e => setNumPassengers(e.target.value)} />
              </Field>

              {/* Multi-vehicle checkbox */}
              <div className="flex items-start gap-3 p-3 rounded-xl border"
                style={{ borderColor: multiVehicle ? "var(--accent)" : "var(--border)", background: multiVehicle ? "var(--accent-dim)" : "var(--surface-2)" }}>
                <input type="checkbox" id="multi-vehicle" className="mt-0.5 w-4 h-4 accent-[color:var(--accent)]"
                  checked={multiVehicle} onChange={e => setMultiVehicle(e.target.checked)} />
                <div className="min-w-0">
                  <label htmlFor="multi-vehicle" className="text-sm font-medium cursor-pointer" style={{ color: "var(--text)" }}>
                    More than one vehicle needed
                  </label>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Supervisor will decide the exact number of vehicles to deploy
                  </p>
                  {multiVehicle && (
                    <div className="mt-2">
                      <label className="form-label">Requested number of vehicles</label>
                      <Input type="number" min="2" max="20" value={numVehicles}
                        onChange={e => setNumVehicles(e.target.value)} className="mt-1" />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Unit: </span>{myUnit?.name ?? "—"}
                <span className="mx-2">·</span>
                <span className="font-medium" style={{ color: "var(--text)" }}>Requester: </span>{profile?.full_name ?? "You"}
              </div>

              {/* Share with units */}
              {myDivisionUnits.length > 1 && (
                <div className="space-y-2">
                  <label className="form-label">Shared with units (optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {myDivisionUnits.filter(u => u.id !== profile?.unit_id).map(u => (
                      <button key={u.id} type="button" onClick={() => toggleUnit(u.id)}
                        className="px-3 py-2 rounded-xl text-xs font-medium text-left transition-all border"
                        style={{
                          background: relatedUnitIds.includes(u.id) ? "var(--accent-dim)" : "var(--surface-2)",
                          borderColor: relatedUnitIds.includes(u.id) ? "var(--accent)" : "var(--border)",
                          color: relatedUnitIds.includes(u.id) ? "var(--accent)" : "var(--text-muted)",
                        }}>
                        {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>}

            {/* ── TRAVELLING form ── */}
            {category === "travelling" && <>
              <Field label="Purpose / Reason for Travel" required>
                <Input placeholder="e.g. Official delegation to Kumasi" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </Field>
              <Field label="Destination" required>
                <Input placeholder="e.g. Kumasi, Ashanti Region" value={destination} onChange={e => setDestination(e.target.value)} />
              </Field>
              <Field label="Departure Date" required>
                <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Expected Return Date">
                <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} min={tripDate || new Date().toISOString().slice(0, 10)} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Leave blank if open-ended</p>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Call Time">
                  <Input type="time" value={travelCallTime} onChange={e => setTravelCallTime(e.target.value)} />
                </Field>
                <Field label="Departure Time" required>
                  <Input type="time" value={travelDepartureTime} onChange={e => setTravelDepartureTime(e.target.value)} />
                </Field>
              </div>
              <Field label="Number of Passengers">
                <Input type="number" min="1" value={travelPassengers} onChange={e => setTravelPassengers(e.target.value)} />
              </Field>

              {/* Return journey checkbox */}
              <div className="flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  borderColor: !isReturnJourney ? "var(--amber)" : "var(--border)",
                  background: !isReturnJourney ? "var(--amber-dim)" : "var(--surface-2)",
                }}>
                <input type="checkbox" id="return-journey" className="mt-0.5 w-4 h-4"
                  checked={isReturnJourney} onChange={e => setIsReturnJourney(e.target.checked)} />
                <div className="min-w-0">
                  <label htmlFor="return-journey" className="text-sm font-medium cursor-pointer" style={{ color: "var(--text)" }}>
                    This is a return journey
                  </label>
                  {!isReturnJourney && (
                    <div className="mt-2 p-2.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(217,119,6,0.15)", color: "var(--amber)" }}>
                      ⚠️ Non-return travel requires <strong>Finance approval</strong> before proceeding to Corporate Approver
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Unit: </span>{myUnit?.name ?? "—"}
                <span className="mx-2">·</span>
                <span className="font-medium" style={{ color: "var(--text)" }}>Requester: </span>{profile?.full_name ?? "You"}
              </div>
            </>}

            {/* ── OTHER form ── */}
            {category === "other" && <>
              <Field label="Purpose" required>
                <Input placeholder="Describe what you need" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </Field>
              <Field label="Pickup Location">
                <Input placeholder="Where should the vehicle start from?" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} />
              </Field>
              <Field label="Destination">
                <Input placeholder="Where is the vehicle needed?" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required>
                  <Input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Time" required>
                  <Input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)} />
                </Field>
              </div>
              <Field label="GPS / Digital Address">
                <Input placeholder="e.g. GA-123-4567" value={gpsAddress} onChange={e => setGpsAddress(e.target.value)} />
              </Field>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Requester: </span>{profile?.full_name ?? "You"}
              </div>
            </>}

            <div className="flex justify-end pt-2">
              <Btn variant="primary" onClick={saveDraft} loading={saving}>Review & Submit →</Btn>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── Render: Review ────────────────────────────────────────────────────────────
  const reviewRows: [string, string][] = [["Type", cat.label], ["Purpose", purpose], ["Date", tripDate]];
  if (tripTime) reviewRows.push(["Time", tripTime]);
  if (category === "pickup" || category === "other") {
    if (pickupLocation) reviewRows.push(["Pickup", pickupLocation]);
    if (dropoffLocation) reviewRows.push(["Destination", dropoffLocation]);
    if (gpsAddress) reviewRows.push(["GPS Address", gpsAddress]);
  }
  if (category === "dropoff") {
    if (pickupLocation) reviewRows.push(["From", pickupLocation]);
    reviewRows.push(["Drop-off", dropoffLocation]);
    if (gpsAddress) reviewRows.push(["GPS Address", gpsAddress]);
  }
  if (category === "production") {
    reviewRows.push(["Call Time", callTime], ["Departure", departureTime], ["Persons", numPassengers]);
    if (multiVehicle) reviewRows.push(["Multi-vehicle", `Yes — ${numVehicles} requested`]);
    if (relatedUnitIds.length > 0) reviewRows.push(["Shared with", `${relatedUnitIds.length} unit(s)`]);
  }
  if (category === "travelling") {
    reviewRows.push(["Destination", destination]);
    if (returnDate) reviewRows.push(["Return Date", returnDate]);
    reviewRows.push(["Return Journey", isReturnJourney ? "Yes" : "No"]);
    if (travelCallTime) reviewRows.push(["Call Time", travelCallTime]);
    reviewRows.push(["Departure Time", travelDepartureTime], ["Passengers", travelPassengers]);
    if (!isReturnJourney) reviewRows.push(["Approval Path", "Finance → Corporate → Transport"]);
  }
  reviewRows.push(["Requester", profile?.full_name ?? "You"]);

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader title="Review & Submit" action={
          <Btn variant="ghost" size="sm" onClick={() => setStep("form")}>← Edit</Btn>
        } />
        <CardBody className="space-y-0">
          {reviewRows.map(([label, value]) => (
            <div key={label} className="flex items-start gap-3 py-2.5 border-b last:border-0"
              style={{ borderColor: "var(--border)" }}>
              <span className="text-xs w-28 shrink-0 pt-0.5" style={{ color: "var(--text-muted)" }}>{label}</span>
              <span className="text-sm font-medium flex-1" style={{ color: label === "Approval Path" ? "var(--amber)" : "var(--text)" }}>
                {label === "Approval Path" ? "⚠️ " : ""}{value}
              </span>
            </div>
          ))}
          {error && <Alert type="error" onDismiss={() => setError(null)} className="mt-3">{error}</Alert>}
          <div className="pt-4">
            <Btn variant="primary" className="w-full" onClick={submit} loading={saving}>
              Submit for Approval
            </Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
