// src/hooks/useAuth.ts
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, cachedFetch } from "../lib/supabase";

export type Profile = {
  user_id: string;
  full_name: string;
  system_role: string;
  status: string;
  division_id: string | null;
  unit_id: string | null;
  position_title?: string | null;
};

const INACTIVITY_FLAG = "tms_inactivity_logout";

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

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string, force = false) => {
    try {
      const data = await cachedFetch<Profile | null>(
        `profile:${userId}`,
        async () => {
          const { data } = await supabase
            .from("profiles")
            .select(
              "user_id, full_name, system_role, status, division_id, unit_id, position_title"
            )
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
        const u = data.session?.user ?? null;
        if (!mountedRef.current) return;

        setUser(u);

        if (u) {
          fetchProfile(u.id).finally(() => {
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      if (!mountedRef.current) return;

      setUser(u);

      if (u) {
        fetchProfile(u.id, true).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
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

  return { user, profile, loading };
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