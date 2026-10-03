"use client";
import {useParams} from "next/navigation";import {AppShell} from "@/components/AppShell";import {RoleGuard} from "@/components/RoleGuard";import {CommunicationThreadView} from "@/components/CommunicationThreadView";
export default function Page(){const p=useParams<{threadId:string}>();return <RoleGuard allow={["parent"]}><AppShell role="parent"><main className="experiencePage"><CommunicationThreadView role="parent" threadId={p.threadId}/></main></AppShell></RoleGuard>}
