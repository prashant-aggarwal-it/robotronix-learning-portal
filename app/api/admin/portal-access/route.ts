import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {logSystemEvent} from "@/lib/server/system-log";

// Admin-only server endpoint. The service-role key must never enter client components.
type Target = "trainer"|"student";
type Action = "invite"|"resend"|"link"|"provision"|"disable"|"enable"|"replace"|"family_link"|"family_unlink"|"family_primary";
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
async function familyLinks(admin:any,studentId:string){
 const {data:links,error}=await admin.from("parent_students").select("parent_id,relationship_label,parent:parents(profile_id)").eq("student_id",studentId);
 if(error)throw new Error(error.message);
 const result:Array<{parentId:string;profileId:string;email:string;relationship:string}>=[];
 for(const row of (links||[]) as Array<{parent_id:string;relationship_label:string;parent:{profile_id:string}|{profile_id:string}[]|null}>){
  const parent=Array.isArray(row.parent)?row.parent[0]:row.parent;
  if(!parent?.profile_id)throw new Error("Family relationship has no linked profile.");
  const {data,error:authError}=await admin.auth.admin.getUserById(parent.profile_id);
  if(authError)throw new Error(authError.message);
  result.push({parentId:row.parent_id,profileId:parent.profile_id,email:String(data.user?.email||"").trim().toLowerCase(),relationship:row.relationship_label});
 }
 return result;
}
async function resolveTarget(admin:any,type:Target,id:string){
 if(type==="trainer"){
  const{data,error}=await admin.from("trainers").select("id,profile_id,email,full_name,record_status").eq("id",id).maybeSingle();
  if(error)throw new Error(error.message);
  return data?{id:data.id,profileId:data.profile_id as string|null,email:data.email as string,name:data.full_name as string,archived:data.record_status==="archived",staleLinks:[] as Array<{parentId:string;profileId:string;email:string;relationship:string}>}:null;
 }
 const {data:student,error}=await admin.from("students").select("id,full_name").eq("id",id).maybeSingle();
 if(error)throw new Error(error.message);
 if(!student)return null;
 const{data:guardian,error:guardError}=await admin.from("student_guardians").select("parent_login_email,primary_guardian_name").eq("student_id",id).maybeSingle();
 if(guardError)throw new Error(guardError.message);
 const email=String(guardian?.parent_login_email||"").trim();
 const links=await familyLinks(admin,id);
 const profileId=links.find(link=>link.email===email.toLowerCase())?.profileId||null;
 return{id:student.id,profileId,email,name:guardian?.primary_guardian_name||student.full_name,archived:false,staleLinks:links.filter(link=>link.relationship!=="Additional guardian"&&link.email!==email.toLowerCase())};
}
async function lookupStatus(admin:any,type:Target,id:string){
 const target=await resolveTarget(admin,type,id);
 if(!target)return null;
 const{data:request,error}=await admin.from("portal_access_requests").select("status,login_email,invited_at,updated_at").eq("target_type",type).eq("target_id",id).maybeSingle();
 if(error)throw new Error("Portal access database objects are missing. Install the Production V1 database baseline before managing invitations: "+error.message);
 const profile=target.profileId?(await admin.from("profiles").select("active").eq("id",target.profileId).maybeSingle()).data:null;
 const auth=target.profileId?(await admin.auth.admin.getUserById(target.profileId)).data.user:null;
 const linked=Boolean(target.profileId&&profile?.active!==false);
 const needsReview=type==="student"&&Boolean(target.staleLinks?.length);
 const status=needsReview?"needs_review":profile?.active===false||request?.status==="disabled"?"disabled":linked&&Boolean(auth?.last_sign_in_at)?"portal_ready":request?.status==="provisioned"?"awaiting_first_login":request?.status==="invited"?"invite_sent":linked?"awaiting_first_login":"not_linked";
 if(status==="portal_ready"&&["invited","provisioned"].includes(request?.status||""))await admin.from("portal_access_requests").update({status:"linked",updated_at:new Date().toISOString()}).eq("target_type",type).eq("target_id",id);
 return{status,email:target.email||request?.login_email||"",lastLoginAt:auth?.last_sign_in_at||null,invitedAt:request?.invited_at||null,linked,archived:target.archived,previousFamilyLinks:target.staleLinks?.length||0};
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
 try{
  const status=await lookupStatus(ctx.admin!,type,id);
  if(!status)return failure("Record not found.",404);
  if(type==="student"&&request.nextUrl.searchParams.get("view")==="family"){
   const links=await familyLinks(ctx.admin!,id);
   const parentIds=[...new Set(links.map(link=>link.parentId))];
   let associations:Array<{parent_id:string;student_id:string}>=[];
   if(parentIds.length){
    const {data,error}=await ctx.admin!.from("parent_students").select("parent_id,student_id").in("parent_id",parentIds);
    if(error)throw new Error(error.message);
    associations=data||[];
   }
   const children=Array.from(new Set(associations.map(link=>link.student_id)));
   let names:Array<{id:string;full_name:string}>=[];
   if(children.length){
    const {data,error}=await ctx.admin!.from("students").select("id,full_name").in("id",children);
    if(error)throw new Error(error.message);
    names=data||[];
   }
   const profiles=await Promise.all(links.map(async link=>{
    const {data,error}=await ctx.admin!.from("profiles").select("active").eq("id",link.profileId).maybeSingle();
    if(error)throw new Error(error.message);
    const {data:auth,error:authError}=await ctx.admin!.auth.admin.getUserById(link.profileId);
    if(authError)throw new Error(authError.message);
    return{parentId:link.parentId,email:link.email,relationship:link.relationship,
      active:data?.active!==false,lastLoginAt:auth.user?.last_sign_in_at||null,
      children:associations.filter(x=>x.parent_id===link.parentId).map(x=>({id:x.student_id,name:names.find(n=>n.id===x.student_id)?.full_name||"Learner"}))};
   }));
   return NextResponse.json({ok:true,...status,accounts:profiles},{headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json({ok:true,...status},{headers:{"Cache-Control":"no-store"}});
 }
 catch(e){const referenceId=await logSystemEvent({source:"portal-access",action:"status",code:"PORTAL_ACCESS_STATUS_FAILURE",message:"Admin portal-access status lookup failed"});return failure("Could not check portal access. Reference: "+referenceId,500)}
}
export async function POST(request:NextRequest){
 const ctx=await adminContext(request);if(ctx.error)return ctx.error;
 let body:{type?:Target;id?:string;action?:Action;email?:string};
 try{body=await request.json()}catch{return failure("Invalid request.")}
 const type=body.type,id=body.id,action=body.action;
 if(!type||!["trainer","student"].includes(type)||!id||!/^[\w-]{6,50}$/.test(id)||!action||!["invite","resend","link","provision","disable","enable","replace","family_link","family_unlink","family_primary"].includes(action))return failure("Invalid target or action.");
 const admin=ctx.admin!,actorId=ctx.actorId!;
 try{
  const target=await resolveTarget(admin,type,id);if(!target)return failure("Record not found.",404);
  if(["family_link","family_unlink","family_primary"].includes(action)){
   if(type!=="student")return failure("Family access actions require a learner.");
   const managedEmail=String(body.email||"").trim().toLowerCase();
   if(!emailPattern.test(managedEmail))return failure("Enter an existing parent's valid email.");
   const links=await familyLinks(admin,id);
   const existingLink=links.find(link=>link.email===managedEmail);
   if(action==="family_link"){
    if(existingLink)return failure("That family account is already linked to this learner.");
    const found=await findAuthByEmail(admin,managedEmail);
    if(!found)return failure("No existing parent login uses that email. Provision the primary guardian first.");
    const{data:profile,error:profileError}=await admin.from("profiles").select("role,active").eq("id",found.id).maybeSingle();
    if(profileError)throw new Error(profileError.message);
    if(profile?.role!=="parent"||profile.active===false)return failure("Only active parent portal accounts can be linked.");
    const{data:parent,error:parentError}=await admin.from("parents").upsert({profile_id:found.id},{onConflict:"profile_id"}).select("id").single();
    if(parentError||!parent)throw new Error(parentError?.message||"Parent profile unavailable.");
    const{error:linkError}=await admin.from("parent_students").insert({parent_id:parent.id,student_id:id,relationship_label:"Additional guardian"});
    if(linkError)throw new Error(linkError.message);
   }else{
    if(!existingLink)return failure("That parent is not linked to this learner.");
    if(action==="family_unlink"){
     if(existingLink.relationship!=="Additional guardian")return failure("Change the primary login before removing this account.");
     const{error,count}=await admin.from("parent_students").delete({count:"exact"}).eq("parent_id",existingLink.parentId).eq("student_id",id).eq("relationship_label","Additional guardian");
     if(error||count!==1)throw new Error(error?.message||"Family link was not removed.");
    }else{
     // Promote the selected linked guardian; keep the previous guardian as additional access.
     const {error:guardianError,count:guardianCount}=await admin.from("student_guardians").update({parent_login_email:managedEmail},{count:"exact"}).eq("student_id",id);
     if(!guardianError&&guardianCount!==1)throw new Error("Guardian record was not found.");
     if(guardianError)throw new Error(guardianError.message);
     const {error:promoteError}=await admin.from("parent_students").update({relationship_label:"Primary guardian"}).eq("student_id",id).eq("parent_id",existingLink.parentId);
     if(promoteError)throw new Error(promoteError.message);
     for(const link of links.filter(x=>x.parentId!==existingLink.parentId&&x.relationship!=="Additional guardian")){
      const{error}=await admin.from("parent_students").update({relationship_label:"Additional guardian"}).eq("student_id",id).eq("parent_id",link.parentId);
      if(error)throw new Error(error.message);
     }
    }
   }
   await audit(admin,actorId,type,id,action,managedEmail);
   return NextResponse.json({ok:true});
  }
  if(target.archived&&["invite","resend","link","provision"].includes(action))return failure("Archived trainers cannot receive new portal access.");
  const email=(body.email||target.email||"").trim().toLowerCase();
  if(type==="student"&&target.staleLinks?.length&&action!=="replace")return failure("Existing family access needs review after a guardian email change. Use Replace family login to revoke old learner links explicitly.",409);
  if(action==="replace"&&(type!=="student"||!target.staleLinks?.length))return failure("No previous learner access needs replacement.");
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
  if(!user&&(action==="provision"||action==="replace")){
   // Admin explicitly authorizes an existing email. No invitation token or password.
   // Google/OTP verification is still required before the account can sign in.
   const created=await admin.auth.admin.createUser({email,email_confirm:true,user_metadata:invitationData});
   if(created.error)throw new Error(created.error.message);
   user=created.data.user;
  }
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
   if(action==="replace"){
    // Only remove this learner's old associations. Other children on those accounts remain linked.
    // Revalidate after provisioning so a concurrent admin change cannot silently escape review.
    const currentLinks=await familyLinks(admin,id);
    const mismatches=currentLinks.filter(link=>link.profileId!==user.id&&link.relationship!=="Additional guardian");
    const expected=new Set(target.staleLinks.map(link=>link.parentId));
    if(mismatches.some(link=>!expected.has(link.parentId)))throw new Error("Family access changed during replacement. Review again.");
    for(const link of mismatches){
     const{error:removeError,count}=await admin.from("parent_students").delete({count:"exact"}).eq("student_id",id).eq("parent_id",link.parentId);
     if(removeError||count!==1)throw new Error(removeError?.message||"Could not revoke the previous learner link.");
    }
   }
  }
  // An invited but not yet signed-in account remains 'Invite sent', not 'Portal-ready'.
  await saveRequest(admin,type,id,email,action==="invite"?"invited":action==="provision"||action==="replace"?"provisioned":"linked",actorId);
  await audit(admin,actorId,type,id,action,email);
  return NextResponse.json({ok:true,...await lookupStatus(admin,type,id)});
 }catch(e){const referenceId=await logSystemEvent({source:"portal-access",action:action||"unknown",code:"PORTAL_ACCESS_FAILURE",message:"Admin portal-access operation failed"});return failure("Could not update portal access. Reference: "+referenceId,500)}
}
