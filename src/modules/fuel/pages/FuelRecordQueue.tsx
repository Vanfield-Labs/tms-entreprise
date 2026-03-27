// src/modules/fuel/pages/FuelRecordQueue.tsx
// Redesigned desktop view: cards instead of wide table — no horizontal scroll.
// Mobile view unchanged. All existing logic preserved.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type FuelRow = {
  id: string;
  status: string;
  purpose: string | null;
  notes: string | null;
  liters: number | null;
  amount: number | null;
  mileage: number | null;
  receipt_url: string | null;
  request_date: string;
  created_at: string;
  vehicles: { plate_number: string; fuel_type: string | null; current_mileage: number | null } | null;
  profiles: { full_name: string } | null;
};

type RecordState = {
  liters: string;
  amount: string;
  mileage: string;
  vendor: string;
  notes: string;
  receiptFile: File | null;
  uploading: boolean;
  saving: boolean;
  error: string;
};

const EMPTY_STATE: RecordState = {
  liters: "",
  amount: "",
  mileage: "",
  vendor: "",
  notes: "",
  receiptFile: null,
  uploading: false,
  saving: false,
  error: "",
};

export default function FuelRecordQueue() {
  const [rows, setRows] = useState<FuelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Record<string, RecordState>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pg = usePagination(rows);

  const s = (id: string): RecordState => state[id] ?? EMPTY_STATE;
  const u = (id: string, patch: Partial<RecordState>) =>
    setState((m) => ({ ...m, [id]: { ...s(id), ...patch } }));

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("fuel_requests")
      .select(
        "id,status,purpose,notes,liters,amount,mileage,receipt_url,request_date,created_at,vehicles(plate_number,fuel_type,current_mileage),profiles!created_by(full_name)"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) console.error("FuelRecordQueue:", error.message);

    setRows((data as unknown as FuelRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(), 350), [load]);

  useRealtimeTable({
    table: "fuel_requests",
    event: "*",
    onChange: debouncedReload,
  });

  const uploadReceipt = async (id: string, file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `receipts/${id}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("fuel-receipts").upload(path, file);
    if (error) {
      u(id, { error: "Receipt upload failed: " + error.message });
      return null;
    }

    const { data: url } = supabase.storage.from("fuel-receipts").getPublicUrl(path);
    return url.publicUrl;
  };

  const record = async (id: string) => {
    const st = s(id);

    if (!st.liters) {
      u(id, { error: "Liters dispensed is required." });
      return;
    }
    if (!st.amount) {
      u(id, { error: "Actual cost is required." });
      return;
    }

    u(id, { saving: true, error: "" });

    try {
      let receiptUrl: string | null = null;

      if (st.receiptFile) {
        u(id, { uploading: true });
        receiptUrl = await uploadReceipt(id, st.receiptFile);
        u(id, { uploading: false });
        if (!receiptUrl) {
          u(id, { saving: false });
          return;
        }
      }

      const { error } = await supabase.rpc("record_fuel_request", {
        p_fuel_request_id: id,
        p_actual_liters: parseFloat(st.liters),
        p_actual_amount: parseFloat(st.amount),
        p_vendor: st.vendor.trim() || null,
        p_mileage: st.mileage ? parseFloat(st.mileage) : null,
        p_receipt_url: receiptUrl,
        p_notes: st.notes.trim() || null,
      });

      if (error) throw error;

      setState((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });

      await load();
    } catch (e: any) {
      u(id, { error: e.message ?? "Failed to record." });
    } finally {
      u(id, { saving: false, uploading: false });
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Fuel</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Enter dispensed amount for approved fuel requests
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No approved requests"
          subtitle="Approved fuel requests awaiting recording appear here"
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={rows.length} color="green" />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              ready to record
            </span>
          </div>

          <div className="space-y-4">
            {pg.slice.map((r) => {
              const st = s(r.id);

              return (
                <Card key={r.id}>
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: "var(--border)", background: "var(--green-dim)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                          {r.profiles?.full_name ?? "—"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {r.vehicles?.plate_number ?? "—"} ·{" "}
                          <span className="capitalize">{r.vehicles?.fuel_type ?? "—"}</span> ·{" "}
                          {fmtDate(r.request_date)}
                        </p>
                        {r.purpose && (
                          <p className="text-xs mt-1 italic" style={{ color: "var(--text-muted)" }}>
                            "{r.purpose}"
                          </p>
                        )}
                      </div>
                      <Badge status={r.status} />
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {st.error && (
                      <p
                        className="text-xs px-3 py-2 rounded-lg"
                        style={{ background: "var(--red-dim)", color: "var(--red)" }}
                      >
                        {st.error}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Liters Dispensed *">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0.0"
                          value={st.liters}
                          onChange={(e) => u(r.id, { liters: e.target.value })}
                        />
                      </Field>

                      <Field label="Actual Cost (GHS) *">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={st.amount}
                          onChange={(e) => u(r.id, { amount: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mileage (km)">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder={r.vehicles?.current_mileage?.toString() ?? "Current km"}
                          value={st.mileage}
                          onChange={(e) => u(r.id, { mileage: e.target.value })}
                        />
                      </Field>

                      <Field label="Vendor / Station">
                        <Input
                          placeholder="e.g. Total Spintex"
                          value={st.vendor}
                          onChange={(e) => u(r.id, { vendor: e.target.value })}
                        />
                      </Field>
                    </div>

                    <Field label="Notes">
                      <Input
                        placeholder="Pump #, attendant name…"
                        value={st.notes}
                        onChange={(e) => u(r.id, { notes: e.target.value })}
                      />
                    </Field>

                    <Field label="Receipt (optional)">
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                        onClick={() => fileInputRefs.current[r.id]?.click()}
                      >
                        <span style={{ fontSize: 14 }}>📎</span>
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          {st.receiptFile?.name ?? "Attach receipt image"}
                        </span>
                      </div>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[r.id] = el;
                        }}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) =>
                          u(r.id, { receiptFile: e.target.files?.[0] ?? null })
                        }
                      />
                    </Field>

                    {r.notes && (
                      <div
                        className="rounded-lg px-3 py-2 text-xs"
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>Request Notes: </span>
                        {r.notes}
                      </div>
                    )}

                    <Btn
                      variant="primary"
                      className="w-full"
                      loading={st.saving || st.uploading}
                      onClick={() => record(r.id)}
                    >
                      Record Fuel
                    </Btn>
                  </div>
                </Card>
              );
            })}
          </div>

          <PaginationBar {...pg} />
        </>
      )}
    </div>
  );
}