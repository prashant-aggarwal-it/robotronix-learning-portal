"use client";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {ClassRecordEditor} from "@/components/operations/ClassRecordEditor";
import {ModuleTaskLinkButton} from "@/features/tasks/ModuleTaskWidgets";
export default function TrainerClassDetail(){const{id}=useParams<{id:string}>();return <RoleGuard allow={["trainer"]}><AppShell role="trainer"><div className="tw-class-action"><ModuleTaskLinkButton module="learning" resource="schedule_event" resourceId={id} label="Review in My Tasks"/></div><ClassRecordEditor eventId={id} role="trainer"/></AppShell></RoleGuard>}
