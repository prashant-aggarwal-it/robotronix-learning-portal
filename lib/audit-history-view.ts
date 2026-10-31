import {safeAuditChanges} from "./audit-display";
import {displayLabel} from "./display";
type AuditLike={entityType:string;entityId:string;actorProfileId?:string;beforeData?:Record<string,unknown>;afterData?:Record<string,unknown>};
const links:Record<string,(id:string)=>string>={
 students:id=>`/admin/students/${encodeURIComponent(id)}`,
 student:id=>`/admin/students/${encodeURIComponent(id)}`,
 trainers:id=>`/admin/trainers/${encodeURIComponent(id)}`,
 trainer:id=>`/admin/trainers/${encodeURIComponent(id)}`,
 schedule_events:id=>`/admin/classes/${encodeURIComponent(id)}`,
 schedule_event:id=>`/admin/classes/${encodeURIComponent(id)}`,
 enrollments:()=>"/admin/enrollments",
 enrollment:()=>"/admin/enrollments",
 zoom_recordings:()=>"/admin/zoom",
 zoom_meetings:()=>"/admin/zoom",
 correction_requests:()=>"/admin/audit",
};
export function auditLink(type:string,id:string){return links[type]?.(id)||null;}
export function auditActor(actorProfileId:string|undefined,names:Record<string,string>){
 if(!actorProfileId)return "Unattributed (system or unknown)";
 return names[actorProfileId]||"Unresolved user · "+actorProfileId.slice(0,8);
}
export function auditCategory(type:string){
 if(/zoom|recording|meeting/.test(type))return "Zoom";
 if(/invoice|payment|finance|earning|payout|fee/.test(type))return "Finance";
 if(/class|attendance|schedule/.test(type))return "Classes";
 if(/student|parent|trainer|enrollment|cohort/.test(type))return "Learners";
 return "Other";
}
export function auditChangeSummary(record:AuditLike){
 const changes=safeAuditChanges(record.beforeData,record.afterData);
 return changes.map(change=>({...change,label:displayLabel(change.name)}));
}
export function auditValue(value:unknown){
 if(value===undefined)return "Not recorded";
 if(value===null)return "Empty";
 if(typeof value==="boolean")return value?"Yes":"No";
 if(typeof value==="number"||typeof value==="string")return String(value);
 if(Array.isArray(value))return value.length+" item(s)";
 return "Structured value (see technical details)";
}
