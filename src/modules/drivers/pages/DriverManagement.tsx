// src/modules/drivers/pages/DriverManagement.tsx
// Changes vs previous:
//  - Admin-only: Delete, Reset Password (removed from transport_supervisor ctx menu)
//  - Transport supervisor cannot edit: employment_date, user_id (hidden in form)
//  - Pagination (10 rows per page)
//  - Leave requests tab added
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, SearchInput, Field, Input, Select, Btn, Modal, TabBar } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { useAuth } from "@/hooks/useAuth";

type Driver = {
  id: string; full_name: string | null; license_number: string; license_expiry: string | null;
  license_class: string | null; employment_status: string; employment_date: string | null;
  phone: string | null; user_id: string | null; team_id: string | null; team_name: string | null;
  team_role: string | null; assigned_route: string | null; route_id: string | null; notes: string | null;
};
type Team  = { id: string; name: string };
type Route = { id: string; name: string; route_type: string };
type LeaveReq = {
  id: string; driver_id: string; driver_name: string; leave_type: string;
  start_date: string; end_date: string; working_days: number; reason: string | null;
  status: string; created_at: string;
};
type FormData = {
  user_id: string; license_number: string; license_class: string; license_expiry: string;
  employment_status: string; employment_date: string; phone: string;
  team_id: string; team_role: string; route_id: string; notes: string;
};
const EMPTY: FormData = { user_id:"",license_number:"",license_class:"B",license_expiry:"",employment_status:"active",employment_date:"",phone:"",team_id:"",team_role:"member",route_id:"",notes:"" };
const EMP_STATUSES = ["all","active","inactive","suspended","on_leave"];
const LICENSE_CLASSES = ["A","B","C","D","B+C","B+C+D","Commercial"];
const TEAM_ROLES = [{ value:"leader",label:"Group Leader"},{ value:"assistant",label:"Assistant"},{ value:"member",label:"Team Member"}];
const LEAVE_TYPES = ["annual","sick","emergency","other"];

function daysLeft(expiry:string|null):number|null{
  if(!expiry) return null;
  return Math.floor((new Date(expiry).getTime()-Date.now())/86_400_000);
}
function ExpiryPill({days}:{days:number|null}){
  if(days===null) return null;
  if(days<0) return <span style={{fontSize:11,fontWeight:700,color:"var(--red)",background:"rgba(220,38,38,0.1)",padding:"2px 8px",borderRadius:20}}>Expired</span>;
  if(days<=30) return <span style={{fontSize:11,fontWeight:700,color:"var(--amber)",background:"rgba(217,119,6,0.1)",padding:"2px 8px",borderRadius:20}}>{days}d left</span>;
  return null;
}
function TeamRoleBadge({role}:{role:string|null}){
  const map:Record<string,{label:string;cls:string}>={ leader:{label:"Group Leader",cls:"badge-approved"}, assistant:{label:"Assistant",cls:"badge-dispatched"}, member:{label:"Member",cls:"badge-draft"} };
  const r=map[role??"member"]??map.member;
  return <span className={`badge ${r.cls}`}>{r.label}</span>;
}
function ExpiryBanner({variant,drivers}:{variant:"expired"|"expiring";drivers:Driver[]}){
  if(drivers.length===0) return null;
  const isExp=variant==="expired";
  return (
    <div style={{display:"flex",gap:14,padding:"14px 16px",borderRadius:14,background:isExp?"rgba(220,38,38,0.07)":"rgba(217,119,6,0.07)",border:`1px solid ${isExp?"rgba(220,38,38,0.35)":"rgba(217,119,6,0.35)"}`,borderLeft:`4px solid ${isExp?"var(--red)":"var(--amber)"}`}}>
      <div style={{fontSize:20,lineHeight:1,paddingTop:1,flexShrink:0}}>{isExp?"🚨":"⏰"}</div>
      <div style={{minWidth:0,flex:1}}>
        <p style={{fontSize:13,fontWeight:700,color:isExp?"var(--red)":"var(--amber)",marginBottom:4}}>{isExp?`${drivers.length} licence${drivers.length>1?"s":""} expired`:`${drivers.length} licence${drivers.length>1?"s":""} expiring within 30 days`}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px"}}>{drivers.map(d=><span key={d.id} style={{fontSize:12,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:600,color:"var(--text)"}}>{d.full_name??d.license_number}</span>{d.license_expiry&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,opacity:0.8}}>· {fmtDate(d.license_expiry)}</span>}</span>)}</div>
      </div>
    </div>
  );
}

