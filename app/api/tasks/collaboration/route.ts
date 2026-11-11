import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
import {validateTask} from "@/lib/server/tasks/validation";

export const dynamic="force-dynamic";
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function dbFailure(error:{code?:string}|null){return error?.code==="42501"?taskError("Access denied.",403):taskDbError(error?.code)}
const scopes:Record<string,string>={workspaces:"task_workspaces_list",invitations:"task_invitations_list",members:"task_workspace_members",comments:"task_comments_list",activity:"task_activity_list",attachments:"task_attachments_list",collaborators:"task_collaborators_list",access:"task_access_check"};

export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const scope=request.nextUrl.searchParams.get("scope")||"workspaces";
 const fn=scopes[scope];if(!fn)return taskError("Unsupported view.",400);
 const workspace=request.nextUrl.searchParams.get("workspace_id"),task=request.nextUrl.searchParams.get("task_id");
 const args:Record<string,unknown>={p_actor_id:session.userId};
 if(scope==="invitations"){if(!session.verifiedEmail)return taskError("Verified email required.",403);args.p_verified_email=session.verifiedEmail;}
 if(scope==="members"){if(!isUuid(workspace))return taskError("Invalid workspace.",400);args.p_workspace_id=workspace;}
 if(["comments","activity","attachments","collaborators","access"].includes(scope)){if(!isUuid(task))return taskError("Invalid task.",400);args.p_task_id=task;}
 const {data,error}=await session.db.rpc(fn,args);if(error)return dbFailure(error);
 return NextResponse.json({ok:true,...(scope==="access"?{access:data}:{items:data||[]})},{headers:noStore});
}

export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>16000)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid request.",400);
 const v=raw as Record<string,unknown>;
 const action=v.action;
 if(typeof action!=="string")return taskError("Action is required.",400);
 let fn="",args:Record<string,unknown>={p_actor_id:session.userId};
 if(action==="workspace_create"){
  if(typeof v.name!=="string"||v.name.trim().length<2||v.name.length>100)return taskError("Workspace name must be 2–100 characters.",400);
  fn="task_workspace_create";args.p_name=v.name.trim();
 }else if(action==="invite_send"){
  if(!isUuid(v.workspace_id)||typeof v.email!=="string"||!emailPattern.test(v.email)||v.email.length>254||!["admin","member"].includes(String(v.role)))return taskError("Invalid invitation.",400);
  fn="task_invite_send";Object.assign(args,{p_workspace_id:v.workspace_id,p_email:v.email.trim().toLowerCase(),p_role:v.role});
 }else if(action==="invite_accept"){
  if(!session.verifiedEmail||!isUuid(v.invitation_id))return taskError("Verified email and valid invitation required.",403);
  fn="task_invite_accept";Object.assign(args,{p_verified_email:session.verifiedEmail,p_invitation_id:v.invitation_id});
 }else if(action==="member_manage"){
  if(!isUuid(v.workspace_id)||!isUuid(v.user_id)||!["remove","role"].includes(String(v.operation))||(v.operation==="role"&&!["admin","member"].includes(String(v.role))))return taskError("Invalid member action.",400);
  fn="task_workspace_member_manage";Object.assign(args,{p_workspace_id:v.workspace_id,p_member_id:v.user_id,p_action:v.operation,p_role:v.role||null});
 }else if(action==="task_create"){
  if(!isUuid(v.workspace_id))return taskError("Workspace required.",400);
  const validated=validateTask(v.task);if(!validated.value)return taskError(validated.error||"Invalid task.",400);
  if(validated.value.category_id||validated.value.status&&validated.value.status!=="todo")return taskError("Workspace task categories and status cannot be preset.",400);
  fn="task_workspace_task_create";Object.assign(args,{p_workspace_id:v.workspace_id,p_data:validated.value});
 }else if(action==="task_share"){
  if(!isUuid(v.task_id)||(v.workspace_id!==null&&!isUuid(v.workspace_id))||(v.assignee_id!==null&&!isUuid(v.assignee_id))||typeof v.workspace_visible!=="boolean")return taskError("Invalid sharing details.",400);
  fn="task_share";Object.assign(args,{p_task_id:v.task_id,p_workspace_id:v.workspace_id,p_assignee_id:v.assignee_id,p_workspace_visible:v.workspace_visible});
 }else if(action==="collaborator_manage"){
  if(!isUuid(v.task_id)||!isUuid(v.user_id)||(v.permission!==null&&!["view","edit"].includes(String(v.permission))))return taskError("Invalid collaborator.",400);
  fn="task_collaborator_manage";Object.assign(args,{p_task_id:v.task_id,p_user_id:v.user_id,p_permission:v.permission});
 }else if(action==="comment_add"){
  if(!isUuid(v.task_id)||typeof v.body!=="string"||!v.body.trim()||v.body.length>4000)return taskError("Comment must contain 1–4000 characters.",400);
  fn="task_comment_add";Object.assign(args,{p_task_id:v.task_id,p_body:v.body.trim()});
 }else return taskError("Unsupported action.",400);
 const {data,error}=await session.db.rpc(fn,args);if(error)return dbFailure(error);
 if(data===null||data===false)return taskError("Not found or access denied.",403);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
