// src/context/LicenceContext.tsx
// Fetches and caches the active licence. Provides useLicence() hook app-wide.

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
  licence:        Licence | null;
  loading:        boolean;
  isValid:        boolean;
  isExpired:      boolean;
  isGracePeriod:  boolean;
  daysRemaining:  number | null;
  hasFeature:     (feature: string) => boolean;
}

const LicenceContext = createContext<LicenceContextValue>({
  licence:       null,
  loading:       true,
  isValid:       false,
  isExpired:     false,
  isGracePeriod: false,
  daysRemaining: null,
  hasFeature:    () => false,
});

const CACHE_KEY      = "tms-licence-cache";
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

function loadCache(): { licence: Licence; cachedAt: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(licence: Licence) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ licence, cachedAt: Date.now() }));
  } catch {}
}

export function LicenceProvider({ children }: { children: ReactNode }) {
  const [licence, setLicence] = useState<Licence | null>(() => loadCache()?.licence ?? null);
  const [loading, setLoading] = useState(!loadCache());

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setLicence(cached.licence);
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
  }, []);

  const now        = new Date();
  const validUntil = licence ? new Date(licence.valid_until) : null;
  const validFrom  = licence ? new Date(licence.valid_from)  : null;

  const daysRemaining = validUntil
    ? Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired     = daysRemaining !== null && daysRemaining < -(licence?.grace_period_days ?? 7);
  const isGracePeriod = daysRemaining !== null && daysRemaining < 0 && !isExpired;
  const isValid       = !!licence && licence.is_active && !isExpired;

  const hasFeature = (feature: string): boolean => {
    if (!licence) return false;
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