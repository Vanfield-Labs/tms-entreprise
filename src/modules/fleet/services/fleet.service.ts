import { supabase } from "@/lib/supabase";

// ── Vehicles ──────────────────────────────────────────────────────────────────

export type Vehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  fuel_type: string | null;
  capacity: number | null;
  status: string;
  vin: string | null;
  insurance_expiry: string | null;
  roadworthy_expiry: string | null;
  notes: string | null;
  created_at: string;
};

export type VehicleInput = Omit<Vehicle, "id" | "created_at">;

export async function listVehicles() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("plate_number");
  if (error) throw error;
  return data as Vehicle[];
}

export async function createVehicle(input: Partial<VehicleInput>) {
  const { data, error } = await supabase.from("vehicles").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>) {
  const { error } = await supabase.from("vehicles").update(input).eq("id", id);
  if (error) throw error;
}

export async function setVehicleStatus(id: string, status: string) {
  const { error } = await supabase.from("vehicles").update({ status }).eq("id", id);
  if (error) throw error;
}

// ── Drivers ───────────────────────────────────────────────────────────────────

export type Driver = {
  id: string;
  user_id: string | null;
  license_number: string;
  license_expiry: string | null;
  license_class: string | null;
  employment_status: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type DriverInput = Omit<Driver, "id" | "created_at">;

export async function listDrivers() {
  const { data, error } = await supabase
    .from("drivers")
    .select("*, profiles(full_name)")
    .order("license_number");
  if (error) throw error;
  return data as (Driver & { profiles?: { full_name: string } | null })[];
}

export async function createDriver(input: Partial<DriverInput>) {
  const { data, error } = await supabase.from("drivers").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateDriver(id: string, input: Partial<DriverInput>) {
  const { error } = await supabase.from("drivers").update(input).eq("id", id);
  if (error) throw error;
}

export async function setDriverStatus(id: string, status: string) {
  const { error } = await supabase.from("drivers").update({ employment_status: status }).eq("id", id);
  if (error) throw error;
}
