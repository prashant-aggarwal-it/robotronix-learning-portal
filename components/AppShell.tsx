"use client";
import Link from "next/link";
import {useEffect,useRef} from "react";
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
    {label:"Family Dashboard",href:"/parent"},{label:"Calendar",href:"/parent/calendar"},{label:"Family Profile",href:"/parent/profile"},{label:"Messages",href:"/parent/messages"},{label:"Notifications",href:"/parent/notifications"},{label:"Add learner",href:"/onboarding"}
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

function isActive(path:string, href:string){
  if(href==="/admin"||href==="/trainer"||href==="/parent"||href==="/student") return path===href;
  // Keep sibling Progress routes visually distinct.
  if(href==="/admin/progress") return path===href || /^\/admin\/progress\/(?!alerts(?:\/|$)|projects(?:\/|$))[^/]+$/.test(path);
  return path===href||path.startsWith(`${href}/`);
}

export function AppShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const pathname=usePathname();
  const sidebarRef=useRef<HTMLElement|null>(null);
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
    return <div className="workspaceShell">
      <aside className="workspaceSidebar">
        <Link href={`/${role}`} className="sidebarBrand" aria-label="Robotronix Learning Portal"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
        <div className="portalName">Learning Portal <span>{role==="admin"?"Admin":"Trainer"}</span></div>
        <nav className="sidebarNav" ref={sidebarRef}>{navByRole[role].map(item=>{
          const showGroup=role==="admin"&&item.group&&item.group!==lastGroup;
          if(showGroup)lastGroup=item.group!;
          return <div key={item.href}>{showGroup&&<div className="navGroupLabel">{item.group}</div>}<Link className={isActive(pathname,item.href)?"active":""} href={item.href}><span className="navIndicator"/>{item.label}</Link></div>
        })}</nav>
        <div className="sidebarFooter"><div className="roleBadge"><span className="statusDot"/> {role==="admin"?"Administrator":"Trainer account"}</div><SignOutButton className="sidebarSignout" label="Sign out"/></div>
      </aside>
      <div className="workspaceMain"><header className="workspaceTopbar"><div><b>Robotronix™ Learning Portal</b><span className="workspaceCrumb">{pathname.split("/").filter(Boolean).slice(1).map(s=>s.replaceAll("-"," ")).join(" / ")||"overview"}</span></div><div className="topbarActions"><ThemeSwitcher/><NotificationBell role={role}/><SignOutButton/></div></header><main className="workspaceContent">{children}</main>{role==="admin"&&<AdminRecordHistory/>}<div className="footer">Robotronix™ Learning Portal · Structured learning, visible progress, connected operations</div></div><ModeBadge /></div>
  }
  return <>
    <div className="shell experienceShell">
      <header className="topbar experienceTopbar">
        <Link href={`/${role}`} className="brandLogo" aria-label="Robotronix Learning Portal"><img src="/brand/robotronix-horizontal.png" alt="Robotronix Future Ready Skills" /></Link>
        <nav className="nav">{navByRole[role].map(({label,href}) => <Link className={isActive(pathname,href)?"active":""} href={href} key={href}>{label}</Link>)}</nav>
        <div className="experienceAccount"><ThemeSwitcher/><NotificationBell role={role}/><span>{role==="parent"?"Family account":"Learner account"}</span><SignOutButton label="Sign out"/></div>
      </header>
      {children}
      <div className="footer">Robotronix™ Learning Portal · Learning progress, projects and mentor feedback in one place</div>
    </div>
    <nav className="mobileExperienceNav">{navByRole[role].map(({label,href})=><Link className={isActive(pathname,href)?"active":""} href={href} key={href}>{label}</Link>)}</nav>
    <ModeBadge />
  </>;
}
