// src/components/NotificationBell.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type NotificationType = "booking" | "fuel" | "maintenance" | "user" | "system";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  user_id?: string;
  link_entity?: string;
  link_id?: string;
};

const TYPE_ICON: Record<NotificationType | "default", string> = {
  booking: "📋",
  fuel: "⛽",
  maintenance: "🔧",
  user: "👤",
  system: "🔔",
  default: "🔔",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushActive, setPushActive] = useState(
    localStorage.getItem("tms-push-subscribed") === "true"
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const prevCountRef = useRef(0);

  const unread = useMemo(
    () => notifs.reduce((count, n) => count + (n.read ? 0 : 1), 0),
    [notifs]
  );

  const playSound = () => {
    try {
      new Audio("/notification.mp3").play();
    } catch {}
  };

  const load = useCallback(async () => {
    if (!user?.id) {
      setNotifs([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!mountedRef.current) return;

    if (error) {
      console.error("Notification load failed:", error);
      setLoading(false);
      return;
    }

    const incoming = (data as Notification[]) || [];

    // 🔊 sound only when NEW notification arrives
    if (incoming.length > prevCountRef.current) {
      playSound();
    }

    prevCountRef.current = incoming.length;

    setNotifs(incoming);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(
    () => debounce(() => void load(), 250),
    [load]
  );

  useRealtimeTable({
    table: "notifications",
    filter: user?.id ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user?.id,
    event: "*",
    onChange: debouncedReload,
  });

  const openNotification = async (n: Notification) => {
    // optimistic update
    setNotifs((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    );

    // mark read in DB
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);

    // 🔗 deep link
    if (n.link_id && n.link_entity) {
      window.dispatchEvent(
        new CustomEvent("tms:entity-focus", {
          detail: {
            entityId: n.link_id,
            entityType: n.link_entity,
          },
        })
      );
    }
  };

  const grouped = useMemo(() => {
    const today: Notification[] = [];
    const earlier: Notification[] = [];

    const todayStr = new Date().toDateString();

    notifs.forEach((n) => {
      if (new Date(n.created_at).toDateString() === todayStr) {
        today.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, earlier };
  }, [notifs]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl"
      >
        🔔

        {unread > 0 && (
          <span className="absolute top-1 right-1 text-[10px] bg-red-500 text-white rounded-full px-1">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-xl overflow-hidden z-50">
          {loading ? (
            <div className="p-4 text-center text-sm">Loading...</div>
          ) : (
            <div>
              {grouped.today.length > 0 && (
                <>
                  <p className="px-3 pt-2 text-xs text-gray-500">Today</p>
                  {grouped.today.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={`px-4 py-3 cursor-pointer ${
                        !n.read ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="text-sm font-semibold">{n.title}</div>
                      <div className="text-xs text-gray-500">{n.body}</div>
                      <div className="text-[10px] text-gray-400">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {grouped.earlier.length > 0 && (
                <>
                  <p className="px-3 pt-2 text-xs text-gray-500">Earlier</p>
                  {grouped.earlier.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={`px-4 py-3 cursor-pointer ${
                        !n.read ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="text-sm font-semibold">{n.title}</div>
                      <div className="text-xs text-gray-500">{n.body}</div>
                      <div className="text-[10px] text-gray-400">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}