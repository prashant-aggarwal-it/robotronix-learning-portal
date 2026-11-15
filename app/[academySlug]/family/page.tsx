"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Course={enrollmentId:string;courseTitle:string;status:string;sessionsCompleted:number;progressPercent:number};
type ClassEvent={title:string;date:string;startTime:string;timezone:string;status:string};
type Learner={organizationId:string;academy:string;slug:string;studentId:string;studentName:string;grade:string;accessRole:"parent"|"student";courses:Course[];upcomingClasses:ClassEvent[]};
export default function AcademyFamily(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [students,setStudents]=useState<Learner[]>([]),[status,setStatus]=useState<"loading"|"ready"|"denied">("loading");
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const {data,error}=await client.rpc("saas_my_academy_family");if(error)throw error;
  const matches=(Array.isArray(data)?data:[]).filter((row:Learner)=>row.slug===academySlug);
  if(active){setStudents(matches);setStatus(matches.length?"ready":"denied");}
 }catch{if(active)setStatus("denied");}})();return()=>{active=false};},[academySlug]);
 return <main style={{minHeight:"100vh",padding:"48px 24px",background:"#f6f8fd",color:"#1a2542"}}>
  <div style={{maxWidth:850,margin:"auto"}}>
   <Link href={"/"+academySlug}>← Academy homepage</Link>
   <h1 style={{fontSize:"clamp(28px,4vw,42px)",margin:"26px 0 12px"}}>{students[0]?.academy||"Academy family portal"}</h1>
   {status==="loading"&&<p role="status">Verifying your family's access…</p>}
   {status==="denied"&&<section role="alert" style={{padding:24,background:"white",borderRadius:14}}>
     <h2>Family access not linked</h2>
     <p>Sign in with the email your academy invited. Your academy administrator must link the correct learner before records become available.</p>
     <Link href={"/login?academy="+encodeURIComponent(academySlug)}>Academy sign in</Link>
   </section>}
   {status==="ready"&&<><p>Only learners linked to your verified account in this academy are displayed.</p>
    <div style={{display:"grid",gap:16,marginTop:26}}>
     {students.map(s=><article key={s.studentId+"-"+s.accessRole} style={{padding:24,borderRadius:14,background:"white",border:"1px solid #dde4f1"}}>
      <p style={{textTransform:"capitalize",fontSize:13,fontWeight:700,color:"#5443a1"}}>{s.accessRole} access</p>
      <h2>{s.studentName}</h2><p>Grade: {s.grade||"Not specified"}</p>
      <h3 style={{marginTop:20}}>Courses and progress</h3>
      {s.courses?.length?s.courses.map(course=><div key={course.enrollmentId} style={{padding:"12px 0",borderTop:"1px solid #eef0f4"}}><strong>{course.courseTitle}</strong><p>Status: {course.status} · Sessions completed: {course.sessionsCompleted||0} · Progress: {Math.round(course.progressPercent||0)}%</p></div>):<p>No active course details have been linked yet.</p>}
      <h3 style={{marginTop:20}}>Upcoming classes</h3>
      {s.upcomingClasses?.length?<ul>{s.upcomingClasses.map((event,i)=><li key={event.date+"-"+event.startTime+"-"+i} style={{margin:"8px 0"}}>{event.title} · {event.date} · {event.startTime} ({event.timezone})</li>)}</ul>:<p>No upcoming classes listed.</p>}
     </article>)}
    </div>
   </>}
  </div>
 </main>;
}