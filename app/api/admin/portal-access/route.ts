import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

// Admin-only server endpoint. The service-role key must never enter client components.
type Target = "trainer"|"student";
type Action = "invite"|"resend"|"link"|"disable"|"enable";
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function failure(message:string,status=400){return NextResponse.json({ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}})}

async function adminContext(request:NextRequest){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return{error:failure("Portal invitations require server-side Supabase configuration.",503)};
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return{error:failure("Sign in as an administrator to manage access.",401)};
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(token);
 if(authError||!user)return{error:failure("Your admin session expired. Sign in again.",401)};
 const{data:profile,error:profileError}=await admin.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profileError||profile?.role!=="admin"||!profile.active)return{error:failure("Administrator access required.",403)};
 return{admin,actorId:user.id};
}

async function findAuthByEmail(admin:any,email:string){
 // Never assume listUsers() returns every account on its default page.
 for(let page=1;page<=100;page++){
  const {data,error}=await admin.auth.admin.listUsers({page,perPage:200});
  if(error)throw new Error(error.message);
  const match=data.users.find((user: any)=>user.email?.toLowerCase()===email.toLowerCase());
  if(match)return match;
  if(data.users.length<200)break;
 }
 return null;
}
async function resolveTarget(admin:any,type:Target,id:string){
 if(type==="trainer"){
  const{data,error}=await admin.from("trainers").select("id,profile_id,email,full_name,record_status").eq("id",id).maybeSingle();
  if(error)throw new Error(error.message);
  return data?{id:data.id,profileId:data.profile_id as string|null,email:data.email as string,name:data.full_name as string,archived:data.record_status==="archived"}:null;
 }
 const {data:student,error}=await admin.from("students").select("id,full_name").eq("id",id).maybeSingle();
 if(error)throw new Error(error.message);
 if(!student)return null;
 const{data:guardian,error:guardError}=await admin.from("student_guardians").select("parent_login_email,primary_guardian_name").eq("student_id",id).maybeSingle();
 if(guardError)throw new Error(guardError.message);
 const email=String(guardian?.parent_login_email||"").trim();
 const{data:links,error:linkError}=await admin.from("parent_students").select("parent_id,parent:parents(profile_id)").eq("student_id",id);
 if(linkError)throw new Error(linkError.message);
 let profileId:string|null=null;
 for(const row of (links||[]) as Array<{parent:{profile_id:string}|{profile_id:string}[]|null}>){
  const parent=Array.isArray(row.parent)?row.parent[0]:row.parent;
  if(!parent?.profile_id)continue;
  const{data:{user}}=await admin.auth.admin.getUserById(parent.profile_id);
  if(user?.email?.toLowerCase()===email.toLowerCase()){profileId=parent.profile_id;break;}
 }
 return{id:student.id,profileId,email,name:guardian?.primary_guardian_name||student.full_name,archived:false};
}
async function lookupStatus(admin:any,type:Target,id:string){
 const target=await resolveTarget(admin,type,id);
 if(!target)return null;
 const{data:request,error}=await admin.from("portal_access_requests").select("status,login_email,invited_at,updated_at").eq("target_type",type).eq("target_id",id).maybeSingle();
 if(error)throw new Error("Portal access database objects are missing. Install the Production V1 database baseline before managing invitations: "+error.message);
 const profile=target.profileId?(await admin.from("profiles").select("active").eq("id",target.profileId).maybeSingle()).data:null;
 const auth=target.profileId?(await admin.auth.admin.getUserById(target.profileId)).data.user:null;
 const linked=Boolean(target.profileId&&profile?.active!==false);
 const status=profile?.active===false||request?.status==="disabled"?"disabled":linked&&(!request||request.status!=="invited"||auth?.last_sign_in_at)?"portal_ready":request?.status==="invited"?"invite_sent":"not_linked";
 if(status==="portal_ready"&&request?.status==="invited")await admin.from("portal_access_requests").update({status:"linked",updated_at:new Date().toISOString()}).eq("target_type",type).eq("target_id",id);
 return{status,email:target.email||request?.login_email||"",lastLoginAt:auth?.last_sign_in_at||null,invitedAt:request?.invited_at||null,linked,archived:target.archived};
}
async function saveRequest(admin:any,type:Target,id:string,email:string,status:string,actorId:string){
 const{error}=await admin.from("portal_access_requests").upsert({target_type:type,target_id:id,login_email:email,status,updated_at:new Date().toISOString(),last_actor_id:actorId,...(status==="invited"?{invited_at:new Date().toISOString()}:{} )},{onConflict:"target_type,target_id"});
 if(error)throw new Error(error.message);
}
async function audit(admin:any,actorId:string,type:Target,id:string,action:string,email:string){
 await admin.from("portal_audit_log").insert({actor_profile_id:actorId,entity_type:type==="trainer"?"trainer_portal_access":"parent_portal_access",entity_id:id,action,before_data:{},after_data:{email}});
}
export async function GET(request:NextRequest){
 const ctx=await adminContext(request);if(ctx.error)return ctx.error;
 const type=request.nextUrl.searchParams.get("type") as Target,id=request.nextUrl.searchParams.get("id")||"";
 if(!["trainer","student"].includes(type)||!id)return failure("Missing target.");
 try{const status=await lookupStatus(ctx.admin!,type,id);return status?NextResponse.json({ok:true,...status},{headers:{"Cache-Control":"no-store"}}):failure("Record not found.",404)}
 catch(e){return failure(e instanceof Error?e.message:"Unable to check portal access.",500)}
}
export async function POST(request:NextRequest){
 const ctx=await adminContext(request);if(ctx.error)return ctx.error;
 let body:{type?:Target;id?:string;action?:Action;email?:string};
 try{body=await request.json()}catch{return failure("Invalid request.")}
 const type=body.type,id=body.id,action=body.action;
 if(!type||!["trainer","student"].includes(type)||!id||!/^[\w-]{6,50}$/.test(id)||!action||!["invite","resend","link","disable","enable"].includes(action))return failure("Invalid target or action.");
 const admin=ctx.admin!,actorId=ctx.actorId!;
 try{
  const target=await resolveTarget(admin,type,id);if(!target)return failure("Record not found.",404);
  if(target.archived&&["invite","resend","link"].includes(action))return failure("Archived trainers cannot receive new portal access.");
  const email=(body.email||target.email||"").trim().toLowerCase();
  if(!emailPattern.test(email))return failure("A valid login email is required.");
  if(type==="student"&&target.email&&target.email.trim().toLowerCase()!==email)return failure("Update the primary guardian's login email on the student profile first. This prevents linking the wrong family.");
  const existing=target.profileId?await admin.auth.admin.getUserById(target.profileId):null;
  if(target.profileId&&existing?.data.user?.email?.toLowerCase()!==email)return failure("This profile is already linked to a different email. Contact the administrator before changing account ownership.");
  if(action==="disable"||action==="enable"){
   if(!target.profileId)return failure("There is no linked account to manage.");
   const enabled=action==="enable";
   const{error}=await admin.from("profiles").update({active:enabled}).eq("id",target.profileId);
   if(error)throw new Error(error.message);
   const{error:banError}=await admin.auth.admin.updateUserById(target.profileId,{ban_duration:enabled?"none":"876000h"});
   if(banError)throw new Error("Profile updated but authentication ban could not be updated: "+banError.message);
   await saveRequest(admin,type,id,email,enabled?"linked":"disabled",actorId);
   await audit(admin,actorId,type,id,action,email);
   return NextResponse.json({ok:true,...await lookupStatus(admin,type,id)});
  }
  const found=await findAuthByEmail(admin,email);
  if(action==="link"&&!found)return failure("No existing portal account has this email. Use Send invite instead.");
  if(action==="invite"&&found)return failure("An account with this email already exists. Use Link existing account instead.");
  if(action==="resend"){
   const {data:pending,error:pendingError}=await admin.from("portal_access_requests").select("status,login_email").eq("target_type",type).eq("target_id",id).maybeSingle();
   if(pendingError)throw new Error(pendingError.message);
   if(!found||pending?.status!=="invited"||pending.login_email.toLowerCase()!==email)return failure("Resend is available only for a previous pending invitation.");
   const{error:emailError}=await admin.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:process.env.NEXT_PUBLIC_SITE_URL?`${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"")}/`:request.nextUrl.origin}});
   if(emailError)throw new Error(emailError.message);
   await saveRequest(admin,type,id,email,"invited",actorId);
   await audit(admin,actorId,type,id,"resend",email);
   return NextResponse.json({ok:true,...await lookupStatus(admin,type,id)});
  }
  if(found){
   const {data:profile}=await admin.from("profiles").select("role").eq("id",found.id).maybeSingle();
   if(profile?.role&&profile.role!==(type==="trainer"?"trainer":"parent"))return failure("This login belongs to another portal role and cannot be linked automatically.");
   if(type==="trainer"){
    const{data:other}=await admin.from("trainers").select("id").eq("profile_id",found.id).neq("id",id).maybeSingle();
    if(other)return failure("This account is already linked to a different trainer.");
   }
  }
  const portalRole=type==="trainer"?"trainer":"parent";
  const portalLabel=type==="trainer"?"Trainer Portal":"Parent Portal";
  const invitationData={
   portal_role:portalRole,
   portal_name:target.name||email,
   portal_label:portalLabel,
   target_type:type,
  };
  let user=found;
  if(!user){
   const inviteResult=await admin.auth.admin.inviteUserByEmail(email,{
    redirectTo:process.env.NEXT_PUBLIC_SITE_URL?`${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"")}/`:request.nextUrl.origin,
    data:invitationData,
   });
   if(inviteResult.error)throw new Error(inviteResult.error.message);
   user=inviteResult.data.user;
  }else{
   // Keep invite metadata useful for branded templates, but authorization still
   // comes only from public.profiles.role below — never from user_metadata.
   const mergedMetadata={...(user.user_metadata||{}),...invitationData};
   const{data:updated,error:updateError}=await admin.auth.admin.updateUserById(user.id,{user_metadata:mergedMetadata});
   if(updateError)throw new Error(updateError.message);
   user=updated.user||user;
  }
  if(!user)return failure("Unable to create the invitation.",500);
  const role=portalRole;
  const{error:profileError}=await admin.from("profiles").upsert({id:user.id,role,full_name:target.name||email,active:true},{onConflict:"id"});
  if(profileError)throw new Error(profileError.message);
  if(type==="trainer"){
   const{error}=await admin.from("trainers").update({profile_id:user.id}).eq("id",id);if(error)throw new Error(error.message);
  }else{
   const{data:parent,error:pe}=await admin.from("parents").upsert({profile_id:user.id},{onConflict:"profile_id"}).select("id").single();
   if(pe||!parent)throw new Error(pe?.message||"Could not link parent.");
   const{error}=await admin.from("parent_students").upsert({parent_id:parent.id,student_id:id,relationship_label:"Primary guardian"},{onConflict:"parent_id,student_id"});
   if(error)throw new Error(error.message);
  }
  // An invited but not yet signed-in account remains 'Invite sent', not 'Portal-ready'.
  await saveRequest(admin,type,id,email,action==="invite"?"invited":"linked",actorId);
  await audit(admin,actorId,type,id,action,email);
  return NextResponse.json({ok:true,...await lookupStatus(admin,type,id)});
 }catch(e){return failure(e instanceof Error?e.message:"Could not update access.",500)}
}
