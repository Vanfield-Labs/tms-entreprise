// src/context/LicenceContext.tsx
// KEY FIXES:
// 1. Waits for auth session before querying licences table
//    (RLS policy is `authenticated` only — anon queries fail silently)
// 2. Fail-open: if licence can't be loaded, hasFeature() returns TRUE
//    so the app never gets stuck on "Feature Not Available"
// 3. Uses localStorage (not sessionStorage) so cache survives tab close

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
  isValid:       true,   // fail-open default
  isExpired:     false,
  isGracePeriod: false,
  daysRemaining: null,
  hasFeature:    () => true, // fail-open: never block if context not ready
});

const CACHE_KEY    = "tms_licence_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (localStorage survives tab close)

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
  } catch {
    return null;
  }
}

function saveCache(licence: Licence) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ licence, cachedAt: Date.now() }));
  } catch {}
}

export function LicenceProvider({ children }: { children: ReactNode }) {
  const cached = loadCache();
  const [licence, setLicence] = useState<Licence | null>(cached);
  // If we have a valid cache, start with loading=false immediately
  const [loading, setLoading] = useState<boolean>(cached === null);

  useEffect(() => {
    // If already cached and fresh, don't refetch
    if (loadCache()) return;

    // Wait for the auth session to be ready before querying
    // This ensures the query runs as `authenticated` not `anon`
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Not logged in — don't query, but don't block the app either
        // The Login page doesn't use LicenceGate so this is fine
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
          // Whether success or error, stop loading
          // On error: licence stays null → fail-open (hasFeature returns true)
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
  // isValid is true if: licence loaded AND active AND not expired
  // OR if licence couldn't be loaded (fail-open)
  const isValid = licence ? (licence.is_active && !isExpired) : true;

  const hasFeature = (feature: string): boolean => {
    // FAIL-OPEN: if still loading or licence null, return true
    // This prevents the app from blocking on licence fetch failures
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

export function useLicence() {
  return useContext(LicenceContext);
}