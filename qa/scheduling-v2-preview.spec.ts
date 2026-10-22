import {test,expect} from "@playwright/test";
import {previewCourseSchedule} from "../lib/scheduling-v2-preview";

const base={startDate:"2026-10-26",timezone:"Asia/Kolkata",trainerId:"trainer-1",rules:[{dayOfWeek:2,startTime:"17:00",endTime:"18:00"},{dayOfWeek:4,startTime:"17:00",endTime:"18:00"}],totalSessions:24} as const;
const input={...base,rules:[...base.rules]};

test.describe("Scheduling V2 read-only course preview",()=>{
 test("entire course generates exact session count",()=>{
  const rows=previewCourseSchedule({...input,horizon:"full"});
  expect(rows).toHaveLength(24);
  expect(rows[0].date).toBe("2026-10-27");
  expect(rows[23].date).toBe("2027-01-14");
  expect(rows.every(x=>x.endUtc>x.startUtc)).toBe(true);
 });
 test("selected weeks truncates horizon without exceeding course count",()=>{
  const rows=previewCourseSchedule({...input,horizon:"weeks",weeks:2});
  expect(rows).toHaveLength(4);
 });
 test("manual mode never generates bookings",()=>{
  expect(previewCourseSchedule({...input,horizon:"manual"})).toEqual([]);
 });
 test("existing trainer overlap is flagged",()=>{
  const previous={id:"evt-1",trainerId:"trainer-1",courseId:"course-1",title:"Existing",date:"2026-10-27",startTime:"17:30",endTime:"18:30",timezone:"Asia/Kolkata",eventType:"class",deliveryMode:"one_to_one",status:"scheduled"} as const;
  const rows=previewCourseSchedule({...input,horizon:"full",existingEvents:[previous]});
  expect(rows[0].conflicts).toContain("Trainer busy");
  expect(rows[1].conflicts).toEqual([]);
 });
 test("invalid counts are rejected",()=>{
  expect(()=>previewCourseSchedule({...input,horizon:"full",totalSessions:0})).toThrow();
 });
});
