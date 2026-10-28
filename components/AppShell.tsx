"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import { usePathname } from "next/navigation";
import { ModeBadge } from "./ModeBadge";
import { NotificationBell } from "./NotificationBell";
import { SignOutButton } from "./SignOutButton";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { AdminRecordHistory } from "./admin/AdminRecordHistory";
import type { UserRole } from "@/lib/types";

const navByRole: Record<UserRole, Array<{label:string;href:string;group?:string}>> = {
  student: [
    {label:"Home",href:"/student"},{label:"My Calendar",href:"/student/calendar"},{label:"My Profile",href:"/student/profile"},{label:"My Course",href:"/student/course"},{label:"My Projects",href:"/student/portfolio"},{label:"Notifications",href:"/student/notifications"}
  ],
  parent: [
    {label:"Family Dashboard",href:"/parent"},{label:"Calendar",href:"/parent/calendar"},{label:"Fees & Payments",href:"/parent/billing"},{label:"Family Profile",href:"/parent/profile"},{label:"Messages",href:"/parent/messages"},{label:"Notifications",href:"/parent/notifications"},{label:"Add learner",href:"/onboarding"}
  ],
  trainer: [
    {label:"Home",href:"/trainer"},{label:"My Profile",href:"/trainer/profile"},{label:"Learner Progress",href:"/trainer/progress"},{label:"Demo Experience",href:"/trainer/demos"},{label:"My Classes",href:"/trainer/classes"},{label:"My Schedule",href:"/trainer/schedule"},{label:"My Courses",href:"/trainer/courses"},{label:"My Earnings",href:"/trainer/earnings"},{label:"Messages",href:"/trainer/messages"},{label:"Notifications",href:"/trainer/notifications"}
  ],
  admin: [
    {label:"Overview",href:"/admin",group:"Workspace"},{label:"My Account",href:"/admin/account",group:"Workspace"},{label:"Parent Community",href:"/admin/community",group:"Workspace"},
    {label:"Onboarding",href:"/admin/onboarding",group:"Learners"},
    {label:"Students",href:"/admin/students",group:"Learners"},
    {label:"Trainers",href:"/admin/trainers",group:"Delivery"},
    {label:"Courses",href:"/admin/courses",group:"Delivery"},
    {label:"Enrollments",href:"/admin/enrollments",group:"Delivery"},
    {label:"Demo Experience",href:"/admin/demos",group:"Delivery"},
    {label:"Schedule",href:"/admin/schedule",group:"Operations"},
    {label:"Classes",href:"/admin/classes",group:"Operations"},
    {label:"Zoom Classroom",href:"/admin/zoom",group:"Operations"},
    {label:"Operational Alerts",href:"/admin/alerts",group:"Operations"},
    {label:"Corrections & Audit",href:"/admin/audit",group:"Operations"},
    {label:"System Logs",href:"/admin/system-logs",group:"Operations"},
    {label:"Fees & Earnings",href:"/admin/finance",group:"Finance"},
    {label:"International Invoices",href:"/admin/invoices",group:"Finance"},
    {label:"Trainer Payroll",href:"/admin/trainer-finance",group:"Finance"},
    {label:"Progress",href:"/admin/progress",group:"Learners"},
    {label:"Messages",href:"/admin/messages",group:"Communication"},
    {label:"Notifications",href:"/admin/notifications",group:"Communication"},
    {label:"Reminder Rules",href:"/admin/reminders",group:"Communication"},
  ],
};

