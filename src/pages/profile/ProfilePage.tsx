// src/pages/profile/ProfilePage.tsx — view & edit own profile
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Division = { id: string; name: string };
type Unit = { id: string; name: string; division_id: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  corporate_approver: "Corporate Approver",
  transport_supervisor: "Transport Supervisor",
  driver: "Driver",
  unit_head: "Unit Head",
  staff: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-500",
  corporate_approver: "bg-violet-500",
  transport_supervisor: "bg-amber-500",
  driver: "bg-emerald-500",
  unit_head: "bg-sky-500",
  staff: "bg-slate-400",
};

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [fullName, setFullName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

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
      await supabase.from("profiles")
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
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } finally {
      setPwSaving(false);
    }
  };

  if (!profile) return <div className="text-center py-16 text-sm text-gray-400">Loading profile…</div>;

  const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleColor = ROLE_COLORS[profile.system_role] ?? "bg-slate-400";
  const roleLabel = ROLE_LABELS[profile.system_role] ?? profile.system_role;

  const division = divisions.find((d) => d.id === profile.division_id);
  const unit = units.find((u) => u.id === profile.unit_id);

  return (
    <div className="space-y-5 max-w-xl">
      {/* Avatar + role card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5">
        <div className={`w-16 h-16 rounded-2xl ${roleColor} flex items-center justify-center text-white text-xl font-bold shrink-0`}>
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{profile.full_name}</h2>
          <p className="text-sm text-gray-500">{roleLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Organisation info (read-only) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Organisation</h3>
          <p className="text-xs text-gray-400 mt-0.5">Managed by your administrator</p>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: "Role", value: roleLabel },
            { label: "Division", value: division?.name ?? "—" },
            { label: "Unit", value: unit?.name ?? "—" },
            { label: "Status", value: profile.status },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-4">
              <span className="text-xs text-gray-400 w-20 shrink-0">{row.label}</span>
              <span className="text-sm text-gray-900 font-medium capitalize">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editable profile */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Profile Details</h3>
          <p className="text-xs text-gray-400 mt-0.5">You can update your name and title</p>
        </div>
        <div className="p-5 space-y-4">
          {saved && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              Profile saved successfully!
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Position Title (optional)</label>
            <input value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} placeholder="e.g. Senior Driver" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input value={user?.email ?? ""} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
          </div>
          <div className="flex justify-end">
            <button onClick={saveProfile} disabled={saving || !fullName.trim()} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Change Password</h3>
          <p className="text-xs text-gray-400 mt-0.5">Choose a strong password of at least 8 characters</p>
        </div>
        <div className="p-5 space-y-4">
          {pwError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              Password changed successfully!
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          {newPassword && (
            <div className="flex gap-1.5">
              {[8, 12, 16].map((len) => (
                <div key={len} className={`h-1 flex-1 rounded-full transition-colors ${newPassword.length >= len ? "bg-green-500" : "bg-gray-200"}`} />
              ))}
              <span className="text-xs text-gray-400 ml-1">{newPassword.length < 8 ? "Weak" : newPassword.length < 12 ? "OK" : "Strong"}</span>
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={pwSaving || !newPassword || !confirmPassword}
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {pwSaving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all";