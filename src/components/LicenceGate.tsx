// src/components/LicenceGate.tsx
// Wrap any section: <LicenceGate feature="camera"> ... </LicenceGate>
// Shows locked overlay if feature is disabled.
// Shows full-page expired banner if licence has lapsed past grace period.
// Shows amber banner during grace period.

import { ReactNode } from "react";
import { useLicence } from "@/context/LicenceContext";
import { useAuth } from "@/hooks/useAuth";

interface LicenceGateProps {
  feature:  string;
  children: ReactNode;
}

// ── Grace period banner (dismissable, amber) ──────────────────────────────────
function GracePeriodBanner({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl mb-4"
      style={{
        background: "var(--amber-dim)",
        border:     "1px solid var(--amber)",
        color:      "var(--amber)",
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <span>
          Your TMS licence expires in <strong>{Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? "s" : ""}</strong>. Please renew soon to avoid service interruption.
        </span>
      </div>
    </div>
  );
}

// ── Expired full-page block ────────────────────────────────────────────────────
function ExpiredBlock({ validUntil, isAdmin }: { validUntil: string | null; isAdmin: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl"
      style={{
        background: "var(--red-dim)",
        border:     "1px solid var(--red)",
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl"
        style={{ background: "var(--red)", color: "#fff" }}
      >
        🔒
      </div>
      <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>
        TMS Licence Expired
      </h2>
      <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
        Your TMS Portal licence has expired{validUntil ? ` (${new Date(validUntil).toLocaleDateString("en-GB")})` : ""}.
      </p>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Please renew your licence to continue using TMS Portal.
      </p>
      {isAdmin && (
        <a
          href="mailto:support@tmsportal.com?subject=TMS Licence Renewal"
          className="btn btn-danger"
        >
          Contact Supplier to Renew
        </a>
      )}
    </div>
  );
}

// ── Feature locked overlay ─────────────────────────────────────────────────────
function LockedFeature({ feature }: { feature: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl"
      style={{
        background: "var(--surface-2)",
        border:     "1px dashed var(--border-bright)",
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        🔐
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
        Feature Not Available
      </h3>
      <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
        The <strong>{feature}</strong> module requires a licence upgrade. Contact your administrator to enable it.
      </p>
    </div>
  );
}

// ── Main LicenceGate ──────────────────────────────────────────────────────────
export function LicenceGate({ feature, children }: LicenceGateProps) {
  const { licence, loading, isExpired, isGracePeriod, daysRemaining, hasFeature } = useLicence();
  const { profile } = useAuth();
  const isAdmin = profile?.system_role === "admin";

  if (loading) return null;

  // Licence fully expired (past grace period)
  if (isExpired) {
    return <ExpiredBlock validUntil={licence?.valid_until ?? null} isAdmin={isAdmin} />;
  }

  // Feature not enabled in this licence
  if (!hasFeature(feature)) {
    return <LockedFeature feature={feature} />;
  }

  // In grace period — show banner above content
  if (isGracePeriod && daysRemaining !== null) {
    return (
      <>
        <GracePeriodBanner daysRemaining={daysRemaining} />
        {children}
      </>
    );
  }

  // Valid licence with feature enabled
  return <>{children}</>;
}