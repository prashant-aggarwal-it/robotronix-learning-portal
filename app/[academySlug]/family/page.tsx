"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Learner={organizationId:string;academy:string;slug:string;studentId:string;studentName:string;grade:string;accessRole:"parent"|"student"};
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
      <p style={{fontSize:13,color:"#617088"}}>Course progress and class scheduling will appear after the legacy Academy experience is fully integrated with tenant-specific family authorization.</p>
     </article>)}
    </div>
   </>}
  </div>
 </main>;
}