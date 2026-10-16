import type {
  ClassAttendanceRecord, CourseAdminRecord, EnrollmentAdminRecord, EnrollmentHoldRecord, LearnerProgressRow,
  LearnerProjectRecord, LearningObservationRecord, LearningStatus, ProgressAlertActionRecord, ProgressAlertRecord,
  ScheduleEvent, StudentAdminRecord, TrainerAdminRecord, TrainerFeedbackRecord
} from "./types";

const attendedStatuses=new Set(["attended","late"]);
function pct(n:number,d:number){return d>0?Math.round((n/d)*100):0;}
function isoDate(value?:string){return value?value.slice(0,10):undefined;}
function daysBetween(a:string,b:string){return Math.floor((new Date(`${b}T12:00:00`).getTime()-new Date(`${a}T12:00:00`).getTime())/86400000);}

export function buildLearnerProgressRows(input:{
  students:StudentAdminRecord[]; enrollments:EnrollmentAdminRecord[]; courses:CourseAdminRecord[]; trainers:TrainerAdminRecord[];
  attendance:ClassAttendanceRecord[]; events:ScheduleEvent[]; observations:LearningObservationRecord[]; feedback?:TrainerFeedbackRecord[]; projects:LearnerProjectRecord[]; holds:EnrollmentHoldRecord[];
  alerts?:ProgressAlertRecord[];
}):LearnerProgressRow[]{
  const eventById=new Map(input.events.map(e=>[e.id,e]));
  return input.enrollments.filter(e=>e.status!=="cancelled").map(enrollment=>{
    const student=input.students.find(s=>s.id===enrollment.studentId); const course=input.courses.find(c=>c.id===enrollment.courseId); const trainer=input.trainers.find(t=>t.id===enrollment.trainerId);
    const attendance=input.attendance.filter(a=>a.enrollmentId===enrollment.id);
    const portalAttended=attendance.filter(a=>attendedStatuses.has(a.status)).length;
    const attended=(enrollment.openingCompletedSessions??0)+portalAttended;
    const absent=attendance.filter(a=>a.status==="absent").length;
    const excused=attendance.filter(a=>a.status==="excused").length;
    const denominator=portalAttended+absent;
    const attendanceRate=pct(portalAttended,denominator);
    const attendedDates=attendance.filter(a=>attendedStatuses.has(a.status)).map(a=>eventById.get(a.scheduleEventId)?.date).filter(Boolean) as string[];
    attendedDates.sort();
    const observations=input.observations.filter(o=>o.enrollmentId===enrollment.id).map(o=>({id:o.id,signal:o.signal,createdAt:o.createdAt}));
    const feedback=(input.feedback??[]).filter(f=>f.enrollmentId===enrollment.id).map(f=>({id:f.id,signal:f.signal,createdAt:f.createdAt}));
    const recent=[...observations,...feedback].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4);
    let currentSignal:LearningStatus="on_track";
    if(recent.some(o=>o.signal==="follow_up")|| (denominator>=3&&attendanceRate<70)) currentSignal="follow_up";
    else if(recent.filter(o=>o.signal==="reinforce").length>=2 || (denominator>=3&&attendanceRate<85)) currentSignal="reinforce";
    const projects=input.projects.filter(p=>p.enrollmentId===enrollment.id);
    const activeHold=input.holds.find(h=>h.enrollmentId===enrollment.id&&h.status==="active");
    const alerts=(input.alerts??[]).filter(a=>a.enrollmentId===enrollment.id&&["open","reviewed"].includes(a.status));
    return {
      studentId:enrollment.studentId,enrollmentId:enrollment.id,studentName:student?.fullName??"Learner",grade:student?.grade??"",courseId:enrollment.courseId,courseTitle:course?.shortTitle||course?.title||"Course",trainerId:enrollment.trainerId,trainerName:trainer?.fullName??"Trainer",enrollmentStatus:enrollment.status,enrollmentType:enrollment.enrollmentType,
      sessionsAttended:attended,totalSessions:enrollment.plannedSessions??course?.totalSessions??0,plannedHours:enrollment.plannedHours,hoursCompleted:enrollment.hoursCompleted,hoursRemaining:enrollment.hoursRemaining,progressPercent:enrollment.progressPercent,attendanceRate,attendanceRecorded:denominator,absentCount:absent,excusedCount:excused,currentSignal,recentSignalCount:recent.filter(o=>o.signal!=="on_track").length,lastAttendedDate:attendedDates.at(-1),projectsTotal:projects.length,projectsCompleted:projects.filter(p=>p.status==="completed").length,projectsAwaitingReview:projects.filter(p=>p.status==="submitted").length,activeHold,openAlertCount:alerts.length
    };
  });
}

