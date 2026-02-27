import { supabase } from "@/lib/supabase";

export async function listMyFuelRequests() {
  const { data, error } = await supabase.from("fuel_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data as any[];
}

export async function createFuelDraft(input: {
  vehicle_id?: string | null; driver_id?: string | null;
  fuel_type?: string | null; liters?: number | null;
  estimated_cost?: number | null; purpose?: string | null; notes?: string | null;
}) {
  const { data, error } = await supabase.rpc("create_fuel_request_draft", {
    p_vehicle_id: input.vehicle_id ?? null, p_driver_id: input.driver_id ?? null,
    p_fuel_type: input.fuel_type ?? null, p_liters: input.liters ?? null,
    p_estimated_cost: input.estimated_cost ?? null, p_purpose: input.purpose ?? null,
    p_notes: input.notes ?? null, p_meta: {},
  });
  if (error) throw error;
  return data as string;
}

export async function submitFuelRequest(fuelRequestId: string) {
  const { error } = await supabase.rpc("submit_fuel_request", { p_fuel_request_id: fuelRequestId, p_meta: {} });
  if (error) throw error;
}

export async function corporateApproveFuel(fuelRequestId: string, approve: boolean, notes?: string) {
  const { error } = await supabase.rpc("corporate_review_fuel_request", {
    p_fuel_request_id: fuelRequestId,
    p_action: approve ? "approved" : "rejected",
    p_notes: notes ?? null, p_meta: {},
  });
  if (error) throw error;
}

export async function transportRecordFuel(fuelRequestId: string, actualCost?: number, notes?: string) {
  const { error } = await supabase.rpc("record_fuel_request", {
    p_fuel_request_id: fuelRequestId,
    p_actual_cost: actualCost ?? null,
    p_notes: notes ?? null, p_meta: {},
  });
  if (error) throw error;
}
