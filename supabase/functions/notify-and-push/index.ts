// supabase/functions/notify-and-push/index.ts
// Combined function: inserts a notification row AND sends a push notification.
// Call this from other edge functions instead of directly inserting to notifications.
// Deploy: supabase functions deploy notify-and-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const {
      user_id,
      title,
      body,
      type = "system",
      link_entity,
      link_id,
      data = {},
    } = await req.json() as {
      user_id:      string;
      title:        string;
      body:         string;
      type?:        string;
      link_entity?: string;
      link_id?:     string;
      data?:        Record<string, string>;
    };

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "user_id, title, and body are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 1. Insert notification into notifications table
    const { error: notifErr } = await adminClient.from("notifications").insert({
      user_id,
      title,
      body,
      type,
      link_entity: link_entity ?? null,
      link_id:     link_id ?? null,
      read:        false,
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
      body: JSON.stringify({ user_id, title, body, data: { ...data, url: link_id ? `/${link_entity}s/${link_id}` : "/" } }),
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