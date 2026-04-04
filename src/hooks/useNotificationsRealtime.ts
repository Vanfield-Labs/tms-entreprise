import { useRealtimeTable } from "@/hooks/useRealtimeTable";

export function useNotificationsRealtime(
  userId: string | undefined,
  reload: () => void | Promise<void>
) {
  useRealtimeTable({
    table: "notifications",
    filter: userId ? `recipient_id=eq.${userId}` : undefined,
    enabled: !!userId,
    event: "*",
    onChange: reload,
  });
}
