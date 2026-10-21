import {test,expect} from "@playwright/test";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {authConfig,qaCredentials,isProductionSanity,loadQaEnv,type QaRole} from "./env";

/**
 * DEV-only, non-destructive authorization testing using real authenticated roles.
 * Requires SECURITY_QA_DEV_ACK=I_UNDERSTAND_DEV_ONLY, SECURITY_QA_PROJECT_REF,
 * QA_{TRAINER,PARENT,STUDENT}_{EMAIL,PASSWORD}, and a separate DEV Supabase.
 * No service_role key is needed. Never call this against production.
 */
const ROLES:QaRole[]=["trainer","parent","student"];
const foreignId="00000000-0000-4000-8000-000000000099";
const validateDevTarget=()=>{
 loadQaEnv();
 if(isProductionSanity()||process.env.QA_TARGET==="production")
  throw new Error("Security test refused: production QA target");
 if(process.env.SECURITY_QA_DEV_ACK!=="I_UNDERSTAND_DEV_ONLY")
  throw new Error("Explicit SECURITY_QA_DEV_ACK required for DEV security tests");
 const {url,anonKey}=authConfig();
 const host=new URL(url).hostname;
 const expected=process.env.SECURITY_QA_PROJECT_REF;
 if(!expected||host!==expected+".supabase.co")
  throw new Error("DEV Supabase project ref does not match SECURITY_QA_PROJECT_REF");
 if(!anonKey)throw new Error("DEV anon key required");
 return {url,anonKey};
};
async function roleClient(role:QaRole):Promise<SupabaseClient>{
 const {url,anonKey}=validateDevTarget();
 const c=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {email,password}=qaCredentials(role);
 if(!email||!password)throw new Error("DEV security credentials missing for "+role);
 const {data,error}=await c.auth.signInWithPassword({email,password});
 if(error||!data.user||!data.session)throw new Error("DEV role authentication failed: "+role);
 const {data:profile,error:profileError}=await c.from("profiles").select("role,active").eq("id",data.user.id).single();
 if(profileError||profile?.role!==role||profile.active!==true)
  throw new Error("DEV role identity/profile mismatch: "+role);
 return c;
}

test.describe("DEV Supabase role and RPC isolation (non-destructive)",()=>{
 test.beforeAll(()=>{validateDevTarget()});
 for(const role of ROLES){
  test(role+" cannot invoke privileged course generation/reassignment/finance",async()=>{
   const db=await roleClient(role);
   const calls:Array<[string,Record<string,unknown>]>=[
    ["generate_enrollment_schedule_v2",{p_enrollment_id:foreignId,p_horizon:"full"}],
    ["generate_cohort_schedule_v2",{p_cohort_id:foreignId,p_horizon:"full"}],
    ["reassign_enrollment_trainer_v2",{p_enrollment_id:foreignId,p_new_trainer_id:foreignId,p_reason:"DEV authorization test"}],
    ["reassign_cohort_trainer_v2",{p_cohort_id:foreignId,p_new_trainer_id:foreignId,p_reason:"DEV authorization test"}],
    ["resolve_class_cancellation_v2",{p_event_id:foreignId,p_decision:"approved",p_reason:"DEV authorization test"}]
   ];
   for(const [fn,args] of calls){
    const {error}=await db.rpc(fn,args);
    expect(error,role+" unexpectedly invoked "+fn).not.toBeNull();
   }
  });
 }
 test("Parent/Student cannot read trainer payroll records",async()=>{
  for(const role of ["parent","student"] as const){
   const db=await roleClient(role);
   const {data,error}=await db.from("trainer_earnings").select("id").limit(1);
   expect(error?true:(data?.length??0)===0,role+" exposed trainer payroll").toBe(true);
  }
 });
 test("Trainer/Student cannot read family fee payment records",async()=>{
  for(const role of ["trainer","student"] as const){
   const db=await roleClient(role);
   const {data,error}=await db.from("student_fee_payments").select("id").limit(1);
   expect(error?true:(data?.length??0)===0,role+" exposed family payments").toBe(true);
  }
 });
 test("Unlinked users cannot retrieve a random Zoom meeting",async()=>{
  for(const role of ROLES){
   const db=await roleClient(role);
   const {data,error}=await db.rpc("class_reusable_zoom_link_v2",{p_event_id:foreignId});
   expect(error??data).toBeNull();
  }
 });
});