// ctx menu
type CtxItem = {label:string;icon:string;cls?:string;onClick:()=>void};
type MenuState = {top:number;left:number}|null;
function CtxMenu({items}:{items:CtxItem[]}){
  const [menu,setMenu]=useState<MenuState>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!menu) return;
    const close=(e:MouseEvent)=>{if(menuRef.current?.contains(e.target as Node)||triggerRef.current?.contains(e.target as Node)) return;setMenu(null);};
    document.addEventListener("mousedown",close,true);
    window.addEventListener("scroll",()=>setMenu(null),{capture:true,once:true});
    return()=>document.removeEventListener("mousedown",close,true);
  },[menu]);
  const toggle=()=>{
    if(menu){setMenu(null);return;}
    const rect=triggerRef.current?.getBoundingClientRect();
    if(!rect) return;
    const W=196;
    setMenu({top:rect.bottom+6,left:Math.min(Math.max(8,rect.right-W),window.innerWidth-W-8)});
  };
  return (
    <>
      <button ref={triggerRef} onClick={toggle} aria-label="More actions"
        style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:32,height:32,padding:0,background:"transparent",border:"1px solid var(--border)",borderRadius:8,cursor:"pointer",color:"var(--text-muted)",fontSize:16,letterSpacing:2,flexShrink:0}}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--surface-2)"}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="transparent"}}>•••</button>
      {menu&&createPortal(
        <div ref={menuRef} role="menu" style={{position:"fixed",top:menu.top,left:menu.left,width:196,zIndex:2147483647,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",padding:"4px 0",boxShadow:"0 4px 6px -1px rgba(0,0,0,0.10), 0 16px 40px -4px rgba(0,0,0,0.18)",transform:"translateZ(0)"}}>
          {items.map((item,i)=>{
            const fg=item.cls==="danger"?"var(--red)":item.cls==="warning"?"var(--amber)":item.cls==="success"?"var(--green)":"var(--text)";
            const hoverBg=item.cls==="danger"?"rgba(220,38,38,0.09)":item.cls==="warning"?"rgba(217,119,6,0.09)":item.cls==="success"?"rgba(22,163,74,0.09)":"var(--surface-2)";
            return <button key={i} role="menuitem" onClick={()=>{setMenu(null);item.onClick();}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 16px",minHeight:44,background:"transparent",border:"none",color:fg,cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left"}} onMouseEnter={e=>(e.currentTarget.style.background=hoverBg)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}><span style={{fontSize:15,lineHeight:1,flexShrink:0}}>{item.icon}</span><span style={{fontFamily:"inherit"}}>{item.label}</span></button>;
          })}
        </div>,document.body
      )}
    </>
  );
}

function ConfirmDialog({open,title,message,confirmLabel="Confirm",variant="danger",onConfirm,onCancel}:{open:boolean;title:string;message:string;confirmLabel?:string;variant?:"danger"|"warning";onConfirm:()=>void;onCancel:()=>void;}){
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:2147483646,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <h3 style={{fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:8}}>{title}</h3>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:20,lineHeight:1.5}}>{message}</p>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant={variant==="danger"?"danger":"amber"} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

const LEAVE_STATUS_LABEL: Record<string,string> = {
  pending_supervisor:"Awaiting Supervisor", pending_corporate:"Awaiting Corporate",
  pending_hr:"Awaiting HR", approved:"Approved", rejected:"Rejected",
};

