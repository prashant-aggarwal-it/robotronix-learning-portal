import type { CommunicationThread, CommunicationMessage, PortalNotification } from "./types";

const now = Date.now();
const isoAgo = (minutes:number) => new Date(now - minutes*60_000).toISOString();

export const demoNotifications: PortalNotification[] = [
  {id:"not-admin-1",recipientRole:"admin",type:"onboarding_submitted",priority:"action",title:"New onboarding received",message:"A new family onboarding is ready for setup.",href:"/admin/onboarding",createdAt:isoAgo(22)},
  {id:"not-admin-2",recipientRole:"admin",type:"message_received",priority:"action",title:"Parent reply awaiting response",message:"Neha Sharma replied about a class reschedule request.",href:"/admin/messages/thread-001",createdAt:isoAgo(48)},
  {id:"not-admin-3",recipientRole:"admin",type:"progress_alert",priority:"important",title:"Learner needs attention",message:"Recent learning signals show an area that should be reviewed in the next regular classes.",href:"/admin/progress/alerts",createdAt:isoAgo(105)},
  {id:"not-admin-4",recipientRole:"admin",type:"project_review_due",priority:"info",title:"Project review queue updated",message:"Three learner projects are waiting for mentor review.",href:"/admin/progress/projects",createdAt:isoAgo(190),readAt:isoAgo(120)},
  {id:"not-admin-5",recipientRole:"admin",type:"class_completed",priority:"info",title:"Today’s classes are being closed",message:"Attendance has been recorded for recent classes.",href:"/admin/classes",createdAt:isoAgo(280),readAt:isoAgo(240)},

  {id:"not-parent-1",recipientRole:"parent",studentId:"aarav-mehta",type:"class_rescheduled",priority:"action",title:"Class time updated",message:"Aarav’s Python class has been rescheduled. Please review the new time.",href:"/parent",createdAt:isoAgo(35)},
  {id:"not-parent-2",recipientRole:"parent",studentId:"aarav-mehta",type:"feedback_posted",priority:"info",title:"New mentor feedback",message:"Vikas Sharma has shared a new learning update for Aarav.",href:"/parent/learner/aarav-mehta",createdAt:isoAgo(96)},
  {id:"not-parent-3",recipientRole:"parent",studentId:"riya-kapoor",type:"project_reviewed",priority:"info",title:"Project reviewed",message:"Riya’s latest project has been reviewed by the mentor.",href:"/parent",createdAt:isoAgo(250),readAt:isoAgo(180)},
  {id:"not-parent-4",recipientRole:"parent",studentId:"aarav-mehta",type:"class_scheduled",priority:"info",title:"Upcoming class confirmed",message:"The next Python class is confirmed on the learner schedule.",href:"/parent",createdAt:isoAgo(380),readAt:isoAgo(300)},

  {id:"not-trainer-1",recipientRole:"trainer",trainerId:"vikas",type:"message_received",priority:"action",title:"Parent message requires reply",message:"A parent has a schedule question for one of your assigned learners.",href:"/trainer/messages/thread-001",createdAt:isoAgo(41)},
  {id:"not-trainer-2",recipientRole:"trainer",trainerId:"vikas",type:"project_review_due",priority:"action",title:"Project review pending",message:"A learner project is ready for your review.",href:"/trainer/projects",createdAt:isoAgo(76)},
  {id:"not-trainer-3",recipientRole:"trainer",trainerId:"vikas",type:"class_rescheduled",priority:"info",title:"Schedule updated",message:"One of today’s learner sessions has a revised time.",href:"/trainer/schedule",createdAt:isoAgo(140),readAt:isoAgo(110)},
  {id:"not-trainer-4",recipientRole:"trainer",trainerId:"vikas",type:"trainer_assignment",priority:"info",title:"Learner assignment updated",message:"A learner enrollment has been assigned to you.",href:"/trainer/progress",createdAt:isoAgo(310),readAt:isoAgo(290)},

  {id:"not-student-1",recipientRole:"student",studentId:"aarav-mehta",type:"class_scheduled",priority:"info",title:"Next class confirmed",message:"Your next Python class is confirmed. Check the dashboard for timing.",href:"/student",createdAt:isoAgo(50)},
  {id:"not-student-2",recipientRole:"student",studentId:"aarav-mehta",type:"feedback_posted",priority:"info",title:"Mentor feedback available",message:"Your mentor has shared feedback on your recent learning.",href:"/student",createdAt:isoAgo(170),readAt:isoAgo(120)},
  {id:"not-student-3",recipientRole:"student",studentId:"aarav-mehta",type:"project_reviewed",priority:"info",title:"Project review complete",message:"Your latest project has been reviewed.",href:"/student/portfolio",createdAt:isoAgo(460),readAt:isoAgo(430)},
];