export function buildProgressAlerts(input:{
  students:StudentAdminRecord[]; enrollments:EnrollmentAdminRecord[]; courses:CourseAdminRecord[]; trainers:TrainerAdminRecord[];
  attendance:ClassAttendanceRecord[]; events:ScheduleEvent[]; observations:LearningObservationRecord[]; feedback?:TrainerFeedbackRecord[]; projects:LearnerProjectRecord[]; holds:EnrollmentHoldRecord[]; actions:ProgressAlertActionRecord[];
  today?:string;
}):ProgressAlertRecord[]{
  const today=input.today??new Date().toISOString().slice(0,10); const eventById=new Map(input.events.map(e=>[e.id,e])); const actionByKey=new Map(input.actions.map(a=>[a.ruleKey,a]));
  const rows:ProgressAlertRecord[]=[];
  function add(base:Omit<ProgressAlertRecord,"status"|"generatedAt">){const action=actionByKey.get(base.ruleKey);rows.push({...base,status:action?.status??"open",generatedAt:action?.updatedAt??new Date().toISOString()});}
  for(const enrollment of input.enrollments.filter(e=>["active","on_hold"].includes(e.status))){
    const student=input.students.find(s=>s.id===enrollment.studentId); const name=student?.fullName??"Learner";
    const attendance=input.attendance.filter(a=>a.enrollmentId===enrollment.id).map(a=>({...a,date:eventById.get(a.scheduleEventId)?.date??""})).filter(a=>a.date).sort((a,b)=>b.date.localeCompare(a.date));
    const counted=attendance.filter(a=>a.status!=="excused"); const attended=counted.filter(a=>attendedStatuses.has(a.status)).length; const absences=counted.filter(a=>a.status==="absent").length; const rate=pct(attended,attended+absences);
    if(counted.length>=3&&rate<75)add({ruleKey:`attendance-low:${enrollment.id}:${counted[0]?.scheduleEventId??"none"}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"attendance",severity:"high",title:`Low attendance · ${name}`,detail:`Attendance is ${rate}% across recorded classes. Review the recent absence pattern before scheduling the next milestone.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    else if(counted.length>=3&&rate<85)add({ruleKey:`attendance-watch:${enrollment.id}:${counted[0]?.scheduleEventId??"none"}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"attendance",severity:"medium",title:`Attendance needs attention · ${name}`,detail:`Attendance is ${rate}%. Check whether recent missed classes require rescheduling or a temporary hold.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    const latestTwo=counted.slice(0,2); if(latestTwo.length===2&&latestTwo.every(a=>a.status==="absent"))add({ruleKey:`attendance-consecutive:${enrollment.id}:${latestTwo.map(x=>x.scheduleEventId).join("-")}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"attendance",severity:"high",title:`Two consecutive absences · ${name}`,detail:"The learner has missed the two most recent counted classes. Confirm availability before the next scheduled session.",href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    const obs=input.observations.filter(o=>o.enrollmentId===enrollment.id).map(o=>({id:o.id,signal:o.signal,createdAt:o.createdAt}));
    const fb=(input.feedback??[]).filter(f=>f.enrollmentId===enrollment.id).map(f=>({id:f.id,signal:f.signal,createdAt:f.createdAt}));
    const signals=[...obs,...fb].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4);
    if(signals.some(o=>o.signal==="follow_up"))add({ruleKey:`learning-followup:${enrollment.id}:${signals[0]?.id??"none"}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"learning",severity:"high",title:`Learning area needs attention · ${name}`,detail:"A recent trainer signal shows an area that needs focused attention during upcoming regular sessions. Review feedback and agree the next learning action.",href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    else if(signals.filter(o=>o.signal==="reinforce").length>=2)add({ruleKey:`learning-reinforce:${enrollment.id}:${signals[0]?.id??"none"}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"learning",severity:"medium",title:`Review needed next class · ${name}`,detail:"Two or more recent learning signals suggest revisiting this concept during upcoming regular sessions. Consider a short recap or practice build.",href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    const lastAttended=attendance.filter(a=>attendedStatuses.has(a.status))[0]?.date; if(enrollment.status==="active"&&lastAttended&&daysBetween(lastAttended,today)>=21)add({ruleKey:`inactivity:${enrollment.id}:${lastAttended??"none"}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"inactivity",severity:"medium",title:`No attended class recently · ${name}`,detail:`No attended class has been recorded for ${daysBetween(lastAttended,today)} days. Check the schedule or consider placing the enrollment on hold.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    const projects=input.projects.filter(p=>p.enrollmentId===enrollment.id);
    projects.filter(p=>p.status==="submitted"&&daysBetween(isoDate(p.submittedAt)??today,today)>=7).forEach(p=>add({ruleKey:`project-review:${p.id}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"project",severity:"medium",title:`Project review pending · ${name}`,detail:`${p.title} has been awaiting trainer review for ${daysBetween(isoDate(p.submittedAt)??today,today)} days.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`}));
    projects.filter(p=>p.status==="in_progress"&&daysBetween(isoDate(p.updatedAt)??p.startedAt,today)>=21).forEach(p=>add({ruleKey:`project-stalled:${p.id}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"project",severity:"low",title:`Project progress has stalled · ${name}`,detail:`${p.title} has not been updated for ${daysBetween(isoDate(p.updatedAt)??p.startedAt,today)} days.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`}));
    const hold=input.holds.find(h=>h.enrollmentId===enrollment.id&&h.status==="active"); if(hold?.endDate&&hold.endDate<today)add({ruleKey:`hold-ended:${hold.id}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"hold",severity:"medium",title:`Hold period ended · ${name}`,detail:`The ${hold.reason} hold ended on ${hold.endDate}. Confirm whether the learner should resume or extend the hold.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
    if(hold&&daysBetween(hold.startDate,today)>=30)add({ruleKey:`hold-long:${hold.id}`,studentId:enrollment.studentId,enrollmentId:enrollment.id,type:"hold",severity:"low",title:`Long enrollment hold · ${name}`,detail:`This enrollment has been on hold for ${daysBetween(hold.startDate,today)} days. Review the expected return date.`,href:`/admin/progress/${enrollment.studentId}?enrollment=${enrollment.id}`});
  }
  return rows.sort((a,b)=>({high:0,medium:1,low:2}[a.severity]-{high:0,medium:1,low:2}[b.severity])||b.generatedAt.localeCompare(a.generatedAt));
}
