// src/modules/fuel/services/fuel.service.ts
// Aligned exactly with DB RPC signatures confirmed from Supabase.
//
// Fuel workflow:  draft → submitted → approved/rejected → recorded
// RPCs:
//   create_fuel_request_draft(p_vehicle_id, p_driver_id?, p_fuel_type?, p_liters?, p_amount?, p_vendor?, p_purpose?, p_notes?) → uuid
//   submit_fuel_request(p_fuel_request_id)                          → void
//   approve_fuel_request(p_fuel_request_id, p_action, p_comment?)  → void  [admin | corporate_approver]
//   record_fuel_request(p_fuel_request_id, p_actual_liters?, p_actual_amount?, p_vendor?, p_notes?) → void  [admin | transport_supervisor]

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
export type FuelStatus = "draft" | "submitted" | "approved" | "rejected" | "recorded";

export interface FuelRequest {
  id: string;
  created_by: string;
  vehicle_id: string;
  driver_id: string | null;
  request_date: string;
  liters: number | null;
  amount: number | null;
  vendor: string | null;
  status: FuelStatus;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFuelDraftInput {
  vehicle_id: string;
  driver_id?: string | null;
  fuel_type?: string;
  liters?: number | null;
  amount?: number | null;
  vendor?: string | null;
  purpose?: string | null;
  notes?: string | null;
}

// ── Create draft ──────────────────────────────────────────────────────────────
export async function createFuelDraft(input: CreateFuelDraftInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_fuel_request_draft", {
    p_vehicle_id: input.vehicle_id,
    p_driver_id:  input.driver_id  ?? null,
    p_fuel_type:  input.fuel_type  ?? "petrol",
    p_liters:     input.liters     ?? null,
    p_amount:     input.amount     ?? null,
    p_vendor:     input.vendor     ?? null,
    p_purpose:    input.purpose    ?? null,
    p_notes:      input.notes      ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ── Submit draft → submitted ──────────────────────────────────────────────────
export async function submitFuelRequest(fuelRequestId: string): Promise<void> {
  const { error } = await supabase.rpc("submit_fuel_request", {
    p_fuel_request_id: fuelRequestId,
  });
  if (error) throw error;
}

// ── Corporate approve/reject: submitted → approved | rejected ─────────────────
export async function approveFuelRequest(
  fuelRequestId: string,
  action: "approved" | "rejected",
  comment?: string
): Promise<void> {
  const { error } = await supabase.rpc("approve_fuel_request", {
    p_fuel_request_id: fuelRequestId,
    p_action:          action,
    p_comment:         comment ?? null,
  });
  if (error) throw error;
}

// ── Transport record: approved → recorded ─────────────────────────────────────
export async function recordFuelRequest(
  fuelRequestId: string,
  opts?: {
    actualLiters?: number | null;
    actualAmount?: number | null;
    vendor?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("record_fuel_request", {
    p_fuel_request_id: fuelRequestId,
    p_actual_liters:   opts?.actualLiters ?? null,
    p_actual_amount:   opts?.actualAmount ?? null,
    p_vendor:          opts?.vendor       ?? null,
    p_notes:           opts?.notes        ?? null,
  });
  if (error) throw error;
}

// ── Read helpers ──────────────────────────────────────────────────────────────
export async function listMyFuelRequests(): Promise<FuelRequest[]> {
  const { data, error } = await supabase
    .from("fuel_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FuelRequest[];
}

export async function listFuelByStatus(status: FuelStatus | FuelStatus[]): Promise<FuelRequest[]> {
  const statuses = Array.isArray(status) ? status : [status];
  const { data, error } = await supabase
    .from("fuel_requests")
    .select("*")
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FuelRequest[];
}

export async function listAllFuelRequests(): Promise<FuelRequest[]> {
  const { data, error } = await supabase
    .from("fuel_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as FuelRequest[];
}