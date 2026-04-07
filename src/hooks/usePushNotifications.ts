import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: PermissionState;
  isSubscribed: boolean;
  checkedSubscription: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

// Firebase config (from Vercel env)
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// cache messaging instance
let messagingInstance: any = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;

  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js" as any);
    const { getMessaging } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js" as any);

    const apps = getApps();
    const app = apps.length ? apps[0] : initializeApp(FIREBASE_CONFIG);

    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error("[Push] Firebase init failed:", err);
    return null;
  }
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const [permission, setPermission] = useState<PermissionState>(
    isSupported ? (Notification.permission as PermissionState) : "unsupported"
  );

  const [isSubscribed, setIsSubscribed] = useState(
    () => localStorage.getItem("tms-push-subscribed") === "true"
  );
  const [checkedSubscription, setCheckedSubscription] = useState(!isSupported);

  const getDeviceLabel = () => {
    const ua = navigator.userAgent;
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Chrome/.test(ua)) return "Chrome Desktop";
    return "Web";
  };

  useEffect(() => {
    if (!isSupported) return;

    let alive = true;

    const syncSubscriptionState = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (!user) {
          setIsSubscribed(false);
          setCheckedSubscription(true);
          return;
        }

        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("user_id")
          .eq("user_id", user.id)
          .limit(1);

        if (!alive) return;

        const hasSubscription = !error && Array.isArray(data) && data.length > 0;
        setIsSubscribed(hasSubscription);

        if (hasSubscription) {
          localStorage.setItem("tms-push-subscribed", "true");
        } else {
          localStorage.removeItem("tms-push-subscribed");
        }
      } catch {
        if (!alive) return;
        setIsSubscribed(localStorage.getItem("tms-push-subscribed") === "true");
      } finally {
        if (alive) setCheckedSubscription(true);
      }
    };

    void syncSubscriptionState();

    return () => {
      alive = false;
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // 1. request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") return false;

      // 2. init firebase messaging
      const messaging = await getMessagingInstance();
      if (!messaging) return false;

      // 3. register YOUR existing service worker
      const sw = await navigator.serviceWorker.register("/sw.js");

      // 4. get token using YOUR sw.js
      const { getToken } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js" as any);

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      });

      if (!token) {
        console.error("[Push] No token received");
        return false;
      }

      // 5. get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 6. save token
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          fcm_token: token,
          device_label: getDeviceLabel(),
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "user_id,fcm_token" });

      if (error) {
        console.error("[Push] DB error:", error.message);
        return false;
      }

      localStorage.setItem("tms-push-subscribed", "true");
      setIsSubscribed(true);

      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id);
      }

      localStorage.removeItem("tms-push-subscribed");
      setIsSubscribed(false);
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    checkedSubscription,
    subscribe,
    unsubscribe,
  };
}
