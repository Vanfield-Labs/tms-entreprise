// src/pages/profile/ProfilePage.tsx — view & edit own profile (dark mode ready)
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Division = { id: string; name: string };
type Unit = { id: string; name: string; division_id: string };

const ROLE_LABELS: Record<string, string> = {
  admin:                "Admin",
  corporate_approver:   "Corporate Approver",
  transport_supervisor: "Transport Supervisor",
  driver:               "Driver",
  unit_head:            "Unit Head",
  staff:                "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  admin:                "bg-rose-500",
  corporate_approver:   "bg-violet-500",
  transport_supervisor: "bg-amber-500",
  driver:               "bg-emerald-500",
  unit_head:            "bg-sky-500",
  staff:                "bg-slate-400",
};

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [fullName, setFullName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setPositionTitle((profile as any).position_title || "");

    (async () => {
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from("divisions").select("id,name").order("name"),
        supabase.from("units").select("id,name,division_id").order("name"),
      ]);
      setDivisions((d as Division[]) || []);
      setUnits((u as Unit[]) || []);
    })();
  }, [profile]);

  const saveProfile = async () => {
    if (!user?.id || !fullName.trim()) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), position_title: positionTitle.trim() || null })
        .eq("user_id", user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwSaving(true); setPwError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPwError(error.message); return; }
      setPwSuccess(true);
      setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } finally {
      setPwSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">Loading profile…</span>
      </div>
    );
  }

  const initials  = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleColor = ROLE_COLORS[profile.system_role] ?? "bg-slate-400";
  const roleLabel = ROLE_LABELS[profile.system_role] ?? profile.system_role;
  const division  = divisions.find((d) => d.id === profile.division_id);
  const unit      = units.find((u) => u.id === profile.unit_id);

  const pwStrength = newPassword.length === 0 ? 0 : newPassword.length < 8 ? 1 : newPassword.length < 12 ? 2 : 3;
  const pwStrengthLabel = ["", "Weak", "OK", "Strong"][pwStrength];
  const pwStrengthColor = ["", "var(--status-error-fg)", "var(--status-warning-fg)", "var(--status-success-fg)"][pwStrength];

  return (
    <div className="space-y-4 max-w-xl">

      {/* ── Avatar + role ────────────────────────────────────── */}
      <div
        className="card"
        style={{ padding: "20px 24px" }}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl ${roleColor} flex items-center justify-center text-white text-xl font-bold shrink-0`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate" style={{ color: "var(--text)" }}>
              {profile.full_name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{roleLabel}</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* ── Organisation (read-only) ─────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Organisation</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              Managed by your administrator
            </p>
          </div>
        </div>
        <div className="card-body">
          <dl className="space-y-3">
            {[
              { label: "Role",     value: roleLabel },
              { label: "Division", value: division?.name ?? "—" },
              { label: "Unit",     value: unit?.name ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="text-sm shrink-0" style={{ color: "var(--text-dim)" }}>{label}</dt>
                <dd
                  className="text-sm font-medium text-right truncate"
                  style={{ color: "var(--text)" }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Edit profile ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Edit Profile</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="form-label">Full Name</label>
            <input
              className="tms-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="form-label">Position Title</label>
            <input
              className="tms-input"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              placeholder="e.g. Senior Officer"
            />
          </div>

          {saved && (
            <div className="alert alert-success">
              ✓ Profile saved successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={saving || !fullName.trim()}
              className="btn btn-primary"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Change password ───────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Change Password</h3>
          <button
            onClick={() => setShowPw((v) => !v)}
            className="btn btn-ghost btn-sm"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>

        {showPw && (
          <div className="card-body space-y-4">
            <div>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="tms-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
              {/* Strength bar */}
              {newPassword.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3].map((lvl) => (
                    <div
                      key={lvl}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background: pwStrength >= lvl ? pwStrengthColor : "var(--border)",
                      }}
                    />
                  ))}
                  <span className="text-xs ml-1" style={{ color: pwStrengthColor }}>
                    {pwStrengthLabel}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="tms-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>

            {pwError   && <div className="alert alert-error">{pwError}</div>}
            {pwSuccess && <div className="alert alert-success">✓ Password updated successfully.</div>}

            <div className="flex justify-end">
              <button
                onClick={changePassword}
                disabled={pwSaving || !newPassword || !confirmPassword}
                className="btn btn-primary"
              >
                {pwSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}