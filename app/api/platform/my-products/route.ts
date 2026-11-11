import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {resolveDeploymentConfig,type ProductId} from "@/lib/platform/deployment";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
export type ProductNavigation={id:ProductId;label:string;href:string};
export function portalDestination(role:unknown):string|null{
 return role==="admin"?"/admin":role==="trainer"?"/trainer":
  role==="parent"?"/parent":role==="student"?"/student":null;
}
/** Only return products that are both installed and associated with this user.
 * A CRM user without a workspace must first complete CRM onboarding; this is not
 * a product switch entitlement. Supabase service-role credentials never leave server.
 */
export async function GET(request:NextRequest){
 let deployment;
 try{deployment=resolveDeploymentConfig(process.env);}
 catch{return NextResponse.json({ok:false,error:"Module configuration unavailable"},{status:503,headers:noStore});}
 const token=request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
 if(!token)return NextResponse.json({ok:false,error:"Sign in first"},{status:401,headers:noStore});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({ok:false,error:"Account service unavailable"},{status:503,headers:noStore});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous)
  return NextResponse.json({ok:false,error:"Session invalid"},{status:401,headers:noStore});
 const products:ProductNavigation[]=[];
 let disabledPortal=false;
 if(deployment.products.includes("portal")){
  const {data:profile,error:profileError}=await db.from("profiles")
   .select("active,role").eq("id",user.id).maybeSingle();
  if(profileError)return NextResponse.json({ok:false,error:"Portal access unavailable"},{status:503,headers:noStore});
  disabledPortal=profile?.active===false;
  const href=profile?.active?portalDestination(profile.role):null;
  if(href){
   // Trainer access can be separately disabled even when the profile is active.
   let active=true;
   if(profile?.role==="trainer"){
    const {data:trainer,error:trainerError}=await db.from("trainers").select("id").eq("profile_id",user.id).maybeSingle();
    if(trainerError)return NextResponse.json({ok:false,error:"Portal access unavailable"},{status:503,headers:noStore});
    if(trainer?.id){
     const {data:access,error:accessError}=await db.from("portal_access_requests").select("status")
       .eq("target_type","trainer").eq("target_id",trainer.id).maybeSingle();
     if(accessError)return NextResponse.json({ok:false,error:"Portal access unavailable"},{status:503,headers:noStore});
     active=access?.status!=="disabled";
    }
   }
   if(active)products.push({id:"portal",label:"Learning Portal",href});
  }
 }
 // Preserve legacy global disabled Portal policy.
 if(disabledPortal&&deployment.legacyDefault)
  return NextResponse.json({ok:true,products:[]},{headers:noStore});
 if(deployment.products.includes("crm")){
  const {data,error:workspaceError}=await db.rpc("connect_my_workspaces",{p_actor_id:user.id});
  if(workspaceError)return NextResponse.json({ok:false,error:"CRM access unavailable"},{status:503,headers:noStore});
  if(Array.isArray(data)&&data.length>0)
   products.push({id:"crm",label:"Connect CRM",href:"/connect"});
 }
 if(deployment.products.includes("tasks")){
  const {data,error:tasksError}=await db.rpc("task_account_get",{p_actor_id:user.id});
  if(tasksError)return NextResponse.json({ok:false,error:"Tasks access unavailable"},{status:503,headers:noStore});
  if(data?.status==="active")
   products.push({id:"tasks",label:"My Tasks",href:"/tasks"});
 }
 return NextResponse.json({ok:true,products},{headers:noStore});
}
