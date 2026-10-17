import {test,expect} from '@playwright/test';
import {calculateTrainerEarning,DEFAULT_COMP_PLAN} from '@/lib/trainer-payroll';
import type {ClassAttendanceRecord,EnrollmentAdminRecord,ScheduleEvent,TrainerCompensationPlan} from '@/lib/types';

const plan:TrainerCompensationPlan={id:'qa-plan',trainerId:'qa-trainer',updatedAt:new Date().toISOString(),...DEFAULT_COMP_PLAN};
const enrollment:EnrollmentAdminRecord={
  id:'qa-enr',studentId:'qa-student',courseId:'qa-course',trainerId:'qa-trainer',enrollmentType:'one_to_one',status:'active',startedAt:'2026-01-01',scheduleTimezone:'Asia/Kolkata',scheduleRules:[],deliveryChannel:'online',scheduleMode:'recurring',sessionsCompleted:0,plannedHours:12,hoursCompleted:0,hoursRemaining:12,progressPercent:0
};
function event(status:ScheduleEvent['status']='conducted'):ScheduleEvent{return{id:'qa-event',trainerId:'qa-trainer',courseId:'qa-course',enrollmentId:'qa-enr',studentId:'qa-student',title:'QA class',date:'2026-10-12',startTime:'16:00',endTime:'17:00',timezone:'Asia/Kolkata',eventType:'class',deliveryMode:'one_to_one',status,notes:'',occurrenceKind:'regular',requestedBy:'admin',actualDurationMinutes:60}}
function attendance(status:ClassAttendanceRecord['status']):ClassAttendanceRecord{return{id:'qa-att',scheduleEventId:'qa-event',studentId:'qa-student',enrollmentId:'qa-enr',status,note:'',updatedAt:new Date().toISOString()}}

test.describe('Trainer payroll business rules',()=>{
 test('completed 1-to-1 class earns the normal class pay',()=>{
  const r=calculateTrainerEarning({event:event('conducted'),plan,attendance:[attendance('attended')],enrollments:[enrollment]});
  expect(r.classOutcome).toBe('completed');expect(r.totalAmount).toBe(plan.oneToOneDay);
 });
 test('student no-show produces zero trainer class pay',()=>{
  const r=calculateTrainerEarning({event:event('conducted'),plan,attendance:[attendance('absent')],enrollments:[enrollment]});
  expect(r.classOutcome).toBe('no_show');expect(r.totalAmount).toBe(0);
 });
 test('student cancellation produces zero trainer class pay',()=>{
  const r=calculateTrainerEarning({event:event('cancelled'),plan,attendance:[],enrollments:[enrollment]});
  expect(r.classOutcome).toBe('cancelled');expect(r.totalAmount).toBe(0);
 });
 test('trainer no-show default penalty makes net payroll negative by one class pay',()=>{
  const normal=calculateTrainerEarning({event:event('conducted'),plan,attendance:[attendance('attended')],enrollments:[enrollment]});
  const penalty=normal.baseRate*normal.durationFactor*(plan.trainerNoShowPenaltyPercent/100);
  const adjusted=calculateTrainerEarning({event:event('conducted'),plan,attendance:[attendance('attended')],enrollments:[enrollment],adjustment:-(normal.totalAmount+penalty),adjustmentReason:'[Trainer no-show]'});
  expect(adjusted.totalAmount).toBe(-normal.totalAmount);
 });
});
