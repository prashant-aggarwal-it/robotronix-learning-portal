"use client";

import type {CohortAdminRecord,CourseAdminRecord,EnrollmentAdminRecord,StudentAdminRecord,TrainerAdminRecord} from "./types";
import {dayNames,formatWeeklySchedule,timeZoneLabel} from "./timezones";
import {exportWorkbook} from "./export-workbook";

function dateLabel(value?:string){if(!value)return "";return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));}

export async function exportStudentWorkbook(input:{students:StudentAdminRecord[];enrollments:EnrollmentAdminRecord[];courses:CourseAdminRecord[];trainers:TrainerAdminRecord[];cohorts:CohortAdminRecord[]}){
  const {students,enrollments,courses,trainers,cohorts}=input;
  const courseName=(id:string)=>courses.find(c=>c.id===id)?.title??id;
  const trainerName=(id:string)=>trainers.find(t=>t.id===id)?.fullName??"Unassigned";
  const cohortName=(id?:string)=>id?cohorts.find(c=>c.id===id)?.name??id:"";
  const latestEnrollment=(studentId:string)=>[...enrollments.filter(e=>e.studentId===studentId)].sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
  const activeEnrollment=(studentId:string)=>enrollments.find(e=>e.studentId===studentId&&["active","on_hold"].includes(e.status))??latestEnrollment(studentId);

  const studentRows=students.map(student=>{
    const current=activeEnrollment(student.id);
    return {
      "Student ID":student.id,"Student Name":student.fullName,"Date of Birth":student.dob,"Grade / Class":student.grade,"School":student.school,
      "City":student.city,"State / Province":student.state??"","Country":student.country,"Learning Timezone":timeZoneLabel(student.timezone),"Record Status":student.recordStatus,
      "Mother Name":student.motherName,"Mother Mobile":student.motherMobile,"Father Name":student.fatherName,"Father Mobile":student.fatherMobile,
      "Primary Contact":student.primaryContact,"Primary WhatsApp":student.primaryWhatsApp,"Alternate Contact":student.alternateWhatsApp,"Parent Login Email":student.parentLoginEmail,
      "Interests":student.interests.join(", "),"Previous Experience":student.previousExperience,"Source":student.source,
      "Current Course":current?courseName(current.courseId):"","Current Trainer":current?trainerName(current.trainerId):"","Current Enrollment Status":current?.status??"No enrollment","Delivery Channel":current?.deliveryChannel??"","Center / Location":current?.centerLocation??"","Schedule Mode":current?.scheduleMode??"",
      "Current Progress %":current?.progressPercent??"","Instructional Hours Completed":current?.hoursCompleted??"","Total Instructional Hours":current?.plannedHours??"","Instructional Hours Remaining":current?.hoursRemaining??"","Classes Attended":current?.sessionsCompleted??"","Current Weekly Schedule":current?formatWeeklySchedule(current.scheduleRules,current.scheduleTimezone):""
    };
  });
  const enrollmentRows=enrollments.map(enrollment=>{
    const student=students.find(s=>s.id===enrollment.studentId);
    const course=courses.find(c=>c.id===enrollment.courseId);
    const completedInCycle=enrollment.sessionsCompleted%8;
    const nextMilestone=(Math.floor(enrollment.sessionsCompleted/8)+1)*8;
    const milestoneRemaining=completedInCycle===0&&enrollment.sessionsCompleted>0?8:8-completedInCycle;
    return {
      "Enrollment ID":enrollment.id,"Student":student?.fullName??enrollment.studentId,"Course":courseName(enrollment.courseId),"Trainer":trainerName(enrollment.trainerId),
      "Delivery Format":enrollment.enrollmentType==="one_to_one"?"1-to-1":"Cohort","Delivery Channel":enrollment.deliveryChannel??"online","Center / Location":enrollment.centerLocation??"","Schedule Mode":enrollment.scheduleMode??"recurring","Cohort":cohortName(enrollment.cohortId),"Status":enrollment.status,
      "Start Date":dateLabel(enrollment.startedAt),"Completion Date":dateLabel(enrollment.completedAt),"Total Instructional Hours":enrollment.plannedHours??"","Instructional Hours Completed":enrollment.hoursCompleted??"","Instructional Hours Remaining":enrollment.hoursRemaining??"","Classes Attended":enrollment.sessionsCompleted,"Reference Estimated Classes":course?.totalSessions??"",
      "Progress %":enrollment.progressPercent,"Next 8-Class Attendance Marker":nextMilestone,"Classes to Marker":milestoneRemaining,"Schedule Timezone":timeZoneLabel(enrollment.scheduleTimezone),"Weekly Schedule":formatWeeklySchedule(enrollment.scheduleRules,enrollment.scheduleTimezone),
      "Hold Reason":enrollment.holdReason??"","Hold From":dateLabel(enrollment.holdFrom),"Hold Until":dateLabel(enrollment.holdUntil),"Hold Note":enrollment.holdNote??""
    };
  });
  const scheduleRows=enrollments.flatMap(enrollment=>enrollment.scheduleRules.map(slot=>({
    "Student":students.find(s=>s.id===enrollment.studentId)?.fullName??enrollment.studentId,"Course":courseName(enrollment.courseId),"Trainer":trainerName(enrollment.trainerId),"Enrollment Status":enrollment.status,
    "Delivery Channel":enrollment.deliveryChannel??"online","Center / Location":enrollment.centerLocation??"","Schedule Mode":enrollment.scheduleMode??"recurring","Day":dayNames[slot.dayOfWeek],"Start Time":slot.startTime,"End Time":slot.endTime,"Timezone":timeZoneLabel(enrollment.scheduleTimezone),"Enrollment ID":enrollment.id
  })));

  const filename=`Robotronix-Student-Export-${new Date().toISOString().slice(0,10)}.xlsx`;
  await exportWorkbook(filename,[
    {name:"Students",rows:studentRows},
    {name:"Enrollment History",rows:enrollmentRows},
    {name:"Weekly Schedules",rows:scheduleRows.length?scheduleRows:[{"Student":"No recurring schedule records"}]}
  ]);
  return filename;
}
