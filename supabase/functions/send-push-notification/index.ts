// supabase/functions/send-push-notification/index.ts
// Sends FCM push notifications to all devices registered for a user.
// Requires FIREBASE_SERVICE_ACCOUNT_JSON set as a Supabase secret.
// Deploy: supabase functions deploy send-push-notification

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Get FCM OAuth2 access token from service account ──────────────────────────
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  // Encode JWT parts
  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const headerB64  = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemKey = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get FCM access token");
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { user_id, title, body, data = {} } = await req.json() as {
      user_id: string;
      title:   string;
      body:    string;
      data?:   Record<string, string>;
    };

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "user_id, title, and body are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get FCM tokens for this user
    const { data: subs, error: subsErr } = await adminClient
      .from("push_subscriptions")
      .select("id, fcm_token")
      .eq("user_id", user_id);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No devices registered" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Load Firebase service account
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not set");
    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;
    const accessToken = await getFcmAccessToken(serviceAccount);

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    let failed = 0;
    const staleTokenIds: string[] = [];

    // Send to each device
    for (const sub of subs as { id: string; fcm_token: string }[]) {
      const message = {
        message: {
          token: sub.fcm_token,
          notification: { title, body },
          data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
          webpush: {
            notification: { title, body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" },
            fcm_options: { link: data.url || "/" },
          },
        },
      };

      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (res.ok) {
        sent++;
        // Update last_seen_at
        await adminClient
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sub.id);
      } else {
        const errData = await res.json();
        const errCode = errData?.error?.details?.[0]?.errorCode;
        // Mark stale tokens for cleanup
        if (errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
          staleTokenIds.push(sub.id);
        }
        failed++;
        console.error(`FCM send failed for token ${sub.id}:`, errData);
      }
    }

    // Clean up stale tokens
    if (staleTokenIds.length > 0) {
      await adminClient.from("push_subscriptions").delete().in("id", staleTokenIds);
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[send-push-notification]", err.message);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});