"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {GradeSelect} from "@/components/GradeSelect";
import {TimeZoneField} from "@/components/TimeZoneField";
import {PhoneField} from "@/components/PhoneField";
import {CountryCityFields} from "@/components/CountryCityFields";
import {appMode} from "@/lib/config";
import {classDayNames,preferredWindowDurationMinutes,preferredWindowsOverlap} from "@/lib/learner-options";
import {getCurrentAuthUser,signInWithGoogle,submitOnboarding} from "@/lib/repository";
import {IST_TIMEZONE,browserTimeZone,formatClock,isValidTimeZone,shortTimeZoneLabel,timeZoneLabel,zonedRangeParts} from "@/lib/timezones";
import {validInternationalPhone} from "@/lib/phones";
import {timeRangeError} from "@/lib/time-range-validation";
import {guardianRelationshipOptions,legacyFieldsFromGuardians} from "@/lib/guardians";
import type {GuardianRelationship} from "@/lib/types";

const interests=["Coding","Python","Scratch","Robotics","AI","Game Development","Web Development","Electronics","3D Design","Not sure — need guidance"];
const sources=["Existing parent","Referral","School","Facebook","Instagram","Google","Website","Offline centre","Other"];
const classDays=classDayNames.slice(1).concat(classDayNames[0]);
const dayIndex=new Map(classDays.map((day,index)=>[day,index]));
type TimingSlot={day:string;start:string;end:string;endsNextDay?:boolean};
function slotWindow(slot:TimingSlot){const dayOfWeek=classDayNames.findIndex(d=>d===slot.day);return{day:slot.day,dayOfWeek,start:slot.start,end:slot.end,endsNextDay:slot.endsNextDay}}
const initial={loginEmail:"",motherName:"",motherMobile:"",fatherName:"",fatherMobile:"",primaryContact:"guardian" as "mother"|"father"|"guardian",primaryGuardianName:"",primaryGuardianRelationship:"mother" as GuardianRelationship,primaryGuardianMobile:"",secondaryGuardianName:"",secondaryGuardianRelationship:"father" as GuardianRelationship,secondaryGuardianMobile:"",primaryWhatsApp:"",alternateWhatsApp:"",city:"Delhi",country:"India",state:"Delhi",timezone:IST_TIMEZONE,childName:"",childDob:"",grade:"",school:"",preferredClassDays:[] as string[],preferredTimeWindows:"",interests:[] as string[],goal:"Explore technology",codingExperience:"None",roboticsExperience:"None",source:"",dataConsent:false,portfolioConsent:false};
type Errors=Record<string,string>;
const validPhone=(v:string)=>validInternationalPhone(v);
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function nextDateForDay(day:string,timeZone:string){
  const zone=isValidTimeZone(timeZone)?timeZone:IST_TIMEZONE;
  const now=new Date();
  const weekday=new Intl.DateTimeFormat("en-US",{timeZone:zone,weekday:"long"}).format(now);
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  const current=classDays.indexOf(weekday);
  const target=classDays.indexOf(day);
  const delta=((target-current)+7)%7;
  const d=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+delta));
  return d.toISOString().slice(0,10);
}

function indiaReference(slot:TimingSlot,timeZone:string){
  if(!slot.day||!slot.start||!slot.end||timeRangeError(slot.start,slot.end,slot.endsNextDay,12*60))return "Correct this time window first.";
  const date=nextDateForDay(slot.day,timeZone);
  const range=zonedRangeParts(date,slot.start,slot.end,timeZone,IST_TIMEZONE);
  const startDay=new Intl.DateTimeFormat("en-US",{timeZone:IST_TIMEZONE,weekday:"short"}).format(range.startInstant);
  const endDay=new Intl.DateTimeFormat("en-US",{timeZone:IST_TIMEZONE,weekday:"short"}).format(range.endInstant);
  const localNext=slot.endsNextDay?` · ends ${classDayNames[(classDayNames.indexOf(slot.day)+1)%7]}`:"";
  return `${startDay} ${formatClock(range.startTime)}–${endDay!==startDay?`${endDay} `:""}${formatClock(range.endTime)} IST${localNext}`;
}

