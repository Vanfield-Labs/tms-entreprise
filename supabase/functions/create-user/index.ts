// supabase/functions/create-user/index.ts
// Deploy: supabase functions deploy create-user

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateUserPayload = {
  email: string;
  password: string;
  full_name: string;
  system_role: string;
  division_id?: string | null;
  unit_id?: string | null;
  position_title?: string | null;
  request_id?: string | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let createdUserId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return json(401, { error: "Unauthorized — no bearer token" });
    }

    const {
      data: { user: caller },
      error: callerErr,
    } = await adminClient.auth.getUser(token);

    if (callerErr || !caller) {
      return json(401, {
        error: "Unauthorized — " + (callerErr?.message ?? "invalid token"),
      });
    }

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("system_role")
      .eq("user_id", caller.id)
      .single();

    if (profileErr || !callerProfile || callerProfile.system_role !== "admin") {
      return json(403, { error: "Forbidden — admin role required" });
    }

    const body = (await req.json()) as CreateUserPayload;

    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const full_name = body.full_name?.trim();
    const system_role = body.system_role?.trim();
    const division_id = body.division_id ?? null;
    const unit_id = body.unit_id ?? null;
    const position_title = body.position_title?.trim() || null;
    const request_id = body.request_id ?? null;

    if (!email || !password || !full_name || !system_role) {
      return json(400, {
        error: "email, password, full_name and system_role are required",
      });
    }

    if (password.length < 8) {
      return json(400, { error: "Password must be at least 8 characters" });
    }

    const allowedRoles = new Set([
      "staff",
      "unit_head",
      "driver",
      "transport_supervisor",
      "corporate_approver",
      "admin",
    ]);

    if (!allowedRoles.has(system_role)) {
      return json(400, { error: "Invalid system_role" });
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("full_name", full_name)
      .limit(1);

    void existingProfile; // keeps lint calm if unused by your deploy target

    const { data: createdUser, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          system_role,
        },
      });

    if (createErr || !createdUser.user) {
      return json(400, { error: createErr?.message ?? "Failed to create auth user" });
    }

    createdUserId = createdUser.user.id;

    const { error: insertProfileErr } = await adminClient.from("profiles").insert({
      user_id: createdUserId,
      full_name,
      system_role,
      status: "active",
      division_id,
      unit_id,
      position_title,
    });

    if (insertProfileErr) {
      await adminClient.auth.admin.deleteUser(createdUserId);
      return json(400, { error: insertProfileErr.message });
    }

    if (system_role === "driver") {
      const { error: driverInsertErr } = await adminClient.from("drivers").insert({
        user_id: createdUserId,
        employment_status: "active",
      });

      if (driverInsertErr) {
        await adminClient.from("profiles").delete().eq("user_id", createdUserId);
        await adminClient.auth.admin.deleteUser(createdUserId);
        return json(400, { error: driverInsertErr.message });
      }
    }

    if (request_id) {
      const { error: requestErr } = await adminClient
        .from("user_requests")
        .update({ status: "approved" })
        .eq("id", request_id);

      if (requestErr) {
        await adminClient.from("drivers").delete().eq("user_id", createdUserId);
        await adminClient.from("profiles").delete().eq("user_id", createdUserId);
        await adminClient.auth.admin.deleteUser(createdUserId);
        return json(400, { error: requestErr.message });
      }
    }

    console.log(
      `[create-user] admin=${caller.id} created user=${createdUserId} role=${system_role} email=${email}`
    );

    return json(200, {
      success: true,
      user_id: createdUserId,
    });
  } catch (err: any) {
    if (createdUserId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        await adminClient.from("drivers").delete().eq("user_id", createdUserId);
        await adminClient.from("profiles").delete().eq("user_id", createdUserId);
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch {
        // best-effort rollback only
      }
    }

    console.error("[create-user] unhandled:", err?.message ?? err);
    return json(500, { error: err?.message ?? "Internal server error" });
  }
});