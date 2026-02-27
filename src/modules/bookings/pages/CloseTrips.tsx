import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/utils";

type Booking = { id: string; purpose: string; trip_date: string; status: string; pickup_location: string; dropoff_location: string };

export default function CloseTrips() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,status,pickup_location,dropoff_location")
      .eq("status", "completed")
      .order("trip_date", { ascending: false });
    setItems((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const close = async (id: string) => {
    setClosing(id);
    await supabase.rpc("close_booking", { p_booking_id: id });
    await load();
    setClosing(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Close Completed Trips</h1>
        <p className="page-sub">{items.length} trip{items.length !== 1 ? "s" : ""} awaiting closure</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-row">Loading...</div>
        ) : (
          <table className="tms-table">
            <thead>
              <tr><th>Purpose</th><th>Date</th><th>Route</th><th>Action</th></tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.purpose}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtDate(b.trip_date)}</td>
                  <td style={{ fontSize: 12 }}>{b.pickup_location} → {b.dropoff_location}</td>
                  <td>
                    <button
                      className="btn btn-success btn-sm"
                      disabled={closing === b.id}
                      onClick={() => close(b.id)}
                    >
                      {closing === b.id ? "Closing..." : "Close Trip"}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon">✓</div>
                    <div>No completed trips awaiting closure</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
