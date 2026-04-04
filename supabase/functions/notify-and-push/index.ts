// supabase/functions/notify-and-push/index.ts
// Combined function: inserts a notification row AND sends a push notification.
// Call this from other edge functions instead of directly inserting to notifications.
// Deploy: supabase functions deploy notify-and-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEntityType(value?: string | null) {
  switch (value) {
    case "fuel":
      return "fuel_request";
    case "maintenance":
      return "maintenance_request";
    case "user":
      return "user_request";
    case "incident":
      return "incident_report";
    default:
      return value ?? "system";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const {
      recipient_id,
      user_id,
      title,
      body,
      priority = "normal",
      entity_type,
      entity_id,
      type = "system",
      link_entity,
      link_id,
      data = {},
    } = await req.json() as {
      recipient_id?: string;
      user_id?:      string;
      title:         string;
      body:          string;
      priority?:     string;
      entity_type?:  string;
      entity_id?:    string;
      type?:         string;
      link_entity?:  string;
      link_id?:      string;
      data?:         Record<string, string>;
    };

    const recipientId = recipient_id ?? user_id;
    const normalizedEntityType = normalizeEntityType(
      entity_type ?? link_entity ?? type
    );
    const normalizedEntityId = entity_id ?? link_id ?? null;

    if (!recipientId || !title || !body) {
      return new Response(JSON.stringify({ error: "recipient_id, title, and body are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 1. Insert notification into notifications table
    const { error: notifErr } = await adminClient.from("notifications").insert({
      recipient_id: recipientId,
      title,
      body,
      priority,
      entity_type: normalizedEntityType ?? "system",
      entity_id: normalizedEntityId,
      is_read: false,
    });

    if (notifErr) {
      console.error("[notify-and-push] notification insert failed:", notifErr.message);
      // Don't throw — still try push
    }

    // 2. Send push notification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Use service role to call our own function
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
      body: JSON.stringify({
        user_id: recipientId,
        title,
        body,
        data: {
          ...data,
          entity_type: normalizedEntityType ?? "system",
          entity_id: normalizedEntityId ?? "",
          url:
            normalizedEntityType && normalizedEntityId
              ? `/${normalizedEntityType}/${normalizedEntityId}`
              : "/",
        },
      }),
    });

    const pushResult = pushRes.ok ? await pushRes.json() : { sent: 0, failed: 0, error: "push function failed" };

    return new Response(
      JSON.stringify({ notification_inserted: !notifErr, push: pushResult }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[notify-and-push]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
