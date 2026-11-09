import {NextRequest,NextResponse} from "next/server";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";

export const noStore={"Cache-Control":"no-store"};
export type TaskSession={db:SupabaseClient;userId:string};
export function taskError(message:string,status:number){
 return NextResponse.json({ok:false,error:message},{status,headers:noStore});
}
export function isTaskSession(value:TaskSession|NextResponse):value is TaskSession{
 return !(value instanceof NextResponse);
}
export const isUuid=(value:unknown):value is string=>
 typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function taskSession(request:NextRequest):Promise<TaskSession|NextResponse>{
 const token=request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
 if(!token)return taskError("Sign in to use My Tasks.",401);
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return taskError("Task service is unavailable.",503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous)return taskError("Session expired or invalid.",401);
 const {data:profile,error:profileError}=await db.from("profiles").select("active").eq("id",user.id).maybeSingle();
 if(profileError||!profile?.active)return taskError("Active account required.",403);
 return {db,userId:user.id};
}

export function taskDbError(code?:string){
 if(code==="23503"||code==="23514"||code==="22P02"||code==="22007"||code==="22008")return taskError("Invalid task details.",400);
 if(code==="23505")return taskError("An item with this name already exists.",409);
 return taskError("Task operation failed.",500);
}
