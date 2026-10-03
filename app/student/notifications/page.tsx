"use client";
import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {PageIntro} from "@/components/PageIntro";import {NotificationCenter} from "@/components/NotificationCenter";
export default function Page(){return <RoleGuard allow={["student"]}><AppShell role="student"><main className="experiencePage"><PageIntro eyebrow="MY UPDATES" title="Notifications" text="Class reminders, project reviews and mentor feedback that matter to your learning journey."/><NotificationCenter role="student"/></main></AppShell></RoleGuard>}
