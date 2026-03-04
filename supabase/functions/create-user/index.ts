// supabase/functions/create-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    console.log("=== create-user called ===");

    // 1. Get the Bearer token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("ERROR: No Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - no token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    console.log("Token received, length:", token.length);

    // 2. Use service role client to verify the JWT — more reliable than anon client
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      console.log("ERROR: Could not verify user -", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized - " + (authError?.message ?? "bad token") }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.log("Caller verified:", caller.id);

    // 3. Check caller is admin (using service role to bypass RLS)
    const { data: callerProfile, error: profileCheckErr } = await adminClient
      .from("profiles")
      .select("system_role")
      .eq("user_id", caller.id)
      .single();

    console.log("Caller profile:", callerProfile, "Error:", profileCheckErr?.message);

    if (!callerProfile || callerProfile.system_role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden - admin role required" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 4. Parse request body
    const body = await req.json();
    console.log("Request body fields:", Object.keys(body));

    const { email, password, full_name, system_role, division_id, unit_id, position_title, request_id } = body;

    if (!email || !password || !full_name || !system_role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, full_name, system_role" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 5. Create the new auth user
    console.log("Creating auth user:", email);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.log("ERROR creating auth user:", createError.message);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;
    console.log("Auth user created:", newUserId);

    // 6. Create their profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: newUserId,
      full_name,
      system_role,
      division_id: division_id || null,
      unit_id: unit_id || null,
      position_title: position_title || null,
      status: "active",
    });

    if (profileError) {
      console.log("ERROR creating profile:", profileError.message);
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Profile error: " + profileError.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log("Profile created successfully");

    // 7. Mark user_request as approved if this came from a pending request
    if (request_id) {
      await adminClient
        .from("user_requests")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
          resolved_user_id: newUserId,
        })
        .eq("id", request_id);
    }

    console.log("=== create-user SUCCESS ===");
    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.log("UNHANDLED ERROR:", err.message);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});