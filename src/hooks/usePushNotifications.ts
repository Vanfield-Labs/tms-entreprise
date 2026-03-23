// src/hooks/usePushNotifications.ts
// Manages FCM push notification subscription lifecycle.
// Requires Firebase JS SDK initialized with your project config.

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission:  PermissionState;
  isSubscribed: boolean;
  subscribe:   () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

// ── Firebase config — fill in from your Firebase project ─────────────────────
// Store these in .env as VITE_FIREBASE_* variables
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Lazy-load Firebase to avoid bundling it unless needed
let firebaseMessaging: any = null;

async function getFirebaseMessaging() {
  if (firebaseMessaging) return firebaseMessaging;
  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js" as any);
    const { getMessaging } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js" as any);
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp(FIREBASE_CONFIG);
    firebaseMessaging = getMessaging(app);
    return firebaseMessaging;
  } catch {
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
  const [isSubscribed, setIsSubscribed] = useState(() => {
    return localStorage.getItem("tms-push-subscribed") === "true";
  });

  const getDeviceLabel = (): string => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return "Safari on iOS";
    if (/Android/.test(ua)) return "Chrome on Android";
    if (/Chrome/.test(ua)) return "Chrome on Desktop";
    if (/Firefox/.test(ua)) return "Firefox";
    if (/Safari/.test(ua)) return "Safari";
    return "Unknown browser";
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") return false;

      // Get Firebase messaging
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.error("[Push] Firebase messaging not available");
        return false;
      }

      // Get FCM token
      const { getToken } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js" as any);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) return false;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Upsert token to Supabase
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id:      user.id,
        fcm_token:    token,
        device_label: getDeviceLabel(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id,fcm_token" });

      if (error) {
        console.error("[Push] Failed to save token:", error.message);
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
        await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
      }
      localStorage.removeItem("tms-push-subscribed");
      setIsSubscribed(false);
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
    }
  }, []);

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}