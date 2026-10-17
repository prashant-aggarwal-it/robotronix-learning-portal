"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import type {LearnerExperienceSnapshot} from "@/lib/types";
import {createCommunicationThread} from "@/lib/communication-repository";
import {createFamilyIntroduction} from "@/lib/repository";
import {formatShortDate,formatTime} from "@/components/experience/ExperienceCards";

function estimateFinish(snapshot:LearnerExperienceSnapshot){
 const remaining=snapshot.paidSessionBalance;
 if(remaining===undefined||remaining===null||remaining<=0)return null;
 if(snapshot.plannedEndDate)return snapshot.plannedEndDate;
 const dates=snapshot.recentClasses.map(x=>new Date(x.date+"T12:00:00").getTime()).sort((a,b)=>a-b);
 let interval=7;
 if(dates.length>=2){
  const diffs=dates.slice(1).map((d,i)=>(d-dates[i])/86400000).filter(x=>x>0&&x<45);
  if(diffs.length)interval=Math.max(1,Math.min(14,Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length)));
 }
 const base=snapshot.nextClass?new Date(snapshot.nextClass.date+"T12:00:00"):new Date();
 base.setDate(base.getDate()+Math.max(0,remaining-1)*interval);
 return base.toISOString().slice(0,10);
}

function milestone(snapshot:LearnerExperienceSnapshot){
 const progress=Number(snapshot.learner.progress||0),projects=snapshot.projects.filter(p=>p.status==="completed").length,sessions=snapshot.learner.sessionsCompleted;
 if(progress>=100)return{title:"Course milestone completed",detail:"100% of the planned learning journey is complete."};
 if(progress>=75)return{title:"75% learning milestone",detail:"The learner is well into the final stretch of the course journey."};
 if(progress>=50)return{title:"Halfway milestone",detail:"50% of the planned learning journey is complete."};
 if(progress>=25)return{title:"25% milestone",detail:"A strong first quarter of the learning journey is complete."};
 if(projects>=1)return{title:"First practical build completed",detail:String(projects)+" completed "+(projects===1?"project":"projects")+" now show learning in action."};
 if(sessions>=8)return{title:"Consistency milestone",detail:String(sessions)+" attended sessions show a healthy learning rhythm."};
 return null;
}

const supportOptions=[
 {value:"schedule",label:"Class timing / reschedule"},
 {value:"technical",label:"Technical problem"},
 {value:"progress",label:"Course / learning guidance"},
 {value:"attendance",label:"Attendance question"},
 {value:"general",label:"Payment / invoice or something else"}
] as const;

