// src/pages/auth/TwoFactorChallenge.tsx
// Shown after password login when user has TOTP 2FA enrolled.
// Route: /2fa

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const MAX_ATTEMPTS = 3;

export default function TwoFactorChallenge() {
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const navigate = useNavigate();

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);

    try {
      // Get enrolled TOTP factors
      const { data: mfaData, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr || !mfaData?.totp?.length) {
        // No factors — proceed to app (shouldn't happen but safe fallback)
        navigate("/", { replace: true });
        return;
      }

      const factor = mfaData.totp.find(f => f.status === "verified");
      if (!factor) { navigate("/", { replace: true }); return; }

      // Create challenge
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr || !challenge) {
        setError("Failed to create authentication challenge. Please try again.");
        setLoading(false);
        return;
      }

      // Verify code
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    factor.id,
        challengeId: challenge.id,
        code,
      });

      setLoading(false);

      if (verifyErr) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setError("Too many incorrect codes. Please sign in again.");
          await supabase.auth.signOut();
          setTimeout(() => navigate("/login", { replace: true }), 2000);
        } else {
          setError(`Incorrect code. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} remaining.`);
          setCode("");
        }
        return;
      }

      // Success — navigate to dashboard
      navigate("/", { replace: true });

    } catch (err: any) {
      setError(err.message ?? "Verification failed.");
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const tooManyAttempts = attempts >= MAX_ATTEMPTS;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #111827 100%)",
      }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="#111"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="#111" opacity=".4"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="#111" opacity=".4"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="#111"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">TMS Portal</div>
              <div className="text-gray-500 text-xs tracking-widest uppercase">Two-Factor Auth</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 p-8 shadow-2xl"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>

          {/* Shield icon */}
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)" }}>
              🛡️
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-white font-semibold text-xl">Two-Factor Verification</h2>
            <p className="text-gray-400 text-sm mt-1.5">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={verify} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">
                Authenticator Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                disabled={loading || tooManyAttempts}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 text-center font-mono tracking-[0.4em] text-xl focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6 || tooManyAttempts}
              className="w-full py-3 px-4 rounded-xl bg-white text-black text-sm font-semibold transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Verifying…
                </span>
              ) : "Verify"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-gray-600 text-xs">
              Lost access to your authenticator?
            </p>
            <p className="text-gray-500 text-xs">
              Contact your TMS administrator to reset your account access.
            </p>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline mt-2 block mx-auto"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}