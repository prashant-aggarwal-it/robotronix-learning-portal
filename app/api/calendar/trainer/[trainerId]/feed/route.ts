import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {zonedLocalToUtc} from "@/lib/timezones";
export const dynamic="force-dynamic";

function hash(token:string){return crypto.createHash("sha256").update(token).digest("hex")}
function pad(n:number){return String(n).padStart(2,"0")}
function stamp(d:Date){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z"}
function esc(value:string){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
function addDay(date:string){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}

export async function GET(request:NextRequest,{params}:{params:Promise<{trainerId:string}>}){
 const {trainerId}=await params,token=request.nextUrl.searchParams.get("token")||"";
 if(!token)return new NextResponse("Calendar subscription token required.",{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return new NextResponse("Calendar service is not configured.",{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const tokenHash=hash(token);
 const {data:grant,error:grantError}=await db.from("calendar_subscription_tokens").select("id,owner_id,active").eq("owner_role","trainer").eq("owner_id",trainerId).eq("token_hash",tokenHash).eq("active",true).maybeSingle();
 if(grantError||!grant)return new NextResponse("Calendar subscription link is invalid or has been revoked.",{status:403});
 await db.from("calendar_subscription_tokens").update({last_used_at:new Date().toISOString()}).eq("id",grant.id);
 const {data:trainer}=await db.from("trainers").select("full_name").eq("id",trainerId).maybeSingle();
 const {data:events,error}=await db.from("schedule_events").select("id,title,date,start_time,end_time,timezone,event_type,delivery_mode,status,notes").eq("trainer_id",trainerId).order("date").order("start_time");
 if(error)return new NextResponse("Unable to load calendar.",{status:500});
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Robotronix//Trainer Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:"+esc("Robotronix · "+(trainer?.full_name||"Trainer")),"X-WR-CALDESC:"+esc("Private Robotronix teaching schedule")];
 for(const e of events||[]){
  const start=zonedLocalToUtc(e.date,String(e.start_time).slice(0,5),e.timezone);
  const endDate=String(e.end_time).slice(0,5)<=String(e.start_time).slice(0,5)?addDay(e.date):e.date;
  const end=zonedLocalToUtc(endDate,String(e.end_time).slice(0,5),e.timezone);
  lines.push("BEGIN:VEVENT","UID:"+esc(e.id)+"@portal.robotronixstemlab.com","DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(start),"DTEND:"+stamp(end),"SUMMARY:"+esc(e.title),"DESCRIPTION:"+esc("Robotronix "+String(e.event_type).replaceAll("_"," ")+" · "+String(e.delivery_mode).replaceAll("_"," ")+" · "+e.status+(e.notes?"\\n"+e.notes:"")),"STATUS:"+(e.status==="cancelled"||e.status==="rescheduled"?"CANCELLED":"CONFIRMED"),"END:VEVENT");
 }
 lines.push("END:VCALENDAR");
 return new NextResponse(lines.join("\r\n"),{status:200,headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":"inline; filename=\"robotronix-trainer-calendar.ics\"","Cache-Control":"private, no-store"}});
}
