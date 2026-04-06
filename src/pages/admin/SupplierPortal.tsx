// src/pages/admin/SupplierPortal.tsx
// PIN-protected supplier page. Only the TMS supplier (you) can access this.
// Admins at Multimedia can SEE the page exists but cannot get past the PIN screen.

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type LicenceStatus = {
  client_name: string;
  tier: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  max_users: number;
  current_users: number;
  grace_period_days: number;
  features_enabled: string[];
  days_remaining: number;
};

type SupplierVerifyResponse = {
  success?: boolean;
  token?: string;
  error?: string;
};

type SupplierStatusResponse = LicenceStatus & {
  success?: boolean;
  error?: string;
};

type SupplierActionResponse = {
  success?: boolean;
  error?: string;
  valid_until?: string;
};

const ALL_FEATURES = [
  "fleet", "fuel", "bookings", "maintenance", "shifts",
  "camera", "news_assignments", "incidents", "reports",
  "audit", "push_notifications", "divisions", "users",
];

export default function SupplierPortal() {
  const [pin,          setPin]          = useState("");
  const [showPin,      setShowPin]      = useState(false);
  const [token,        setToken]        = useState<string | null>(null);
  const [pinLoading,   setPinLoading]   = useState(false);
  const [pinError,     setPinError]     = useState<string | null>(null);

  const [status,       setStatus]       = useState<LicenceStatus | null>(null);
  const [statusLoading,setStatusLoading]= useState(false);

  // Renewal form state
  const [newExpiry,    setNewExpiry]    = useState("");
  const [newMaxUsers,  setNewMaxUsers]  = useState("");
  const [newTier,      setNewTier]      = useState("");
  const [newFeatures,  setNewFeatures]  = useState<string[]>([]);
  const [renewing,     setRenewing]     = useState(false);
  const [renewMsg,     setRenewMsg]     = useState<string | null>(null);
  const [renewError,   setRenewError]   = useState<string | null>(null);

  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(false);

  const callSupplierPortal = async <T,>(body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("supplier-portal", {
      body,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? null) as T;
  };

  // ── Step 1: verify PIN ──────────────────────────────────────────────────────
  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setPinLoading(true); setPinError(null);

    let data: SupplierVerifyResponse | null = null;

    try {
      data = await callSupplierPortal<SupplierVerifyResponse>({
        action: "verify_pin",
        pin,
      });
    } catch (error) {
      setPinLoading(false);
      setPinError(error instanceof Error ? error.message : "Invalid PIN");
      setPin("");
      return;
    }

    setPinLoading(false);
    if (!data?.success || !data.token) {
      setPinError(data?.error ?? "Invalid PIN");
      setPin("");
      return;
    }
    setToken(data.token);
    loadStatus(data.token);
  };

  // ── Load current licence status ─────────────────────────────────────────────
  const loadStatus = async (tok: string) => {
    setStatusLoading(true);

    let data: SupplierStatusResponse | null = null;

    try {
      data = await callSupplierPortal<SupplierStatusResponse>({
        action: "get_status",
        token: tok,
      });
    } catch (error) {
      setStatusLoading(false);
      setToken(null);
      setPinError(error instanceof Error ? error.message : "Session expired. Please re-enter your PIN.");
      return;
    }

    setStatusLoading(false);
    if (!data?.success) {
      setToken(null);
      setPinError("Session expired. Please re-enter your PIN.");
      return;
    }
    setStatus(data as LicenceStatus);
    setNewExpiry(data.valid_until);
    setNewMaxUsers(String(data.max_users));
    setNewTier(data.tier);
    setNewFeatures(data.features_enabled);
  };

  // ── Renew licence ───────────────────────────────────────────────────────────
  const renew = async () => {
    if (!token || !newExpiry) return;
    setRenewing(true); setRenewMsg(null); setRenewError(null);

    let data: SupplierActionResponse | null = null;

    try {
      data = await callSupplierPortal<SupplierActionResponse>({
        action: "renew",
        token,
        valid_until: newExpiry,
        max_users: newMaxUsers ? parseInt(newMaxUsers, 10) : null,
        tier: newTier || null,
        features: newFeatures.length > 0 ? newFeatures : null,
      });
    } catch (error) {
      setRenewing(false);
      setRenewError(error instanceof Error ? error.message : "Renewal failed");
      setToken(null);
      return;
    }

    setRenewing(false);
    if (!data?.success || !data.valid_until) {
      setRenewError(data?.error ?? "Renewal failed");
      setToken(null);
      return;
    }
    const renewedUntil = data.valid_until;
    setRenewMsg(`✓ Licence renewed to ${new Date(renewedUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`);
    // Token consumed — need to re-auth for next action
    setToken(null);
    setStatus(prev => prev ? { ...prev, valid_until: renewedUntil, is_active: true } : prev);
  };

  // ── Deactivate ──────────────────────────────────────────────────────────────
  const deactivate = async () => {
    if (!token) return;
    setDeactivating(true);

    let data: SupplierActionResponse | null = null;

    try {
      data = await callSupplierPortal<SupplierActionResponse>({
        action: "deactivate",
        token,
      });
    } catch (error) {
      setDeactivating(false);
      setRenewError(error instanceof Error ? error.message : "Deactivation failed");
      setToken(null);
      return;
    }

    setDeactivating(false);
    if (!data?.success) {
      setRenewError(data?.error ?? "Deactivation failed");
      setToken(null);
      return;
    }
    setRenewMsg("⚠️ Licence deactivated. The client will see the expired screen immediately.");
    setToken(null);
    setConfirmDeact(false);
    setStatus(prev => prev ? { ...prev, is_active: false } : prev);
  };

  const toggleFeature = (f: string) => {
    setNewFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const daysColor = (days: number) =>
    days > 90 ? "var(--green)" : days > 30 ? "var(--amber)" : "var(--red)";

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="max-w-sm mx-auto pt-12 space-y-4">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
          >
            🔐
          </div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Supplier Portal</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Enter your supplier PIN to manage this licence
          </p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={verifyPin} className="space-y-4">
              <div>
                <label className="form-label">Supplier PIN</label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    className="tms-input pr-10"
                    placeholder="Enter your secret PIN"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showPin ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {pinError && (
                <div className="alert alert-error">{pinError}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={pinLoading || !pin.trim()}
              >
                {pinLoading ? "Verifying…" : "Access Supplier Portal"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs" style={{ color: "var(--text-dim)" }}>
          This area is restricted to TMS Portal supplier only.
        </p>
      </div>
    );
  }

  // ── Loading status ──────────────────────────────────────────────────────────
  if (statusLoading || !status) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  // ── Main portal ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">🔐 Supplier Portal</h1>
          <p className="page-sub">Managing licence for {status.client_name}</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setToken(null); setPin(""); setStatus(null); }}
        >
          Lock Portal
        </button>
      </div>

      {/* Success / error messages */}
      {renewMsg && (
        <div className="alert alert-success">
          <span>{renewMsg}</span>
          <button onClick={() => setRenewMsg(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {renewError && (
        <div className="alert alert-error">
          <span>{renewError}</span>
          <button onClick={() => setRenewError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Session notice */}
      <div
        className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
        style={{ background: "var(--amber-dim)", border: "1px solid var(--amber)", color: "var(--amber)" }}
      >
        ⏱ Your supplier session is valid for 2 hours and expires after each action. You'll need to re-enter your PIN for the next action.
      </div>

      {/* Current status card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Current Licence Status</h3>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: status.is_active ? "var(--green-dim)" : "var(--red-dim)",
              color:      status.is_active ? "var(--green)"     : "var(--red)",
            }}
          >
            {status.is_active ? "● Active" : "● Inactive"}
          </span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: "Client",        value: status.client_name },
              { label: "Tier",          value: status.tier.toUpperCase() },
              { label: "Valid From",    value: new Date(status.valid_from).toLocaleDateString("en-GB") },
              { label: "Valid Until",   value: new Date(status.valid_until).toLocaleDateString("en-GB") },
              { label: "Days Left",     value: String(status.days_remaining), color: daysColor(status.days_remaining) },
              { label: "Users",         value: `${status.current_users} / ${status.max_users}` },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs mb-0.5" style={{ color: "var(--text-dim)" }}>{label}</p>
                <p className="font-semibold" style={{ color: color ?? "var(--text)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Renewal form */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Renew / Update Licence</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">New Expiry Date *</label>
              <input
                type="date"
                className="tms-input"
                value={newExpiry}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setNewExpiry(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Max Users</label>
              <input
                type="number"
                className="tms-input"
                value={newMaxUsers}
                min="1"
                onChange={e => setNewMaxUsers(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Tier</label>
              <select className="tms-select" value={newTier} onChange={e => setNewTier(e.target.value)}>
                <option value="trial">Trial</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          {/* Feature toggles */}
          <div>
            <label className="form-label">Features Enabled</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {ALL_FEATURES.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-left transition-all"
                  style={{
                    background:   newFeatures.includes(f) ? "var(--green-dim)" : "var(--surface-2)",
                    border:       `1px solid ${newFeatures.includes(f) ? "var(--green)" : "var(--border)"}`,
                    color:        newFeatures.includes(f) ? "var(--green)" : "var(--text-muted)",
                  }}
                >
                  {newFeatures.includes(f) ? "✓" : "✗"} {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={renew}
              disabled={renewing || !newExpiry}
            >
              {renewing ? "Renewing…" : "Renew Licence"}
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="card"
        style={{ borderColor: "var(--red)" }}
      >
        <div className="card-header" style={{ background: "var(--red-dim)" }}>
          <h3 className="card-title" style={{ color: "var(--red)" }}>⚠️ Danger Zone</h3>
        </div>
        <div className="card-body space-y-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Deactivating the licence will immediately lock all users out of the TMS Portal. Use only if the client has not paid or violated terms.
          </p>
          {!confirmDeact ? (
            <button
              className="btn btn-danger"
              onClick={() => setConfirmDeact(true)}
            >
              Deactivate Licence
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>
                Are you sure? This locks out all users immediately.
              </p>
              <button
                className="btn btn-danger"
                onClick={deactivate}
                disabled={deactivating}
              >
                {deactivating ? "Deactivating…" : "Yes, Deactivate"}
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDeact(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
