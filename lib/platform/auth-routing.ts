import {isRouteAvailable,type DeploymentConfig} from "./deployment";

export type PortalAccess = {
  state:"active"|"disabled"|"unlinked";
  role?:"admin"|"trainer"|"parent"|"student";
};
export type TaskAccess = "active"|"suspended"|"unlinked";
export type AuthAccess = {
  portal?:PortalAccess;
  tasks?:TaskAccess;
  crmWorkspace?:boolean;
};
export type AuthDestination = {path:string;denied?:string};

/** Explicit destination allowlist: no external, protocol-relative or arbitrary URLs. */
export function safeAuthNext(value:string|null|undefined,config:DeploymentConfig):string|null{
  if(!value || value.includes("?") || value.includes("#") ||
     value.includes("\\") || value.includes("%") || value.includes("//"))return null;
  const candidates=new Set(["/tasks","/tasks/welcome","/connect","/zoom/connect","/onboarding"]);
  if(!candidates.has(value))return null;
  return isRouteAvailable(config,value)?value:null;
}
const portalRolePath=(role:PortalAccess["role"])=>role?"/"+role:null;

/**
 * Choose a destination without accessing product-specific databases.
 * Caller independently loads only the enabled product's account details.
 * A disabled Portal account cannot enter Portal; in the legacy deployment
 * we keep the original global disabled-account restriction.
 */
export function resolveAuthDestination(
 config:DeploymentConfig,
 access:AuthAccess,
 requested:string|null|undefined,
 source:"login"|"callback"="login"
):AuthDestination {
 const next=safeAuthNext(requested,config);
 const portalEnabled=config.products.includes("portal");
 const tasksEnabled=config.products.includes("tasks");
 const crmEnabled=config.products.includes("crm");
 const portal=portalEnabled?access.portal:undefined;
 if(config.legacyDefault && portal?.state==="disabled"){
   return {path:"",denied:"Your Robotronix portal access is disabled. Please contact Robotronix Admin."};
 }
 const activePortal=portal?.state==="active";
 const rolePath=portalRolePath(portal?.role);
 const taskActive=access.tasks==="active";
 const taskSuspended=access.tasks==="suspended";
 if(next==="/zoom/connect" && activePortal && portal?.role==="admin")return {path:next};
 if(next==="/onboarding" && portalEnabled && portal?.state!=="disabled" && (portal?.role==="parent"||!activePortal))
   return {path:next};
 if(next==="/connect" && crmEnabled && access.crmWorkspace)return {path:next};
 if(next==="/tasks" && tasksEnabled && taskActive)return {path:next};
 if(next==="/tasks/welcome" && tasksEnabled && !taskSuspended)return {path:taskActive?"/tasks":next};

 // Preserve original Portal-first navigation for existing combined deployments.
 if(activePortal && rolePath)return {path:rolePath};
 if(crmEnabled && access.crmWorkspace)return {path:"/connect"};
 if(tasksEnabled && taskActive)return {path:"/tasks"};
 if(tasksEnabled && taskSuspended && !portalEnabled && !crmEnabled)
   return {path:"",denied:"Your My Tasks account is suspended. Contact your administrator."};
 if(tasksEnabled && !taskSuspended && !portalEnabled)return {path:"/tasks/welcome"};
 if(portalEnabled && portal?.state==="unlinked"){
   if(tasksEnabled && !taskSuspended && (next==="/tasks" || next==="/tasks/welcome"))
      return {path:"/tasks/welcome"};
   if(crmEnabled && !config.legacyDefault)return {path:"/connect"};
   if(config.legacyDefault)return source==="callback"?{path:"/onboarding"}:{path:"",denied:"Your email is not linked to an active portal profile yet. Contact Admin, or start family onboarding."};
   return {path:"/onboarding"};
 }
 if(crmEnabled)return {path:"/connect"};
 if(tasksEnabled && !taskSuspended)return {path:"/tasks/welcome"};
 if(portalEnabled && portal?.state==="disabled")
   return {path:"",denied:"Your Robotronix portal access is disabled. Please contact Robotronix Admin."};
 return {path:"/onboarding"};
}
