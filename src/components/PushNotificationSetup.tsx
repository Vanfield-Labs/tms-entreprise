// src/components/PushNotificationSetup.tsx
// Shown once per user after login to prompt push subscription.
// The local dismissal state is reset automatically when the backend has no device subscription.

import { useEffect, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISSED_KEY = "tms-push-prompt-dismissed";

export function PushNotificationSetup() {
  const { isSupported, permission, isSubscribed, checkedSubscription, subscribe } = usePushNotifications();
  const [subscribing, setSubscribing] = useState(false);
  const [result, setResult] = useState<"success" | "denied" | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );

  useEffect(() => {
    if (!checkedSubscription || isSubscribed) return;
    localStorage.removeItem(DISMISSED_KEY);
    setDismissed(false);
  }, [checkedSubscription, isSubscribed]);

  // Wait until the backend subscription state has been checked.
  if (!isSupported || !checkedSubscription) return null;

  // Don't show if: already subscribed or already dismissed
  if (isSubscribed || dismissed) return null;

  // If permission already denied, show instructions
  if (permission === "denied") {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm flex items-start gap-3"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <span className="text-base shrink-0 mt-0.5">🔕</span>
        <div className="flex-1">
          <p className="font-medium" style={{ color: "var(--text)" }}>Push notifications are blocked</p>
          <p className="text-xs mt-0.5">To enable, click the lock icon in your browser's address bar and allow notifications for this site.</p>
        </div>
        <button
          onClick={() => { localStorage.setItem(DISMISSED_KEY, "true"); setDismissed(true); }}
          className="shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (result === "success") {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm flex items-center gap-3"
        style={{
          background: "var(--green-dim)",
          borderColor: "var(--green)",
          color: "var(--green)",
        }}
      >
        <span className="text-base shrink-0">✓</span>
        <p className="font-medium">Push notifications enabled — you'll be notified even when the app is closed.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border px-4 py-3 flex items-start gap-3"
      style={{
        background: "var(--accent-dim)",
        borderColor: "var(--accent)",
      }}
    >
      <span className="text-base shrink-0 mt-0.5">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Get notified even when the app is closed
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Enable push notifications for booking approvals, fuel requests, and more.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => {
              setSubscribing(true);
              const ok = await subscribe();
              setSubscribing(false);
              if (ok) {
                setResult("success");
                localStorage.setItem(DISMISSED_KEY, "true");
                setTimeout(() => setDismissed(true), 4000);
              } else {
                setResult("denied");
              }
            }}
            disabled={subscribing}
            className="btn btn-primary btn-sm"
          >
            {subscribing ? "Enabling…" : "Enable Notifications"}
          </button>
          <button
            onClick={() => { localStorage.setItem(DISMISSED_KEY, "true"); setDismissed(true); }}
            className="btn btn-ghost btn-sm"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
