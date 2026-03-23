// src/pages/admin/LicenceManagement.tsx
// Admin-only page showing licence details, feature list, user count, and export.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLicence } from "@/context/LicenceContext";
import { StatCard, Card, CardHeader, CardBody } from "@/components/TmsUI";

const ALL_FEATURES = [
  { key: "fleet",             label: "Fleet Management",         icon: "🚗" },
  { key: "fuel",              label: "Fuel Management",          icon: "⛽" },
  { key: "bookings",          label: "Trip Bookings",            icon: "📋" },
  { key: "maintenance",       label: "Maintenance",              icon: "🔧" },
  { key: "shifts",            label: "Driver Shifts",            icon: "📅" },
  { key: "camera",            label: "Camera Operations",        icon: "📷" },
  { key: "news_assignments",  label: "News Assignments",         icon: "📰" },
  { key: "incidents",         label: "Incident Reports",         icon: "🚨" },
  { key: "reports",           label: "Reports & Analytics",      icon: "📊" },
  { key: "audit",             label: "Audit Logs",               icon: "🔍" },
  { key: "push_notifications",label: "Push Notifications",       icon: "🔔" },
  { key: "divisions",         label: "Divisions & Units",        icon: "🏢" },
  { key: "users",             label: "User Management",          icon: "👥" },
];

export default function LicenceManagement() {
  const { licence, isValid, isExpired, isGracePeriod, daysRemaining, hasFeature } = useLicence();
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("user_id", { count: "exact", head: true }).then(({ count }) => {
      setUserCount(count ?? 0);
    });
  }, []);

  const exportLicenceInfo = () => {
    if (!licence) return;
    const lines = [
      `TMS Portal — Licence Information`,
      `Generated: ${new Date().toLocaleString("en-GB")}`,
      ``,
      `Client:        ${licence.client_name}`,
      `Tier:          ${licence.tier.toUpperCase()}`,
      `Licence Key:   ${licence.licence_key}`,
      `Valid From:    ${new Date(licence.valid_from).toLocaleDateString("en-GB")}`,
      `Valid Until:   ${new Date(licence.valid_until).toLocaleDateString("en-GB")}`,
      `Max Users:     ${licence.max_users}`,
      `Current Users: ${userCount ?? "—"}`,
      `Status:        ${isExpired ? "EXPIRED" : isGracePeriod ? "GRACE PERIOD" : "ACTIVE"}`,
      ``,
      `Features Enabled:`,
      ...ALL_FEATURES.map(f => `  ${hasFeature(f.key) ? "✓" : "✗"} ${f.label}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `TMS_Licence_${licence.client_name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const daysColor =
    daysRemaining === null ? "var(--text-muted)"
    : daysRemaining > 30 ? "var(--green)"
    : daysRemaining > 7  ? "var(--amber)"
    : "var(--red)";

  const statusLabel = isExpired ? "Expired" : isGracePeriod ? "Grace Period" : isValid ? "Active" : "Inactive";
  const statusColor = isExpired || isGracePeriod ? "var(--red)" : isValid ? "var(--green)" : "var(--text-muted)";

  if (!licence) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>No Active Licence Found</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Contact your supplier to set up a TMS Portal licence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Licence Management</h1>
          <p className="page-sub">TMS Portal licence details for {licence.client_name}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportLicenceInfo}>
          ⬇ Export
        </button>
      </div>

      {/* Status / KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Status"
          value={statusLabel}
          accent={isExpired ? "red" : isGracePeriod ? "amber" : "green"}
        />
        <StatCard
          label="Days Remaining"
          value={daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : 0) : "—"}
          accent={daysRemaining !== null && daysRemaining > 30 ? "green" : daysRemaining !== null && daysRemaining > 7 ? "amber" : "red"}
        />
        <StatCard
          label="Users"
          value={`${userCount ?? "—"} / ${licence.max_users}`}
          accent={userCount !== null && userCount >= licence.max_users ? "red" : "accent"}
        />
        <StatCard
          label="Tier"
          value={licence.tier.charAt(0).toUpperCase() + licence.tier.slice(1)}
          accent="purple"
        />
      </div>

      {/* Licence details */}
      <Card>
        <CardHeader title="Licence Details" />
        <CardBody>
          <dl className="space-y-3">
            {[
              { label: "Client",       value: licence.client_name },
              { label: "Licence Key",  value: licence.licence_key, mono: true },
              { label: "Valid From",   value: new Date(licence.valid_from).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) },
              { label: "Valid Until",  value: new Date(licence.valid_until).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) },
              { label: "Grace Period", value: `${licence.grace_period_days} days after expiry` },
              { label: "Max Users",    value: String(licence.max_users) },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between gap-4 py-1"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <dt className="text-sm shrink-0" style={{ color: "var(--text-dim)", width: 120 }}>{label}</dt>
                <dd className="text-sm font-medium text-right truncate"
                  style={{ color: "var(--text)", fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit", fontSize: mono ? 12 : undefined }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {/* Feature list */}
      <Card>
        <CardHeader title="Feature Access" subtitle="Features included in your licence" />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_FEATURES.map(f => {
              const enabled = hasFeature(f.key);
              return (
                <div
                  key={f.key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: enabled ? "var(--green-dim)" : "var(--surface-2)",
                    border:     `1px solid ${enabled ? "var(--green)" : "var(--border)"}`,
                    opacity:    enabled ? 1 : 0.6,
                  }}
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-sm font-medium flex-1" style={{ color: "var(--text)" }}>{f.label}</span>
                  <span style={{ color: enabled ? "var(--green)" : "var(--text-dim)", fontSize: 16 }}>
                    {enabled ? "✓" : "✗"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Contact note */}
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <strong style={{ color: "var(--text)" }}>To renew or upgrade your licence</strong>, contact your TMS supplier.
        Licence changes take effect immediately after the database is updated.
      </div>
    </div>
  );
}