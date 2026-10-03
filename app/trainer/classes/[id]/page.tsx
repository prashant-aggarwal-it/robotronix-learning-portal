"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {ClassRecordEditor} from "@/components/operations/ClassRecordEditor";
export default function TrainerClassDetail(){const{id}=useParams<{id:string}>();return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><ClassRecordEditor eventId={id} role="trainer"/></AppShell></RoleGuard>}
