import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";

type Context={params:Promise<{id:string}>};
export const dynamic="force-dynamic";
const bucket="task-attachments";
const mimeTypes=new Set(["application/pdf","image/png","image/jpeg","image/webp","text/plain"]);
async function permitted(request:NextRequest,id:string){
 const session=await taskSession(request);if(!isTaskSession(session))return {failure:session};
 const {data,error}=await session.db.rpc("task_access_check",{p_actor_id:session.userId,p_task_id:id});
 if(error||!data?.read)return {failure:taskError("Task not found or access denied.",403)};
 return {session};
}

export async function POST(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const auth=await permitted(request,id);if(auth.failure||!auth.session)return auth.failure;
 const length=Number(request.headers.get("content-length")||0);
 if(length>11_000_000)return taskError("File exceeds the 10 MB limit.",413);
 const form=await request.formData().catch(()=>null);const file=form?.get("file");
 if(!(file instanceof File)||file.size<1||file.size>10_485_760||!mimeTypes.has(file.type))return taskError("Upload a PDF, image or text file up to 10 MB.",400);
 const name=file.name.replace(/[\x00-\x1f/\\]/g,"_").slice(0,250)||"attachment";
 const path=`${id}/${randomUUID()}`;
 const bytes=new Uint8Array(await file.arrayBuffer());
 const {error:uploadError}=await auth.session.db.storage.from(bucket).upload(path,bytes,{contentType:file.type,upsert:false});
 if(uploadError)return taskError("Unable to upload attachment.",500);
 const {data,error}=await auth.session.db.rpc("task_attachment_add",{p_actor_id:auth.session.userId,p_task_id:id,p_path:path,p_name:name,p_mime:file.type,p_size:file.size});
 if(error||!data){await auth.session.db.storage.from(bucket).remove([path]);return taskDbError(error?.code)}
 return NextResponse.json({ok:true,item:data},{status:201,headers:noStore});
}
export async function GET(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const attachmentId=request.nextUrl.searchParams.get("attachment_id");if(!isUuid(attachmentId))return taskError("Invalid attachment.",400);
 const auth=await permitted(request,id);if(auth.failure||!auth.session)return auth.failure;
 const {data,error}=await auth.session.db.rpc("task_attachment_lookup",{p_actor_id:auth.session.userId,p_task_id:id,p_attachment_id:attachmentId});
 if(error||!data)return taskError("Attachment unavailable.",404);
 const signed=await auth.session.db.storage.from(bucket).createSignedUrl(data.storage_path,60,{download:data.file_name});
 if(signed.error||!signed.data?.signedUrl)return taskError("Cannot download attachment.",500);
 return NextResponse.json({ok:true,url:signed.data.signedUrl},{headers:noStore});
}
export async function DELETE(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const attachmentId=request.nextUrl.searchParams.get("attachment_id");if(!isUuid(attachmentId))return taskError("Invalid attachment.",400);
 const auth=await permitted(request,id);if(auth.failure||!auth.session)return auth.failure;
 const {data,error}=await auth.session.db.rpc("task_attachment_lookup",{p_actor_id:auth.session.userId,p_task_id:id,p_attachment_id:attachmentId});
 if(error||!data)return taskError("Attachment unavailable.",404);
 if(data.uploaded_by!==auth.session.userId){
  const {data:access}=await auth.session.db.rpc("task_access_check",{p_actor_id:auth.session.userId,p_task_id:id});
  if(!access?.owner)return taskError("Only the uploader or task owner can remove a file.",403);
 }
 const removed=await auth.session.db.storage.from(bucket).remove([data.storage_path]);
 if(removed.error)return taskError("Unable to remove stored file.",500);
 const deleted=await auth.session.db.rpc("task_attachment_remove",{p_actor_id:auth.session.userId,p_task_id:id,p_attachment_id:attachmentId});
 if(deleted.error||!deleted.data)return taskDbError(deleted.error?.code);
 return NextResponse.json({ok:true},{headers:noStore});
}
