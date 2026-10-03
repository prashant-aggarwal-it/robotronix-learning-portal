"use client";
import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {PageIntro} from "@/components/PageIntro";import {NotificationCenter} from "@/components/NotificationCenter";
export default function Page(){return <RoleGuard allow={["parent"]}><AppShell role="parent"><main className="experiencePage"><PageIntro eyebrow="FAMILY UPDATES" title="Notifications" text="Important class, progress, project and account updates for your child’s Robotronix™ learning journey."/><NotificationCenter role="parent"/></main></AppShell></RoleGuard>}
