// src/modules/fuel/pages/CreateFuelRequest.tsx
// Form opens in a modal triggered by a "+ New Fuel Request" button

import { useEffect, useMemo, useState } from "react";
import { supabase, cachedFetch } from "@/lib/supabase";
import { Alert, Btn, Field, Input, Select, Textarea } from "@/components/TmsUI";
import { useAuth } from "@/hooks/useAuth";

type Vehicle = { id: string; plate_number: string; fuel_type: string | null };

export default function CreateFuelRequest() {
  const { user } = useAuth();
  const draftKey = useMemo(() => `fuel_request_draft:${user?.id ?? "anon"}`, [user?.id]);

  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myName, setMyName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (user?.id) {
        const profile = await cachedFetch<any>(
          `profile_name:${user.id}`,
          async () => {
            const { data } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", user.id)
              .single();
            return data;
          }
        );
        setMyName(profile?.full_name ?? "You");
      }

      const data = await cachedFetch<Vehicle[]>("vehicles_active_fuel", async () => {
        const { data } = await supabase
          .from("vehicles")
          .select("id,plate_number,fuel_type")
          .eq("status", "active")
          .order("plate_number");
        return (data as Vehicle[]) || [];
      });

      setVehicles(data);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setVehicleId(draft.vehicleId ?? "");
      setFuelType(draft.fuelType ?? "");
      setPurpose(draft.purpose ?? "");
      setNotes(draft.notes ?? "");
    } catch {}
  }, [open, draftKey]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ vehicleId, fuelType, purpose, notes })
      );
    } catch {}
  }, [open, draftKey, vehicleId, fuelType, purpose, notes]);

  const handleVehicleChange = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    setFuelType(v?.fuel_type ?? "");
  };

  const resetForm = () => {
    setVehicleId("");
    setFuelType("");
    setPurpose("");
    setNotes("");
    setError(null);
    setSuccess(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  };

  const openModal = () => {
    setError(null);
    setSuccess(false);
    setOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setOpen(false);
  };

  const submit = async () => {
    if (!vehicleId) {
      setError("Please select a vehicle.");
      return;
    }
    if (!purpose.trim()) {
      setError("Purpose / destination is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: draftId, error: draftErr } = await supabase.rpc(
        "create_fuel_request_draft",
        {
          p_vehicle_id: vehicleId,
          p_driver_id: null,
          p_fuel_type: fuelType || null,
          p_liters: null,
          p_amount: null,
          p_vendor: null,
          p_purpose: purpose.trim(),
          p_notes: notes.trim() || null,
        }
      );

      if (draftErr) throw draftErr;

      const { error: subErr } = await supabase.rpc("submit_fuel_request", {
        p_fuel_request_id: draftId,
      });

      if (subErr) throw subErr;

      setSuccess(true);

      try {
        localStorage.removeItem(draftKey);
      } catch {}

      setTimeout(() => {
        resetForm();
        setOpen(false);
      }, 2200);
    } catch (e: any) {
      setError(e.message ?? "Submission failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={openModal}>
        + New Fuel Request
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>
                  New Fuel Request
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Liters and cost will be entered by transport supervisor
                </p>
              </div>

              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg"
                style={{ color: "var(--text-muted)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 14 14" stroke="currentColor">
                  <path d="M3 3l8 8M11 3l-8 8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {success && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "var(--green-dim)" }}
                  >
                    <svg className="w-6 h-6" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold" style={{ color: "var(--text)" }}>
                    Request submitted!
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Closing…
                  </p>
                </div>
              )}

              {!success && (
                <>
                  {error && (
                    <Alert type="error" onDismiss={() => setError(null)}>
                      {error}
                    </Alert>
                  )}

                  <Field label="Requested By">
                    <div
                      className="px-3 py-2.5 rounded-lg text-sm font-medium"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {myName || "Loading…"}{" "}
                      <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                        (you)
                      </span>
                    </div>
                  </Field>

                  <Field label="Vehicle" required>
                    <Select value={vehicleId} onChange={(e) => handleVehicleChange(e.target.value)}>
                      <option value="">— Select vehicle —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate_number}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {vehicleId && (
                    <Field label="Fuel Type">
                      <div
                        className="px-3 py-2.5 rounded-lg text-sm capitalize"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: fuelType ? "var(--text)" : "var(--text-dim)",
                        }}
                      >
                        {fuelType ? (
                          <>
                            <span style={{ color: "var(--accent)" }}>⛽</span> {fuelType}
                          </>
                        ) : (
                          "Not set on vehicle profile"
                        )}
                      </div>
                    </Field>
                  )}

                  <Field label="Purpose / Destination" required>
                    <Input
                      placeholder="e.g. Field assignment to Kumasi, Studio generator top-up"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </Field>

                  <Field label="Notes">
                    <Textarea
                      rows={3}
                      placeholder="Additional notes for the approver / transport team…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>

                  <div className="flex justify-end gap-3 pt-1">
                    <Btn variant="ghost" onClick={closeModal}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" onClick={submit} loading={saving}>
                      Submit Request
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}