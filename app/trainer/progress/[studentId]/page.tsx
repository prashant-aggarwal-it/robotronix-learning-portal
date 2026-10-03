"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {LearnerProgressWorkspace} from "@/components/progress/LearnerProgressWorkspace";
export default function TrainerLearnerProgress(){const{studentId}=useParams<{studentId:string}>();return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><LearnerProgressWorkspace studentId={studentId} role="trainer"/></AppShell></RoleGuard>}
