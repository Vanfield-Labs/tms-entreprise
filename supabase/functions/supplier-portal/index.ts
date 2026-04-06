import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const VERIFY_WINDOW_MINUTES = 15;
const VERIFY_MAX_FAILURES = 5;
const ACTION_WINDOW_MINUTES = 10;
const ACTION_MAX_REQUESTS = 30;

type SupplierPortalPayload =
  | { action: "verify_pin"; pin: string }
  | { action: "get_status"; token: string }
  | {
      action: "renew";
      token: string;
      valid_until: string;
      max_users?: number | null;
      tier?: string | null;
      features?: string[] | null;
    }
  | { action: "deactivate"; token: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getUserAgent(req: Request) {
  return req.headers.get("user-agent") ?? "unknown";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function recordAttempt(
  adminClient: ReturnType<typeof createClient>,
  action: string,
  identifier: string,
  success: boolean,
  detail?: Record<string, unknown> | null
) {
  await adminClient.from("supplier_portal_attempts").insert({
    action,
    identifier_hash: identifier,
    success,
    detail: detail ?? null,
  });
}

async function countAttempts(
  adminClient: ReturnType<typeof createClient>,
  action: string,
  identifier: string,
  success: boolean,
  minutes: number
) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count, error } = await adminClient
    .from("supplier_portal_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("identifier_hash", identifier)
    .eq("success", success)
    .gte("created_at", since);

  if (error) throw error;
  return Number(count ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing Supabase configuration" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = (await req.json()) as SupplierPortalPayload;
    const action = payload?.action;

    if (!action) {
      return json(400, { error: "Action is required" });
    }

    const identifier = await sha256(`${getIp(req)}|${getUserAgent(req)}`);

    const recentRequests = await countAttempts(
      adminClient,
      `request:${action}`,
      identifier,
      true,
      ACTION_WINDOW_MINUTES
    );

    if (recentRequests >= ACTION_MAX_REQUESTS) {
      return json(429, {
        error: "Too many requests. Please wait a few minutes and try again.",
      });
    }

    await recordAttempt(adminClient, `request:${action}`, identifier, true);

    if (action === "verify_pin") {
      const failedAttempts = await countAttempts(
        adminClient,
        "verify_pin",
        identifier,
        false,
        VERIFY_WINDOW_MINUTES
      );

      if (failedAttempts >= VERIFY_MAX_FAILURES) {
        return json(429, {
          error: "Too many invalid PIN attempts. Please wait 15 minutes and try again.",
        });
      }

      const pin = payload.pin?.trim();
      if (!pin) {
        return json(400, { error: "PIN is required" });
      }

      const { data, error } = await adminClient.rpc("supplier_verify_pin", {
        p_pin: pin,
      });

      const success = Boolean(data?.success) && !error;
      await recordAttempt(adminClient, "verify_pin", identifier, success);

      if (error || !data?.success) {
        return json(401, { error: data?.error ?? error?.message ?? "Invalid PIN" });
      }

      return json(200, data as Record<string, unknown>);
    }

    const token = payload.token?.trim();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!token || !uuidPattern.test(token)) {
      return json(400, { error: "Invalid session token" });
    }

    if (action === "get_status") {
      const { data, error } = await adminClient.rpc("supplier_get_licence_status", {
        p_token: token,
      });

      if (error || !data?.success) {
        return json(401, {
          error: data?.error ?? error?.message ?? "Session expired. Please re-enter your PIN.",
        });
      }

      return json(200, data as Record<string, unknown>);
    }

    if (action === "renew") {
      const validUntil = payload.valid_until;
      const maxUsers = payload.max_users ?? null;
      const tier = payload.tier?.trim() || null;
      const features = payload.features ?? null;

      if (!validUntil) {
        return json(400, { error: "New expiry date is required" });
      }

      const validDate = new Date(validUntil);
      if (Number.isNaN(validDate.getTime())) {
        return json(400, { error: "Expiry date is invalid" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      validDate.setHours(0, 0, 0, 0);
      if (validDate < today) {
        return json(400, { error: "Expiry date cannot be in the past" });
      }

      if (maxUsers != null && (!Number.isInteger(maxUsers) || maxUsers < 1)) {
        return json(400, { error: "Max users must be a positive whole number" });
      }

      if (features && !Array.isArray(features)) {
        return json(400, { error: "Features must be an array" });
      }

      const { data, error } = await adminClient.rpc("supplier_renew_licence", {
        p_token: token,
        p_valid_until: validUntil,
        p_max_users: maxUsers,
        p_tier: tier,
        p_features: features,
      });

      if (error || !data?.success) {
        return json(400, {
          error: data?.error ?? error?.message ?? "Renewal failed",
        });
      }

      return json(200, data as Record<string, unknown>);
    }

    if (action === "deactivate") {
      const { data, error } = await adminClient.rpc("supplier_deactivate_licence", {
        p_token: token,
      });

      if (error || !data?.success) {
        return json(400, {
          error: data?.error ?? error?.message ?? "Deactivation failed",
        });
      }

      return json(200, data as Record<string, unknown>);
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    console.error("[supplier-portal]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});
