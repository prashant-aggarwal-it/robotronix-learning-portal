import Link from "next/link";
import type { LearnerExperienceSnapshot, LearningStatus, ScheduleEvent } from "@/lib/types";
import {shortTimeZoneLabel} from "@/lib/timezones";
import {displayLabel} from "@/lib/display";

export function learningStatusCopy(status:LearningStatus){
  if(status==="reinforce") return {label:"Strengthening concepts",tone:"amber",title:"Building confidence in key concepts",body:"Your mentor is revisiting a recent concept so the next step feels more confident and independent."};
  if(status==="follow_up") return {label:"Mentor focus",tone:"red",title:"A little extra mentor focus is planned",body:"The recent learning pattern needs a closer look. Your mentor is following up before the next milestone."};
  return {label:"On track",tone:"green",title:"Learning is moving well",body:"Attendance and recent learning signals look healthy. Keep the momentum going."};
}

export function formatShortDate(value:string){return new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`));}
export function formatTime(value:string){const [h,m]=value.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);return new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit"}).format(d);}

export function ProjectVisual({title,compact=false}:{title:string;compact?:boolean}){
  const lower=title.toLowerCase();
  const kind=lower.includes("water")?"water":lower.includes("car")||lower.includes("vehicle")?"car":lower.includes("gate")||lower.includes("toll")?"gate":lower.includes("light")?"light":"build";
  return <div className={`projectVisual projectVisual-${kind} ${compact?"compact":""}`} aria-hidden="true">
    <div className="projectVisualGlow"/>
    <svg viewBox="0 0 240 150" role="presentation">
      {kind==="water"?<>
        <rect x="48" y="28" width="92" height="96" rx="12" className="pvLine"/>
        <path d="M58 86 C78 72, 95 100, 130 82 L130 114 L58 114 Z" className="pvFill"/>
        <circle cx="174" cy="52" r="12" className="pvAccent"/><circle cx="174" cy="83" r="12" className="pvAccent soft"/><circle cx="174" cy="114" r="12" className="pvAccent soft"/>
        <path d="M141 52 H160 M141 83 H160 M141 114 H160" className="pvLine"/>
        <path d="M30 52 C38 44,38 36,30 28 C22 36,22 44,30 52 Z" className="pvDrop"/>
      </>:kind==="car"?<>
        <path d="M47 90 L67 58 H154 L183 90 V111 H47 Z" className="pvFill"/><path d="M79 58 L95 40 H139 L154 58" className="pvLine"/><circle cx="80" cy="113" r="15" className="pvAccent"/><circle cx="158" cy="113" r="15" className="pvAccent"/><path d="M184 69 Q212 75 218 95" className="pvSignal"/>
      </>:kind==="gate"?<>
        <rect x="43" y="50" width="24" height="75" rx="6" className="pvFill"/><path d="M62 61 L184 84" className="pvLine thick"/><circle cx="62" cy="61" r="10" className="pvAccent"/><path d="M163 46 Q194 46 206 69 M170 57 Q191 58 198 73" className="pvSignal"/>
      </>:kind==="light"?<>
        <circle cx="119" cy="62" r="35" className="pvFill"/><path d="M101 91 H137 M105 103 H133 M110 115 H128" className="pvLine"/><path d="M119 14 V1 M75 29 L64 17 M163 29 L174 17 M67 63 H49 M171 63 H189" className="pvSignal"/>
      </>:<>
        <rect x="78" y="42" width="84" height="66" rx="15" className="pvFill"/><circle cx="120" cy="75" r="17" className="pvAccent"/><path d="M120 20 V41 M120 109 V130 M56 75 H77 M163 75 H185 M75 31 L89 45 M165 31 L151 45 M75 119 L89 105 M165 119 L151 105" className="pvLine"/>
        <circle cx="42" cy="75" r="8" className="pvAccent soft"/><circle cx="198" cy="75" r="8" className="pvAccent soft"/>
      </>}
    </svg>
    <span>{kind==="water"?"Sensor + control logic":kind==="car"?"Motion + automation":kind==="gate"?"Sensor + servo system":kind==="light"?"Smart sensing":"Build · Code · Test"}</span>
  </div>
}

export function NextClassCard({event,trainer}:{event?:ScheduleEvent;trainer:string}){
  return <div className="experienceCard nextClassCard"><div className="nextClassAccent"><span>UP NEXT</span><b>{event?new Intl.DateTimeFormat("en-IN",{day:"2-digit"}).format(new Date(`${event.date}T12:00:00`)):"—"}</b><small>{event?new Intl.DateTimeFormat("en-IN",{month:"short"}).format(new Date(`${event.date}T12:00:00`)):"TBD"}</small></div><div className="experienceCardBody"><span className="experienceLabel">NEXT CLASS</span>{event?<><h3>{formatShortDate(event.date)} · {formatTime(event.startTime)} {shortTimeZoneLabel(event.timezone)}</h3><p>{event.title}</p><div className="experienceMeta"><span>Mentor {trainer}</span><span>{event.deliveryMode.replaceAll("_"," ")}</span></div></>:<><h3>No class scheduled yet</h3><p>Your next class will appear here as soon as the schedule is confirmed.</p></>}</div></div>
}

export function ParentActionCard({snapshot}:{snapshot:LearnerExperienceSnapshot}){
  const status=learningStatusCopy(snapshot.learner.status);
  if(snapshot.activeHold) return <div className="experienceCard parentActionCard hold"><div className="experienceIcon">Ⅱ</div><div className="experienceCardBody"><span className="experienceLabel">CURRENT STATUS</span><h3>Learning is temporarily paused</h3><p>{snapshot.activeHold.reason.charAt(0).toUpperCase()+snapshot.activeHold.reason.slice(1)} hold{snapshot.activeHold.endDate?` until ${formatShortDate(snapshot.activeHold.endDate)}`:""}. Completed course hours stay protected until classes resume.</p></div></div>;
  return <div className={`experienceCard parentActionCard ${status.tone}`}><div className="experienceIcon">{snapshot.learner.status==="on_track"?"✓":"↗"}</div><div className="experienceCardBody"><span className="experienceLabel">LEARNING PULSE</span><h3>{status.title}</h3><p>{status.body}</p></div></div>
}

export function ProjectSpotlight({snapshot,href}:{snapshot:LearnerExperienceSnapshot;href?:string}){
  const project=snapshot.projects[0];
  return <div className="experienceCard projectSpotlight"><div className="experienceCardBody"><span className="experienceLabel">PROJECT SPOTLIGHT</span>{project?<><div className="projectSpotlightGrid"><ProjectVisual title={project.title}/><div className="projectSpotlightCopy"><div className="row between" style={{alignItems:"flex-start"}}><div><h3>{project.title}</h3><p>{project.trainerFeedback||"A practical build that turns class concepts into visible work."}</p></div><span className={`statusBadge status-${project.status}`}>{displayLabel(project.status)}</span></div><div className="tagRow">{project.skills.slice(0,4).map(skill=><span className="softBadge" key={skill}>{skill}</span>)}</div></div></div></>:<><div className="projectEmptyVisual"><ProjectVisual title="First build" compact/><div><h3>Projects will appear here</h3><p>As the learner starts building, project milestones and mentor feedback will be visible here.</p></div></div></>}{href&&<Link className="textLink" href={href}>Explore project journey →</Link>}</div></div>
}

export function FeedbackCard({snapshot}:{snapshot:LearnerExperienceSnapshot}){
  const latest=snapshot.feedback[0];
  const observation=snapshot.observations[0];
  return <div className="experienceCard feedbackSpotlight"><div className="mentorMark">“</div><div className="experienceCardBody"><span className="experienceLabel">MENTOR INSIGHT</span>{latest?<><h3>{latest.title}</h3><p className="mentorSummary">{latest.summary}</p><div className="feedbackSplit"><div><span>What’s working</span><b>{latest.strengths}</b></div><div><span>Next focus</span><b>{latest.nextFocus}</b></div></div></>:observation?<><h3>Recent session feedback</h3><p className="mentorSummary">{observation.feedback}</p><div className="feedbackSplit"><div><span>What’s working</span><b>{observation.strength}</b></div><div><span>Next focus</span><b>{observation.nextFocus}</b></div></div></>:<><h3>Mentor insights will appear here</h3><p>Feedback will appear after learning sessions and milestone reviews.</p></>}</div></div>
}