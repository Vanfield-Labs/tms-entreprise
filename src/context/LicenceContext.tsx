// src/context/LicenceContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Licence = {
  id: string;
  client_name: string;
  licence_key: string;
  tier: string;
  features_enabled: string[];
  max_users: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  grace_period_days: number;
};

interface LicenceContextValue {
  licence:       Licence | null;
  loading:       boolean;
  isValid:       boolean;
  isExpired:     boolean;
  isGracePeriod: boolean;
  daysRemaining: number | null;
  hasFeature:    (feature: string) => boolean;
}

const LicenceContext = createContext<LicenceContextValue>({
  licence:       null,
  loading:       true,
  isValid:       true,
  isExpired:     false,
  isGracePeriod: false,
  daysRemaining: null,
  hasFeature:    () => true, // fail-open default
});

const CACHE_KEY    = "tms_licence_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function loadCache(): Licence | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { licence, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return licence as Licence;
  } catch { return null; }
}

function saveCache(lic: Licence) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ licence: lic, cachedAt: Date.now() })); }
  catch {}
}

export function LicenceProvider({ children }: { children: ReactNode }) {
  const cached = loadCache();
  const [licence, setLicence] = useState<Licence | null>(cached);
  const [loading, setLoading] = useState<boolean>(cached === null);

  useEffect(() => {
    // Already have a fresh cache — nothing to do
    if (loadCache()) { setLoading(false); return; }

    // Wait for auth session before querying (RLS requires authenticated role)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Not logged in yet — don't block, just stop loading
        setLoading(false);
        return;
      }
      supabase
        .from("licences")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setLicence(data as Licence);
            saveCache(data as Licence);
          }
          setLoading(false);
        });
    });
  }, []);

  const now        = new Date();
  const validUntil = licence ? new Date(licence.valid_until) : null;
  const daysRemaining = validUntil
    ? Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired     = daysRemaining !== null && daysRemaining < -(licence?.grace_period_days ?? 7);
  const isGracePeriod = daysRemaining !== null && daysRemaining < 0 && !isExpired;
  const isValid       = licence ? (licence.is_active && !isExpired) : true;

  // FAIL-OPEN: if still loading or no licence, return true so nothing is blocked
  const hasFeature = (feature: string): boolean => {
    if (loading || !licence) return true;
    return licence.features_enabled.includes(feature);
  };

  return (
    <LicenceContext.Provider value={{
      licence, loading, isValid, isExpired, isGracePeriod, daysRemaining, hasFeature,
    }}>
      {children}
    </LicenceContext.Provider>
  );
}

export function useLicence() { return useContext(LicenceContext); }