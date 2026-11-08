"use client";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export type ConnectWorkspace={
 tenant_id:string;slug:string;workspace_name:string;tenant_status:string;membership_role:string
};
export type ConnectPerson={
 id:string;full_name:string;status:string;created_at:string;
 contact_methods:Array<{kind:string;value:string;primary:boolean}>;roles:string[]
};
export type ConnectInquiry={
 id:string;person_id:string|null;opportunity_id:string|null;source:string;summary:string|null;
 category_id:string|null;category_label:string|null;
 received_at:string;contact_name:string|null;contact_detail:string|null;
 opportunity_title:string|null;stage_name:string|null;outcome:string|null
};
export type ConnectOpportunity={
 id:string;title:string;contact_id:string|null;organization_id:string|null;
 pipeline_id:string;stage_id:string;stage_name:string;outcome:string;
 owner_membership_id:string|null;expected_value:number|null;currency:string;
 version:number;updated_at:string;closed_at:string|null
};
export type ConnectPipeline={
 id:string;name:string;kind:string;active:boolean;
 stages:Array<{id:string;name:string;order:number;outcome:"open"|"won"|"lost"}>
};
export type ConnectTask={
 id:string;title:string;status:string;person_id:string|null;opportunity_id:string|null;
 assignee_membership_id:string|null;due_at:string|null;completed_at:string|null;created_at:string
};
export type ConnectAppointment={
 id:string;title:string;kind:string;status:string;person_id:string|null;opportunity_id:string|null;
 starts_at:string;ends_at:string;owner_membership_id:string|null;
 location:string|null;meeting_url:string|null;notes:string|null;programme:string|null;version:number;updated_at:string
};
export type ConnectOverview={
 newEnquiries:number;totalEnquiries:number;openOpportunities:number;wonOpportunities:number;
 overdueTasks:number;openTasks:number;scheduledAppointments:number
};
export type ConnectActivity={
 id:string;type?:string;kind?:string;title?:string;summary?:string;event_time?:string;occurred_at?:string
};
export type ConnectProgram={id:string;name:string;code:string|null;active:boolean};
export type ConnectMember={member_id:string;member_user_id:string;member_role:string;member_status:string;member_created_at:string};

export async function connectFetch<T=unknown>(path:string,init?:RequestInit):Promise<T>{
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Supabase is not configured for Connect.");
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token)throw new Error("Your session has expired. Sign in again.");
 const response=await fetch(path,{
  ...init,cache:"no-store",
  headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,...(init?.headers||{})}
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok||json.ok===false)throw new Error(typeof json.error==="string"?json.error:"Connect request failed. Please retry.");
 return json as T;
}
export function crmPath(tenantId:string,resource:string){
 return "/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/crm/"+encodeURIComponent(resource);
}
export async function crmList<T>(tenantId:string,resource:string,params?:Record<string,string>){
 const q=new URLSearchParams(params||{});
 return connectFetch<{ok:true;items:T[];limit:number;offset:number}>(crmPath(tenantId,resource)+"?"+q.toString());
}
export async function crmCommand(tenantId:string,resource:string,action:string,data:Record<string,unknown>){
 return connectFetch<{ok:true;id?:string;personId?:string;opportunityId?:string}>(
  crmPath(tenantId,resource),{method:"POST",body:JSON.stringify({action,data})}
 );
}
