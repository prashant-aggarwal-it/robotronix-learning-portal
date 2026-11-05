import {NextRequest,NextResponse} from "next/server";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";

export type ConnectRole="owner"|"admin"|"manager"|"counsellor"|"viewer";
export type ConnectSession={admin:SupabaseClient;actorId:string;actorEmail:string|null};

export const noStore={"Cache-Control":"no-store"};
export function connectFailure(message:string,status:number){
 return NextResponse.json({ok:false,error:message},{status,headers:noStore});
}
export async function connectSession(request:NextRequest):Promise<ConnectSession|NextResponse>{
 const token=request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
 if(!token)return connectFailure("Sign in to Connect.",401);
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return connectFailure("Connect server configuration is unavailable.",503);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await admin.auth.getUser(token);
 if(error||!user||user.is_anonymous)return connectFailure("Session expired or invalid.",401);
 return {admin,actorId:user.id,actorEmail:user.email?.trim().toLowerCase()??null};
}
export function isConnectSession(value:ConnectSession|NextResponse):value is ConnectSession{
 return !(value instanceof NextResponse);
}
export async function invokeConnect<T>(
 session:ConnectSession,fn:string,args:Record<string,unknown>
):Promise<{data:T|null;error:string|null;code?:string}>{
 const {data,error}=await session.admin.rpc(fn,args);
 return {data:data as T|null,error:error?.message??null,code:error?.code};
}
export function connectRpcFailure(error:string,code?:string){
 // Avoid returning database internals to callers.
 if(code==="23505")return connectFailure("An entry with these details already exists.",409);
 if(code==="42501"||code==="28000")return connectFailure("Not authorized for this workspace or invitation.",403);
 if(code==="22023"||code==="23514")return connectFailure("Please check the supplied details.",400);
 return connectFailure("Unable to complete Connect request.",500);
}
export function uuid(value:unknown):value is string{
 return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
