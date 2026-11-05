import {NextRequest,NextResponse} from "next/server";
import {
 connectSession,isConnectSession,connectFailure,connectRpcFailure,
 invokeConnect,noStore,uuid
} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";

// Each mutation belongs to exactly one business resource; callers cannot invoke arbitrary SQL.
const operations:Record<string,readonly string[]>={
 people:["create_person","update_person","add_person_role","add_contact_method","link_people"],
 households:["create_household","link_household_member"],
 organizations:["create_organization","link_organization_contact"],
 programs:["create_program"],
 pipelines:["create_pipeline","bootstrap_pipeline","add_stage"],
 opportunities:["create_opportunity","link_opportunity_person","link_opportunity_program","move_opportunity","assign_opportunity"],
 inquiries:["create_inquiry","capture_lead"],
 tasks:["create_task","update_task","complete_task"],
 activities:["log_activity"],
 appointments:["create_appointment","reschedule_appointment","finish_appointment"],
};
const resources=new Set([
 ...Object.keys(operations),"contact_matches","timeline","overview"
]);

type Ctx={params:Promise<{tenantId:string;resource:string}>};

export async function GET(request:NextRequest,context:Ctx){
 const {tenantId,resource}=await context.params;
 if(!uuid(tenantId)||!resources.has(resource))return connectFailure("Invalid CRM workspace or resource.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const url=request.nextUrl.searchParams;
 const limit=url.get("limit")??"30",offset=url.get("offset")??"0";
 if(!/^\d{1,3}$/.test(limit)||!/^\d{1,5}$/.test(offset))
  return connectFailure("Invalid pagination.",400);
 const id=url.get("id");
 if(id!==null&&!uuid(id))return connectFailure("Invalid record ID.",400);
 const options={
  limit:Math.min(100,Math.max(1,Number(limit))),
  offset:Math.min(10000,Number(offset)),search:(url.get("search")||"").slice(0,100),
  ...(id?{id}:{})
 };
 const result=await invokeConnect<{items:unknown[];limit:number;offset:number}>(
  auth,"connect_crm_read",
  {p_actor_id:auth.actorId,p_tenant_id:tenantId,p_resource:resource,p_options:options}
 );
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,...(result.data??{items:[],limit:options.limit,offset:options.offset})},{headers:noStore});
}

export async function POST(request:NextRequest,context:Ctx){
 const {tenantId,resource}=await context.params;
 if(!uuid(tenantId)||!Object.hasOwn(operations,resource))
  return connectFailure("Invalid CRM workspace or resource.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const len=Number(request.headers.get("content-length")??"0");
 if(len>16000)return connectFailure("Request is too large.",413);
 // Do not echo sensitive input, including enquiry/contact PII, in errors.
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Provide a JSON object.",400);
 const entry=body as Record<string,unknown>;
 if(typeof entry.action!=="string"||!operations[resource].includes(entry.action))
  return connectFailure("Unsupported CRM action for this resource.",400);
 const data=entry.data;
 if(!data||typeof data!=="object"||Array.isArray(data)||JSON.stringify(data).length>12000)
  return connectFailure("Invalid CRM payload.",400);
 const result=await invokeConnect<{ok:boolean;id:string|null}>(
  auth,"connect_crm_write",
  {p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:entry.action,p_data:data}
 );
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json(result.data??{ok:true},{status:200,headers:noStore});
}
