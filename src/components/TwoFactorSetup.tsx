// src/components/TwoFactorSetup.tsx
// TOTP 2FA setup using Supabase Auth built-in MFA.
// Only rendered for admin and corporate_approver roles.

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type MFAFactor = {
  id: string;
  status: string;
  factor_type: string;
  friendly_name?: string;
};

interface Props {
  factors: MFAFactor[];
  onRefresh: () => void;
}

export function TwoFactorSetup({ factors, onRefresh }: Props) {
  const enrolledFactor = factors.find(f => f.factor_type === "totp" && f.status === "verified");
  const pendingFactor  = factors.find(f => f.factor_type === "totp" && f.status === "unverified");

  const [phase, setPhase] = useState<"idle" | "enrolling" | "verifying" | "disabling">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEnroll = async () => {
    setError(null);
    setSaving(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TMS Portal" });
    setSaving(false);
    if (err || !data) { setError(err?.message ?? "Failed to start 2FA setup"); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setPhase("verifying");
  };

  const verifyEnroll = async () => {
    if (!factorId || code.length !== 6) { setError("Enter the 6-digit code from your authenticator."); return; }
    setError(null); setSaving(true);
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setError("Challenge failed."); setSaving(false); return; }
    const { error: err } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess("Two-factor authentication is now active.");
    setPhase("idle");
    setCode(""); setQrCode(null); setSecret(null); setFactorId(null);
    onRefresh();
  };

  const startDisable = () => {
    setPhase("disabling");
    setCode("");
    setError(null);
  };

  const confirmDisable = async () => {
    if (!enrolledFactor) return;
    if (code.length !== 6) { setError("Enter your current 6-digit code to confirm."); return; }
    setError(null); setSaving(true);
    // Verify once more before unenrolling for security
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: enrolledFactor.id });
    if (challenge) {
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrolledFactor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) { setError("Code incorrect. 2FA not disabled."); setSaving(false); return; }
    }
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactor.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess("Two-factor authentication has been disabled.");
    setPhase("idle"); setCode("");
    onRefresh();
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Two-Factor Authentication</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
            Extra security for privileged accounts via authenticator app
          </p>
        </div>
        {enrolledFactor && (
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "var(--green-dim)", color: "var(--green)" }}
          >
            ✓ Active
          </span>
        )}
      </div>

      <div className="card-body space-y-4">

        {/* Success message */}
        {success && (
          <div className="alert alert-success">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── No 2FA enrolled ── */}
        {!enrolledFactor && phase === "idle" && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Protect your account with a one-time password from an authenticator app (Google Authenticator, Authy, etc.).
            </p>
            <button className="btn btn-primary" onClick={startEnroll} disabled={saving}>
              {saving ? "Setting up…" : "Enable 2FA"}
            </button>
          </div>
        )}

        {/* ── QR Code / Enrollment ── */}
        {phase === "verifying" && qrCode && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                1. Scan this QR code with your authenticator app
              </p>
              <div
                className="flex items-center justify-center p-4 rounded-xl"
                style={{ background: "#fff", border: "1px solid var(--border)", display: "inline-flex" }}
              >
                <img src={qrCode} alt="2FA QR Code" width={180} height={180} />
              </div>
            </div>

            {secret && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  Or enter this secret key manually:
                </p>
                <div
                  className="px-3 py-2 rounded-lg text-xs font-mono tracking-widest select-all"
                  style={{
                    background: "var(--surface-2)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text)",
                    letterSpacing: "0.15em",
                    wordBreak:  "break-all",
                  }}
                >
                  {secret}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
                2. Enter the 6-digit code from your app
              </p>
              <div className="flex gap-3">
                <input
                  className="tms-input"
                  style={{ maxWidth: 160, fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, letterSpacing: "0.3em", textAlign: "center" }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button className="btn btn-primary" onClick={verifyEnroll} disabled={saving || code.length !== 6}>
                  {saving ? "Verifying…" : "Verify & Enable"}
                </button>
                <button className="btn btn-ghost" onClick={() => { setPhase("idle"); setQrCode(null); setSecret(null); }}>
                  Cancel
                </button>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
          </div>
        )}

        {/* ── 2FA Active ── */}
        {enrolledFactor && phase === "idle" && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Your account is protected with two-factor authentication. You'll be asked for a code each time you sign in from a new device.
            </p>
            <button className="btn btn-danger btn-sm" onClick={startDisable}>
              Disable 2FA
            </button>
          </div>
        )}

        {/* ── Disable confirmation ── */}
        {phase === "disabling" && (
          <div className="space-y-4">
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--red-dim)", border: "1px solid var(--red)", color: "var(--red)" }}
            >
              ⚠️ Disabling 2FA will make your account less secure. Enter your current authenticator code to confirm.
            </div>
            <div className="flex gap-3">
              <input
                className="tms-input"
                style={{ maxWidth: 160, fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, letterSpacing: "0.3em", textAlign: "center" }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button className="btn btn-danger" onClick={confirmDisable} disabled={saving || code.length !== 6}>
                {saving ? "Disabling…" : "Confirm Disable"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setPhase("idle"); setCode(""); }}>
                Cancel
              </button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
          </div>
        )}

        {error && phase === "idle" && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  );
}