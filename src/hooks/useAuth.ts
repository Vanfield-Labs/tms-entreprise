import { createContext, createElement, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, cachedFetch } from "../lib/supabase";
import {
  consumePendingSignOutReason,
  flushPendingSecurityEvents,
  logSecurityEvent,
  markNextSignOutReason,
} from "@/services/securityLog.service";

export type Profile = {
  user_id: string;
  full_name: string;
  system_role: string;
  status: string;
  division_id: string | null;
  unit_id: string | null;
  position_title?: string | null;
};

type AuthContextValue = {
  user: any;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const INACTIVITY_FLAG = "tms_inactivity_logout";
const INACTIVITY_MS = 30 * 60 * 1000;
const LAST_ACTIVE_KEY = "tms-last-active";

function touchActivity() {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {}
}

function isInactive() {
  try {
    const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
    if (!last) return false;
    return Date.now() - last > INACTIVITY_MS;
  } catch {
    return false;
  }
}

export function setInactivityFlag() {
  try {
    sessionStorage.setItem(INACTIVITY_FLAG, "1");
  } catch {}
}

export function consumeInactivityFlag(): boolean {
  try {
    const val = sessionStorage.getItem(INACTIVITY_FLAG);
    if (val) {
      sessionStorage.removeItem(INACTIVITY_FLAG);
      return true;
    }
  } catch {}
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const previousUserRef = useRef<any>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = async (userId: string, force = false) => {
    try {
      const data = await cachedFetch<Profile | null>(
        `profile:${userId}`,
        async () => {
          const { data } = await supabase
            .from("profiles")
            .select("user_id, full_name, system_role, status, division_id, unit_id, position_title")
            .eq("user_id", userId)
            .single();

          return (data as Profile | null) ?? null;
        },
        force
      );

      if (mountedRef.current) setProfile(data);
    } catch {
      if (mountedRef.current) setProfile(null);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 6000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const sessionUser = data.session?.user ?? null;
        if (!mountedRef.current) return;

        setUser(sessionUser);

        if (sessionUser) {
          previousUserRef.current = sessionUser;
          void flushPendingSecurityEvents({ id: sessionUser.id, email: sessionUser.email ?? null });
          fetchProfile(sessionUser.id).finally(() => {
            clearTimeout(safetyTimeout);
            if (mountedRef.current) setLoading(false);
          });
        } else {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      })
      .catch(() => {
        clearTimeout(safetyTimeout);
        if (mountedRef.current) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;
      const previousUser = previousUserRef.current;

      if (!mountedRef.current) return;

      setUser(sessionUser);

      if (sessionUser) {
        const isNewLogin = event === "SIGNED_IN" && previousUser?.id !== sessionUser.id;

        previousUserRef.current = sessionUser;
        void flushPendingSecurityEvents({ id: sessionUser.id, email: sessionUser.email ?? null });

        if (isNewLogin) {
          void logSecurityEvent({
            event: "login_success",
            userId: sessionUser.id,
            email: sessionUser.email ?? null,
          });
        }

        fetchProfile(sessionUser.id, true).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
        if (event === "SIGNED_OUT" && previousUser) {
          void logSecurityEvent({
            event: consumePendingSignOutReason() ?? "session_expired",
            userId: previousUser.id,
            email: previousUser.email ?? null,
          });
        }

        previousUserRef.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    const resetInactivityTimer = () => {
      touchActivity();

      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

      inactivityTimerRef.current = setTimeout(async () => {
        if (!isInactive()) return;

        setInactivityFlag();
        markNextSignOutReason("session_expired");
        await supabase.auth.signOut();
        window.location.href = "/login";
      }, INACTIVITY_MS);
    };

    const activityEvents: (keyof WindowEventMap)[] = ["click", "keypress", "scroll", "mousemove", "touchstart"];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });

      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user?.id]);

  return createElement(AuthContext.Provider, { value: { user, profile, loading } }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}

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
  }, [auth.loading, auth.user, location.pathname, navigate, location]);

  return auth;
}
