// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export type Profile = {
  user_id: string;
  full_name: string;
  system_role: string;
  status: string;
  division_id: string | null;
  unit_id: string | null;
  position_title?: string | null;
};

// ── Inactivity flag ───────────────────────────────────────────────────────────
const INACTIVITY_FLAG = "tms_inactivity_logout";
export function setInactivityFlag() {
  try { sessionStorage.setItem(INACTIVITY_FLAG, "1"); } catch {}
}
export function consumeInactivityFlag(): boolean {
  try {
    const val = sessionStorage.getItem(INACTIVITY_FLAG);
    if (val) { sessionStorage.removeItem(INACTIVITY_FLAG); return true; }
  } catch {}
  return false;
}

// ── useAuth ───────────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(data ?? null);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    // Safety net: never spin forever — force loading=false after 6s
    const safetyTimeout = setTimeout(() => setLoading(false), 6000);

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).finally(() => {
          clearTimeout(safetyTimeout);
          setLoading(false);
        });
      } else {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}

// ── useAuthGuard ──────────────────────────────────────────────────────────────
export function useAuthGuard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (auth.loading) return;
    const publicPaths = ["/login", "/2fa"];
    const isPublic = publicPaths.includes(location.pathname);
    if (!auth.user && !isPublic) {
      navigate("/login", { replace: true, state: { from: location } });
    }
    if (auth.user && isPublic) {
      const from = (location.state as any)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    }
  }, [auth.loading, auth.user, location.pathname]);

  return auth;
}