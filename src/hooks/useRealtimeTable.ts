import { useEffect, useRef } from "react";
import { subscribeToTable } from "@/lib/realtime";

type UseRealtimeTableOptions = {
  table: string;
  filter?: string;
  enabled?: boolean;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  onChange: () => void | Promise<void>;
};

export function useRealtimeTable({
  table,
  filter,
  enabled = true,
  event = "*",
  onChange,
}: UseRealtimeTableOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToTable({
      table,
      filter,
      event,
      onChange: () => {
        void onChangeRef.current();
      },
    });

    return unsubscribe;
  }, [table, filter, enabled, event]);
}