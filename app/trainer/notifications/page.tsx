"use client";
import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {PageIntro} from "@/components/PageIntro";import {NotificationCenter} from "@/components/NotificationCenter";
export default function Page(){return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><PageIntro eyebrow="MY UPDATES" title="Notifications" text="Important schedule, learner, project and communication updates for your assigned work."/><NotificationCenter role="trainer"/></AppShell></RoleGuard>}
