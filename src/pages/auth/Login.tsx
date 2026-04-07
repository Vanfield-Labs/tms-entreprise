// src/pages/auth/Login.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth, consumeInactivityFlag } from "@/hooks/useAuth";
import { logSecurityEvent } from "@/services/securityLog.service";

const MAX_ATTEMPTS    = 5;
const COOLDOWN_SECS   = 30;

export default function Login() {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [attempts,  setAttempts]  = useState(0);
  const [cooldown,  setCooldown]  = useState(0);
  const [wasInactive, setWasInactive] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Check inactivity flag on mount
  useEffect(() => {
    if (consumeInactivityFlag()) setWasInactive(true);
  }, []);

  // Already logged in → go home
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Cooldown countdown timer
  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_SECS);
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current!);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [attempts >= MAX_ATTEMPTS]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || cooldown > 0) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      void logSecurityEvent({
        event: "login_failed",
        email: email.trim().toLowerCase(),
      });
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Too many failed attempts. Please wait ${COOLDOWN_SECS} seconds before trying again.`);
      } else {
        setError(
          authError.message === "Invalid login credentials"
            ? `Incorrect email or password. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} remaining.`
            : authError.message
        );
      }
      setLoading(false);
    }
    // On success, useEffect above will redirect
  };

  const isLocked = cooldown > 0;

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
              <div className="text-gray-500 text-xs tracking-widest uppercase">Transport Management</div>
            </div>
          </div>
        </div>

        {/* Inactivity message */}
        {wasInactive && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
            style={{ background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.4)", color: "#f59e0b" }}>
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>You were signed out due to inactivity. Please sign in again.</span>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-white/10 p-8 shadow-2xl"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
          <div className="mb-6">
            <h2 className="text-white font-semibold text-xl">Sign in</h2>
            <p className="text-gray-400 text-sm mt-1">Enter your credentials to access your dashboard</p>
          </div>

          {/* Cooldown alert */}
          {isLocked && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}>
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Too many attempts. Try again in <strong>{cooldown}s</strong>.</span>
            </div>
          )}

          {/* Regular error */}
          {error && !isLocked && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email" required disabled={isLocked}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Password with visibility toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required disabled={isLocked}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked || !email || !password}
              className="w-full py-3 px-4 rounded-xl bg-white text-black text-sm font-semibold transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : isLocked ? `Wait ${cooldown}s…` : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">Need access? Contact your administrator.</p>
      </div>
    </div>
  );
}
