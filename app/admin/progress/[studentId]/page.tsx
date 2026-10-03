"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {LearnerProgressWorkspace} from "@/components/progress/LearnerProgressWorkspace";
export default function AdminLearnerProgress(){const{studentId}=useParams<{studentId:string}>();return <RoleGuard allow={["admin"]}><AppShell role="admin"><LearnerProgressWorkspace studentId={studentId} role="admin"/></AppShell></RoleGuard>}
