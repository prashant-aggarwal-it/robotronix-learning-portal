import {test,expect} from "@playwright/test";
import {freeScheduleWindows,mergeWindows,subtractWindows,timeToMinutes} from "../lib/schedule-capacity";
const w=(a:string,b:string)=>({start:timeToMinutes(a),end:timeToMinutes(b)});
test.describe("Availability minus bookings and exceptions",()=>{
 test("merges adjacent working windows and handles 30-minute boundaries",()=>{
  expect(mergeWindows([w("17:00","18:00"),w("18:00","21:00")])).toEqual([w("17:00","21:00")]);
  expect(freeScheduleWindows([w("17:00","21:00")],[],[],[w("18:30","19:30")]))
   .toEqual([w("17:00","18:30"),w("19:30","21:00")]);
 });
 test("leave overrides ordinary hours, extra availability adds capacity",()=>{
  expect(freeScheduleWindows([w("17:00","21:00")],[w("09:00","10:00")],[w("18:00","20:00")],[]))
   .toEqual([w("09:00","10:00"),w("17:00","18:00"),w("20:00","21:00")]);
 });
 test("a booked class never appears as free time, even inside an extra window",()=>{
  expect(freeScheduleWindows([], [w("10:00","12:00")], [], [w("10:30","11:30")]))
   .toEqual([w("10:00","10:30"),w("11:30","12:00")]);
 });
 test("all-day leave returns no availability, and adjacent bookings do not overlap",()=>{
  expect(freeScheduleWindows([w("10:00","19:00")],[],[w("00:00","23:59")],[])).toEqual([]);
  expect(subtractWindows([w("10:00","11:00")],[w("11:00","12:00")])).toEqual([w("10:00","11:00")]);
 });
 test("cross-midnight bookings are clipped within the selected date",()=>{
  expect(freeScheduleWindows([w("00:00","03:00")],[],[],[{start:-60,end:90}]))
   .toEqual([w("01:30","03:00")]);
 });
});
