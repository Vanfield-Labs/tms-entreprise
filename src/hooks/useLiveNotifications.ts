// src/hooks/useLiveNotifications.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AppNotification = {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent" | string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type Options = {
  userId?: string | null;
  limit?: number;
  enableSound?: boolean;
  enablePopup?: boolean;
};

const AUDIO_KEY = "tms-notification-sound-enabled";

function canPlaySound() {
  const raw = localStorage.getItem(AUDIO_KEY);
  return raw !== "false";
}

function sortAndLimitRows(rows: AppNotification[], limit: number) {
  return [...rows]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

function normalizeNotificationRow(row: any): AppNotification | null {
  if (
    !row?.id ||
    !row?.recipient_id ||
    !row?.title ||
    !row?.body ||
    !row?.created_at
  ) {
    return null;
  }

  return {
    id: String(row.id),
    recipient_id: String(row.recipient_id),
    title: String(row.title),
    body: String(row.body),
    priority: String(row.priority ?? "normal"),
    entity_type: row.entity_type ? String(row.entity_type) : null,
    entity_id: row.entity_id ? String(row.entity_id) : null,
    is_read: Boolean(row.is_read),
    read_at: row.read_at ? String(row.read_at) : null,
    created_at: String(row.created_at),
  };
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function useLiveNotifications({
  userId,
  limit = 30,
  enableSound = true,
  enablePopup = true,
}: Options) {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const previousTopId = useRef<string | null>(null);
  const mounted = useRef(true);
  const toastTimeout = useRef<number | null>(null);

  const unread = useMemo(
    () => rows.reduce((n, row) => n + (row.is_read ? 0 : 1), 0),
    [rows]
  );

  const queueToast = useCallback(
    (notification: AppNotification) => {
      if (enableSound && canPlaySound()) {
        try {
          const audio = new Audio("/notification.mp3");
          void audio.play();
        } catch {}
      }

      if (!enablePopup) return;

      setToast(notification);

      if (toastTimeout.current !== null) {
        window.clearTimeout(toastTimeout.current);
      }

      toastTimeout.current = window.setTimeout(() => {
        setToast((current) =>
          current?.id === notification.id ? null : current
        );
      }, 4200);
    },
    [enablePopup, enableSound]
  );

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id,recipient_id,title,body,priority,entity_type,entity_id,is_read,read_at,created_at"
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!mounted.current) return;

    if (error) {
      console.error("Notification load failed:", error);
      setLoading(false);
      return;
    }

    const incoming = (((data ?? []) as any[]) || [])
      .map(normalizeNotificationRow)
      .filter((row): row is AppNotification => row !== null);
    const newTop = incoming[0]?.id ?? null;
    const hasNewTop =
      previousTopId.current !== null &&
      newTop !== null &&
      newTop !== previousTopId.current;

    setRows(incoming);
    setLoading(false);

    if (hasNewTop) {
      const newest = incoming[0];
      if (newest) queueToast(newest);
    }

    previousTopId.current = newTop;
  }, [userId, limit, queueToast]);

  const markRead = useCallback(async (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, is_read: true, read_at: new Date().toISOString() }
          : row
      )
    );

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        is_read: true,
        read_at: row.read_at ?? new Date().toISOString(),
      }))
    );

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("recipient_id", userId)
      .eq("is_read", false);
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await supabase.from("notifications").delete().eq("recipient_id", userId);
    setRows([]);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (toastTimeout.current !== null) {
        window.clearTimeout(toastTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted.current) return;

          if (payload.eventType === "INSERT") {
            const incoming = normalizeNotificationRow(payload.new);
            if (!incoming) {
              void load();
              return;
            }

            previousTopId.current = incoming.id;
            setRows((prev) =>
              sortAndLimitRows(
                [incoming, ...prev.filter((row) => row.id !== incoming.id)],
                limit
              )
            );
            queueToast(incoming);
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = normalizeNotificationRow(payload.new);
            if (!updated) {
              void load();
              return;
            }

            setRows((prev) => {
              const next = prev.some((row) => row.id === updated.id)
                ? prev.map((row) => (row.id === updated.id ? updated : row))
                : [updated, ...prev];

              const normalized = sortAndLimitRows(next, limit);
              previousTopId.current = normalized[0]?.id ?? null;
              return normalized;
            });
            return;
          }

          if (payload.eventType === "DELETE") {
            const deletedId = String(payload.old?.id ?? "");
            if (!deletedId) {
              void load();
              return;
            }

            setRows((prev) => {
              const next = prev.filter((row) => row.id !== deletedId);
              previousTopId.current = next[0]?.id ?? null;
              return next;
            });
            setToast((current) => (current?.id === deletedId ? null : current));
            return;
          }

          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load, limit, queueToast]);

  return {
    rows,
    loading,
    unread,
    toast,
    setToast,
    load,
    markRead,
    markAllRead,
    clearAll,
  };
}