export function ParentDelightHub({snapshot}:{snapshot:LearnerExperienceSnapshot}){
 const[panel,setPanel]=useState<"none"|"reschedule"|"help"|"referral">("none");
 const[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const[reason,setReason]=useState("travel"),[preferred,setPreferred]=useState("");
 const[helpType,setHelpType]=useState("schedule"),[helpText,setHelpText]=useState("");
 const[refName,setRefName]=useState(""),[refContact,setRefContact]=useState(""),[refNote,setRefNote]=useState("");
 const reviewUrl=process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL||"";
 const firstName=snapshot.learner.name.split(" ")[0];
 const latest=snapshot.recentClasses[0];
 const observation=latest?snapshot.observations.find(o=>o.scheduleEventId===latest.scheduleEventId):undefined;
 const next=snapshot.nextClass;
 const remaining=snapshot.paidSessionBalance;
 const finish=useMemo(()=>estimateFinish(snapshot),[snapshot]);
 const achieved=useMemo(()=>milestone(snapshot),[snapshot]);
 const projectsCompleted=snapshot.projects.filter(p=>p.status==="completed").length;
 const shouldInviteReview=Boolean(reviewUrl&&(projectsCompleted>0||snapshot.learner.progress>=50||snapshot.learner.sessionsCompleted>=8));

 async function submitThread(category:"schedule"|"technical"|"progress"|"attendance"|"general",subject:string,body:string){
  setBusy(true);setError("");setMessage("");
  try{
   const result=await createCommunicationThread({category,subject,studentId:snapshot.learner.id,studentName:snapshot.learner.name,trainerId:snapshot.trainerId,trainerName:snapshot.trainerName,message:body,senderRole:"parent",senderName:"Family account"});
   if(!result.ok)throw new Error(result.error||"Unable to submit your request.");
   setMessage("Request sent to the Robotronix team. You can follow the conversation in Messages.");
   setPanel("none");setHelpText("");setPreferred("");
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }

 async function submitReschedule(){
  if(!next){setError("There is no upcoming class to reschedule.");return}
  const details="Please review a reschedule request for "+snapshot.learner.name+". Current class: "+next.date+" "+next.startTime+" "+next.timezone+". Reason: "+reason+". Preferred alternative: "+(preferred.trim()||"Please suggest the nearest available option")+". Please confirm before changing the schedule.";
  await submitThread("schedule","Reschedule request · "+snapshot.learner.name,details);
 }

 async function submitHelp(){
  if(!helpText.trim()){setError("Please add a short note so the team knows how to help.");return}
  const label=supportOptions.find(x=>x.value===helpType)?.label||"Support";
  await submitThread(helpType as "schedule"|"technical"|"progress"|"attendance"|"general",label+" · "+snapshot.learner.name,helpText.trim());
 }

 async function submitReferral(){
  if(!refName.trim()||!refContact.trim()){setError("Add your friend's name and contact details.");return}
  setBusy(true);setError("");setMessage("");
  try{
   const r=await createFamilyIntroduction({introducedName:refName.trim(),introducedContact:refContact.trim(),note:refNote.trim()});
   if(!r.ok)throw new Error(r.error||"Unable to save the referral.");
   setMessage("Thank you — the referral has been shared with Robotronix.");
   setRefName("");setRefContact("");setRefNote("");setPanel("none");
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }

 return <section className="delightHub">
  <div className="delightHeader">
   <div><span className="experienceLabel">FAMILY CONCIERGE</span><h2>Everything you need, without chasing updates</h2><p>Class recap, upcoming actions, support, renewal visibility and milestones in one place.</p></div>
   <Link className="button ghost" href="/parent/messages">Open Messages</Link>
  </div>
  {message&&<div className="successBanner">{message}</div>}
  {error&&<div className="errorBanner">{error}</div>}

  <div className="delightGrid">
   <article className="delightCard postClassCard">
    <div className="delightCardTop"><span className="experienceLabel">LATEST CLASS SUMMARY</span>{latest&&<span className={"statusBadge status-"+(latest.attendance==="attended"?"active":"pending")}>{latest.attendance}</span>}</div>
    {latest?<><h3>{formatShortDate(latest.date)} · {latest.title}</h3>
     <div className="delightSummaryRows">
      <div><span>What we worked on</span><b>{latest.sessionTopic||latest.projectWorkedOn||latest.title}</b></div>
      <div><span>Skills practised</span><b>{latest.skillsWorked?.length?latest.skillsWorked.join(", "):"Hands-on application and problem solving"}</b></div>
      <div><span>Mentor insight</span><b>{observation?.feedback||snapshot.feedback[0]?.summary||"Class completed and progress updated."}</b></div>
      <div><span>Next focus</span><b>{observation?.nextFocus||snapshot.learner.nextFocus||"Continue the current learning path"}</b></div>
     </div>
     <div className="delightMeta">{latest.actualDurationMinutes?String(latest.actualDurationMinutes)+" min delivered":"Class completed"}{next?" · Next: "+formatShortDate(next.date)+" at "+formatTime(next.startTime):""}</div>
    </>:<><h3>Your first class summary will appear here</h3><p>After an attended class, learning topics, trainer insight and the next focus are brought together automatically.</p></>}
   </article>

   <article className="delightCard attentionCard">
    <span className="experienceLabel">WHAT NEEDS YOUR ATTENTION</span><h3>Only the things that matter now</h3>
    <div className="attentionList">
     {next?<div><span>Next class</span><b>{formatShortDate(next.date)} · {formatTime(next.startTime)}</b><Link href={"/parent/learner/"+snapshot.learner.id}>View</Link></div>:<div><span>Schedule</span><b>No upcoming class confirmed</b><button className="linkButton" onClick={()=>setPanel("help")}>Ask support</button></div>}
     {remaining!==undefined&&remaining!==null&&<div><span>Package balance</span><b>{remaining} paid {remaining===1?"session":"sessions"} remaining</b><button className="linkButton" onClick={()=>setPanel("help")}>Talk to us</button></div>}
     {snapshot.feedback[0]&&<div><span>Mentor update</span><b>New learning feedback available</b><Link href={"/parent/learner/"+snapshot.learner.id}>Read</Link></div>}
     {snapshot.projects.some(p=>["submitted","reviewed","in_progress"].includes(p.status))&&<div><span>Project journey</span><b>{snapshot.projects[0]?.title||"Practical project in progress"}</b><Link href={"/parent/learner/"+snapshot.learner.id}>Open</Link></div>}
    </div>
   </article>

   {achieved&&<article className="delightCard milestoneCard">
    <div className="milestoneBurst">★</div><span className="experienceLabel">MILESTONE UNLOCKED</span><h3>{achieved.title}</h3><p>{firstName} has reached another meaningful point in the learning journey.</p><div className="milestoneStats"><div><b>{snapshot.learner.sessionsCompleted}</b><span>classes</span></div><div><b>{projectsCompleted}</b><span>projects</span></div><div><b>{snapshot.learner.progress}%</b><span>progress</span></div></div><small>{achieved.detail}</small>
   </article>}

   <article className="delightCard renewalCard">
    <span className="experienceLabel">CONTINUITY & RENEWAL</span>
    <h3>{remaining!==undefined&&remaining!==null?String(remaining)+" paid "+(remaining===1?"session":"sessions")+" remaining":"Learning continuity"}</h3>
    {remaining!==undefined&&remaining!==null?<p>{finish?"At the recent learning rhythm, this package is estimated to run until around "+formatShortDate(finish)+".":"We'll keep the remaining balance visible so there are no surprises."}</p>:<p>Your learning plan remains visible here as the course progresses.</p>}
    {remaining!==undefined&&remaining<=3&&<div className="renewalNotice"><b>Renewal window</b><span>Renew early to protect the preferred class slot and avoid a break in continuity.</span></div>}
    <button className="button secondary" onClick={()=>{setHelpType("general");setHelpText("I would like to discuss renewal / the next learning package for "+snapshot.learner.name+".");setPanel("help")}}>Talk about renewal</button>
   </article>

   <article className="delightCard supportCard">
    <span className="experienceLabel">SELF-SERVICE SUPPORT</span><h3>Need something changed?</h3><p>You don't need to search for the right person. Tell us what you need and Robotronix routes it to the right workflow.</p>
    <div className="row" style={{flexWrap:"wrap"}}>{next&&<button className="button" onClick={()=>setPanel(panel==="reschedule"?"none":"reschedule")}>Request Reschedule</button>}<button className="button secondary" onClick={()=>setPanel(panel==="help"?"none":"help")}>Need Help?</button></div>
   </article>

   <article className="delightCard advocacyCard">
    <span className="experienceLabel">SHARE THE EXPERIENCE</span><h3>Celebrate the progress</h3><p>Good moments are the right time to share feedback or introduce another family to hands-on STEM learning.</p>
    <div className="row" style={{flexWrap:"wrap"}}>{shouldInviteReview&&<a className="button" href={reviewUrl} target="_blank" rel="noreferrer">Write a Google Review</a>}<button className="button secondary" onClick={()=>setPanel(panel==="referral"?"none":"referral")}>Refer a Friend</button></div>
    {!reviewUrl&&<small className="muted">Google review prompt will appear automatically once the review link is configured.</small>}
   </article>
  </div>

  {panel==="reschedule"&&next&&<div className="delightDrawer">
   <div className="panelHeader"><div><span className="experienceLabel">RESCHEDULE REQUEST</span><h3>{next.title}</h3><p>Current class: {formatShortDate(next.date)} · {formatTime(next.startTime)}</p></div><button className="button ghost" onClick={()=>setPanel("none")}>Close</button></div>
   <div className="formGrid"><label>Reason<select className="input" value={reason} onChange={e=>setReason(e.target.value)}><option value="travel">Travel</option><option value="school">School / exam</option><option value="medical">Medical</option><option value="family">Family commitment</option><option value="other">Other</option></select></label><label>Preferred alternative<input className="input" value={preferred} onChange={e=>setPreferred(e.target.value)} placeholder="e.g. Monday after 5 PM or nearest available slot"/></label></div>
   <div className="infoBanner"><b>No class changes happen automatically.</b><span>The request goes to Robotronix for trainer-availability confirmation, so existing classes and other learners are protected.</span></div>
   <button className="button" disabled={busy} onClick={submitReschedule}>{busy?"Sending…":"Send Reschedule Request"}</button>
  </div>}

  {panel==="help"&&<div className="delightDrawer">
   <div className="panelHeader"><div><span className="experienceLabel">GUIDED SUPPORT</span><h3>How can we help?</h3><p>Your message becomes a tracked Robotronix conversation instead of getting lost in scattered chats.</p></div><button className="button ghost" onClick={()=>setPanel("none")}>Close</button></div>
   <div className="formGrid"><label>Help with<select className="input" value={helpType} onChange={e=>setHelpType(e.target.value)}>{supportOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label><label style={{gridColumn:"1 / -1"}}>Tell us briefly<textarea className="input" rows={4} value={helpText} onChange={e=>setHelpText(e.target.value)} placeholder="A short note is enough."/></label></div>
   <button className="button" disabled={busy} onClick={submitHelp}>{busy?"Sending…":"Send to Robotronix"}</button>
  </div>}

  {panel==="referral"&&<div className="delightDrawer">
   <div className="panelHeader"><div><span className="experienceLabel">REFER A FRIEND</span><h3>Introduce another family</h3><p>Share only the contact details they are comfortable with you passing to Robotronix.</p></div><button className="button ghost" onClick={()=>setPanel("none")}>Close</button></div>
   <div className="formGrid"><label>Name<input className="input" value={refName} onChange={e=>setRefName(e.target.value)} placeholder="Friend / parent name"/></label><label>Contact<input className="input" value={refContact} onChange={e=>setRefContact(e.target.value)} placeholder="Phone or email"/></label><label style={{gridColumn:"1 / -1"}}>Optional note<input className="input" value={refNote} onChange={e=>setRefNote(e.target.value)} placeholder="Interested in robotics, coding, age/grade, etc."/></label></div>
   <button className="button" disabled={busy} onClick={submitReferral}>{busy?"Sending…":"Share Referral"}</button>
  </div>}
 </section>;
}