export default function OnboardingPage(){
 const[slots,setSlots]=useState<TimingSlot[]>([]);
 const[timingNote,setTimingNote]=useState("");
 const[dayPickerOpen,setDayPickerOpen]=useState(false);
 const[copyFrom,setCopyFrom]=useState<string|null>(null);
 const[copyTargets,setCopyTargets]=useState<string[]>([]);
 const[copyMode,setCopyMode]=useState<"merge"|"replace">("merge");
 const[step,setStep]=useState<1|2>(1);
 const[form,setForm]=useState(initial);
 const[waChoice,setWaChoice]=useState<"primary"|"other">("primary");
 const[errors,setErrors]=useState<Errors>({});
 const[done,setDone]=useState(false);
 const[saving,setSaving]=useState(false);
 const[signedIn,setSignedIn]=useState(appMode==="demo");

 useEffect(()=>{
  const detected=browserTimeZone();
  if(isValidTimeZone(detected))setForm(f=>({...f,timezone:detected}));
  if(appMode==="live")getCurrentAuthUser().then(u=>{setSignedIn(Boolean(u));if(u)setForm(f=>({...f,loginEmail:u.email??""}))});
 },[]);

 const age=useMemo(()=>{
  if(!form.childDob)return null;
  const d=new Date(`${form.childDob}T12:00:00`);if(Number.isNaN(d.getTime()))return null;
  const now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return a;
 },[form.childDob]);
 const resolvedWhatsApp=waChoice==="primary"?form.primaryGuardianMobile:form.primaryWhatsApp;
 const groupedDays=useMemo(()=>classDays.filter(day=>slots.some(slot=>slot.day===day)),[slots]);

 function set(k:string,v:any){setForm(f=>({...f,[k]:v}));setErrors(e=>{const n={...e};delete n[k];return n})}
 function toggle(v:string){setForm(f=>({...f,interests:f.interests.includes(v)?f.interests.filter(x=>x!==v):[...f.interests,v]}));setErrors(e=>({...e,interests:""}))}
 function addDay(day:string){
   setSlots(current=>current.some(s=>s.day===day)?current:[...current,{day,start:"17:00",end:"19:00"}]);
 }
 function addTime(day:string){setSlots(x=>[...x,{day,start:"17:00",end:"19:00"}])}
 function updateSlot(index:number,patch:Partial<TimingSlot>){setSlots(x=>x.map((slot,i)=>i===index?{...slot,...patch}:slot))}
 function removeSlot(index:number){setSlots(x=>x.filter((_,i)=>i!==index))}
 function openCopy(day:string){setCopyFrom(day);setCopyTargets([]);setCopyMode("merge")}
 function applyCopy(){
   if(!copyFrom||!copyTargets.length){setCopyFrom(null);return;}
   const source=slots.filter(s=>s.day===copyFrom);
   setSlots(current=>{
     let next=[...current];
     for(const target of copyTargets.filter(t=>t!==copyFrom)){
       if(copyMode==="replace")next=next.filter(s=>s.day!==target);
       for(const src of source){
         const candidate={...src,day:target};
         const overlaps=next.some(s=>preferredWindowsOverlap(slotWindow(candidate),slotWindow(s)));
         if(!overlaps)next.push(candidate);
       }
     }
     return next;
   });
   setCopyFrom(null);setCopyTargets([]);
 }
 function validate(s:1|2){
  const e:Errors={};
  if(s===1){
   if(!form.primaryGuardianName.trim())e.primaryGuardianName="Primary parent / guardian name is required.";
   if(!form.primaryGuardianMobile||!validPhone(form.primaryGuardianMobile))e.primaryGuardianMobile="Enter a valid primary parent / guardian mobile number.";
   if(form.secondaryGuardianMobile&&!validPhone(form.secondaryGuardianMobile))e.secondaryGuardianMobile="Enter a valid secondary contact number.";
   if(form.secondaryGuardianName.trim()&&!form.secondaryGuardianMobile)e.secondaryGuardianMobile="Add a mobile number for the secondary contact, or leave the secondary contact blank.";
   if(!resolvedWhatsApp||!validPhone(resolvedWhatsApp))e.primaryWhatsApp="Use the primary guardian mobile or enter another valid WhatsApp number.";
   if(form.alternateWhatsApp&&!validPhone(form.alternateWhatsApp))e.alternateWhatsApp="Enter a valid alternative contact number.";
   if(!form.city.trim())e.city="City is required.";
   if(!form.country.trim())e.country="Country is required.";
   if(!form.timezone||!isValidTimeZone(form.timezone))e.timezone="Choose a valid learning timezone.";
   if(!form.loginEmail||!validEmail(form.loginEmail))e.loginEmail="Enter a valid parent login email.";
   if(!form.childName.trim())e.childName="Child’s name is required.";
   if(!form.childDob)e.childDob="Date of birth is required.";
   if(!form.grade.trim())e.grade="Grade / class is required.";
   if(!form.school.trim())e.school="School is required.";
  }else{
   if(!form.interests.length)e.interests="Select at least one interest.";
   if(!form.source)e.source="Please tell us how you heard about Robotronix™.";
   if(!form.dataConsent)e.dataConsent="Parent / guardian consent is required.";
  }
  setErrors(e);return Object.keys(e).length===0;
 }
 function next(){if(validate(1))setStep(2)}
 async function submit(){
  if(!validate(2))return;
  if(slots.some(s=>!s.day||!s.start||!s.end||timeRangeError(s.start,s.end,s.endsNextDay,12*60))||slots.some((a,i)=>slots.some((b,j)=>j>i&&preferredWindowsOverlap(slotWindow(a),slotWindow(b))))){setErrors({submit:"Please enter valid, non-overlapping time windows. Overnight windows are allowed and are checked against the following day."});return;}
  const longWindow=slots.find(s=>s.endsNextDay&&preferredWindowDurationMinutes(s.start,s.end)>12*60);
  if(longWindow&&!window.confirm(`${longWindow.day} ${formatClock(longWindow.start)}–${formatClock(longWindow.end)} spans more than 12 hours and ends the next day. Is that intentional?`))return;
  setSaving(true);
  const legacy=legacyFieldsFromGuardians({name:form.primaryGuardianName,relationship:form.primaryGuardianRelationship,mobile:form.primaryGuardianMobile},form.secondaryGuardianName.trim()?{name:form.secondaryGuardianName,relationship:form.secondaryGuardianRelationship,mobile:form.secondaryGuardianMobile}:undefined);
  const r=await submitOnboarding({...form,...legacy,preferredClassDays:[...new Set(slots.map(s=>s.day))],preferredTimeWindows:[...[...slots].sort((a,b)=>(dayIndex.get(a.day)??0)-(dayIndex.get(b.day)??0)||a.start.localeCompare(b.start)).map(s=>`${s.day}: ${s.start}–${s.end}${s.endsNextDay?" (+1 day)":""}`),...(timingNote.trim()?[`Note: ${timingNote.trim()}`]:[])].join("\n"),primaryWhatsApp:resolvedWhatsApp});
  setSaving(false);
  if(!r.ok){setErrors({submit:r.error??"Could not submit onboarding."});return;}
  setDone(true);
 }
 const err=(k:string)=>errors[k]?<div className="fieldError">{errors[k]}</div>:null;

 if(done)return <main className="onboardingShell"><div className="onboardingSuccess"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><span className="statusBadge status-active">Onboarding submitted</span><h1>Thank you. Your child’s profile has been received.</h1><p>Robotronix™ will confirm the course, trainer and class schedule. After activation, the learner will appear inside your Family Account — a separate student login is not required.</p><Link className="button" href={appMode==="demo"?"/admin/onboarding":"/parent"}>Continue to portal</Link></div></main>;
 if(!signedIn)return <main className="onboardingShell"><div className="onboardingSignIn"><img src="/brand/robotronix-stacked.png" alt="Robotronix"/><div className="eyebrow">PARENT ONBOARDING</div><h1>Set up your family account</h1><p>Continue with Google for the simplest sign-in. We use your verified email only for secure portal access and do not request access to Gmail, Drive or Contacts.</p><button className="button googleButton" onClick={()=>signInWithGoogle()}><span className="googleG">G</span> Continue with Google</button><Link href="/" className="textLink">Back to Learning Portal</Link></div></main>;

 return <main className="onboardingPage">
  <header className="onboardingTop"><Link href="/"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link><div><b>Family Onboarding</b><span>Usually takes about 2 minutes</span></div><Link href="/" className="button ghost smallButton">Exit</Link></header>
  <section className="onboardingIntro"><div className="eyebrow">WELCOME TO ROBOTRONIX™</div><h1>Tell us the essentials to get your child started</h1><p>We keep onboarding short. Course, trainer and delivery setup are confirmed by the Robotronix™ team after submission.</p></section>
  <div className="wizard premiumWizard twoStepWizard"><button className={`wizardStep ${step===1?"active":"done"}`} onClick={()=>setStep(1)}><span className="stepNumber">1</span><span>Family & Child</span></button><button className={`wizardStep ${step===2?"active":""}`} onClick={()=>step===2&&setStep(2)}><span className="stepNumber">2</span><span>Learning & Submit</span></button></div>
  <section className="onboardingCard">
   {step===1&&<>
    <div className="formStepHead"><span>Step 1 of 2</span><h2>Family & child details</h2><p>Required fields are marked with <b>*</b>.</p></div>
    <div className="formSection compactFormSection"><h3>Parent / guardian contacts</h3><p className="sectionIntro">Add one primary parent or guardian. A second contact is optional.</p><div className="guardianContactCard primaryGuardianCard"><div className="guardianCardHead"><b>Primary parent / guardian</b><span>Required</span></div><div className="formGrid">
      <Field label="Name *" value={form.primaryGuardianName} onChange={v=>set("primaryGuardianName",v)} error={errors.primaryGuardianName}/><div className="formGroup"><label>Relationship *</label><select className="input" value={form.primaryGuardianRelationship} onChange={e=>set("primaryGuardianRelationship",e.target.value as GuardianRelationship)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div>
      <PhoneField label="Mobile *" required value={form.primaryGuardianMobile} onChange={v=>set("primaryGuardianMobile",v)} country={form.country} error={errors.primaryGuardianMobile}/><div className="formGroup"><label>Primary WhatsApp *</label><select className={`input ${errors.primaryWhatsApp?"invalid":""}`} value={waChoice} onChange={e=>{setWaChoice(e.target.value as any);setErrors(x=>({...x,primaryWhatsApp:""}))}}><option value="primary">Use primary guardian mobile</option><option value="other">Use another number</option></select>{err("primaryWhatsApp")}</div>
      {waChoice==="other"&&<PhoneField label="WhatsApp number" required value={form.primaryWhatsApp} onChange={v=>set("primaryWhatsApp",v)} country={form.country} error={errors.primaryWhatsApp}/>}
    </div></div><div className="guardianContactCard secondaryGuardianCard"><div className="guardianCardHead"><b>Secondary parent / guardian</b><span>Optional</span></div><div className="formGrid"><Field label="Name" value={form.secondaryGuardianName} onChange={v=>set("secondaryGuardianName",v)}/><div className="formGroup"><label>Relationship</label><select className="input" value={form.secondaryGuardianRelationship} onChange={e=>set("secondaryGuardianRelationship",e.target.value as GuardianRelationship)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div><PhoneField label="Mobile" value={form.secondaryGuardianMobile} onChange={v=>set("secondaryGuardianMobile",v)} country={form.country} error={errors.secondaryGuardianMobile}/><PhoneField label="Alternative contact" value={form.alternateWhatsApp} onChange={v=>set("alternateWhatsApp",v)} country={form.country} error={errors.alternateWhatsApp}/></div></div><div className="formGrid guardianLocationGrid">
      <CountryCityFields country={form.country} state={form.state||""} city={form.city} onCountryChange={v=>set("country",v)} onStateChange={v=>set("state",v)} onCityChange={v=>set("city",v)} countryError={errors.country} cityError={errors.city}/>
      <TimeZoneField value={form.timezone} onChange={v=>set("timezone",v)} label="Your timezone" required error={errors.timezone} hint="Choose the timezone you use at home. You will enter preferred class timings in this timezone."/>
      <div className="formGroup"><label>Family account email *</label><input className={`input ${errors.loginEmail?"invalid":""}`} type="email" value={form.loginEmail} onChange={e=>appMode==="demo"&&set("loginEmail",e.target.value)} readOnly={appMode==="live"}/>{appMode==="live"&&<small className="fieldHint">Verified from your Google / portal account.</small>}{err("loginEmail")}</div>
    </div></div>
    <div className="formSection compactFormSection"><h3>Child profile</h3><div className="formGrid"><Field label="Child’s full name *" value={form.childName} onChange={v=>set("childName",v)} error={errors.childName}/><div className="formGroup"><label>Date of birth *</label><input className={`input ${errors.childDob?"invalid":""}`} type="date" value={form.childDob} onChange={e=>set("childDob",e.target.value)}/>{age!==null&&<small className="fieldHint">Age {age}</small>}{err("childDob")}</div><GradeSelect value={form.grade} onChange={v=>set("grade",v)} required error={errors.grade}/><Field label="School *" value={form.school} onChange={v=>set("school",v)} error={errors.school}/></div></div>
    <div className="wizardActions"><span/><button className="button" onClick={next}>Continue</button></div>
   </>}

   {step===2&&<>
    <div className="formStepHead"><span>Step 2 of 2</span><h2>Learning preferences</h2><p>A few quick choices help us recommend the right starting point and class schedule.</p></div>

    <section className="preferenceSection interestSection"><div className="preferenceSectionHead"><div><span>1</span><div><h3>What is your child interested in?</h3><p>Select as many as apply.</p></div></div></div><div className="selectionGrid compactSelections interestSelectionGrid">{interests.map(x=><button type="button" key={x} className={`selectionCard ${form.interests.includes(x)?"selected":""}`} onClick={()=>toggle(x)}><span><b>{x}</b></span>{form.interests.includes(x)&&<i className="selectionCheck">✓</i>}</button>)}</div>{err("interests")}</section>

    <section className="preferenceSection"><div className="preferenceSectionHead"><div><span>2</span><div><h3>Learning profile</h3><p>This helps us recommend the right starting level.</p></div></div></div><div className="formGrid learningProfileGrid">
      <div className="formGroup"><label>Main goal *</label><select className="input" value={form.goal} onChange={e=>set("goal",e.target.value)}>{["Explore technology","Build real projects","Learn coding properly","Robotics & electronics","School support","Competition preparation"].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="formGroup"><label>Coding experience *</label><select className="input" value={form.codingExperience} onChange={e=>set("codingExperience",e.target.value)}><option>None</option><option>Beginner</option><option>Some experience</option><option>Comfortable</option></select></div>
      <div className="formGroup"><label>Robotics experience *</label><select className="input" value={form.roboticsExperience} onChange={e=>set("roboticsExperience",e.target.value)}><option>None</option><option>Beginner</option><option>Some experience</option><option>Comfortable</option></select></div>
      <div className="formGroup"><label>How did you hear about Robotronix™? *</label><select className={`input ${errors.source?"invalid":""}`} value={form.source} onChange={e=>set("source",e.target.value)}><option value="">Select source</option>{sources.map(x=><option key={x}>{x}</option>)}</select>{err("source")}</div>
    </div></section>

    <section className="preferenceSection timingPreferenceSection"><div className="preferenceSectionHead timingSectionHead"><div><span>3</span><div><h3>Preferred class timing windows</h3><p>When could classes work? Enter broad availability windows — the final recurring class time is confirmed later.</p></div></div></div>
      <div className="timingTimezoneRow"><TimeZoneField value={form.timezone} onChange={v=>set("timezone",v)} label="Your timezone" required error={errors.timezone} hint={`Enter timings in your local timezone. We also show the India-time reference for Robotronix™.`}/><div className="timezoneReference"><span>Your timings are in</span><b>{timeZoneLabel(form.timezone)}</b><small>India reference is shown under every window.</small></div></div>
      <div className="dayPickerPanel"><div className="dayPickerHead"><b>Choose the days that work</b><small>Select any days in any order. The same choices remain available when adding more days.</small></div><div className="dayPickerOptions">{classDays.map(day=><button type="button" key={day} aria-pressed={slots.some(s=>s.day===day)} className={`dayChoice ${slots.some(s=>s.day===day)?"chosen":""}`} onClick={()=>slots.some(s=>s.day===day)?setSlots(rows=>rows.filter(x=>x.day!==day)):addDay(day)}>{day.slice(0,3)}</button>)}</div></div><div className="timingDayList">
        {groupedDays.map(day=><div className="timingDayCard" key={day}><div className="timingDayHead"><div><span>{day}</span><small>{shortTimeZoneLabel(form.timezone)} local time</small></div><div className="timingDayActions"><button type="button" className="textButton" onClick={()=>addTime(day)}>+ Add another time</button><button type="button" className="textButton" onClick={()=>openCopy(day)}>Copy to…</button></div></div>
          <div className="timingWindowList">{slots.map((slot,index)=>({slot,index})).filter(x=>x.slot.day===day).sort((a,b)=>a.slot.start.localeCompare(b.slot.start)).map(({slot,index})=><div className="timingWindowRow" key={`${day}-${index}`}><div className="timeField"><label>From</label><input className="input" type="time" aria-label={`${day} available from`} value={slot.start} onChange={e=>updateSlot(index,{start:e.target.value})}/></div><span className="timeArrow">to</span><div className="timeField"><label>Until</label><input className="input" type="time" aria-label={`${day} available until`} value={slot.end} onChange={e=>updateSlot(index,{end:e.target.value})}/></div><label className="nextDayCheckbox"><input type="checkbox" checked={Boolean(slot.endsNextDay)} onChange={e=>updateSlot(index,{endsNextDay:e.target.checked})}/> Ends next day</label><div className="indiaTimePreview"><span>India time</span><b>{indiaReference(slot,form.timezone)}</b>{slot.endsNextDay&&<small>Overnight window · ends next day</small>}</div>{timeRangeError(slot.start,slot.end,slot.endsNextDay,12*60)&&<div className="inlineFieldError">{timeRangeError(slot.start,slot.end,slot.endsNextDay,12*60)}</div>}<button type="button" className="iconButton dangerIcon" aria-label={`Remove ${day} time window`} onClick={()=>removeSlot(index)}>×</button></div>)}</div>
          {copyFrom===day&&<div className="copyTimingPanel"><div><b>Copy {day} timings to</b><div className="copyDayChoices">{classDays.filter(d=>d!==day).map(d=><label key={d}><input type="checkbox" checked={copyTargets.includes(d)} onChange={e=>setCopyTargets(x=>e.target.checked?[...x,d]:x.filter(v=>v!==d))}/><span>{d.slice(0,3)}</span></label>)}</div></div><div className="copyModeChoices"><label><input type="radio" checked={copyMode==="merge"} onChange={()=>setCopyMode("merge")}/> Merge non-overlapping</label><label><input type="radio" checked={copyMode==="replace"} onChange={()=>setCopyMode("replace")}/> Replace selected days</label></div><div className="row"><button type="button" className="button ghost smallButton" onClick={()=>setCopyFrom(null)}>Cancel</button><button type="button" className="button smallButton" disabled={!copyTargets.length} onClick={applyCopy}>Copy timings</button></div></div>}
        </div>)}
        {!groupedDays.length&&<div className="emptyScheduleState"><b>No preferred windows added yet.</b><span>Add the days and broad times that usually work for your family.</span></div>}
      </div>
      <button type="button" className="button ghost timingAddDay" onClick={()=>setDayPickerOpen(v=>!v)}>+ Add another day</button>{dayPickerOpen&&<div className="dayPickerPanel" aria-label="Add another preferred day"><b>Select an additional day</b><div className="dayPickerOptions">{classDays.filter(day=>!slots.some(s=>s.day===day)).map(day=><button type="button" key={day} className="dayChoice" onClick={()=>{addDay(day);setDayPickerOpen(false)}}>{day.slice(0,3)}</button>)}</div></div>}
      <div className="formGroup timingNoteField"><label>Timing preferences or restrictions <span className="optionalLabel">Optional</span></label><input className="input" value={timingNote} onChange={e=>setTimingNote(e.target.value)} placeholder="e.g. Saturday morning is easiest"/></div>
      <small className="fieldHint timingExplainer">These are availability windows, not the final class duration. Robotronix™ will choose a class slot inside a preferred window after checking trainer availability.</small>
    </section>

    <div className="consentBox"><label><input type="checkbox" checked={form.dataConsent} onChange={e=>set("dataConsent",e.target.checked)}/><span><b>Parent / guardian consent *</b><small>I confirm I am authorised to provide this information for course delivery, progress tracking and related communication.</small></span></label>{err("dataConsent")}</div>
    {errors.submit&&<div className="errorBanner">{errors.submit}</div>}
    <div className="wizardActions"><button className="button ghost" onClick={()=>setStep(1)}>Back</button><button className="button" disabled={saving} onClick={submit}>{saving?"Submitting…":"Submit onboarding"}</button></div>
   </>}
  </section>
 </main>;
}

function Field({label,value,onChange,error,tel=false}:{label:string;value:string;onChange:(v:string)=>void;error?:string;tel?:boolean}){
 return <div className="formGroup"><label>{label}</label><input className={`input ${error?"invalid":""}`} type={tel?"tel":"text"} value={value} onChange={e=>onChange(e.target.value)}/>{error&&<div className="fieldError">{error}</div>}</div>;
}
