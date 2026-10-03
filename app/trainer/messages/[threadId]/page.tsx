"use client";
import {useParams} from "next/navigation";import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {CommunicationThreadView} from "@/components/CommunicationThreadView";
export default function Page(){const p=useParams<{threadId:string}>();return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><CommunicationThreadView role="trainer" threadId={p.threadId}/></AppShell></RoleGuard>}
