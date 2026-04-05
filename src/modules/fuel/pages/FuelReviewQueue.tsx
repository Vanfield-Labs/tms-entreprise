// src/modules/fuel/pages/FuelReviewQueue.tsx

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner,
  EmptyState,
  Badge,
  Card,
  CountPill,
  Field,
  Input,
  Btn,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type FuelRow = {
  id: string;
  status: string;
  purpose: string | null;
  notes: string | null;
  request_date: string;
  created_at: string;
  vehicles: { plate_number: string; fuel_type: string | null } | null;
  profiles: { full_name: string } | null;
};

export default function FuelReviewQueue() {
  const [rows, setRows] = useState<FuelRow[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [focusedFuelId, setFocusedFuelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("fuel_requests")
      .select(
        "id,status,purpose,notes,request_date,created_at,vehicles(plate_number,fuel_type),profiles!created_by(full_name)"
      )
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("FuelReviewQueue load:", error.message);
      setLoading(false);
      return;
    }

    setRows((data as unknown as FuelRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(), 400), [load]);

  useRealtimeTable({
    table: "fuel_requests",
    event: "*",
    onChange: debouncedReload,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ entityType?: string; entityId?: string | null }>).detail;
      if (!detail?.entityId) return;
      if (detail.entityType !== "fuel_request" && detail.entityType !== "fuel") return;

      setFocusedFuelId(detail.entityId);

      window.setTimeout(() => {
        document
          .getElementById(`fuel-request-${detail.entityId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      window.setTimeout(() => {
        setFocusedFuelId((prev) => (prev === detail.entityId ? null : prev));
      }, 4500);
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  const act = async (id: string, action: "approved" | "rejected") => {
    setActing((m) => ({ ...m, [id]: true }));

    try {
      const { error } = await supabase.rpc("approve_fuel_request", {
        p_fuel_request_id: id,
        p_action: action,
        p_comment: comment[id] ?? null,
      });

      if (error) throw error;

      await load();
    } catch (e: any) {
      alert("Action failed: " + e.message);
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  };

  if (loading) return <PageSpinner variant="cards" count={3} />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fuel Approvals</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Review and approve fuel requests
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="All caught up"
          subtitle="No fuel requests awaiting approval"
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={rows.length} color="amber" />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              pending approval{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-4">
            {rows.map((r) => {
              const isFocused = focusedFuelId === r.id;

              return (
                <div key={r.id} id={`fuel-request-${r.id}`}>
  <Card className={isFocused ? "transition-all duration-300" : undefined}>
                  <div
                    style={{
                      boxShadow: isFocused
                        ? "0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 18px 40px rgba(0,0,0,0.12)"
                        : undefined,
                      transition: "all 0.3s ease",
                      borderRadius: 16,
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b flex items-start justify-between gap-3"
                      style={{
                        borderColor: "var(--border)",
                        background: isFocused
                          ? "color-mix(in srgb, var(--accent-dim) 40%, var(--surface))"
                          : "var(--amber-dim)",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                          {r.purpose || "Fuel Request"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Submitted {fmtDate(r.created_at)}
                        </p>
                      </div>
                      <Badge status={r.status} />
                    </div>

                    <div
                      className="px-4 py-4 space-y-3 border-b"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            Requested By
                          </p>
                          <p className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                            {r.profiles?.full_name ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            Vehicle
                          </p>
                          <p className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                            {r.vehicles?.plate_number ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            Fuel Type
                          </p>
                          <p className="font-semibold mt-0.5 capitalize" style={{ color: "var(--text)" }}>
                            {r.vehicles?.fuel_type ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            Date Requested
                          </p>
                          <p className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                            {fmtDate(r.request_date)}
                          </p>
                        </div>
                      </div>

                      {r.notes && (
                        <div
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                        >
                          <span className="font-medium" style={{ color: "var(--text)" }}>
                            Notes:{" "}
                          </span>
                          {r.notes}
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <Field label="Comment (optional)">
                        <Input
                          placeholder="Add a comment for the requester…"
                          value={comment[r.id] || ""}
                          onChange={(e) =>
                            setComment((m) => ({
                              ...m,
                              [r.id]: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <div className="flex gap-2">
                        <Btn
                          variant="primary"
                          className="flex-1"
                          loading={acting[r.id]}
                          onClick={() => act(r.id, "approved")}
                        >
                          ✅ Approve
                        </Btn>

                        <Btn
                          variant="danger"
                          className="flex-1"
                          loading={acting[r.id]}
                          onClick={() => act(r.id, "rejected")}
                        >
                          ❌ Reject
                        </Btn>
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
