import {test} from "node:test";
import assert from "node:assert/strict";
import {suggestEnquiryCategory} from "../features/connect/model.ts";
import {classSlotError,weeklyScheduleError,timeRangeError} from "../lib/time-range-validation.ts";

const categories=[
 {id:"school",label:"School Programs",active:true,sortOrder:1},
 {id:"python",label:"Online Courses",active:true,sortOrder:2},
 {id:"vendor",label:"Vendor / Supplier",active:true,sortOrder:3},
 {id:"job",label:"Trainer / Job Applicant",active:false,sortOrder:4}
];

test("Connect classifies a single school enquiry without false trainer matches",()=>{
 assert.equal(suggestEnquiryCategory("Principal requests robotics for our school",categories)?.id,"school");
});
test("Connect does not auto-classify conflicting intent",()=>{
 assert.equal(suggestEnquiryCategory("Need an online course for our school",categories),null);
});
test("Connect does not auto-classify disabled categories",()=>{
 assert.equal(suggestEnquiryCategory("I am applying for a trainer job",categories),null);
});
test("Connect leaves unknown enquiries unclassified for human review",()=>{
 assert.equal(suggestEnquiryCategory("Please call me",categories),null);
});
test("Portal rejects invalid or same-time class windows",()=>{
 assert.ok(classSlotError({startTime:"10:00",endTime:"10:00"}));
 assert.ok(timeRangeError("25:00","11:00"));
});
test("Portal accepts a valid half-hour aligned class",()=>{
 assert.equal(classSlotError({startTime:"10:00",endTime:"11:00"}),null);
});
test("Portal enforces explicit overnight guard and 4-hour class limit",()=>{
 assert.ok(timeRangeError("23:00","00:30"));
 assert.equal(classSlotError({startTime:"23:00",endTime:"00:30",endsNextDay:true}),null);
 assert.ok(classSlotError({startTime:"20:00",endTime:"03:00",endsNextDay:true}));
});
test("Portal prevents overlapping timeslots even across midnight and week boundary",()=>{
 assert.ok(weeklyScheduleError([
  {dayOfWeek:6,startTime:"23:00",endTime:"00:30",endsNextDay:true},
  {dayOfWeek:0,startTime:"00:00",endTime:"01:00"}
 ]));
});
