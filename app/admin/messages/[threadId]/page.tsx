"use client";
import {useParams} from "next/navigation";import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {CommunicationThreadView} from "@/components/CommunicationThreadView";
export default function Page(){const p=useParams<{threadId:string}>();return <RoleGuard allow={["admin"]}><AppShell role="admin"><CommunicationThreadView role="admin" threadId={p.threadId}/></AppShell></RoleGuard>}
