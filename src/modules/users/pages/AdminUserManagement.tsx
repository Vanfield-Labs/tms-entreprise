// src/modules/users/pages/AdminUserManagement.tsx
// Original UI preserved: context menu (...) with Edit / Deactivate / Reset Password on each user row.
// Bug fixes only: correct import path, profile_status "disabled" (not "inactive").

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createSystemUser, rejectUserRequest, listProfiles, setUserStatus } from "../services/userManagement.service";
import { fmtDateTime } from "@/lib/utils";
import { createPortal } from "react-dom";

type Tab = "requests" | "create" | "users";

type PendingRequest = {
  id: string; full_name: string; email: string;
  division_id: string | null; unit_id: string | null;
  requested_role: string; status: string; created_at: string;
};

type Profile = {
  user_id: string; full_name: string; system_role: string;
  status: string; division_id: string | null; unit_id: string | null;
  position_title: string | null;
};

type Division = { id: string; name: string };
type Unit     = { id: string; name: string; division_id: string };

const ROLES = [
  { value: "staff",                label: "Staff" },
  { value: "unit_head",            label: "Unit Head" },
  { value: "driver",               label: "Driver" },
  { value: "transport_supervisor", label: "Transport Supervisor" },
  { value: "corporate_approver",   label: "Corporate Approver" },
  { value: "finance_manager",      label: "Finance Manager" },
  { value: "admin",                label: "Admin" },
];

const ROLE_COLORS: Record<string, string> = {
  admin:                "badge badge-role-admin",
  corporate_approver:   "badge badge-role-corporate",
  finance_manager:      "badge badge-role-corporate",
  transport_supervisor: "badge badge-role-transport",
  driver:               "badge badge-role-driver",
  unit_head:            "badge badge-role-unit",
  staff:                "badge badge-role-staff",
};

function generatePassword(length = 12): string {
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#$!";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => charset[b % charset.length]).join("");
}

