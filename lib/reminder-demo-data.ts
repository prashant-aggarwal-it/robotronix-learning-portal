import type {ReminderPolicy} from "./types";
export const demoReminderPolicies:ReminderPolicy[]=[
 {id:"rem-trainer-30",eventType:"class",recipientRole:"trainer",minutesBefore:30,enabled:true},
 {id:"rem-trainer-10",eventType:"class",recipientRole:"trainer",minutesBefore:10,enabled:true},
 {id:"rem-parent-30",eventType:"class",recipientRole:"parent",minutesBefore:30,enabled:true},
 {id:"rem-student-15",eventType:"class",recipientRole:"student",minutesBefore:15,enabled:true},
 {id:"rem-trainer-update-30",eventType:"attendance_pending",recipientRole:"trainer",minutesAfter:30,enabled:true}
];
