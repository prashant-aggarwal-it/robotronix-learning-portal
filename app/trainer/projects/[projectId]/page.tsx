"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {ProjectReviewWorkspace} from "@/components/progress/ProjectReviewWorkspace";
export default function TrainerProjectReview(){const params=useParams<{projectId:string}>();return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><ProjectReviewWorkspace projectId={params.projectId} role="trainer"/></AppShell></RoleGuard>}
