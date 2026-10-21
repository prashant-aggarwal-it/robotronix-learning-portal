"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {Suspense,useEffect,useMemo,useState} from "react";
import {GradeSelect} from "@/components/GradeSelect";
import {TimeZoneField} from "@/components/TimeZoneField";
import {PhoneField} from "@/components/PhoneField";
import {CountryCityFields} from "@/components/CountryCityFields";
import {appMode} from "@/lib/config";
import {classDayNames,preferredWindowDurationMinutes,preferredWindowsOverlap} from "@/lib/learner-options";
import {getCurrentAuthUser,getCurrentFamilyOnboardingDefaults,signInWithGoogle,submitOnboarding} from "@/lib/repository";
import {IST_TIMEZONE,formatClock,isValidTimeZone,shortTimeZoneLabel,timeZoneLabel,zonedRangeParts} from "@/lib/timezones";
import {validInternationalPhone} from "@/lib/phones";
import {timeRangeError} from "@/lib/time-range-validation";
import {guardianRelationshipOptions,legacyFieldsFromGuardians} from "@/lib/guardians";
import type {GuardianRelationship} from "@/lib/types";

const interests=["Coding for Beginners","Scratch & Game Creation","Python Programming","Robotics & Smart Automations","AI & Future Skills","Website Designing","Mobile App Development","3D Design & Modelling","Data Science","Not sure — need guidance"];
const sources=["Demo / Discovery Session","Referred by an existing Robotronix parent","Referral","School","Facebook","Instagram","Google","Website","Offline centre","Other"];
const demoInterestMap:Record<string,string>={Robotics:"Robotics & Smart Automations",Arduino:"Robotics & Smart Automations",Coding:"Coding for Beginners",Python:"Python Programming",Scratch:"Scratch & Game Creation","AI & Future Skills":"AI & Future Skills"};
const classDays=classDayNames.slice(1).concat(classDayNames[0]);
const dayIndex=new Map(classDays.map((day,index)=>[day,index]));
type TimingSlot={day:string;start:string;end:string;endsNextDay?:boolean};
function slotWindow(slot:TimingSlot){const dayOfWeek=classDayNames.findIndex(d=>d===slot.day);return{day:slot.day,dayOfWeek,start:slot.start,end:slot.end,endsNextDay:slot.endsNextDay}}
const initial={loginEmail:"",motherName:"",motherMobile:"",fatherName:"",fatherMobile:"",primaryContact:"guardian" as "mother"|"father"|"guardian",primaryGuardianName:"",primaryGuardianRelationship:"mother" as GuardianRelationship,primaryGuardianMobile:"",secondaryGuardianName:"",secondaryGuardianRelationship:"" as GuardianRelationship|"",secondaryGuardianMobile:"",primaryWhatsApp:"",alternateWhatsApp:"",city:"Delhi",country:"India",state:"Delhi",timezone:IST_TIMEZONE,addressLine1:"",addressLine2:"",postalCode:"",billingName:"",billingEmail:"",billingPhone:"",childName:"",childDob:"",grade:"",school:"",preferredClassDays:[] as string[],preferredTimeWindows:"",interests:[] as string[],goal:"Explore technology & discover interests",codingExperience:"None",roboticsExperience:"None",source:"",referringParentName:"",dataConsent:false,portfolioConsent:false};
type Errors=Record<string,string>;
const validPhone=(v:string)=>validInternationalPhone(v);
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const phoneKey=(v:string)=>v.replace(/\D/g,"");

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

