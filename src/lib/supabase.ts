// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (default — keeps users logged in)
    persistSession: true,
    // Automatically refresh the token before it expires
    autoRefreshToken: true,
    // Detect session from URL (needed for OAuth / magic links)
    detectSessionInUrl: true,
    // Use PKCE flow for better security
    flowType: "pkce",
  },
  global: {
    headers: {
      // Identify the client in Supabase logs
      "x-client-info": "tms-portal/2.0",
    },
  },
});