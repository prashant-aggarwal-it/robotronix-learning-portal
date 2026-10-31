import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
async function context(req:NextRequest){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return{error:fail("Operational alerts unavailable",503)};
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return{error:fail("Unauthorized",401)};
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return{error:fail("Unauthorized",401)};
 const{data:profile,error:profileError}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profileError||profile?.role!=="admin"||!profile.active)return{error:fail("Forbidden",403)};
 return{db,actorId:user.id};
}
const expected:Record<string,number>={"process-reminders":5,"zoom-auto-reconcile":5,"zoom-retention":1440,"system-log-retention":1440};
export async function GET(req:NextRequest){
 const ctx=await context(req);if(ctx.error)return ctx.error;const db=ctx.db!;
 const since=new Date(Date.now()-24*3600000).toISOString();
 const [events,jobs,states,users]=await Promise.all([
  db.from("portal_system_logs").select("source,action,level,error_code,occurred_at,reference_id").eq("level","error").gte("occurred_at",since).order("occurred_at",{ascending:false}).limit(2000),
  db.from("portal_job_runs").select("job_name,started_at,status").order("started_at",{ascending:false}).limit(150),
  db.from("portal_operational_alert_states").select("alert_key,status,snoozed_until,assigned_to,note,updated_at").limit(1000),
  db.from("profiles").select("id,full_name").eq("role","admin").eq("active",true).limit(100),
 ]);
 if(events.error||jobs.error)return fail("Unable to load monitored system conditions",503);
 const map=new Map<string,{key:string;type:string;category:string;priority:string;title:string;detail:string;href:string;lastSeen:string;count:number}>();
 for(const e of events.data||[]){
  const key=["system",e.source,e.action,e.error_code||"UNSPECIFIED"].map(encodeURIComponent).join("|");
  const old=map.get(key);
  if(old){old.count++;continue;}
  const zoom=/zoom/i.test(e.source),finance=/finance|razorpay|payment/i.test(e.source);
  map.set(key,{key,type:"Repeated system failure",category:zoom?"Zoom":finance?"Finance":"System",priority:zoom||finance?"high":"medium",title:(zoom?"Zoom":finance?"Finance":"System")+" · "+(e.error_code||"Operational error"),detail:"Recorded error needs investigation. Open System Logs for the reference and latest provider status.",href:"/admin/system-logs",lastSeen:e.occurred_at,count:1});
 }
 const now=Date.now();
 for(const [name,minutes] of Object.entries(expected)){
  const run=(jobs.data||[]).find(j=>j.job_name===name);
  const delayed=!run||now-new Date(run.started_at).getTime()>minutes*3*60000;
  if(!delayed&&run?.status==="success")continue;
  const key="job|"+encodeURIComponent(name);
  map.set(key,{key,type:"Background job",category:"System",priority:minutes===5?"high":"medium",title:name+" · "+(!run?"No heartbeat":delayed?"Heartbeat overdue":"Last run failed"),detail:"Expected "+(minutes===5?"every 5 minutes":"daily")+". Verify job configuration and execution in System Logs.",href:"/admin/system-logs",lastSeen:run?.started_at||new Date(0).toISOString(),count:1});
 }
 const statesAvailable=!states.error;
 return NextResponse.json({ok:true,monitoredAt:new Date().toISOString(),alerts:[...map.values()],states:states.error?[]:states.data||[],statesAvailable,admins:users.error?[]:users.data||[],truncated:(events.data||[]).length===2000},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(req:NextRequest){
 const ctx=await context(req);if(ctx.error)return ctx.error;
 let body:{key?:string;status?:string;note?:string;assignedTo?:string|null;snoozeHours?:number};
 try{body=await req.json()}catch{return fail("Invalid request",400)}
 const key=String(body.key||"");
 if(!/^(system|job|hold|class|login)\|[A-Za-z0-9%._~!()*'|\-]+$/.test(key)||key.length>240)return fail("Invalid alert key",400);
 if(!["open","acknowledged","resolved"].includes(String(body.status)))return fail("Invalid status",400);
 const note=String(body.note||"").trim();
 if(note.length>500||/[<>]/.test(note))return fail("Invalid note",400);
 // Follow-up keys must refer to an actual alert source, not an arbitrary client string.
 const [kind,...pieces]=key.split("|");
 if(kind==="system"){
  if(pieces.length!==3)return fail("Invalid system issue",400);
  let decoded:string[];try{decoded=pieces.map(decodeURIComponent)}catch{return fail("Invalid issue key",400)}
  const [source,action,code]=decoded;
  let check=ctx.db!.from("portal_system_logs").select("id").eq("source",source).eq("action",action).limit(1);
  check=code==="UNSPECIFIED"?check.is("error_code",null):check.eq("error_code",code);
  const result=await check;
  if(result.error||!result.data?.length)return fail("Unknown incident",404);
 }else if(kind==="job"){
  let name="";try{name=decodeURIComponent(pieces[0]||"")}catch{return fail("Invalid job key",400)}
  if(pieces.length!==1||!Object.hasOwn(expected,name))return fail("Unknown job",404);
 }else{
  if(pieces.length!==1)return fail("Invalid business alert",400);
  let id="";try{id=decodeURIComponent(pieces[0]||"")}catch{return fail("Invalid record key",400)}
  if(!/^[0-9a-f-]{36}$/i.test(id))return fail("Invalid business record",400);
  const table=kind==="hold"?"enrollments":kind==="class"?"schedule_events":kind==="login"?"trainers":null;
  if(!table)return fail("Unknown alert category",400);
  const result=await ctx.db!.from(table).select("id").eq("id",id).limit(1);
  if(result.error||!result.data?.length)return fail("Business record not found",404);
 }
 const assignedTo=body.assignedTo||null;
 if(assignedTo){
  if(!/^[0-9a-f-]{36}$/i.test(assignedTo))return fail("Invalid assignee",400);
  const{data}=await ctx.db!.from("profiles").select("id").eq("id",assignedTo).eq("role","admin").eq("active",true).maybeSingle();
  if(!data)return fail("Assign to an active administrator",400);
 }
 const hours=Number(body.snoozeHours||0);
 if(![0,1,4,24].includes(hours))return fail("Invalid snooze duration",400);
 const {error}=await ctx.db!.from("portal_operational_alert_states").upsert({
  alert_key:key,status:body.status,note,assigned_to:assignedTo,
  snoozed_until:hours?new Date(Date.now()+hours*3600000).toISOString():null,
  updated_by:ctx.actorId,updated_at:new Date().toISOString()
 },{onConflict:"alert_key"});
 if(error)return fail("Alert state unavailable. Apply the operational alert migration.",503);
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
