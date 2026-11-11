"use client";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import type {DeploymentConfig} from "./deployment";
import type {AuthAccess,TaskAccess} from "./auth-routing";

/** Deployment feature selection. Not proof of the signed-in user's permissions. */
export async function loadAuthDeployment():Promise<DeploymentConfig>{
 const response=await fetch("/api/platform/capabilities",{cache:"no-store"});
 if(!response.ok)throw new Error("Application configuration is unavailable.");
 const value=await response.json().catch(()=>null);
 if(!value?.ok||!Array.isArray(value.products)||!Array.isArray(value.integrations))
  throw new Error("Application configuration is invalid.");
 return {mode:value.mode,legacyDefault:value.legacyDefault===true,products:value.products,integrations:value.integrations};
}
function client(){
 const result=getSupabaseBrowserClient();
 if(!result)throw new Error("Authentication is unavailable.");
 return result;
}
export async function passwordSignIn(email:string,password:string){
 const {error}=await client().auth.signInWithPassword({email,password});
 return error?{ok:false,error:error.message}:{ok:true};
}
export async function googleSignIn(){
 const redirectTo=typeof window!=="undefined"?window.location.origin+"/auth/callback":undefined;
 const {error}=await client().auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{prompt:"select_account"}}});
 return error?{ok:false,error:error.message}:{ok:true};
}
export async function emailSignInCode(email:string){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return {ok:false,error:"Enter a valid email address."};
 const redirectTo=typeof window!=="undefined"?window.location.origin+"/auth/callback":undefined;
 // Existing-account sign in only. Account creation needs a separate product-specific flow.
 const {error}=await client().auth.signInWithOtp({
  email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
 });
 return error?{ok:false,error:"Unable to send sign-in code. Check your account email."}:{ok:true};
}
export async function verifySignInCode(email:string,code:string){
 if(!/^\d{6,8}$/.test(code.trim()))return {ok:false,error:"Enter the code from the email."};
 const {error}=await client().auth.verifyOtp({email:email.trim(),token:code.trim(),type:"email"});
 return error?{ok:false,error:"Code expired or invalid. Request a new code."}:{ok:true};
}
/** Load only installed products: CRM/Tasks logins must not query Portal profiles. */
export async function loadSignedInAccess(deployment:DeploymentConfig):Promise<AuthAccess>{
 const supabase=client();
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error("Sign in again.");
 const header={Authorization:"Bearer "+session.access_token};
 const [portal,tasks,crm]=await Promise.all([
  deployment.products.includes("portal")?
    import("@/lib/repository").then(m=>m.getCurrentAccountAccess()):Promise.resolve(undefined),
  deployment.products.includes("tasks")?
    fetch("/api/tasks/onboarding",{headers:header,cache:"no-store"}).then(async response=>{
     if(!response.ok)throw new Error("Task account verification is unavailable.");
     const data=await response.json();
     if(data.portalDisabled&&deployment.legacyDefault)
      return "suspended" as TaskAccess;
     if(data.account?.status==="suspended")return "suspended" as TaskAccess;
     return data.account?.status==="active"?"active" as TaskAccess:"unlinked" as TaskAccess;
    }):Promise.resolve(undefined),
  deployment.products.includes("crm")?
    fetch("/api/connect/workspaces",{headers:header,cache:"no-store"}).then(async response=>{
     if(!response.ok)throw new Error("CRM workspace verification is unavailable.");
     const data=await response.json();
     return Array.isArray(data.workspaces)&&data.workspaces.length>0;
    }):Promise.resolve(undefined)
 ]);
 return {portal,tasks,crmWorkspace:crm};
}
