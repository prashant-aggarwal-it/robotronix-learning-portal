/** Shared UI metadata only. Authorization remains enforced by server APIs and RLS. */
export type SuiteModuleId="portal"|"crm"|"tasks";
export type SuiteModule={id:SuiteModuleId;label:string;description:string;href:string;icon:string;entitlement:string;navigation:readonly {label:string;href:string}[]};
export const suiteModules:readonly SuiteModule[]=[
 {id:"portal",label:"Academy",description:"Learning and academic operations",href:"/admin",icon:"▦",entitlement:"academy",navigation:[
  {label:"Overview",href:"/admin"},{label:"Students",href:"/admin/students"},{label:"Trainers",href:"/admin/trainers"},{label:"Courses",href:"/admin/courses"},{label:"Enrollments",href:"/admin/enrollments"},{label:"Classes",href:"/admin/classes"},{label:"Schedule",href:"/admin/schedule"},{label:"Finance",href:"/admin/finance"}]},
 {id:"crm",label:"Connect CRM",description:"Enquiries, admissions and communication",href:"/connect",icon:"◎",entitlement:"crm",navigation:[
  {label:"Workspace",href:"/connect"}]},
 {id:"tasks",label:"My Tasks",description:"Priorities, board and planning",href:"/tasks",icon:"✦",entitlement:"tasks",navigation:[
  {label:"My Day",href:"/tasks"},{label:"Board",href:"/tasks/board"},{label:"Weekly Planner",href:"/tasks/planner"},{label:"Focus",href:"/tasks/focus"},{label:"Settings",href:"/tasks/settings"}]}
] as const;
export const suiteModuleById=(id:SuiteModuleId)=>suiteModules.find(m=>m.id===id)!;
export function routeMatches(pathname:string,href:string):boolean{return pathname===href||pathname.startsWith(href+"/");}
