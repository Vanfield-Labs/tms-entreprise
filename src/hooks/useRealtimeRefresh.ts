import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type TableName = "bookings" | "fuel_requests" | "maintenance_requests" | "users" | "profiles";

type UseRealtimeRefreshOptions = {
  channel: string;
  tables: TableName[];
  onRefresh: () => void | Promise<void>;
};

export function useRealtimeRefresh({
  channel,
  tables,
  onRefresh,
}: UseRealtimeRefreshOptions) {
  useEffect(() => {
    const ch = supabase.channel(channel);

    tables.forEach((table) => {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        async () => {
          await onRefresh();
        }
      );
    });

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [channel, tables, onRefresh]);
}