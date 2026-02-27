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

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
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
    const publicPaths = ["/login"];
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