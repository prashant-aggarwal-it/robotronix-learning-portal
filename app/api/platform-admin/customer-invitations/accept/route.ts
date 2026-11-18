import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {verifiedBrandingActor} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>null),token=body?.token;
  if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))
   throw new SaaSAccessError(400,"Invalid invitation link");
  const {db,userId}=await verifiedBrandingActor(request.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_accept_pending_customer_v1",{
    p_token_sha256:createHash("sha256").update(token).digest("hex"),p_actor:userId
  });
  if(error)throw new SaaSAccessError(error.code==="42501"?403:error.code==="23505"||error.code==="23514"?409:503,
   error.code==="42501"?"Invitation expired, revoked, already used, or intended for another email":
   error.code==="23505"?"Organization URL is no longer available":
   "Unable to accept invitation");
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Unable to accept invitation"},
    {status:e instanceof SaaSAccessError?e.status:503,headers});
 }
}
