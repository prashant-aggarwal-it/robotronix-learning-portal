import { demoEnrollments, demoStudents, demoCourses } from "./admin-demo-data";
import type { EnrollmentHoldRecord, LearnerProjectRecord, LearningObservationRecord, ProgressAlertActionRecord, TrainerFeedbackRecord } from "./types";

function isoDaysAgo(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString();}
function dateDaysAgo(days:number){return isoDaysAgo(days).slice(0,10);}

export const demoLearningObservations:LearningObservationRecord[] = demoEnrollments.slice(0,10).flatMap((enr,i)=>{
  const count=4+(i%5);
  const rows:LearningObservationRecord[]=[];
  for(let n=Math.max(0,count-3);n<count;n++){
    const risk=i===4&&n>=count-2?"reinforce":i===8&&n===count-1?"follow_up":(n===count-1&&i%5===1?"reinforce":"on_track");
    rows.push({
      id:`obs-${i}-${n}`,
      scheduleEventId:`hist-${i}-${n}`,
      studentId:enr.studentId,
      enrollmentId:enr.id,
      trainerId:enr.trainerId,
      signal:risk,
      strength:risk==="on_track"?"Applies concepts confidently during guided practice.":risk==="reinforce"?"Understands the idea with prompts.":"Engagement needs closer follow-up before moving ahead.",
      nextFocus:risk==="on_track"?"Increase independent problem solving.":risk==="reinforce"?"Revisit the concept through one practical build.":"Review recent concepts and agree a recovery plan.",
      feedback:risk==="on_track"?"Good participation and steady progress in the session.":risk==="reinforce"?"Review this concept briefly in the next regular class before moving ahead.":"Please review the recent learning pattern before the next class.",
      createdAt:isoDaysAgo((count-n)*3+i),
      updatedAt:isoDaysAgo((count-n)*3+i)
    });
  }
  return rows;
});

const projectTemplates=[
  ["Smart Calculator","milestone",["Variables","Conditions","Functions"]],
  ["Quiz Game","guided",["Loops","Lists","Logic"]],
  ["Interactive Portfolio","independent",["Planning","UI","Debugging"]],
  ["Sensor Challenge","guided",["Sensors","Logic","Testing"]],
] as const;

export const demoLearnerProjects:LearnerProjectRecord[]=demoEnrollments.slice(0,12).flatMap((enr,i)=>{
  const course=demoCourses.find(c=>c.id===enr.courseId)!;
  const student=demoStudents.find(s=>s.id===enr.studentId)!;
  const total=i%3===0?2:1;
  return Array.from({length:total},(_,j)=>{
    const tpl=projectTemplates[(i+j)%projectTemplates.length];
    const status=j===0?(i%5===2?"submitted":i%4===1?"in_progress":"completed"):(i%2?"reviewed":"in_progress");
    const started=isoDaysAgo(24-i*1-j*5);
    return {
      id:`proj-${i}-${j}`,
      studentId:enr.studentId,
      enrollmentId:enr.id,
      courseId:enr.courseId,
      title:course.id==="arduino-robotics"&&j===0?"Smart Water Level Controller":course.id==="scratch-coding"&&j===0?"Maze Adventure":tpl[0],
      type:tpl[1],
      status,
      skills:[...tpl[2]],
      evidenceUrl:status==="completed"?`https://example.com/${student.id}/project-${j+1}`:undefined,
      studentReflection:status==="completed"?"I improved the project after testing different cases.":undefined,
      trainerFeedback:status==="completed"||status==="reviewed"?"Strong practical application. Next, explain the logic more independently.":undefined,
      startedAt:started.slice(0,10),
      submittedAt:["submitted","reviewed","completed"].includes(status)?isoDaysAgo(7+i+j):undefined,
      reviewedAt:["reviewed","completed"].includes(status)?isoDaysAgo(4+i+j):undefined,
      completedAt:status==="completed"?isoDaysAgo(2+i+j):undefined,
      updatedAt:status==="in_progress"&&i%4===1?isoDaysAgo(23):isoDaysAgo(2+i+j)
    } as LearnerProjectRecord;
  });
});

export const demoTrainerFeedback:TrainerFeedbackRecord[] = demoEnrollments.slice(0,8).map((enr,i)=>({
  id:`fb-${i}`,
  studentId:enr.studentId,
  enrollmentId:enr.id,
  trainerId:enr.trainerId,
  type:i%3===0?"milestone":"general",
  title:i%3===0?"Milestone review":"Progress note",
  summary:i%4===1?"The learner is progressing well but benefits from a short recap before independent tasks.":"Steady progress with good participation and growing independence.",
  strengths:i%4===1?"Curious and willing to attempt problems.":"Good project engagement and clear understanding of recent concepts.",
  nextFocus:i%4===1?"Practise one concept independently before the next class.":"Increase independent debugging and explanation of project logic.",
  signal:i%4===1?"reinforce":"on_track",
  createdAt:isoDaysAgo(6+i),
  updatedAt:isoDaysAgo(6+i)
}));

export const demoEnrollmentHolds:EnrollmentHoldRecord[]=[
  {
    id:"hold-enr-016-1", enrollmentId:"enr-016", studentId:demoEnrollments[15]?.studentId??"",
    reason:"exams", startDate:dateDaysAgo(3), endDate:dateDaysAgo(-12), status:"active",
    note:"Paused during school examinations. Resume after the exam window.", createdAt:isoDaysAgo(4)
  },
  {
    id:"hold-enr-004-old", enrollmentId:"enr-004", studentId:demoEnrollments[3]?.studentId??"",
    reason:"travel", startDate:dateDaysAgo(40), endDate:dateDaysAgo(31), status:"ended",
    note:"Family travel.", createdAt:isoDaysAgo(41), endedAt:isoDaysAgo(31)
  }
];

export const demoProgressAlertActions:ProgressAlertActionRecord[]=[];
