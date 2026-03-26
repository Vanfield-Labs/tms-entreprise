import { supabase } from "@/lib/supabase";

type RealtimeTableOptions = {
  schema?: string;
  table: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  channelName?: string;
  onChange: () => void;
};

export function subscribeToTable({
  schema = "public",
  table,
  filter,
  event = "*",
  channelName,
  onChange,
}: RealtimeTableOptions) {
  const name = channelName ?? `rt:${schema}:${table}:${filter ?? "all"}`;

  const channel = supabase
    .channel(name)
    .on(
      "postgres_changes",
      {
        event,
        schema,
        table,
        ...(filter ? { filter } : {}),
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}