// Context Menu
function ContextMenu({ profile, onEdit, onToggle, onResetPwd, toggling }: {
  profile: Profile;
  onEdit: (p: Profile) => void;
  onToggle: (p: Profile) => void;
  onResetPwd: (p: Profile) => void;
  toggling: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; anchorTop: number; anchorBottom: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setMenu(null);
    };
    const closeOnResize = () => {
      setOpen(false);
      setMenu(null);
    };
    const closeOnScroll = () => {
      setOpen(false);
      setMenu(null);
    };
    document.addEventListener("mousedown", close, true);
    window.addEventListener("resize", closeOnResize);
    window.addEventListener("scroll", closeOnScroll, { capture: true, once: true });
    return () => {
      document.removeEventListener("mousedown", close, true);
      window.removeEventListener("resize", closeOnResize);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menu || !menuRef.current) return;
    const menuHeight = menuRef.current.offsetHeight;
    const nextTop =
      menu.anchorBottom + 6 + menuHeight <= window.innerHeight - 8
        ? menu.anchorBottom + 6
        : Math.max(8, menu.anchorTop - menuHeight - 6);
    if (nextTop !== menu.top) {
      setMenu((current) => (current ? { ...current, top: nextTop } : current));
    }
  }, [open, menu]);

  const items = [
    { label: "Edit", onClick: () => onEdit(profile), color: "var(--text)" },
    {
      label: profile.status === "active" ? "Deactivate" : "Activate",
      onClick: () => onToggle(profile),
      color: profile.status === "active" ? "var(--red)" : "var(--green)",
      disabled: toggling,
    },
    { label: "Reset Password", onClick: () => onResetPwd(profile), color: "var(--text)" },
  ];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          if (open) {
            setOpen(false);
            setMenu(null);
            return;
          }
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          const menuWidth = 196;
          setMenu({
            top: rect.bottom + 6,
            left: Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8),
            anchorTop: rect.top,
            anchorBottom: rect.bottom,
          });
          setOpen(true);
        }}
        aria-label="More actions"
        title="Options"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 16,
          letterSpacing: 2,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        ...
      </button>

      {open && menu && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: menu.top,
            left: menu.left,
            width: 196,
            maxHeight: "calc(100vh - 16px)",
            overflowY: "auto",
            zIndex: 2147483647,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "4px 0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10), 0 16px 40px -4px rgba(0,0,0,0.18)",
            transform: "translateZ(0)",
          }}
        >
          {items.map((item, i) => {
            const hoverBg =
              item.color === "var(--red)"
                ? "rgba(220,38,38,0.09)"
                : item.color === "var(--green)"
                ? "rgba(22,163,74,0.09)"
                : "var(--surface-2)";

            return (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  setMenu(null);
                  item.onClick();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 16px",
                  minHeight: 44,
                  background: "transparent",
                  border: "none",
                  color: item.color,
                  cursor: item.disabled ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: "left",
                  opacity: item.disabled ? 0.4 : 1,
                }}
                onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
// Edit User Modal
function EditModal({ profile, divisions, units, onClose, onSaved }: {
  profile: Profile; divisions: Division[]; units: Unit[];
  onClose: () => void; onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [positionTitle, setPositionTitle] = useState(profile.position_title ?? "");
  const [systemRole, setSystemRole] = useState(profile.system_role);
  const [divisionId, setDivisionId] = useState(profile.division_id ?? "");
  const [unitId, setUnitId] = useState(profile.unit_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    const { error: e } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      position_title: positionTitle.trim() || null,
      system_role: systemRole,
      division_id: divisionId || null,
      unit_id: unitId || null,
    }).eq("user_id", profile.user_id);
    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Edit User</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>x</button>
        </div>
        <div className="space-y-3">
          <div><label className="form-label">Full Name</label><input className="tms-input" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div><label className="form-label">Position Title</label><input className="tms-input" placeholder="e.g. Senior Officer" value={positionTitle} onChange={e => setPositionTitle(e.target.value)} /></div>
          <div><label className="form-label">System Role</label><select className="tms-select" value={systemRole} onChange={e => setSystemRole(e.target.value)}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Division</label>
              <select className="tms-select" value={divisionId} onChange={e => { setDivisionId(e.target.value); setUnitId(""); }}>
                <option value="">None</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Unit</label>
              <select className="tms-select" value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!divisionId}>
                <option value="">None</option>
                {units.filter(u => u.division_id === divisionId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !fullName.trim()}>{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reset Password Modal
function ResetPasswordModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [pwd, setPwd] = useState(generatePassword());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const reset = async () => {
    setSaving(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");
      const res = await supabase.functions.invoke("reset-password", {
        body: { target_user_id: profile.user_id, new_password: pwd },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Reset Password</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>x</button>
        </div>
        {done ? (
          <div className="space-y-3">
            <div className="alert alert-success">Password reset successfully.</div>
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 14, color: "var(--text)", wordBreak: "break-all" }}>{pwd}</div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Share this with <strong>{profile.full_name}</strong> now - it will not be shown again.</p>
            <button className="btn btn-ghost w-full" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>New password for <strong style={{ color: "var(--text)" }}>{profile.full_name}</strong></p>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="tms-input" style={{ fontFamily: "monospace" }} value={pwd} onChange={e => setPwd(e.target.value)} />
              <button className="btn btn-ghost btn-sm" onClick={() => setPwd(generatePassword())}>Gen</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={reset} disabled={saving || !pwd.trim()}>{saving ? "Resetting..." : "Reset Password"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main
export default function AdminUserManagement() {
  const [tab, setTab] = useState<Tab>("requests");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", system_role: "staff",
    division_id: "", unit_id: "", position_title: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState<{ name: string; email: string; password: string } | null>(null);

  const [reqForm, setReqForm] = useState<Record<string, { password: string; position_title: string; acting: boolean }>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: u }, { data: r }, profs] = await Promise.all([
      supabase.from("divisions").select("id,name").order("name"),
      supabase.from("units").select("id,name,division_id").order("name"),
      supabase.from("user_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      listProfiles(),
    ]);
    setDivisions((d as Division[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setRequests((r as PendingRequest[]) ?? []);
    setProfiles(profs as Profile[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filteredUnits = (divId: string) => units.filter(u => !divId || u.division_id === divId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password || !form.system_role) {
      setCreateError("Full name, email, password and role are required."); return;
    }
    setCreateSaving(true); setCreateError("");
    try {
      await createSystemUser({
        email: form.email.trim(), password: form.password, full_name: form.full_name.trim(),
        system_role: form.system_role, division_id: form.division_id || null,
        unit_id: form.unit_id || null, position_title: form.position_title.trim() || null,
      });
      setCreateSuccess({ name: form.full_name, email: form.email, password: form.password });
      setForm({ full_name: "", email: "", password: "", system_role: "staff", division_id: "", unit_id: "", position_title: "" });
      await load();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user.");
    } finally { setCreateSaving(false); }
  };

  const approveRequest = async (r: PendingRequest) => {
    const rf = reqForm[r.id]; const password = rf?.password?.trim();
    if (!password) return;
    setReqForm(m => ({ ...m, [r.id]: { ...m[r.id], acting: true } }));
    try {
      await createSystemUser({
        email: r.email, password, full_name: r.full_name,
        system_role: r.requested_role, division_id: r.division_id,
        unit_id: r.unit_id, position_title: rf?.position_title?.trim() || null, request_id: r.id,
      });
      await load();
    } catch (err: any) { alert(`Approval failed: ${err.message}`); }
    finally { setReqForm(m => ({ ...m, [r.id]: { ...m[r.id], acting: false } })); }
  };

  const rejectRequest = async (id: string) => {
    setRejectingId(id);
    try {
      await rejectUserRequest(id);
      await load();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setRejectingId(null);
    }
  };

  const toggleStatus = async (p: Profile) => {
    setTogglingId(p.user_id);
    try {
      await setUserStatus(p.user_id, p.status === "active" ? "disabled" : "active");
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const pendingCount = requests.length;
  const filteredProfiles = profiles.filter(p => {
    if (!search) return true;
    return [p.full_name, p.system_role, p.status, p.position_title ?? ""]
      .join(" ").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-sub">Create accounts, approve requests, manage access</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 12, width: "fit-content", flexWrap: "wrap" }}>
        {(["requests", "create", "users"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            position: "relative", padding: "6px 14px", borderRadius: 8,
            fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
            background: tab === t ? "var(--surface)" : "transparent",
            color: tab === t ? "var(--text)" : "var(--text-muted)",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none", transition: "all .15s",
          }}>
            {t === "requests" ? "Pending Requests" : t === "create" ? "Create User" : "All Users"}
            {t === "requests" && pendingCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4, width: 16, height: 16,
                borderRadius: 9999, background: "var(--red)", color: "#fff",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">

          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-2">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="skeleton h-9 w-28 rounded-xl" />
          </div>

          {/* Search / filters */}
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-10 w-56 rounded-xl" />
            <div className="skeleton h-10 w-32 rounded-xl" />
          </div>

          {/* User cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-28" />
                      <div className="skeleton h-3 w-20" />
                    </div>
                  </div>
                  <div className="skeleton h-8 w-8 rounded-lg" />
                </div>

                <div className="space-y-2">
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-4/5" />
                </div>

                <div className="flex gap-2">
                  <div className="skeleton h-8 w-20 rounded-lg" />
                  <div className="skeleton h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

        </div>
      ) : (
        <>
          {/* Pending Requests */}
          {tab === "requests" && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">[]</div>
                  <p>No pending requests</p>
                  <p style={{ fontSize: 12, color: "var(--text-dim)" }}>New access requests will appear here</p>
                </div>
              ) : (
                requests.map(r => {
                  const rf = reqForm[r.id] ?? { password: "", position_title: "", acting: false };
                  const setRf = (patch: Partial<typeof rf>) => setReqForm(m => ({ ...m, [r.id]: { ...m[r.id], ...patch } }));
                  return (
                    <div key={r.id} className="card" style={{ overflow: "hidden" }}>
                      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", margin: 0 }}>{r.full_name}</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{r.email}</p>
                          <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0", fontFamily: "monospace" }}>
                            Requested {fmtDateTime(r.created_at)}
                          </p>
                        </div>
                        <span className={ROLE_COLORS[r.requested_role] ?? "badge badge-draft"}>
                          {r.requested_role?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="card-body space-y-3">
                        <div>
                          <label className="form-label">Set a temporary password *</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input type="text" className="tms-input" style={{ fontFamily: "monospace" }}
                              placeholder="Temporary password" value={rf.password}
                              onChange={e => setRf({ password: e.target.value })} />
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => setRf({ password: generatePassword() })}>Generate</button>
                          </div>
                          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                            Share this with the user. They can change it after logging in.
                          </p>
                        </div>
                        <div>
                          <label className="form-label">Position Title (optional)</label>
                          <input className="tms-input" placeholder="e.g. Senior Driver"
                            value={rf.position_title} onChange={e => setRf({ position_title: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2" style={{ paddingTop: 4 }}>
                          <button className="btn btn-danger" onClick={() => rejectRequest(r.id)}
                            disabled={rejectingId === r.id}>
                            {rejectingId === r.id ? "Rejecting..." : "Reject"}
                          </button>
                          <button className="btn btn-primary" onClick={() => approveRequest(r)}
                            disabled={!rf.password.trim() || rf.acting}>
                            {rf.acting ? "Creating..." : "Approve and Create"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Create User */}
          {tab === "create" && (
            <div style={{ maxWidth: 520 }} className="space-y-4">
              {createSuccess && (
                <div className="alert alert-success" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  <strong>User created successfully!</strong>
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: 10, fontSize: 12, fontFamily: "monospace", width: "100%",
                  }}>
                    <div><span style={{ color: "var(--text-dim)" }}>Name: </span>{createSuccess.name}</div>
                    <div><span style={{ color: "var(--text-dim)" }}>Email: </span>{createSuccess.email}</div>
                    <div><span style={{ color: "var(--text-dim)" }}>Password: </span>
                      <strong style={{ color: "var(--green)" }}>{createSuccess.password}</strong></div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                    Share the password now. It will not be shown again.
                  </p>
                  <button onClick={() => setCreateSuccess(null)}
                    style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleCreate} className="card">
                <div className="card-header">
                  <h3 className="card-title">New User Account</h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Creates the login and profile in one step</p>
                </div>
                <div className="card-body space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Full Name *</label>
                      <input className="tms-input" placeholder="John Doe" value={form.full_name}
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="form-label">Email *</label>
                      <input type="email" className="tms-input" placeholder="john@org.com" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Temporary Password *</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ position: "relative", flex: 1 }}>
                        <input type={showPwd ? "text" : "password"} className="tms-input"
                          style={{ paddingRight: 36 }} placeholder="Min. 8 characters"
                          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                          required minLength={8} />
                        <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14,
                        }}>{showPwd ? "Hide" : "Show"}</button>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => { const p = generatePassword(); setForm(f => ({ ...f, password: p })); setShowPwd(true); }}>
                        Generate
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>User can change after first login.</p>
                  </div>
                  <div>
                    <label className="form-label">System Role *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ROLES.map(r => (
                        <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, system_role: r.value }))}
                          style={{
                            padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                            cursor: "pointer", textAlign: "left", transition: "all .15s",
                            border: "1px solid " + (form.system_role === r.value ? "var(--accent)" : "var(--border)"),
                            background: form.system_role === r.value ? "var(--accent-dim)" : "var(--surface)",
                            color: form.system_role === r.value ? "var(--accent)" : "var(--text-muted)",
                          }}>{r.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Division</label>
                      <select className="tms-select" value={form.division_id}
                        onChange={e => setForm(f => ({ ...f, division_id: e.target.value, unit_id: "" }))}>
                        <option value="">None</option>
                        {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Unit</label>
                      <select className="tms-select" value={form.unit_id}
                        onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))} disabled={!form.division_id}>
                        <option value="">None</option>
                        {filteredUnits(form.division_id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Position Title</label>
                    <input className="tms-input" placeholder="e.g. News Coordinator" value={form.position_title}
                      onChange={e => setForm(f => ({ ...f, position_title: e.target.value }))} />
                  </div>
                  {createError && <div className="alert alert-error">{createError}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" disabled={createSaving}>
                      {createSaving ? "Creating..." : "Create User"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* All Users */}
          {tab === "users" && (
            <div className="space-y-3">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="tms-input" style={{ maxWidth: 260 }} placeholder="Search name or role..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto", fontFamily: "monospace" }}>
                  {profiles.length} users
                </span>
              </div>

              {/* Mobile */}
              <div className="block md:hidden space-y-2">
                {filteredProfiles.map(p => (
                  <div key={p.user_id} className="card">
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.full_name}</span>
                          <span className={ROLE_COLORS[p.system_role] ?? "badge badge-draft"}>
                            {p.system_role?.replace(/_/g, " ")}
                          </span>
                          {p.status !== "active" && <span className="badge badge-rejected">{p.status}</span>}
                        </div>
                        {p.position_title && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{p.position_title}</p>
                        )}
                      </div>
                      <ContextMenu profile={p} onEdit={setEditTarget}
                        onToggle={toggleStatus} onResetPwd={setResetTarget}
                        toggling={togglingId === p.user_id} />
                    </div>

                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block tms-table-wrap">
                <table className="tms-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Role</th><th>Position</th><th>Status</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map(p => (
                      <tr key={p.user_id}>
                        <td style={{ fontWeight: 500 }}>{p.full_name}</td>
                        <td>
                          <span className={ROLE_COLORS[p.system_role] ?? "badge badge-draft"}>
                            {p.system_role?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.position_title || "-"}</td>
                        <td>
                          <span className={`badge ${p.status === "active" ? "badge-approved" : "badge-rejected"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <ContextMenu profile={p} onEdit={setEditTarget}
                            onToggle={toggleStatus} onResetPwd={setResetTarget}
                            toggling={togglingId === p.user_id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredProfiles.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">[]</div>
                  <p>No users found</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editTarget && (
        <EditModal profile={editTarget} divisions={divisions} units={units}
          onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}
      {resetTarget && (
        <ResetPasswordModal profile={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}

