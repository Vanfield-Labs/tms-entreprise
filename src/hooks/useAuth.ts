// src/hooks/useAuth.ts
import { useEffect, useRef, useState } from "react";
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

const INACTIVITY_MS   = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_KEY  = "tms-inactivity-signout";
const LAST_ACTIVE_KEY = "tms-last-active";

function touchActivity() {
  sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

function isInactive(): boolean {
  const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
  if (!last) return false;
  return Date.now() - last > INACTIVITY_MS;
}

async function recordLoginEvent(
  userId: string | null,
  email: string | null,
  event: string
) {
  try {
    await supabase.rpc("record_login_event", {
      p_user_id:    userId,
      p_email:      email,
      p_event:      event,
      p_ip:         null,
      p_user_agent: navigator.userAgent.slice(0, 250),
    });
  } catch {
    // Non-fatal — don't block auth flow
  }
}

export function useAuth() {
  const [user,    setUser]    = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data ?? null);
  };

  // ── Inactivity sign-out ───────────────────────────────────────────────────
  const resetInactivityTimer = () => {
    touchActivity();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(async () => {
      // Double-check inactivity before signing out
      if (isInactive()) {
        sessionStorage.setItem(INACTIVITY_KEY, "1");
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) await recordLoginEvent(u.id, u.email ?? null, "session_expired");
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    }, INACTIVITY_MS);
  };

  const startActivityTracking = () => {
    touchActivity();
    const events = ["click", "keypress", "scroll", "mousemove", "touchstart"];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
  };

  useEffect(() => {
    let stopTracking: (() => void) | null = null;

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false));
        stopTracking = startActivityTracking();
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id);
        if (!stopTracking) stopTracking = startActivityTracking();
        // Record login on new session
        if (_event === "SIGNED_IN") {
          await recordLoginEvent(u.id, u.email ?? null, "login_success");
        }
      } else {
        setProfile(null);
        setLoading(false);
        if (stopTracking) { stopTracking(); stopTracking = null; }
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      if (stopTracking) stopTracking();
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  return { user, profile, loading };
}

/** Hook that also handles redirect-on-login / redirect-on-logout */
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
    if (auth.user && location.pathname === "/login") {
      const from = (location.state as any)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    }
  }, [auth.loading, auth.user, location.pathname]);

  return auth;
}

/** Expose inactivity flag for Login page to display message */
export function consumeInactivityFlag(): boolean {
  const flag = sessionStorage.getItem(INACTIVITY_KEY) === "1";
  if (flag) sessionStorage.removeItem(INACTIVITY_KEY);
  return flag;
}