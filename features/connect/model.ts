import type {ConnectOverview} from "@/features/connect/api/client";
import type {EnquiryPreferences} from "@/features/connect/types/enquiries";

export type Section="overview"|"enquiries"|"contacts"|"pipeline"|"followups"|"calendar"|"communications"|"reports"|"settings";
export const navigation:Array<{id:Section;label:string;icon:string}>= [
 {id:"overview",label:"Overview",icon:"◫"},{id:"enquiries",label:"Enquiries",icon:"◎"},
 {id:"contacts",label:"Contacts",icon:"♙"},{id:"pipeline",label:"Admissions pipeline",icon:"▥"},
 {id:"followups",label:"Follow-ups",icon:"☑"},{id:"calendar",label:"Calendar",icon:"▦"},
 {id:"communications",label:"Communications",icon:"✉"},
 {id:"reports",label:"Reports & ROI",icon:"▤"},
 {id:"settings",label:"Institute settings",icon:"⚙"}
];
export const emptyOverview:ConnectOverview={
 newEnquiries:0,totalEnquiries:0,openOpportunities:0,wonOpportunities:0,
 overdueTasks:0,openTasks:0,scheduledAppointments:0
};
export function dateLabel(v:string|null|undefined){if(!v)return "Not scheduled";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
export function initials(v:string){return v.trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join("")||"—";}
export function shortLabel(v:string){return v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
export function suggestEnquiryCategory(message:string,categories:EnquiryPreferences["categories"]){
 const text=message.toLowerCase();
 const rules:Array<[string,RegExp]>=[
  ["Trainer / Job Applicant",/\b(trainer|instructor|teacher|resume|cv|job|hiring|vacancy|apply for)\b/i],
  ["Vendor / Supplier",/\b(supplier|wholesale|distributor|vendor|quotation for supply)\b/i],
  ["School Programs",/\b(school|stem lab|school workshop|principal|school robotics)\b/i],
  ["Kits & Components",/\b(arduino kit|robotics kit|sensor|component|motor|breadboard|buy a kit)\b/i],
  ["Partnerships",/\b(franchise|partnership|partner with|reseller)\b/i],
  ["Collaborations",/\b(collaboration|collaborate|joint event|ngo|joint workshop)\b/i],
  ["Online Courses",/\b(online class|online course|virtual class)\b/i],
  ["Offline Courses",/\b(offline class|offline course|in.person class|classroom course)\b/i]
 ];
 const matches=rules.filter(([,regex])=>regex.test(text));
 if(matches.length!==1)return null;
 return categories.find(c=>c.active&&c.label===matches[0][0])||null;
}