export const demoThreads: CommunicationThread[] = [
  {id:"thread-001",category:"schedule",status:"open",subject:"Request to adjust Python class timing",studentId:"aarav-mehta",studentName:"Aarav Mehta",parentId:"demo-parent",parentName:"Neha Sharma",trainerId:"vikas",trainerName:"Vikas Sharma",assignedTo:"Learning Support",lastMessageAt:isoAgo(39),lastMessagePreview:"Thursday at 6 PM would work better for us.",unreadAdmin:1,unreadParent:0,unreadTrainer:1,createdAt:isoAgo(420)},
  {id:"thread-002",category:"progress",status:"waiting_parent",subject:"Follow-up on independent coding practice",studentId:"riya-kapoor",studentName:"Riya Kapoor",parentId:"demo-parent",parentName:"Neha Sharma",trainerId:"arvind",trainerName:"Arvind Kumar",assignedTo:"Learning Support",lastMessageAt:isoAgo(180),lastMessagePreview:"We have shared two simple practice suggestions for this week.",unreadAdmin:0,unreadParent:1,unreadTrainer:0,createdAt:isoAgo(680)},
  {id:"thread-003",category:"attendance",status:"resolved",subject:"Absence due to school examination",studentId:"aarav-mehta",studentName:"Aarav Mehta",parentId:"demo-parent",parentName:"Neha Sharma",trainerId:"vikas",trainerName:"Vikas Sharma",assignedTo:"Learning Support",lastMessageAt:isoAgo(1220),lastMessagePreview:"The absence has been noted and the session was not consumed.",unreadAdmin:0,unreadParent:0,unreadTrainer:0,createdAt:isoAgo(1750)},
  {id:"thread-004",category:"technical",status:"open",subject:"Unable to open class link on laptop",studentId:"kabir-sharma",studentName:"Kabir Sharma",parentId:"parent-kabir",parentName:"Mrs. Sharma",trainerId:"vikas",trainerName:"Vikas Sharma",assignedTo:"Operations",lastMessageAt:isoAgo(95),lastMessagePreview:"The browser is showing an access error before class.",unreadAdmin:1,unreadParent:0,unreadTrainer:0,createdAt:isoAgo(150)},
  {id:"thread-005",category:"project",status:"open",subject:"Question about project feedback",studentId:"advait-malhotra",studentName:"Advait Malhotra",parentId:"parent-advait",parentName:"Mr. Malhotra",trainerId:"vikas",trainerName:"Vikas Sharma",assignedTo:"Learning Support",lastMessageAt:isoAgo(225),lastMessagePreview:"Can you clarify the change requested in the project review?",unreadAdmin:1,unreadParent:0,unreadTrainer:1,createdAt:isoAgo(330)},
];

export const demoMessages: CommunicationMessage[] = [
  {id:"msg-001-1",threadId:"thread-001",senderRole:"parent",senderName:"Neha Sharma",body:"Aarav has a school activity at the current class time this week. Can we adjust the session?",createdAt:isoAgo(420)},
  {id:"msg-001-2",threadId:"thread-001",senderRole:"admin",senderName:"Robotronix Learning Support",body:"Yes. We are checking the trainer schedule and will confirm an alternate slot here.",createdAt:isoAgo(250)},
  {id:"msg-001-3",threadId:"thread-001",senderRole:"trainer",senderName:"Vikas Sharma",body:"I can accommodate Thursday at 6 PM or Saturday at 4 PM this week.",createdAt:isoAgo(85)},
  {id:"msg-001-4",threadId:"thread-001",senderRole:"parent",senderName:"Neha Sharma",body:"Thursday at 6 PM would work better for us.",createdAt:isoAgo(39)},

  {id:"msg-002-1",threadId:"thread-002",senderRole:"trainer",senderName:"Arvind",body:"Riya is doing well in class. I would like her to practice building small blocks independently between sessions.",createdAt:isoAgo(680)},
  {id:"msg-002-2",threadId:"thread-002",senderRole:"admin",senderName:"Robotronix Learning Support",body:"We have shared two simple practice suggestions for this week. Please let us know if you need any help.",createdAt:isoAgo(180)},

  {id:"msg-003-1",threadId:"thread-003",senderRole:"parent",senderName:"Neha Sharma",body:"Aarav will miss class because of school examinations.",createdAt:isoAgo(1750)},
  {id:"msg-003-2",threadId:"thread-003",senderRole:"admin",senderName:"Robotronix Learning Support",body:"The absence has been noted and the session was not consumed.",createdAt:isoAgo(1220)},

  {id:"msg-004-1",threadId:"thread-004",senderRole:"parent",senderName:"Mrs. Sharma",body:"The browser is showing an access error before class. Please help us resolve it.",createdAt:isoAgo(95)},
  {id:"msg-005-1",threadId:"thread-005",senderRole:"parent",senderName:"Mr. Malhotra",body:"Can you clarify the change requested in the project review?",createdAt:isoAgo(225)},
];
