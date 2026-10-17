import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
export const dynamic="force-dynamic";

function hash(token:string){return crypto.createHash("sha256").update(token).digest("hex")}

export async function GET(request:NextRequest){
 const auth=await requirePortalUser(request,["trainer"]);if("error" in auth)return auth.error;
 const {data:trainer,error}=await auth.admin.from("trainers").select("id,full_name").eq("profile_id",auth.profile.id).maybeSingle();
 if(error||!trainer)return NextResponse.json({ok:false,error:"Trainer profile not found."},{status:404});
 const {data}=await auth.admin.from("calendar_subscription_tokens").select("created_at,last_used_at").eq("owner_role","trainer").eq("owner_id",trainer.id).eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
 return NextResponse.json({ok:true,active:Boolean(data),createdAt:data?.created_at||null,lastUsedAt:data?.last_used_at||null},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
 const auth=await requirePortalUser(request,["trainer"]);if("error" in auth)return auth.error;
 const {data:trainer,error}=await auth.admin.from("trainers").select("id,full_name").eq("profile_id",auth.profile.id).maybeSingle();
 if(error||!trainer)return NextResponse.json({ok:false,error:"Trainer profile not found."},{status:404});
 const raw=crypto.randomBytes(32).toString("base64url"),now=new Date().toISOString();
 const {error:revokeError}=await auth.admin.from("calendar_subscription_tokens").update({active:false,revoked_at:now}).eq("owner_role","trainer").eq("owner_id",trainer.id).eq("active",true);
 if(revokeError)return NextResponse.json({ok:false,error:revokeError.message},{status:500});
 const {error:insertError}=await auth.admin.from("calendar_subscription_tokens").insert({owner_role:"trainer",owner_id:trainer.id,token_hash:hash(raw),active:true});
 if(insertError)return NextResponse.json({ok:false,error:insertError.message},{status:500});
 const origin=request.nextUrl.origin;
 const url=origin+"/api/calendar/trainer/"+encodeURIComponent(trainer.id)+"/feed?token="+encodeURIComponent(raw);
 return NextResponse.json({ok:true,url,warning:"Keep this private. Regenerating the link immediately revokes the previous subscription link."},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:NextRequest){
 const auth=await requirePortalUser(request,["trainer"]);if("error" in auth)return auth.error;
 const {data:trainer,error}=await auth.admin.from("trainers").select("id").eq("profile_id",auth.profile.id).maybeSingle();
 if(error||!trainer)return NextResponse.json({ok:false,error:"Trainer profile not found."},{status:404});
 const {error:updateError}=await auth.admin.from("calendar_subscription_tokens").update({active:false,revoked_at:new Date().toISOString()}).eq("owner_role","trainer").eq("owner_id",trainer.id).eq("active",true);
 if(updateError)return NextResponse.json({ok:false,error:updateError.message},{status:500});
 return NextResponse.json({ok:true});
}
