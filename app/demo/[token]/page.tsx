"use client";
import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {DemoHeroVisual} from "@/components/demo/DemoHeroVisual";

type DemoData={
 state:"upcoming"|"completed"|"cancelled";childName:string;grade:string;interest:string;experienceLevel:string;
 sessionType:"one_to_one"|"group";focus:string;trainerName:string;date:string;startTime:string;endTime:string;timezone:string;
 joinEnabled:boolean;joinOpensAt:string;startAt:string;endAt:string;joinUrl?:string|null;attendance:string;
 engagement?:string;understanding?:string;problemSolving?:string;confidence?:string;explored?:string;strengths:string[];
 mentorNote?:string;recommendedFormat?:string;recommendedFrequency?:string;fit?:string;parentRating?:string;
 recommendedCourse?:{id:string;title:string;public_name?:string;outcome_subtitle?:string;description?:string;total_sessions?:number;session_duration?:number}|null;
};
function clock(value:string){const[h,m]=value.split(":").map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}
function dateLabel(value:string){return new Date(value+"T12:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function googleUrl(d:DemoData){const fmt=(x:string)=>new Date(x).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const q=new URLSearchParams({action:"TEMPLATE",text:"Robotronix "+d.focus,dates:fmt(d.startAt)+"/"+fmt(d.endAt),details:"Robotronix Discovery Session with "+d.trainerName});return"https://calendar.google.com/calendar/render?"+q.toString()}
function downloadIcs(d:DemoData){const fmt=(x:string)=>new Date(x).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const text=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Robotronix//Demo Experience//EN","BEGIN:VEVENT","UID:demo-"+d.startAt+"@portal.robotronixstemlab.com","DTSTART:"+fmt(d.startAt),"DTEND:"+fmt(d.endAt),"SUMMARY:Robotronix "+d.focus,"DESCRIPTION:Robotronix Discovery Session with "+d.trainerName,"END:VEVENT","END:VCALENDAR"].join("\r\n");const blob=new Blob([text],{type:"text/calendar"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Robotronix-Demo.ics";a.click();URL.revokeObjectURL(url)}

export default function DemoGuestPage(){
 const {token}=useParams<{token:string}>();const[data,setData]=useState<DemoData|null|undefined>(undefined),[error,setError]=useState(""),[showRequest,setShowRequest]=useState<"reschedule"|"help"|null>(null),[message,setMessage]=useState(""),[notice,setNotice]=useState(""),[rating,setRating]=useState("");
 async function load(){setError("");try{const r=await fetch("/api/demo/"+encodeURIComponent(token),{cache:"no-store"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Unable to load demo.");setData(j.demo)}catch(e){setError(e instanceof Error?e.message:String(e));setData(null)}}
 useEffect(()=>{load()},[token]);
 async function submitRequest(){if(!showRequest)return;setNotice("");const r=await fetch("/api/demo/"+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:showRequest,message})});const j=await r.json();if(!r.ok||!j.ok){setNotice(j.error||"Unable to send request.");return}setNotice(showRequest==="reschedule"?"Your reschedule request has been sent to Robotronix.":"Your help request has been sent.");setShowRequest(null);setMessage("")}
 async function sendRating(value:string){setRating(value);const r=await fetch("/api/demo/"+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"feedback",rating:value})});const j=await r.json();if(!r.ok||!j.ok)setNotice(j.error||"Unable to save feedback.");else setNotice("Thank you for sharing your feedback.")}
 const first=useMemo(()=>data?.childName?.split(" ")[0]||"there",[data]);
 if(data===undefined)return <main className="demoGuestShell"><div className="demoGuestLoading">Preparing your Robotronix discovery experience…</div></main>;
 if(!data)return <main className="demoGuestShell"><section className="demoGuestError"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><h1>We could not open this demo link</h1><p>{error||"Please contact Robotronix for a fresh invitation."}</p></section></main>;
 if(data.state==="cancelled")return <main className="demoGuestShell"><section className="demoGuestError"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><h1>This demo has been cancelled</h1><p>We would be happy to find another suitable time for {first}.</p><button className="demoPrimary" onClick={()=>setShowRequest("reschedule")}>Request another time</button></section><RequestPanel kind={showRequest} message={message} setMessage={setMessage} close={()=>setShowRequest(null)} submit={submitRequest}/></main>;

 return <main className="demoGuestShell">
  <header className="demoGuestTop"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><span>{data.state==="completed"?"Discovery complete":"Discovery session"}</span></header>
  {data.state==="upcoming"?<>
   <section className="demoGuestHero">
    <div className="demoGuestHeroCopy"><span className="demoPill">YOUR DISCOVERY SESSION</span><h1>Hi {first},<br/>your {data.focus} is ready.</h1><p>A friendly, hands-on introduction designed to help you explore, build and enjoy technology.</p>
     <div className="demoEssentialCard"><div><span>Date</span><b>{dateLabel(data.date)}</b></div><div><span>Time</span><b>{clock(data.startTime)} · {data.timezone}</b></div><div><span>Mentor</span><b>{data.trainerName}</b></div><div><span>Session</span><b>{data.sessionType==="group"?"Group Discovery":"1-to-1 Discovery"}</b></div></div>
     <div className="demoMainActions">{data.joinEnabled&&data.joinUrl?<a className="demoPrimary" href={data.joinUrl} target="_blank" rel="noreferrer">Join Demo Session</a>:<button className="demoPrimary" disabled>Join opens shortly before the session</button>}<a className="demoSecondary" href={googleUrl(data)} target="_blank" rel="noreferrer">Add to Google Calendar</a><button className="demoLinkButton" onClick={()=>downloadIcs(data)}>Apple / Outlook</button></div>
    </div><DemoHeroVisual/>
   </section>
   <section className="demoGuestSimpleRow"><div><span className="demoMiniIcon">01</span><b>Explore hands-on</b><small>See technology come alive.</small></div><div><span className="demoMiniIcon">02</span><b>Build with your mentor</b><small>No prior experience needed.</small></div><div><span className="demoMiniIcon">03</span><b>Find the right next step</b><small>We guide, not pressure.</small></div></section>
   <section className="demoGuestReady"><div><span className="demoPill neutral">BE READY</span><h2>Just three things.</h2><p>Laptop or desktop · stable internet · a quiet space</p></div><div className="demoGuestSupport"><button onClick={()=>setShowRequest("reschedule")}>Need another time?</button><button onClick={()=>setShowRequest("help")}>Need help?</button></div></section>
  </>:<>
   <section className="demoGuestHero completedState">
    <div className="demoGuestHeroCopy"><span className="demoPill success">SESSION COMPLETED</span><h1>Great first step, {first}.</h1><p>You explored, built and showed us how you like to learn.</p>
     <div className="demoSummaryFocus"><span>WHAT YOU EXPLORED</span><b>{data.explored||data.focus}</b></div>
     {!!data.strengths?.length&&<div className="demoStrengths">{data.strengths.slice(0,3).map(x=><span key={x}>✓ {x}</span>)}</div>}
    </div><DemoHeroVisual completed/>
   </section>
   <section className="demoAfterGrid">
    <article className="demoCleanCard"><span className="demoPill neutral">MENTOR NOTE</span><h2>What {data.trainerName.split(" ")[0]} noticed</h2><p>{data.mentorNote||"Your mentor has completed the session and recommended the most suitable next step."}</p></article>
    <article className="demoCleanCard recommendation"><span className="demoPill warm">RECOMMENDED NEXT STEP</span><h2>{data.recommendedCourse?.public_name||data.recommendedCourse?.title||"Continue the learning journey"}</h2><p>{data.recommendedCourse?.outcome_subtitle||data.recommendedCourse?.description||"A learning path selected from what we observed during the discovery session."}</p>{data.recommendedFrequency&&<small>{data.recommendedFrequency}</small>}</article>
   </section>
   <section className="demoGuestFinish"><div><span className="demoPill neutral">YOUR EXPERIENCE</span><h2>How did the demo feel?</h2><div className="demoRating">{[["excellent","Excellent"],["good","Good"],["not_sure","Not sure"]].map(([v,l])=><button key={v} className={(rating||data.parentRating)===v?"active":""} onClick={()=>sendRating(v)}>{l}</button>)}</div>{notice&&<p>{notice}</p>}</div><div className="demoFinishActions"><a className="demoPrimary" href={"/login?next="+encodeURIComponent("/onboarding")}>Continue {first}’s learning journey</a><a className="demoSecondary" href="https://wa.me/918595772008" target="_blank" rel="noreferrer">Talk to Robotronix</a></div></section>
  </>}
  {notice&&data.state==="upcoming"&&<div className="demoGuestNotice">{notice}</div>}
  <footer className="demoGuestFooter">Robotronix™ · Future-ready skills through hands-on learning</footer>
  <RequestPanel kind={showRequest} message={message} setMessage={setMessage} close={()=>setShowRequest(null)} submit={submitRequest}/>
 </main>;
}

function RequestPanel({kind,message,setMessage,close,submit}:{kind:"reschedule"|"help"|null;message:string;setMessage:(v:string)=>void;close:()=>void;submit:()=>void}){
 if(!kind)return null;return <div className="demoModalBackdrop" onMouseDown={close}><section className="demoModal" onMouseDown={e=>e.stopPropagation()}><span className="demoPill neutral">{kind==="reschedule"?"RESCHEDULE":"HELP"}</span><h2>{kind==="reschedule"?"What time would suit you better?":"How can we help?"}</h2><p>{kind==="reschedule"?"Share a preferred day/time. Robotronix will confirm the change before anything moves.":"Tell us briefly what you need help with."}</p><textarea className="input" rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder={kind==="reschedule"?"e.g. Monday after 6 PM":"Type your message"}/><div className="row"><button className="demoPrimary" onClick={submit}>Send request</button><button className="demoSecondary" onClick={close}>Cancel</button></div></section></div>
}
