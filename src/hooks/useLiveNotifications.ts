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

  const unread = useMemo(
    () => rows.reduce((n, row) => n + (row.is_read ? 0 : 1), 0),
    [rows]
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

    const incoming = ((data ?? []) as AppNotification[]) || [];
    const newTop = incoming[0]?.id ?? null;
    const hasNewTop =
      previousTopId.current !== null &&
      newTop !== null &&
      newTop !== previousTopId.current;

    setRows(incoming);
    setLoading(false);

    if (hasNewTop) {
      const newest = incoming[0];
      if (enableSound && canPlaySound()) {
        try {
          const audio = new Audio("/notification.mp3");
          void audio.play();
        } catch {}
      }

      if (enablePopup && newest) {
        setToast(newest);
        window.setTimeout(() => {
          setToast((current) => (current?.id === newest.id ? null : current));
        }, 4200);
      }
    }

    previousTopId.current = newTop;
  }, [userId, limit, enableSound, enablePopup]);

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
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

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