"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {ClassRecordEditor} from "@/components/operations/ClassRecordEditor";
export default function AdminClassDetail(){const{id}=useParams<{id:string}>();return <RoleGuard allow={["admin"]}><AppShell role="admin"><ClassRecordEditor eventId={id} role="admin"/></AppShell></RoleGuard>}