const adminIconPaths:Record<string,string>={
 "/admin":"M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 "/admin/account":"M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10a5 5 0 0 0 0 10",
 "/admin/community":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
 "/admin/onboarding":"M12 5v14 M5 12h14 M3 3h18v18H3z",
 "/admin/students":"M3 10l9-5 9 5-9 5-9-5z M7 13v5c3 2 7 2 10 0v-5 M21 10v7",
 "/admin/trainers":"M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10a5 5 0 0 0 0 10 M16 4l2 2 4-4",
 "/admin/courses":"M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5z M12 6v13.5",
 "/admin/enrollments":"M8 4h13v16H8z M3 8h5 M3 12h5 M3 16h5 M12 9h5 M12 13h5",
 "/admin/demos":"M8 5l12 7-12 7z M3 3h18v18H3z",
 "/admin/schedule":"M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16 M8 15h3",
 "/admin/classes":"M3 5h18v14H3z M8 19v3 M16 19v3 M7 22h10 M8 10h8",
 "/admin/zoom":"M3 7h13v10H3z M16 10l5-3v10l-5-3",
 "/admin/alerts":"M12 3l10 18H2z M12 10v4 M12 18h.01",
 "/admin/audit":"M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3 M16 16l2 2 3-4",
 "/admin/system-logs":"M4 4h16v16H4z M8 9l3 3-3 3 M13 16h4",
 "/admin/finance":"M3 6h18v14H3z M3 10h18 M7 16h4",
 "/admin/invoices":"M6 3h12v18l-3-2-3 2-3-2-3 2z M9 9h6 M9 13h6",
 "/admin/trainer-finance":"M3 5h18v14H3z M7 10h10 M7 14h6 M17 15h.01",
 "/admin/progress":"M4 19V12 M10 19V6 M16 19v-9 M22 19V3",
 "/admin/messages":"M3 4h18v14H8l-5 3z M7 9h10 M7 13h7",
 "/admin/notifications":"M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9 M10 21h4",
 "/admin/reminders":"M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18 M12 7v5l3 2"
};
function AdminSidebarIcon({href}:{href:string}){
 return <svg className="adminSidebarIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={adminIconPaths[href]||"M4 4h16v16H4z"}/></svg>;
}

function isActive(path:string, href:string){
  if(href==="/admin"||href==="/trainer"||href==="/parent"||href==="/student") return path===href;
  // Keep sibling Progress routes visually distinct.
  if(href==="/admin/progress") return path===href || /^\/admin\/progress\/(?!alerts(?:\/|$)|projects(?:\/|$))[^/]+$/.test(path);
  return path===href||path.startsWith(`${href}/`);
}