export default function DriverManagement() {
  const { profile } = useAuth();
  const isAdmin = profile?.system_role === "admin";
  const isSupervisor = profile?.system_role === "transport_supervisor";

  const [drivers,setDrivers]   = useState<Driver[]>([]);
  const [teams,setTeams]       = useState<Team[]>([]);
  const [routes,setRoutes]     = useState<Route[]>([]);
  const [loading,setLoading]   = useState(true);
  const [showForm,setShowForm] = useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [form,setForm]         = useState<FormData>(EMPTY);
  const [saving,setSaving]     = useState(false);
  const [error,setError]       = useState<string|null>(null);
  const [q,setQ]               = useState("");
  const [tab,setTab]           = useState("all");
  const [deleteId,setDeleteId] = useState<string|null>(null);
  const [deleteName,setDeleteName]=useState("");
  const [togglingId,setTogglingId]=useState<string|null>(null);
  const [resetId,setResetId]   = useState<string|null>(null);
  const [resetName,setResetName]=useState("");
  const [newPwd,setNewPwd]     = useState("");
  const [resetSaving,setResetSaving]=useState(false);
  const [resetError,setResetError]=useState("");
  // Leave
  const [pageTab,setPageTab]   = useState<"drivers"|"leave">("drivers");
  const [leaves,setLeaves]     = useState<LeaveReq[]>([]);
  const [leavesLoading,setLeavesLoading]=useState(false);
  const [showLeaveForm,setShowLeaveForm]=useState<string|null>(null); // driver id
  const [leaveType,setLeaveType]=useState("annual");
  const [leaveStart,setLeaveStart]=useState("");
  const [leaveEnd,setLeaveEnd]=useState("");
  const [leaveReason,setLeaveReason]=useState("");
  const [leaveSaving,setLeaveSaving]=useState(false);
  const [actingLeave,setActingLeave]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);
    const {data:driverData,error:driverErr}=await supabase.from("drivers")
      .select("id,user_id,full_name,license_number,license_class,license_expiry,employment_status,employment_date,phone,notes,team_id,team_role,route_id").order("license_number");
    if(driverErr){console.error(driverErr.message);setLoading(false);return;}
    const rows=(driverData as any[])||[];
    const {data:td}=await supabase.from("driver_teams").select("id,name").order("name");
    const teamsArr:Team[]=(td as Team[])||[];setTeams(teamsArr);
    const {data:rd}=await supabase.from("evening_routes").select("id,name,route_type").order("name");
    const routesArr:Route[]=(rd as Route[])||[];setRoutes(routesArr);
    const teamNameMap=Object.fromEntries(teamsArr.map(t=>[t.id,t.name]));
    const routeNameMap=Object.fromEntries(routesArr.map(r=>[r.id,r.name]));
    const missingNameIds=rows.filter((d:any)=>!d.full_name&&d.user_id).map((d:any)=>d.user_id);
    let profileNameMap:Record<string,string>={};
    if(missingNameIds.length>0){
      const {data:pd}=await supabase.from("profiles").select("user_id,full_name").in("user_id",missingNameIds);
      profileNameMap=Object.fromEntries(((pd as any[])||[]).map(p=>[p.user_id,p.full_name]));
    }
    setDrivers(rows.map((d:any):Driver=>({
      id:d.id,user_id:d.user_id??null,
      full_name:d.full_name??(d.user_id?(profileNameMap[d.user_id]??null):null),
      license_number:d.license_number,license_class:d.license_class??null,
      license_expiry:d.license_expiry??null,employment_status:d.employment_status??"active",
      employment_date:d.employment_date??null,phone:d.phone??null,notes:d.notes??null,
      team_id:d.team_id??null,team_name:d.team_id?(teamNameMap[d.team_id]??null):null,
      team_role:d.team_role??null,route_id:d.route_id??null,assigned_route:d.route_id?(routeNameMap[d.route_id]??null):null,
    })));
    setLoading(false);
  };

  const loadLeaves=async()=>{
    setLeavesLoading(true);
    const {data}=await supabase.from("driver_leave_requests")
      .select("id,driver_id,leave_type,start_date,end_date,working_days,reason,status,created_at").order("created_at",{ascending:false});
    const raw=(data as any[])||[];
    const driverIds=[...new Set(raw.map(r=>r.driver_id))];
    const {data:drData}=await supabase.from("drivers").select("id,full_name").in("id",driverIds);
    const nameMap=Object.fromEntries(((drData as any[])||[]).map(d=>[d.id,d.full_name??"Unknown"]));
    setLeaves(raw.map(r=>({...r,driver_name:nameMap[r.driver_id]??"Unknown"})));
    setLeavesLoading(false);
  };

  useEffect(()=>{load();},[]);
  useEffect(()=>{if(pageTab==="leave") loadLeaves();},[pageTab]);

  const f=(k:keyof FormData,v:string)=>setForm(p=>({...p,[k]:v}));
  const openAdd=()=>{setForm(EMPTY);setEditingId(null);setError(null);setShowForm(true);};
  const openEdit=(d:Driver)=>{
    setForm({
      user_id:d.user_id??"",license_number:d.license_number,license_class:d.license_class??"B",
      license_expiry:d.license_expiry??"",employment_status:d.employment_status,
      employment_date:d.employment_date??"",phone:d.phone??"",
      team_id:d.team_id??"",team_role:d.team_role??"member",route_id:d.route_id??"",notes:d.notes??"",
    });
    setEditingId(d.id);setError(null);setShowForm(true);
  };

  const save=async()=>{
    if(!form.license_number.trim()){setError("Licence number is required.");return;}
    setSaving(true);setError(null);
    try {
      const payload:any={
        license_number:form.license_number.trim().toUpperCase(),
        license_class:form.license_class||null,license_expiry:form.license_expiry||null,
        employment_status:form.employment_status,phone:form.phone.trim()||null,
        team_id:form.team_id||null,team_role:form.team_id?(form.team_role||"member"):null,
        route_id:form.route_id||null,notes:form.notes.trim()||null,
      };
      // Admin-only fields
      if(isAdmin){
        payload.user_id=form.user_id.trim()||null;
        payload.employment_date=form.employment_date||null;
      }
      if(editingId){const {error:e}=await supabase.from("drivers").update(payload).eq("id",editingId);if(e) throw e;}
      else{const {error:e}=await supabase.from("drivers").insert(payload);if(e) throw e;}
      setShowForm(false);await load();
    } catch(e:any){setError(e.message??"Save failed.");}
    finally{setSaving(false);}
  };

  const toggleStatus=async(d:Driver)=>{
    setTogglingId(d.id);
    const next=d.employment_status==="active"?"inactive":"active";
    await supabase.from("drivers").update({employment_status:next}).eq("id",d.id);
    await load();setTogglingId(null);
  };

  const handleDelete=async()=>{
    if(!deleteId) return;
    await supabase.from("drivers").delete().eq("id",deleteId);
    setDeleteId(null);await load();
  };

  const handleResetPassword=async()=>{
    if(!resetId||!newPwd.trim()){setResetError("New password is required.");return;}
    if(newPwd.trim().length<8){setResetError("Password must be at least 8 characters.");return;}
    setResetSaving(true);setResetError("");
    try {
      const driver=drivers.find(d=>d.id===resetId);
      if(!driver?.user_id) throw new Error("This driver has no linked user account.");
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error("Not authenticated.");
      const res=await supabase.functions.invoke("reset-password",{body:{target_user_id:driver.user_id,new_password:newPwd.trim()},headers:{Authorization:`Bearer ${session.access_token}`}});
      if(res.error) throw new Error(res.error.message);
      if(res.data?.error) throw new Error(res.data.error);
      setResetId(null);setNewPwd("");
    } catch(e:any){setResetError(e.message??"Failed to reset password.");}
    finally{setResetSaving(false);}
  };

  const submitLeave=async()=>{
    if(!showLeaveForm||!leaveStart||!leaveEnd){return;}
    setLeaveSaving(true);
    try {
      const {error}=await supabase.rpc("submit_driver_leave",{
        p_driver_id:showLeaveForm,p_leave_type:leaveType,
        p_start_date:leaveStart,p_end_date:leaveEnd,p_reason:leaveReason||null,
      });
      if(error) throw error;
      setShowLeaveForm(null);setLeaveType("annual");setLeaveStart("");setLeaveEnd("");setLeaveReason("");
      await loadLeaves();
    } catch(e:any){alert(e.message);}
    finally{setLeaveSaving(false);}
  };

  const actLeave=async(id:string,action:"approved"|"rejected",stage:string)=>{
    setActingLeave(id);
    const {error}=await supabase.rpc("action_driver_leave",{p_request_id:id,p_action:action,p_stage:stage,p_note:null});
    if(error) alert(error.message);
    await loadLeaves();setActingLeave(null);
  };

  const expired     =drivers.filter(d=>{const n=daysLeft(d.license_expiry);return n!==null&&n<0;});
  const expiringSoon=drivers.filter(d=>{const n=daysLeft(d.license_expiry);return n!==null&&n>=0&&n<=30;});
  const tabs=EMP_STATUSES.map(s=>({value:s,label:s==="all"?"All":s.replace(/_/g," ").replace(/^\w/,c=>c.toUpperCase())}));
  const counts=Object.fromEntries(EMP_STATUSES.map(s=>[s,s==="all"?drivers.length:drivers.filter(d=>d.employment_status===s).length]));
  const filtered=drivers.filter(d=>{
    const matchQ=!q||[d.full_name??"",d.license_number,d.phone??"",d.team_name??""].join(" ").toLowerCase().includes(q.toLowerCase());
    return matchQ&&(tab==="all"||d.employment_status===tab);
  });
  const pg=usePagination(filtered);

  if(loading) return <PageSpinner/>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{drivers.length} total drivers</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={openAdd}>+ Add Driver</Btn>
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{background:"var(--surface-2)"}}>
        {[{v:"drivers",l:"Drivers"},{v:"leave",l:"Leave Requests"}].map(t=>(
          <button key={t.v} onClick={()=>setPageTab(t.v as "drivers"|"leave")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{background:pageTab===t.v?"var(--surface)":"transparent",color:pageTab===t.v?"var(--text)":"var(--text-muted)",boxShadow:pageTab===t.v?"var(--shadow-sm)":"none"}}>
            {t.l}
          </button>
        ))}
      </div>

      {pageTab==="drivers"&&(
        <>
          <ExpiryBanner variant="expired" drivers={expired}/>
          <ExpiryBanner variant="expiring" drivers={expiringSoon}/>
          <TabBar tabs={tabs} active={tab} onChange={t=>{setTab(t);pg.reset();}} counts={counts}/>
          <SearchInput value={q} onChange={v=>{setQ(v);pg.reset();}} placeholder="Search name, licence, phone, team…"/>

          {filtered.length===0?(
            <EmptyState title="No drivers found" subtitle="Try adjusting search or filters"/>
          ):(
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {pg.slice.map(d=>{
                  const days=daysLeft(d.license_expiry);
                  const isActive=d.employment_status==="active";
                  const ctxItems:CtxItem[]=[
                    {label:"Edit",icon:"✏️",onClick:()=>openEdit(d)},
                    {label:isActive?"Deactivate":"Activate",icon:isActive?"🔒":"✅",cls:isActive?"warning":"success",onClick:()=>toggleStatus(d)},
                    {label:"Apply Leave",icon:"🏖️",onClick:()=>{setShowLeaveForm(d.id);setPageTab("leave");}},
                  ];
                  if(isAdmin){
                    ctxItems.push({label:"Reset Password",icon:"🔑",onClick:()=>{if(!d.user_id){alert("No linked account.");return;}setResetId(d.id);setResetName(d.full_name??d.license_number);setNewPwd("");setResetError("");}});
                    ctxItems.push({label:"Delete",icon:"🗑️",cls:"danger",onClick:()=>{setDeleteId(d.id);setDeleteName(d.full_name??d.license_number);}});
                  }
                  return (
                    <Card key={d.id}>
                      <div className="p-4">
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>{d.full_name??<span style={{color:"var(--text-dim)",fontStyle:"italic",fontWeight:400}}>No account linked</span>}</span>
                              <Badge status={d.employment_status}/>
                            </div>
                            <p style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:"var(--text-muted)",marginTop:2}}>{d.license_number}</p>
                          </div>
                          <CtxMenu items={ctxItems}/>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {d.phone&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text-muted)"}}><span>📞</span><span style={{fontFamily:"'IBM Plex Mono',monospace"}}>{d.phone}</span></div>}
                          {d.employment_date&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text-muted)"}}><span>📅</span><span>Joined {fmtDate(d.employment_date)}</span></div>}
                          {d.team_name&&<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:12}}>👥</span><span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{d.team_name}</span><TeamRoleBadge role={d.team_role}/></div>}
                          {d.license_expiry&&<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:"var(--text-muted)"}}>🪪 Expires {fmtDate(d.license_expiry)}</span><ExpiryPill days={days}/></div>}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead>
                      <tr>{["Driver","Licence No.","Class","Phone","Joined","Team","Role","Route","Expiry","Status",""].map(h=><th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {pg.slice.map(d=>{
                        const days=daysLeft(d.license_expiry);
                        const isActive=d.employment_status==="active";
                        const ctxItems:CtxItem[]=[
                          {label:"Edit",icon:"✏️",onClick:()=>openEdit(d)},
                          {label:isActive?"Deactivate":"Activate",icon:isActive?"🔒":"✅",cls:isActive?"warning":"success",onClick:()=>toggleStatus(d)},
                          {label:"Apply Leave",icon:"🏖️",onClick:()=>{setShowLeaveForm(d.id);setPageTab("leave");}},
                        ];
                        if(isAdmin){
                          ctxItems.push({label:"Reset Password",icon:"🔑",onClick:()=>{if(!d.user_id){alert("No linked account.");return;}setResetId(d.id);setResetName(d.full_name??d.license_number);setNewPwd("");setResetError("");}});
                          ctxItems.push({label:"Delete",icon:"🗑️",cls:"danger",onClick:()=>{setDeleteId(d.id);setDeleteName(d.full_name??d.license_number);}});
                        }
                        return (
                          <tr key={d.id}>
                            <td><div style={{fontWeight:600,whiteSpace:"nowrap"}}>{d.full_name??<span style={{color:"var(--text-dim)",fontStyle:"italic",fontSize:12}}>No account</span>}</div></td>
                            <td style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>{d.license_number}</td>
                            <td style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"var(--text-muted)"}}>{d.license_class??"—"}</td>
                            <td style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"var(--text-muted)"}}>{d.phone??"—"}</td>
                            <td style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>{d.employment_date?fmtDate(d.employment_date):"—"}</td>
                            <td>{d.team_name?<span style={{fontWeight:600,fontSize:13}}>{d.team_name}</span>:<span style={{color:"var(--text-dim)",fontSize:12}}>—</span>}</td>
                            <td>{d.team_role?<TeamRoleBadge role={d.team_role}/>:<span style={{color:"var(--text-dim)",fontSize:12}}>—</span>}</td>
                            <td>{d.assigned_route?<span className="badge badge-dispatched" style={{whiteSpace:"nowrap"}}>{d.assigned_route}</span>:<span style={{color:"var(--text-dim)",fontSize:12}}>—</span>}</td>
                            <td style={{whiteSpace:"nowrap"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:"var(--text-muted)"}}>{d.license_expiry?fmtDate(d.license_expiry):"—"}</span><ExpiryPill days={days}/></div></td>
                            <td><Badge status={d.employment_status}/></td>
                            <td><div style={{display:"flex",justifyContent:"center"}}><CtxMenu items={ctxItems}/></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationBar {...pg}/>
              </div>
            </>
          )}
        </>
      )}

      {pageTab==="leave"&&(
        <div className="space-y-3">
          {leavesLoading?<PageSpinner/>:leaves.length===0?(
            <EmptyState title="No leave requests" subtitle="Driver leave requests will appear here"/>
          ):(
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Driver</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {leaves.map(l=>(
                      <tr key={l.id}>
                        <td className="font-medium">{l.driver_name}</td>
                        <td className="capitalize">{l.leave_type}</td>
                        <td className="whitespace-nowrap text-xs">{fmtDate(l.start_date)}</td>
                        <td className="whitespace-nowrap text-xs">{fmtDate(l.end_date)}</td>
                        <td>{l.working_days}</td>
                        <td><span className="badge badge-submitted text-xs">{LEAVE_STATUS_LABEL[l.status]??l.status}</span></td>
                        <td>
                          <div className="flex gap-2">
                            {l.status==="pending_supervisor"&&(isSupervisor||isAdmin)&&(
                              <>
                                <Btn size="sm" variant="success" loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"approved","supervisor")}>Approve</Btn>
                                <Btn size="sm" variant="danger"  loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"rejected","supervisor")}>Reject</Btn>
                              </>
                            )}
                            {l.status==="pending_corporate"&&(profile?.system_role==="corporate_approver"||isAdmin)&&(
                              <>
                                <Btn size="sm" variant="success" loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"approved","corporate")}>Approve</Btn>
                                <Btn size="sm" variant="danger"  loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"rejected","corporate")}>Reject</Btn>
                              </>
                            )}
                            {l.status==="pending_hr"&&(profile?.system_role==="unit_head"||isAdmin)&&(
                              <>
                                <Btn size="sm" variant="success" loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"approved","hr")}>Finalise</Btn>
                                <Btn size="sm" variant="danger"  loading={actingLeave===l.id} onClick={()=>actLeave(l.id,"rejected","hr")}>Reject</Btn>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editingId?"Edit Driver":"Add Driver"} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Licence Number" required><Input value={form.license_number} onChange={e=>f("license_number",e.target.value)} placeholder="GHA-DRV-12345"/></Field>
            <Field label="Licence Class"><Select value={form.license_class} onChange={e=>f("license_class",e.target.value)}>{LICENSE_CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Licence Expiry"><Input type="date" value={form.license_expiry} onChange={e=>f("license_expiry",e.target.value)}/></Field>
            <Field label="Phone Number"><Input value={form.phone} onChange={e=>f("phone",e.target.value)} placeholder="+233 XX XXX XXXX"/></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Employment Status">
              <Select value={form.employment_status} onChange={e=>f("employment_status",e.target.value)}>
                {["active","inactive","suspended","on_leave","terminated"].map(s=><option key={s} value={s}>{s.replace(/_/g," ").replace(/^\w/,c=>c.toUpperCase())}</option>)}
              </Select>
            </Field>
            {/* Admin-only: employment date */}
            {isAdmin&&(
              <Field label="Employment Date"><Input type="date" value={form.employment_date} onChange={e=>f("employment_date",e.target.value)}/></Field>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Team">
              <Select value={form.team_id} onChange={e=>{f("team_id",e.target.value);if(!e.target.value)f("team_role","member");}}>
                <option value="">— Unassigned —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Role in Team">
              <Select value={form.team_role} onChange={e=>f("team_role",e.target.value)} disabled={!form.team_id}>
                {TEAM_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Assigned Evening Route">
            <Select value={form.route_id} onChange={e=>f("route_id",e.target.value)}>
              <option value="">— None —</option>{routes.map(r=><option key={r.id} value={r.id}>[{r.route_type?.toUpperCase()}] {r.name}</option>)}
            </Select>
          </Field>
          {/* Admin-only: user_id */}
          {isAdmin&&(
            <Field label="Linked User Account ID (optional)">
              <Input value={form.user_id} onChange={e=>f("user_id",e.target.value)} placeholder="Auth user UUID"/>
            </Field>
          )}
          <Field label="Notes"><Input value={form.notes} onChange={e=>f("notes",e.target.value)} placeholder="Additional notes…"/></Field>
          {error&&<p style={{fontSize:13,color:"var(--red)"}}>{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={()=>setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save}>{editingId?"Update Driver":"Add Driver"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Leave application modal */}
      <Modal open={!!showLeaveForm} onClose={()=>setShowLeaveForm(null)} title="Apply for Leave" maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Leave Type">
            <Select value={leaveType} onChange={e=>setLeaveType(e.target.value)}>
              {LEAVE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" required><Input type="date" value={leaveStart} onChange={e=>setLeaveStart(e.target.value)}/></Field>
            <Field label="End Date" required><Input type="date" value={leaveEnd} min={leaveStart} onChange={e=>setLeaveEnd(e.target.value)}/></Field>
          </div>
          <Field label="Reason"><Input value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} placeholder="Optional reason…"/></Field>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={()=>setShowLeaveForm(null)}>Cancel</Btn>
            <Btn variant="primary" loading={leaveSaving} onClick={submitLeave}>Submit Leave</Btn>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetId} onClose={()=>setResetId(null)} title="Reset Password" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p style={{fontSize:13,color:"var(--text-muted)",lineHeight:1.6}}>Set a new login password for <strong style={{color:"var(--text)"}}>{resetName}</strong>.</p>
          <Field label="New Password" required><Input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Min. 8 characters"/></Field>
          {resetError&&<p style={{fontSize:13,color:"var(--red)"}}>{resetError}</p>}
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={()=>setResetId(null)}>Cancel</Btn>
            <Btn variant="primary" loading={resetSaving} onClick={handleResetPassword}>Reset Password</Btn>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId} title="Delete Driver"
        message={`Remove ${deleteName}? Their driver record will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" variant="danger"
        onConfirm={handleDelete} onCancel={()=>setDeleteId(null)}
      />
    </div>
  );
}