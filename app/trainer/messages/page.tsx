"use client";
import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {PageIntro} from "@/components/PageIntro";import {CommunicationInbox} from "@/components/CommunicationInbox";
export default function Page(){return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><PageIntro eyebrow="LEARNER COMMUNICATION" title="Messages" text="Respond to conversations for learners assigned to you. Family contact details remain protected inside the portal."/><CommunicationInbox role="trainer"/></AppShell></RoleGuard>}