export function AppShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const pathname=usePathname();
  const sidebarRef=useRef<HTMLElement|null>(null);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  useEffect(()=>{try{setSidebarCollapsed(localStorage.getItem("robotronix-admin-sidebar-collapsed")==="true")}catch{}},[]);
  const toggleSidebar=()=>setSidebarCollapsed(previous=>{const next=!previous;try{localStorage.setItem("robotronix-admin-sidebar-collapsed",String(next))}catch{}return next});
  useEffect(()=>{
    const nav=sidebarRef.current;
    if(!nav)return;
    const key="robotronix-sidebar-scroll-"+role;
    try{
      const previous=Number(sessionStorage.getItem(key));
      if(Number.isFinite(previous)&&previous>0)nav.scrollTop=previous;
      else nav.querySelector<HTMLElement>("a.active")?.scrollIntoView({block:"nearest"});
    }catch{}
    const save=()=>{try{sessionStorage.setItem(key,String(nav.scrollTop))}catch{}};
    nav.addEventListener("scroll",save,{passive:true});
    return()=>{save();nav.removeEventListener("scroll",save)};
  },[role]);
  useEffect(()=>{
    const nav=sidebarRef.current;
    if(!nav)return;
    const active=nav.querySelector<HTMLElement>("a.active");
    if(!active)return;
    const bounds=nav.getBoundingClientRect(),item=active.getBoundingClientRect();
    if(item.top<bounds.top||item.bottom>bounds.bottom)active.scrollIntoView({block:"nearest"});
  },[pathname]);
  const workspace=role==="admin"||role==="trainer";
  if(workspace){
    let lastGroup="";
    return <div className={`workspaceShell ${role==="admin"&&sidebarCollapsed?"adminSidebarCollapsed":""}`}>
      <aside className="workspaceSidebar">
        <Link href={`/${role}`} className="sidebarBrand" aria-label="Robotronix Learning Portal"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
        <div className="portalName">Learning Portal <span>{role==="admin"?"Admin":"Trainer"}</span></div>
        {role==="admin"&&<button type="button" className="adminSidebarToggle" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed?"Expand admin navigation":"Collapse admin navigation"} title={sidebarCollapsed?"Expand navigation":"Collapse navigation"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d={sidebarCollapsed?"m15 10 3 2-3 2":"m17 10-3 2 3 2"}/></svg><span>{sidebarCollapsed?"":"Collapse menu"}</span></button>}
        <nav className="sidebarNav" ref={sidebarRef}>{navByRole[role].map(item=>{
          const showGroup=role==="admin"&&item.group&&item.group!==lastGroup;
          if(showGroup)lastGroup=item.group!;
          return <div key={item.href} className={showGroup?"adminSidebarGroupStart":undefined}>{showGroup&&<div className="navGroupLabel">{item.group}</div>}<Link className={isActive(pathname,item.href)?"active":""} href={item.href} title={role==="admin"&&sidebarCollapsed?item.label:undefined} aria-label={item.label}>{role==="admin"?<AdminSidebarIcon href={item.href}/>:<span className="navIndicator"/>}<span className="navItemText">{item.label}</span></Link></div>
        })}</nav>
        <div className="sidebarFooter"><div className="roleBadge"><span className="statusDot"/> {role==="admin"?"Administrator":"Trainer account"}</div><SignOutButton className="sidebarSignout" label="Sign out"/></div>
      </aside>
      <div className="workspaceMain"><header className="workspaceTopbar"><div><b>Robotronix™ Learning Portal</b><span className="workspaceCrumb">{pathname.split("/").filter(Boolean).slice(1).map(s=>s.replaceAll("-"," ")).join(" / ")||"overview"}</span></div><div className="topbarActions"><ThemeSwitcher/><NotificationBell role={role}/><SignOutButton/></div></header><main className="workspaceContent">{children}</main>{role==="admin"&&<AdminRecordHistory/>}<div className="footer">Robotronix™ Learning Portal · Structured learning, visible progress, connected operations</div></div><ModeBadge /></div>
  }
  return <>
    <div className="shell experienceShell">
      {role==="parent"?<header className="topbar experienceTopbar parentPortalHeader">
        <div className="parentPortalHeaderTop">
          <Link href="/parent" className="brandLogo" aria-label="Robotronix Family Dashboard"><img src="/brand/robotronix-horizontal.png" alt="Robotronix Future Ready Skills" /></Link>
          <div className="parentPortalHeaderActions">
            <Link href="/onboarding" className="parentPortalAddLearner">+ Add learner</Link>
            <ThemeSwitcher/>
            <NotificationBell role="parent"/>
            <SignOutButton className="button ghost smallButton parentPortalSignOut" label="Sign out"/>
          </div>
        </div>
        <nav className="parentPortalNavigation" aria-label="Family portal pages">
          {navByRole.parent.filter(item=>item.href!=="/onboarding"&&item.href!=="/parent/notifications").map(({label,href})=><Link className={isActive(pathname,href)?"active":""} href={href} key={href} aria-current={isActive(pathname,href)?"page":undefined}>{label}</Link>)}
        </nav>
      </header>:<header className="topbar experienceTopbar">
        <Link href={`/${role}`} className="brandLogo" aria-label="Robotronix Learning Portal"><img src="/brand/robotronix-horizontal.png" alt="Robotronix Future Ready Skills" /></Link>
        <nav className="nav">{navByRole[role].map(({label,href}) => <Link className={isActive(pathname,href)?"active":""} href={href} key={href}>{label}</Link>)}</nav>
        <div className="experienceAccount"><ThemeSwitcher/><NotificationBell role={role}/><span>Learner account</span><SignOutButton label="Sign out"/></div>
      </header>}
      {children}
      <div className="footer">Robotronix™ Learning Portal · Learning progress, projects and mentor feedback in one place</div>
    </div>
    <nav className="mobileExperienceNav">{navByRole[role].filter(item=>role!=="parent"||!["/onboarding","/parent/notifications"].includes(item.href)).map(({label,href})=><Link className={isActive(pathname,href)?"active":""} href={href} key={href}>{label}</Link>)}</nav>
    <ModeBadge />
  </>;
}
