"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {ProjectReviewWorkspace} from "@/components/progress/ProjectReviewWorkspace";
export default function AdminProjectReview(){const params=useParams<{projectId:string}>();return <RoleGuard allow={["admin"]}><AppShell role="admin"><ProjectReviewWorkspace projectId={params.projectId} role="admin"/></AppShell></RoleGuard>}
