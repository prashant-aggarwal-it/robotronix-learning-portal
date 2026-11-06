import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;personId:string}>};
type Kind="enquiry"|"activity"|"admission"|"task"|"appointment"|"message";
type Event={id:string;kind:Kind;title:string;detail:string;at:string;status?:string};
const kinds:Kind[]=["enquiry","activity","admission","task","appointment","message"];
const BATCH=30;
type Offsets=Record<Kind,number>;
function blank():Offsets{return {enquiry:0,activity:0,admission:0,task:0,appointment:0,message:0};}
function parseCursor(value:string|null):Offsets|null{
 if(!value)return blank();
 try{
  if(value.length>400)return null;
  const decoded=JSON.parse(Buffer.from(value,"base64url").toString("utf8")) as Record<string,unknown>;
  if(!decoded||typeof decoded!=="object"||kinds.some(k=>!Number.isSafeInteger(decoded[k])||(decoded[k] as number)<0||(decoded[k] as number)>100000))return null;
  return Object.fromEntries(kinds.map(k=>[k,decoded[k]])) as Offsets;
 }catch{return null;}
}
const event=(kind:Kind,id:string,title:string,detail:string,at:string,status?:string):Event=>({id:kind+":"+id,kind,title,detail,at,...(status?{status}:{})});
function orderEvents(a:Event,b:Event){return b.at.localeCompare(a.at)||b.id.localeCompare(a.id);}
function text(value:unknown){return typeof value==="string"?value:"";}
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,personId}=await params;
 if(!uuid(tenantId)||!uuid(personId))return connectFailure("Invalid workspace or contact.",400);
 const cursor=parseCursor(request.nextUrl.searchParams.get("cursor"));
 if(!cursor)return connectFailure("Invalid timeline cursor.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 // Authorization precedes all service-role reads: authenticated user must be a member of this tenant.
 const membership=await invokeConnect<Array<{tenant_id:string;membership_role:string}>>(auth,"connect_my_workspaces",{p_actor_id:auth.actorId});
 if(membership.error)return connectRpcFailure(membership.error,membership.code);
 if(!membership.data?.some(w=>w.tenant_id===tenantId))return connectFailure("You do not have access to this workspace.",403);
 const db=auth.admin.schema("connect");
 const {data:person,error:personError}=await db.from("people").select("id").eq("tenant_id",tenantId).eq("id",personId).maybeSingle();
 if(personError)return connectFailure("Unable to load contact.",500);
 if(!person)return connectFailure("Contact not found in this workspace.",404);
 const {data:opportunities,error:oppError}=await db.from("opportunities").select("id").eq("tenant_id",tenantId).eq("contact_id",personId);
 if(oppError)return connectFailure("Unable to load contact opportunities.",500);
 const opportunityIds=(opportunities||[]).map(o=>o.id as string);
 // Include events linked directly to the person or indirectly through any of their opportunities.
 const personOrOpportunity=(personColumn:string,opportunityColumn:string)=>{
  const conditions=[personColumn+".eq."+personId];
  if(opportunityIds.length)conditions.push(opportunityColumn+".in.("+opportunityIds.join(",")+")");
  return conditions.join(",");
 };
 const {data:conversations,error:conversationError}=await db.from("conversations").select("id").eq("tenant_id",tenantId).eq("person_id",personId).limit(10000);
 if(conversationError)return connectFailure("Unable to load conversation references.",500);
 if((conversations||[]).length===10000)return connectFailure("Contact has too many conversations for this timeline view.",422);
 const conversationIds=(conversations||[]).map(c=>c.id as string);
 // Fetch enough from each source to perform an exact merged page; offsets are per source.
 const sources=await Promise.all(kinds.map(async kind=>{
  if(kind==="message"&&!conversationIds.length)return {kind,events:[] as Event[]};
  const resource=kind==="enquiry"?"inquiries":kind==="activity"?"activities":kind==="admission"?"opportunities":kind==="task"?"tasks":kind==="appointment"?"appointments":"messages";
  const timestamp=kind==="enquiry"?"received_at":kind==="activity"||kind==="message"?"occurred_at":kind==="admission"?"created_at":kind==="task"?"created_at":"created_at";
  let query=db.from(resource).select("*").eq("tenant_id",tenantId);
  if(kind==="enquiry")query=query.eq("person_id",personId);
  if(kind==="activity"||kind==="task"||kind==="appointment")query=query.or(personOrOpportunity("person_id","opportunity_id"));
  if(kind==="admission")query=query.eq("contact_id",personId);
  if(kind==="message")query=query.in("conversation_id",conversationIds);
  const {data,error}=await query.order(timestamp,{ascending:false}).order("id",{ascending:false}).range(cursor[kind],cursor[kind]+BATCH-1);
  if(error)throw new Error("timeline source failed: "+kind);
  const rows=(data||[]) as Array<Record<string,unknown>>;
  const events=rows.map(r=>{
   const id=text(r.id),at=text(r[timestamp]);
   if(kind==="enquiry")return event(kind,id,"Enquiry received",text(r.summary)||"Source: "+text(r.source),at,text(r.source));
   if(kind==="activity")return event(kind,id,text(r.kind)||"Activity",text(r.summary),at);
   if(kind==="admission")return event(kind,id,"Admission opened",text(r.title),at);
   if(kind==="task")return event(kind,id,"Follow-up created",text(r.title),at,text(r.status));
   if(kind==="appointment")return event(kind,id,"Appointment scheduled",text(r.title),at,text(r.status));
   return event(kind,id,text(r.direction)==="inbound"?"Message received":"Message sent",text(r.body)||"Message content unavailable",at,text(r.delivery_status));
  });
  return {kind,events};
 }));
 const sorted=sources.flatMap(s=>s.events).sort(orderEvents);
 const items=sorted.slice(0,BATCH);
 const next={...cursor};
 for(const source of sources)next[source.kind]+=items.filter(item=>item.kind===source.kind).length;
 const hasMore=sorted.length>BATCH||sources.some(s=>s.events.length===BATCH);
 const nextCursor=hasMore?Buffer.from(JSON.stringify(next)).toString("base64url"):null;
 return NextResponse.json({ok:true,items,nextCursor},{headers:noStore});
}
