// src/modules/bookings/pages/BookingDetailView.tsx
// Usage: <BookingDetailView bookingId={id} onBack={() => setSelected(null)} />
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  status: string;
  booking_type: string;
  pickup_location: string;
  dropoff_location: string;
  num_passengers: number | null;
  trip_notes: string | null;
  created_at: string;
  vehicles?: { plate_number: string } | null;
  drivers?: { license_number: string; profiles?: { full_name: string } | null } | null;
};

type AuditEntry = {
  id: string;
  action: string;
  actor_user_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Profile = { user_id: string; full_name: string };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  finance_pending: "bg-sky-100 text-sky-700",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  dispatched: "bg-blue-100 text-blue-700",
  in_progress: "bg-violet-100 text-violet-700",
  completed: "bg-cyan-100 text-cyan-700",
  closed: "bg-gray-200 text-gray-600",
};

function getActionIcon(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("draft")) return "✏️";
  if (normalized.includes("submit")) return "📤";
  if (normalized.includes("amend") || normalized.includes("update")) return "🔄";
  if (normalized.includes("approve")) return "✅";
  if (normalized.includes("reject")) return "❌";
  if (normalized.includes("dispatch")) return "🚗";
  if (normalized.includes("close")) return "🔒";
  if (normalized.includes("complete")) return "🏁";

  return "📝";
}

export default function BookingDetailView({
  bookingId,
  onBack,
}: {
  bookingId: string;
  onBack: () => void;
}) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: a }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*,vehicles(plate_number),drivers(license_number,profiles(full_name))")
          .eq("id", bookingId)
          .single(),
        supabase
          .from("audit_logs")
          .select("id,action,actor_user_id,metadata,created_at")
          .eq("entity_type", "booking")
          .eq("entity_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);

      setBooking(b as Booking);
      const entries = (a as AuditEntry[]) || [];
      setAudit(entries);

      const uids = [...new Set(entries.map((entry) => entry.actor_user_id).filter(Boolean))];
      if (uids.length) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", uids);

        const map: Record<string, string> = {};
        (profileRows as Profile[] | null)?.forEach((profile) => {
          map[profile.user_id] = profile.full_name;
        });
        setProfiles(map);
      }

      setLoading(false);
    })();

    const channel = supabase
      .channel(`booking_detail_${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          setBooking((prev) => (prev ? { ...prev, ...(payload.new as Partial<Booking>) } : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-sm">Booking not found.</p>
        <button className="mt-4 text-xs text-gray-500 underline" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{booking.purpose}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
              {booking.status.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400 capitalize">{booking.booking_type}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Trip Details</h3>
        </div>
        <div className="p-5 space-y-3">
          <Detail label="Date & Time" value={`${fmtDate(booking.trip_date)} at ${booking.trip_time}`} />
          <Detail label="Pickup" value={booking.pickup_location} />
          <Detail label="Dropoff" value={booking.dropoff_location} />
          <Detail label="Passengers" value={String(booking.num_passengers || 1)} />
          {booking.vehicles && <Detail label="Vehicle" value={booking.vehicles.plate_number} />}
          {booking.drivers && (
            <Detail
              label="Driver"
              value={booking.drivers.profiles?.full_name || booking.drivers.license_number}
            />
          )}
          {booking.trip_notes && <Detail label="Notes" value={booking.trip_notes} />}
          <Detail label="Created" value={fmtDateTime(booking.created_at)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Audit Trail</h3>
          <p className="text-xs text-gray-400 mt-0.5">Complete history of actions on this booking</p>
        </div>
        {audit.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No audit history found.</div>
        ) : (
          <div className="relative">
            <div className="absolute left-[1.85rem] top-0 bottom-0 w-px bg-gray-100" />
            <div className="p-4 space-y-0">
              {audit.map((entry, index) => {
                const isLast = index === audit.length - 1;

                return (
                  <div key={entry.id} className="flex gap-3 relative pb-4 last:pb-0">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm z-10">
                      {getActionIcon(entry.action)}
                    </div>
                    <div className={`flex-1 min-w-0 ${!isLast ? "pb-4 border-b border-gray-50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {entry.action.replace(/_/g, " ")}
                          </span>
                          {profiles[entry.actor_user_id] && (
                            <span className="ml-1.5 text-xs text-gray-400">
                              by {profiles[entry.actor_user_id]}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-gray-400 font-mono whitespace-nowrap">
                          {fmtDateTime(entry.created_at)}
                        </span>
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 font-mono">
                          {Object.entries(entry.metadata)
                            .filter(([, value]) => value != null && value !== "")
                            .map(([key, value]) => (
                              <span key={key} className="inline-block mr-3">
                                <span className="text-gray-400">{key}:</span> {String(value)}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-xs font-medium text-gray-400 w-24 mt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  );
}
