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
  hasFeature:    () => true,
});

// ── Cache (localStorage — survives tab close and page refresh) ────────────────
const CACHE_KEY    = "tms-licence-v2";
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

function saveCache(licence: Licence) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ licence, cachedAt: Date.now() }));
  } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// ── Fetch the licence as a real Promise (bypasses PromiseLike issue) ──────────
// Wrapping in new Promise() gives TypeScript an unambiguous Promise<T>
// so it works cleanly with Promise.race()
function fetchLicenceFromDB(): Promise<Licence | null> {
  return new Promise(async (resolve) => {
    try {
      const { data, error } = await supabase
        .from("licences")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        resolve(null);
      } else {
        resolve(data as Licence);
      }
    } catch {
      resolve(null); // network error → fail open
    }
  });
}

// ── Timeout race ──────────────────────────────────────────────────────────────
function withTimeout(promise: Promise<Licence | null>, ms: number): Promise<Licence | null> {
  const timeout = new Promise<Licence | null>((resolve) =>
    setTimeout(() => resolve(null), ms) // timeout → resolve null (fail open)
  );
  return Promise.race([promise, timeout]);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function LicenceProvider({ children }: { children: ReactNode }) {
  const [licence, setLicence] = useState<Licence | null>(null);
  const [loading, setLoading] = useState(true);

  const doFetch = async (cancelled: { value: boolean }) => {
    // 1. Serve from cache immediately if still fresh
    const cached = loadCache();
    if (cached) {
      if (!cancelled.value) { setLicence(cached); setLoading(false); }
      return;
    }

    // 2. Need an auth session before RLS allows the query
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      if (!cancelled.value) setLoading(false);
      return;
    }

    // 3. Fetch with 8s timeout — resolves null on error or timeout (fail open)
    const result = await withTimeout(fetchLicenceFromDB(), 8000);

    if (cancelled.value) return;

    if (result) {
      setLicence(result);
      saveCache(result);
    } else {
      // null means fetch failed or timed out → fail open, don't lock anyone out
      console.warn("[Licence] fetch returned null, failing open");
      setLicence(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const cancelled = { value: false };
    doFetch(cancelled);

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        clearCache();
        setLoading(true);
        doFetch(cancelled);
      }
      if (event === "SIGNED_OUT") {
        clearCache();
        setLicence(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled.value = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const validUntil    = licence ? new Date(licence.valid_until) : null;
  const daysRemaining = validUntil
    ? Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const graceDays     = licence?.grace_period_days ?? 7;
  const isExpired     = daysRemaining !== null && daysRemaining < -graceDays;
  const isGracePeriod = daysRemaining !== null && daysRemaining < 0 && !isExpired;

  // Fail open: while loading or if fetch failed → never block access
  const isValid    = (loading || !licence) ? true : licence.is_active && !isExpired;
  const hasFeature = (f: string): boolean =>
    (loading || !licence) ? true : licence.features_enabled.includes(f);

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