function OnboardingPageContent(){
 const params=useSearchParams();const demoToken=params.get("demo")||"";
 const[slots,setSlots]=useState<TimingSlot[]>([]);
 const[timingNote,setTimingNote]=useState("");
 const[dayPickerOpen,setDayPickerOpen]=useState(false);
 const[copyFrom,setCopyFrom]=useState<string|null>(null);
 const[copyTargets,setCopyTargets]=useState<string[]>([]);
 const[copyMode,setCopyMode]=useState<"merge"|"replace">("merge");
 const[step,setStep]=useState<1|2>(1);
 const[form,setForm]=useState(initial);
 const[showSecondGuardian,setShowSecondGuardian]=useState(false);
 const[billingSameAsPrimary,setBillingSameAsPrimary]=useState(true);
 const[errors,setErrors]=useState<Errors>({});
 const[done,setDone]=useState(false);
 const[saving,setSaving]=useState(false);
 const[signedIn,setSignedIn]=useState(appMode==="demo");

 useEffect(()=>{
  if(appMode==="live")getCurrentAuthUser().then(async u=>{setSignedIn(Boolean(u));if(!u)return;const defaults=await getCurrentFamilyOnboardingDefaults();setForm(f=>({...f,...defaults,loginEmail:u.email??"",childName:demoToken?f.childName:"",childDob:"",grade:demoToken?f.grade:"",school:"",interests:demoToken&&f.interests.length?f.interests:[],goal:"Explore technology & discover interests",codingExperience:"None",roboticsExperience:"None",source:demoToken?(f.source||"Demo / Discovery Session"):"",referringParentName:"",dataConsent:false,portfolioConsent:false}));});
 },[demoToken]);

 useEffect(()=>{if(!demoToken)return;let cancelled=false;(async()=>{try{const r=await fetch("/api/demo/"+encodeURIComponent(demoToken)+"/onboarding-prefill",{cache:"no-store"});const j=await r.json();if(!r.ok||!j.ok||cancelled)return;const p=j.prefill||{};const mapped=demoInterestMap[String(p.interest||"")]||"Not sure — need guidance";setForm(f=>({...f,
   primaryGuardianName:f.primaryGuardianName||p.parentName||"",
   primaryGuardianMobile:f.primaryGuardianMobile||p.parentWhatsApp||"",
   primaryWhatsApp:f.primaryWhatsApp||p.parentWhatsApp||"",
   loginEmail:f.loginEmail||p.parentEmail||"",
   childName:f.childName||p.childName||"",
   grade:f.grade||p.grade||"",
   interests:f.interests.length?f.interests:[mapped],
   roboticsExperience:String(p.interest||"").match(/robot|arduino/i)?(p.experienceLevel==="new"?"None":"Some experience"):f.roboticsExperience,
   codingExperience:String(p.interest||"").match(/coding|python|scratch|ai/i)?(p.experienceLevel==="new"?"None":"Some experience"):f.codingExperience,
   source:"Demo / Discovery Session"
  }));}catch{}})();return()=>{cancelled=true}},[demoToken]);

 const age=useMemo(()=>{
  if(!form.childDob)return null;
  const d=new Date(`${form.childDob}T12:00:00`);if(Number.isNaN(d.getTime()))return null;
  const now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return a;
 },[form.childDob]);
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
   if(!form.primaryGuardianName.trim())e.primaryGuardianName="Primary guardian name is required.";
   if(!form.primaryGuardianMobile||!validPhone(form.primaryGuardianMobile))e.primaryGuardianMobile="Enter a valid WhatsApp number for the primary guardian.";
   if(!form.secondaryGuardianMobile||!validPhone(form.secondaryGuardianMobile))e.secondaryGuardianMobile="A second valid WhatsApp number is required.";
   else if(phoneKey(form.secondaryGuardianMobile)===phoneKey(form.primaryGuardianMobile))e.secondaryGuardianMobile="Please provide a different second WhatsApp number.";
   if(showSecondGuardian||form.secondaryGuardianName.trim()){
    if(!form.secondaryGuardianName.trim())e.secondaryGuardianName="Enter the second parent / guardian name.";
    if(!form.secondaryGuardianRelationship)e.secondaryGuardianRelationship="Select their relationship.";
   }
   if(!form.addressLine1.trim())e.addressLine1="Address Line 1 is required.";
   if(!form.city.trim())e.city="City is required.";
   if(!form.country.trim())e.country="Country is required.";
   if(!form.postalCode.trim())e.postalCode="Postal / ZIP code is required.";
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
 function startAnotherChild(){
  setDone(false);setStep(1);setSlots([]);setTimingNote("");setErrors({});
  setForm(f=>({...f,childName:"",childDob:"",grade:"",school:"",preferredClassDays:[],preferredTimeWindows:"",interests:[],goal:"Explore technology & discover interests",codingExperience:"None",roboticsExperience:"None",source:"",referringParentName:"",dataConsent:false,portfolioConsent:false}));
 }
 async function submit(){
  if(!validate(2))return;
  if(slots.some(s=>!s.day||!s.start||!s.end||timeRangeError(s.start,s.end,s.endsNextDay,12*60))||slots.some((a,i)=>slots.some((b,j)=>j>i&&preferredWindowsOverlap(slotWindow(a),slotWindow(b))))){setErrors({submit:"Please enter valid, non-overlapping time windows. Overnight windows are allowed and are checked against the following day."});return;}
  const longWindow=slots.find(s=>s.endsNextDay&&preferredWindowDurationMinutes(s.start,s.end)>12*60);
  if(longWindow&&!window.confirm(`${longWindow.day} ${formatClock(longWindow.start)}–${formatClock(longWindow.end)} spans more than 12 hours and ends the next day. Is that intentional?`))return;
  setSaving(true);
  const secondGuardian=form.secondaryGuardianName.trim()&&form.secondaryGuardianRelationship?{name:form.secondaryGuardianName,relationship:form.secondaryGuardianRelationship as GuardianRelationship,mobile:form.secondaryGuardianMobile}:undefined;
  const legacy=legacyFieldsFromGuardians({name:form.primaryGuardianName,relationship:form.primaryGuardianRelationship,mobile:form.primaryGuardianMobile},secondGuardian);
  const r=await submitOnboarding({...form,referringParentName:(form.source==="Existing parent"||form.source==="Referred by an existing Robotronix parent")?form.referringParentName.trim():"",billingName:form.billingName.trim()||form.primaryGuardianName,billingEmail:form.billingEmail.trim()||form.loginEmail,billingPhone:form.billingPhone.trim()||form.primaryGuardianMobile,...legacy,secondaryGuardianMobile:form.secondaryGuardianMobile,preferredClassDays:[...new Set(slots.map(s=>s.day))],preferredTimeWindows:[...[...slots].sort((a,b)=>(dayIndex.get(a.day)??0)-(dayIndex.get(b.day)??0)||a.start.localeCompare(b.start)).map(s=>`${s.day}: ${s.start}–${s.end}${s.endsNextDay?" (+1 day)":""}`),...(timingNote.trim()?[`Note: ${timingNote.trim()}`]:[])].join("\n"),primaryWhatsApp:form.primaryGuardianMobile,alternateWhatsApp:form.secondaryGuardianMobile});
  setSaving(false);
  if(!r.ok){setErrors({submit:r.error??"Could not submit onboarding."});return;}
  setDone(true);
 }
 const err=(k:string)=>errors[k]?<div className="fieldError">{errors[k]}</div>:null;

 if(done)return <main className="onboardingShell"><div className="onboardingSuccess"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><span className="statusBadge status-active">Setup submitted</span><h1>Thank you. Your child’s learning profile has been received.</h1><p>Robotronix™ will review the details and confirm the course, trainer and recurring class schedule. You can add another child now without entering your family details again.</p><div className="row onboardingSuccessActions"><button className="button ghost" onClick={startAnotherChild}>+ Add another child</button><Link className="button" href={appMode==="demo"?"/admin/onboarding":"/parent"}>Go to Family Dashboard</Link></div></div></main>;
 if(!signedIn)return <main className="onboardingShell onboardingEntryShell"><div className="onboardingSignIn onboardingEntryCard"><img className="onboardingEntryLogo" src="/brand/robotronix-stacked.png" alt="Robotronix"/><div className="eyebrow">PARENT ONBOARDING</div><h1>Create your family portal</h1><p className="onboardingEntryLead">Continue with Google to securely create your family account and access the Robotronix Learning Portal.</p><button className="button googleButton onboardingGoogleButton" onClick={()=>signInWithGoogle(typeof window!=="undefined"?window.location.pathname+window.location.search:"/onboarding")}><span className="googleG">G</span> Continue with Google</button><div className="onboardingSecurityLine">Secure sign-in • No access to Gmail, Drive or Contacts</div><Link href="/" className="textLink onboardingBackLink">Back to Learning Portal</Link></div></main>;

 return <main className="onboardingPage">
  <header className="onboardingTop"><Link href="/"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link><div><b>Family Onboarding</b><span>Usually takes about 2 minutes</span></div><Link href="/" className="button ghost smallButton">Exit</Link></header>
  <section className="onboardingIntro"><div className="eyebrow">WELCOME TO ROBOTRONIX™</div><h1>Tell us the essentials to get your child started</h1><p>We keep onboarding short. Course, trainer and delivery setup are confirmed by the Robotronix™ team after submission.</p></section>
  <div className="wizard premiumWizard twoStepWizard"><button className={`wizardStep ${step===1?"active":"done"}`} onClick={()=>setStep(1)}><span className="stepNumber">1</span><span>Family & Child</span></button><button className={`wizardStep ${step===2?"active":""}`} onClick={()=>step===2&&setStep(2)}><span className="stepNumber">2</span><span>Learning & Submit</span></button></div>
  <section className="onboardingCard">
   {step===1&&<>
    <div className="formStepHead"><span>Step 1 of 2</span><h2>Family & child details</h2><p>Required fields are marked with <b>*</b>.</p></div>
    <div className="formSection compactFormSection"><h3>Parent / guardian contacts</h3><p className="sectionIntro">Add the main person we should contact. Two distinct WhatsApp numbers are required so we can still reach your family if one contact is unavailable.</p>
     <div className="guardianContactCard primaryGuardianCard"><div className="guardianCardHead"><b>Primary Guardian</b><span>Required</span></div><div className="formGrid">
      <Field label="Name *" value={form.primaryGuardianName} onChange={v=>set("primaryGuardianName",v)} error={errors.primaryGuardianName}/><div className="formGroup"><label>Relationship *</label><select className="input" value={form.primaryGuardianRelationship} onChange={e=>set("primaryGuardianRelationship",e.target.value as GuardianRelationship)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div>
      <PhoneField label="WhatsApp number 1" required value={form.primaryGuardianMobile} onChange={v=>set("primaryGuardianMobile",v)} country={form.country} error={errors.primaryGuardianMobile}/>
     </div></div>
     <div className="guardianContactCard secondaryGuardianCard"><div className="guardianCardHead"><b>Second WhatsApp contact</b><span>Required</span></div><p className="sectionIntro">Please give another WhatsApp number that Robotronix can use if the primary contact is unavailable.</p><div className="formGrid secondWhatsAppField">
      <PhoneField label="WhatsApp number 2" required value={form.secondaryGuardianMobile} onChange={v=>set("secondaryGuardianMobile",v)} country={form.country} error={errors.secondaryGuardianMobile}/>
     </div><div className="secondaryGuardianDisclosure"><p className="sectionIntro">If both parents are involved, please add both Mother and Father so we can keep both informed.</p>{!showSecondGuardian?<button type="button" className="button ghost smallButton" onClick={()=>setShowSecondGuardian(true)}>+ Add another parent / guardian</button>:<><div className="guardianCardHead secondaryGuardianDetailsHead"><b>Second parent / guardian details</b><button type="button" className="button ghost smallButton" onClick={()=>{setShowSecondGuardian(false);set("secondaryGuardianName","");set("secondaryGuardianRelationship","")}}>Remove details</button></div><div className="formGrid"><Field label="Name *" value={form.secondaryGuardianName} onChange={v=>set("secondaryGuardianName",v)} error={errors.secondaryGuardianName}/><div className="formGroup"><label>Relationship *</label><select className={`input ${errors.secondaryGuardianRelationship?"invalid":""}`} value={form.secondaryGuardianRelationship} onChange={e=>set("secondaryGuardianRelationship",e.target.value as GuardianRelationship|"")}><option value="">Select relationship</option>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select>{err("secondaryGuardianRelationship")}</div></div><small className="fieldHint">This parent / guardian uses WhatsApp number 2 above.</small></>}</div></div>
     <div className="formGrid guardianLocationGrid"><div className="formGroup"><label>Family account email *</label><input className={`input ${errors.loginEmail?"invalid":""}`} type="email" value={form.loginEmail} onChange={e=>appMode==="demo"&&set("loginEmail",e.target.value)} readOnly={appMode==="live"}/>{appMode==="live"&&<small className="fieldHint">Verified from your Google / portal account.</small>}{err("loginEmail")}</div></div></div>
    <div className="formSection compactFormSection"><h3>Address & billing details</h3><p className="sectionIntro">Your family address is stored once and can be reused for billing and future records.</p><div className="formGrid"><Field label="Address Line 1 *" value={form.addressLine1} onChange={v=>set("addressLine1",v)} error={errors.addressLine1}/><Field label="Address Line 2" value={form.addressLine2} onChange={v=>set("addressLine2",v)}/><CountryCityFields country={form.country} state={form.state||""} city={form.city} onCountryChange={v=>set("country",v)} onStateChange={v=>set("state",v)} onCityChange={v=>set("city",v)} onTimeZoneSuggestion={v=>set("timezone",v)} countryError={errors.country} cityError={errors.city}/><Field label="Postal / ZIP Code *" value={form.postalCode} onChange={v=>set("postalCode",v)} error={errors.postalCode}/><TimeZoneField value={form.timezone} onChange={v=>set("timezone",v)} label="Family timezone" required error={errors.timezone} autoMode locationLabel={[form.city,form.state].filter(Boolean).join(", ")} hint="Selected automatically from the family location."/></div><label className="billingSameCheck"><input type="checkbox" checked={billingSameAsPrimary} onChange={e=>setBillingSameAsPrimary(e.target.checked)}/><span><b>Billing contact is the same as the primary guardian</b><small>Recommended for most families. Uncheck only if a different person handles payments.</small></span></label>{!billingSameAsPrimary&&<div className="formGrid billingContactGrid"><Field label="Billing name" value={form.billingName} onChange={v=>set("billingName",v)}/><Field label="Billing email" value={form.billingEmail} onChange={v=>set("billingEmail",v)}/><Field label="Billing phone" value={form.billingPhone} onChange={v=>set("billingPhone",v)}/></div>}</div>
    <div className="formSection compactFormSection"><h3>Child profile</h3><div className="formGrid"><Field label="Child’s full name *" value={form.childName} onChange={v=>set("childName",v)} error={errors.childName}/><div className="formGroup"><label>Date of birth *</label><input className={`input ${errors.childDob?"invalid":""}`} type="date" value={form.childDob} onChange={e=>set("childDob",e.target.value)}/>{age!==null&&<small className="fieldHint">Age {age}</small>}{err("childDob")}</div><GradeSelect value={form.grade} onChange={v=>set("grade",v)} required error={errors.grade}/><Field label="School *" value={form.school} onChange={v=>set("school",v)} error={errors.school}/></div></div>
    <div className="wizardActions"><span/><button className="button" onClick={next}>Continue</button></div>
   </>}

   {step===2&&<>
    <div className="formStepHead"><span>Step 2 of 2</span><h2>Learning preferences</h2><p>A few quick choices help us recommend the right starting point and class schedule.</p></div>

    <section className="preferenceSection interestSection"><div className="preferenceSectionHead"><div><span>1</span><div><h3>What would your child like to explore?</h3><p>Choose one or more. We’ll recommend the right starting point.</p></div></div></div><div className="selectionGrid compactSelections interestSelectionGrid">{interests.map(x=><button type="button" key={x} className={`selectionCard ${form.interests.includes(x)?"selected":""}`} onClick={()=>toggle(x)}><span><b>{x}</b></span>{form.interests.includes(x)&&<i className="selectionCheck">✓</i>}</button>)}</div>{err("interests")}</section>

    <section className="preferenceSection"><div className="preferenceSectionHead"><div><span>2</span><div><h3>Learning profile</h3><p>This helps us recommend the right starting level.</p></div></div></div><div className="formGrid learningProfileGrid">
      <div className="formGroup"><label>What is the main learning goal? *</label><select className="input" value={form.goal} onChange={e=>set("goal",e.target.value)}>{["Explore technology & discover interests","Build practical projects","Learn coding fundamentals","Learn robotics & smart automation","Build AI / data skills","Create websites or apps","Improve school computer-science skills","Prepare for competitions / exhibitions","Develop problem-solving skills","Prepare for future STEM careers"].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="formGroup"><label>Coding experience *</label><select className="input" value={form.codingExperience} onChange={e=>set("codingExperience",e.target.value)}><option>None</option><option>Beginner</option><option>Some experience</option><option>Comfortable</option></select></div>
      <div className="formGroup"><label>Robotics experience *</label><select className="input" value={form.roboticsExperience} onChange={e=>set("roboticsExperience",e.target.value)}><option>None</option><option>Beginner</option><option>Some experience</option><option>Comfortable</option></select></div>
      <div className="formGroup"><label>How did you hear about Robotronix™? *</label><select className={`input ${errors.source?"invalid":""}`} value={form.source} onChange={e=>{const source=e.target.value;setForm(f=>({...f,source,referringParentName:source==="Existing parent"||source==="Referred by an existing Robotronix parent"?f.referringParentName:""}));}}><option value="">Select source</option>{sources.map(x=><option key={x} value={x}>{x}</option>)}</select>{err("source")}</div>
      {(form.source==="Existing parent"||form.source==="Referred by an existing Robotronix parent")&&<div className="formGroup"><label htmlFor="referringParentName">Referring parent’s name <span className="optionalLabel">Optional</span></label><input id="referringParentName" className="input" type="text" maxLength={120} autoComplete="off" placeholder="Name of the parent who recommended us" value={form.referringParentName} onChange={e=>set("referringParentName",e.target.value)}/><small className="fieldHint">Only enter their name if you know it. No account details are shared.</small></div>
    </div></section>

    <section className="preferenceSection timingPreferenceSection"><div className="preferenceSectionHead timingSectionHead"><div><span>3</span><div><h3>Preferred class timing windows</h3><p>When could classes work? Enter broad availability windows — the final recurring class time is confirmed later.</p></div></div></div>
      <div className="timingTimezoneRow"><TimeZoneField value={form.timezone} onChange={v=>set("timezone",v)} label="Your timezone" required error={errors.timezone} autoMode locationLabel={[form.city,form.state].filter(Boolean).join(", ")} hint={`Enter timings in your local timezone. We also show the India-time reference for Robotronix™.`}/><div className="timezoneReference"><span>Timing reference</span><b>{form.timezone===IST_TIMEZONE?"India time (IST)":"Your local time"}</b><small>{form.timezone===IST_TIMEZONE?"No conversion is needed.":"India-time reference is shown below each window for Robotronix™."}</small></div></div>
      <div className="dayPickerPanel"><div className="dayPickerHead"><b>Choose the days that work</b><small>Select any days in any order. The same choices remain available when adding more days.</small></div><div className="dayPickerOptions">{classDays.map(day=><button type="button" key={day} aria-pressed={slots.some(s=>s.day===day)} className={`dayChoice ${slots.some(s=>s.day===day)?"chosen":""}`} onClick={()=>slots.some(s=>s.day===day)?setSlots(rows=>rows.filter(x=>x.day!==day)):addDay(day)}>{day.slice(0,3)}</button>)}</div></div><div className="timingDayList">
        {groupedDays.map(day=><div className="timingDayCard" key={day}><div className="timingDayHead"><div><span>{day}</span><small>{shortTimeZoneLabel(form.timezone)} local time</small></div><div className="timingDayActions"><button type="button" className="textButton" onClick={()=>addTime(day)}>+ Add another time</button><button type="button" className="textButton" onClick={()=>openCopy(day)}>Copy to…</button></div></div>
          <div className="timingWindowList">{slots.map((slot,index)=>({slot,index})).filter(x=>x.slot.day===day).sort((a,b)=>a.slot.start.localeCompare(b.slot.start)).map(({slot,index})=>{const inferredNextDay=Boolean(slot.start&&slot.end&&slot.end<slot.start);const effective={...slot,endsNextDay:inferredNextDay};return <div className="timingWindowRow" key={`${day}-${index}`}><div className="timeField"><label>From</label><input className="input" type="time" aria-label={`${day} available from`} value={slot.start} onChange={e=>updateSlot(index,{start:e.target.value,endsNextDay:Boolean(e.target.value&&slot.end&&slot.end<e.target.value)})}/></div><span className="timeArrow">→</span><div className="timeField"><label>Until</label><input className="input" type="time" aria-label={`${day} available until`} value={slot.end} onChange={e=>updateSlot(index,{end:e.target.value,endsNextDay:Boolean(slot.start&&e.target.value&&e.target.value<slot.start)})}/></div><div className="timingWindowMeta">{inferredNextDay&&<small className="nextDayAuto">Ends {classDayNames[(classDayNames.indexOf(day)+1)%7]}</small>}{form.timezone!==IST_TIMEZONE&&<div className="indiaTimePreview"><span>India time</span><b>{indiaReference(effective,form.timezone)}</b></div>}</div>{timeRangeError(slot.start,slot.end,inferredNextDay,12*60)&&<div className="inlineFieldError">{timeRangeError(slot.start,slot.end,inferredNextDay,12*60)}</div>}<button type="button" className="iconButton dangerIcon" aria-label={`Remove ${day} time window`} onClick={()=>removeSlot(index)}>×</button></div>})}</div>
          {copyFrom===day&&<div className="copyTimingPanel"><div><b>Copy {day} timings to</b><div className="copyDayChoices">{classDays.filter(d=>d!==day).map(d=><label key={d}><input type="checkbox" checked={copyTargets.includes(d)} onChange={e=>setCopyTargets(x=>e.target.checked?[...x,d]:x.filter(v=>v!==d))}/><span>{d.slice(0,3)}</span></label>)}</div></div><div className="copyModeChoices"><label><input type="radio" checked={copyMode==="merge"} onChange={()=>setCopyMode("merge")}/> Merge non-overlapping</label><label><input type="radio" checked={copyMode==="replace"} onChange={()=>setCopyMode("replace")}/> Replace selected days</label></div><div className="row"><button type="button" className="button ghost smallButton" onClick={()=>setCopyFrom(null)}>Cancel</button><button type="button" className="button smallButton" disabled={!copyTargets.length} onClick={applyCopy}>Copy timings</button></div></div>}
        </div>)}
        {!groupedDays.length&&<div className="emptyScheduleState"><b>No preferred windows added yet.</b><span>Add the days and broad times that usually work for your family.</span></div>}
      </div>
      <button type="button" className="button ghost timingAddDay" onClick={()=>setDayPickerOpen(v=>!v)}>{groupedDays.length?"+ Add another day":"+ Add day"}</button>{dayPickerOpen&&<div className="dayPickerPanel" aria-label="Add another preferred day"><b>Select an additional day</b><div className="dayPickerOptions">{classDays.filter(day=>!slots.some(s=>s.day===day)).map(day=><button type="button" key={day} className="dayChoice" onClick={()=>{addDay(day);setDayPickerOpen(false)}}>{day.slice(0,3)}</button>)}</div></div>}
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

// useSearchParams suspends during static prerendering in Next.js 16.
export default function OnboardingPage(){
 return <Suspense fallback={<main className="pageShell"><p>Loading onboarding…</p></main>}><OnboardingPageContent/></Suspense>;
}
