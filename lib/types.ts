export type UserRole = "student" | "parent" | "trainer" | "admin";
export type LearningStatus = "on_track" | "reinforce" | "follow_up";
export type AttendanceStatus = "attended" | "late" | "absent" | "excused";
export type UnderstandingSignal = "got_it" | "reinforce" | "intervention";
export type ParticipationLevel = "high" | "steady" | "low";
export type PracticeStatus = "completed" | "partial" | "not_attempted" | "optional";
export type RecordStatus = "active" | "inactive" | "archived";
export type CourseStatus = "draft" | "active" | "archived";
export type OnboardingStatus = "draft" | "new" | "setup_pending" | "active";
export type EnrollmentStatus = "active" | "on_hold" | "completed" | "cancelled";
export type DeliveryMode = "small_group" | "one_to_one" | "school" | "online" | "offline" | "hybrid";
export type DeliveryChannel = "online" | "offline" | "hybrid";
export type ScheduleMode = "recurring" | "flexible" | "ad_hoc";
export type ScheduleEventType = "class" | "demo" | "school" | "workshop" | "meeting" | "training" | "blocked" | "leave";
export type ScheduleEventStatus = "scheduled" | "tentative" | "conducted" | "cancelled" | "rescheduled" | "blocked" | "missed" | "makeup";
export type ScheduleOccurrenceKind = "regular" | "rescheduled_replacement" | "makeup" | "ad_hoc" | "extra";
export type GuardianRelationship = "mother" | "father" | "guardian" | "grandparent" | "relative" | "other";

export interface Profile { id:string; fullName:string; role:UserRole; }

export interface WeeklyScheduleSlot { dayOfWeek:number; startTime:string; endTime:string; endsNextDay?:boolean; }

export interface LearnerSummary {
  id:string; name:string; grade:string; course:string; courseSlug:string; trainer:string;
  progress:number; sessionsCompleted:number; totalSessions:number; plannedHours?:number;hoursCompleted?:number;hoursRemaining?:number; attendance:number; latestQuiz:number;
  projectsCompleted:number; xp:number; status:LearningStatus; nextFocus:string;
}
export interface TrainerSummary { id:string; name:string; specialties:string[]; activeLearners:number; activeBatches:number; pendingReviews:number; }
export interface BatchSummary { id:string; name:string; course:string; trainer:string; deliveryMode:"small_group"|"one_to_one"|"school"; schedule:string; learnerCount:number; progress:number; }
export interface CourseSession { id:string; position:number; title:string; kind:"lesson"|"quick_check"|"project"|"assessment"; xp:number; summary:string; }
export interface CourseBlueprint { id:string; slug:string; title:string; level:string; totalSessions:number; modules:Array<{id:string;title:string;sessions:CourseSession[]}>; }
export interface SessionUpdateInput { studentId:string; enrollmentId?:string; courseSessionId?:string; attendance:AttendanceStatus; understanding:UnderstandingSignal; participation:ParticipationLevel; practiceStatus:PracticeStatus; note?:string; }

export interface StudentAdminRecord {
  id:string; fullName:string; dob:string; grade:string; school:string; city:string; country:string; state?:string; timezone:string;
  addressLine1?:string; addressLine2?:string; postalCode?:string; billingName?:string; billingEmail?:string; billingPhone?:string;
  preferredClassDays?:string[]; preferredTimeWindows?:string;
  motherName:string; motherMobile:string; fatherName:string; fatherMobile:string;
  primaryGuardianName?:string; primaryGuardianRelationship?:GuardianRelationship; primaryGuardianMobile?:string;
  secondaryGuardianName?:string; secondaryGuardianRelationship?:GuardianRelationship; secondaryGuardianMobile?:string;
  primaryContact:"mother"|"father"|"guardian"; primaryWhatsApp:string; alternateWhatsApp:string; parentLoginEmail:string;
  interests:string[]; previousExperience:string; source:string; recordStatus:RecordStatus; updatedAt?:string;
  // Legacy compatibility fields are intentionally optional. Assignment belongs to Enrollment, not Student.
  device?:string; courseId?:string; trainerId?:string; batchId?:string; enrollmentStatus?:string; joinedOn?:string;
}

export interface TrainerAdminRecord {
  id:string; fullName:string; mobile:string; email:string; city:string; country?:string; state?:string; timezone?:string; designation:string; joiningDate:string;
  specialties:string[]; courseIds:string[]; recordStatus:RecordStatus; loginLinked:boolean; zoomJoinUrl?:string; portalAccessStatus?:"not_linked"|"invite_sent"|"portal_ready"|"disabled"; updatedAt?:string;
}


export type TrainerPayBand = "day" | "night";
export type TrainerSessionPayType = "one_to_one" | "small_group" | "demo" | "school" | "workshop" | "other";
export type TrainerEarningStatus = "pending" | "approved" | "paid" | "void";
export type TrainerClassFinanceOutcome = "completed" | "no_show" | "cancelled";

export interface TrainerCompensationPlan {
  id:string; trainerId:string; timezone:string; dayStart:string; dayEnd:string;
  oneToOneDay:number; oneToOneNight:number; groupDay:number; groupNight:number; demoDay:number; demoNight:number;
  demoConversionDay:number; demoConversionNight:number; trainerNoShowPenaltyPercent:number; lateGraceMinutes:number; latePenaltyPercent:number;
  effectiveFrom:string; notes:string; updatedAt:string;
}

export interface TrainerEarningRecord {
  id:string; trainerId:string; scheduleEventId:string; earningDate:string; sessionType:TrainerSessionPayType; payBand:TrainerPayBand;
  durationMinutes:number; learnerCount:number; classOutcome:TrainerClassFinanceOutcome; baseRate:number; durationFactor:number;
  conversionBonus:number; adjustment:number; totalAmount:number; conversionApplied:boolean; status:TrainerEarningStatus;
  adjustmentReason?:string; notes?:string; approvedAt?:string; paidAt?:string; paymentReference?:string; createdAt:string; updatedAt:string;
}

export interface TrainerPayoutRecord {
  id:string; trainerId:string; periodMonth:string; grossAmount:number; adjustmentAmount:number; payableAmount:number;
  status:"draft"|"approved"|"paid"; approvedAt?:string; paidAt?:string; paymentReference?:string; notes?:string; updatedAt:string;
}

export type CorrectionRequestStatus = "open" | "approved" | "rejected" | "completed";
export interface CorrectionRequestRecord {
  id:string; requestedByProfileId?:string; requestedByRole:UserRole; entityType:string; entityId:string;
  reason:string; requestedChanges:string; status:CorrectionRequestStatus; adminNote?:string;
  createdAt:string; resolvedAt?:string; resolvedByProfileId?:string;
}

export interface PortalAuditRecord {
  id:string; actorProfileId?:string; entityType:string; entityId:string; action:string;
  beforeData?:Record<string,unknown>; afterData?:Record<string,unknown>; createdAt:string;
}

export interface ParentCommunityProfile {
  parentId:string; profession:string; organization:string; designation:string; linkedinUrl:string; instagramHandle:string; facebookUrl:string; expertise:string[];
  contributionInterests:string[]; foundationInterests:string[]; ambassadorInterest:boolean; socialTagConsent:boolean; communityContactConsent:boolean; updatedAt?:string;
}

export interface FamilyIntroductionRecord {
  id:string; parentId:string; introducedName:string; introducedContact:string; note:string; status:"introduced"|"contacted"|"demo_scheduled"|"enrolled"|"closed";
  convertedAt?:string; benefitStatus:"none"|"available"|"redeemed"|"donated"; benefitValueInr?:number; createdAt:string; updatedAt:string;
}

export interface TrainerFinanceChangeRequest {
  id:string; trainerId:string; accountHolderName:string; bankName:string; accountNumber:string; ifsc:string; upiId:string; pan:string; preferredPayoutMethod:"bank"|"upi"|"other";
  status:"pending"|"approved"|"rejected"|"correction_requested"; trainerNote:string; adminNote:string; submittedAt:string; reviewedAt?:string; reviewedBy?:string; effectivePayrollMonth?:string;
}

export interface TrainerFinanceRecord {
  id:string; trainerId:string; accountHolderName:string; bankName:string; accountNumber:string; ifsc:string; upiId:string;
  preferredPayoutMethod:"bank"|"upi"|"other"; paymentModel:"per_class"|"hourly"|"monthly"|"retainer"|"other"; paymentRate?:number;
  pan:string; complianceStatus:"pending"|"verified"|"needs_update"; notes:string; updatedAt:string;
}

export interface CourseAdminRecord {
  id:string; slug:string; title:string; shortTitle:string; publicName:string; internalName:string; outcomeSubtitle:string; code:string; category:string;
  gradeFrom:number; gradeTo:number; ageFrom:number; ageTo:number; level:string; totalSessions:number; sessionDuration:number; plannedHours?:number;
  deliveryModes:string[]; codingType:string; technologies:string[]; description:string; outcomes:string[]; projects:string[];
  assessmentPattern:string; practiceMissions:boolean; certificate:boolean; status:CourseStatus; defaultCohortCapacity?:number; minimumCohortSize?:number; updatedAt?:string;
}

export interface OnboardingSubmission {
  id:string; userId?:string; loginEmail:string;
  motherName:string; motherMobile:string; fatherName:string; fatherMobile:string;
  primaryGuardianName?:string; primaryGuardianRelationship?:GuardianRelationship; primaryGuardianMobile?:string;
  secondaryGuardianName?:string; secondaryGuardianRelationship?:GuardianRelationship; secondaryGuardianMobile?:string;
  primaryContact:"mother"|"father"|"guardian"; primaryWhatsApp:string; alternateWhatsApp:string;
  city:string; country:string; state?:string; timezone:string; addressLine1:string; addressLine2?:string; postalCode:string; billingName:string; billingEmail:string; billingPhone:string; childName:string; childDob:string; grade:string; school:string;
  preferredClassDays?:string[]; preferredTimeWindows?:string;
  interests:string[]; goal:string; codingExperience:string; roboticsExperience:string; source:string; referringParentName?:string;
  dataConsent:boolean; portfolioConsent:boolean; marketingMediaConsent?:boolean;
  status:OnboardingStatus; assignedCourseId?:string; assignedTrainerId?:string; enrollmentType?:"one_to_one"|"small_group";
  cohortId?:string; startDate?:string; draftScheduleTimezone?:string; draftScheduleRules?:WeeklyScheduleSlot[]; submittedAt:string; activatedAt?:string; updatedAt?:string;
  // Legacy/optional values retained for migration only.
  board?:string; device?:string; learningNote?:string;
}

export interface EnrollmentAdminRecord {
  id:string; studentId:string; courseId:string; trainerId:string; enrollmentType:"one_to_one"|"small_group";
  cohortId?:string; status:EnrollmentStatus; startedAt:string; completedAt?:string;
  deliveryChannel?:DeliveryChannel; centerLocation?:string; scheduleMode?:ScheduleMode;
  scheduleTimezone:string; scheduleRules:WeeklyScheduleSlot[];
  holdReason?:"exams"|"medical"|"travel"|"family"|"other"; holdFrom?:string; holdUntil?:string; holdNote?:string;
  programModel?:"fixed_program"|"short_package"|"open_ended"; plannedSessions?:number; paidSessionBalance?:number; plannedEndDate?:string; autoCompleteOnSessionLimit?:boolean; scheduleOverrideConfirmed?:boolean; scheduleOverrideNote?:string;
  migrationType?:"native"|"active_existing"; openingCompletedSessions?:number; openingCompletedMinutes?:number; migrationNote?:string; portalTrackingStartedAt?:string;
  // Derived from opening position + delivered class records. Session count remains secondary; hours are canonical.
  sessionsCompleted:number; plannedHours?:number; hoursCompleted?:number; hoursRemaining?:number; progressPercent:number;
}

export interface CohortAdminRecord {
  id:string; name:string; code:string; courseId:string; trainerId:string; capacity:number; minimumStartSize?:number; studentIds:string[];
  deliveryChannel?:DeliveryChannel; centerLocation?:string; scheduleMode?:ScheduleMode;
  status:"planned"|"active"|"completed"|"archived"; startedAt:string;
  daysOfWeek:number[]; startTime:string; endTime:string; cohortLabel:string;
  scheduleTimezone:string; scheduleRules:WeeklyScheduleSlot[]; schedule:string;
}


export interface DeliveryCenterRecord {
  id:string; name:string; centerType:"play_school"|"activity_center"|"school"|"robotronix_center"|"other";
  area?:string; city:string; state?:string; country:string; address:string; contactPerson?:string; contactNumber?:string; capacity?:number; notes?:string; active:boolean; updatedAt?:string;
}

export interface ScheduleEvent {
  id:string; trainerId:string; courseId:string; enrollmentId?:string; cohortId?:string; studentId?:string;
  title:string; date:string; startTime:string; endTime:string; timezone:string; eventType:ScheduleEventType; deliveryMode:DeliveryMode;
  status:ScheduleEventStatus; actualDurationMinutes?:number; occurrenceKind?:ScheduleOccurrenceKind; notes?:string; rescheduledToId?:string; originalEventId?:string;
  requestedBy?:"parent"|"student"|"trainer"|"admin"; changeReason?:string; sessionTopic?:string; projectWorkedOn?:string; skillsWorked?:string[];
}

export interface ClassAttendanceRecord {
  id:string; scheduleEventId:string; studentId:string; enrollmentId:string; status:AttendanceStatus; note?:string; updatedAt?:string;
}

export interface TrainerAvailability {
  id:string; trainerId:string; dayOfWeek:number; startTime:string; endTime:string; enabled:boolean;
}
export interface TrainerAvailabilityOverride {
  id:string; trainerId:string; date:string; startTime:string; endTime:string; type:"available"|"unavailable"; reason:string;
}



export interface ReminderPolicy {
  id:string; eventType:"class"|"attendance_pending"; recipientRole:"trainer"|"parent"|"student"|"admin"; minutesBefore?:number; minutesAfter?:number; enabled:boolean;
}

// ---------------- Progress Core ----------------
export type ProjectProgressStatus = "not_started" | "in_progress" | "submitted" | "reviewed" | "completed";
export type LearnerProjectType = "guided" | "milestone" | "independent" | "competition" | "other";
export type FeedbackType = "session" | "milestone" | "general";
export type HoldStatus = "active" | "ended";
export type ProgressAlertSeverity = "high" | "medium" | "low";
export type ProgressAlertState = "open" | "reviewed" | "resolved" | "dismissed";
export type ProgressAlertType = "attendance" | "learning" | "project" | "hold" | "inactivity";

export interface LearningObservationRecord {
  id:string; scheduleEventId:string; studentId:string; enrollmentId:string; trainerId:string;
  signal:LearningStatus; strength:string; nextFocus:string; feedback:string; internalNote?:string; createdAt:string; updatedAt?:string;
}

export interface TrainerFeedbackRecord {
  id:string; studentId:string; enrollmentId:string; trainerId:string; type:FeedbackType; title:string;
  summary:string; strengths:string; nextFocus:string; signal:LearningStatus; createdAt:string; updatedAt?:string;
}

export interface LearnerProjectRecord {
  id:string; studentId:string; enrollmentId:string; courseId:string; title:string; type:LearnerProjectType;
  status:ProjectProgressStatus; skills:string[]; evidenceUrl?:string; studentReflection?:string; trainerFeedback?:string;
  startedAt:string; submittedAt?:string; reviewedAt?:string; completedAt?:string; updatedAt:string;
}

export interface EnrollmentHoldRecord {
  id:string; enrollmentId:string; studentId:string; reason:"exams"|"medical"|"travel"|"family"|"other";
  startDate:string; endDate?:string; status:HoldStatus; note?:string; createdAt:string; endedAt?:string;
}

export interface ProgressAlertActionRecord {
  id:string; ruleKey:string; studentId:string; enrollmentId:string; status:ProgressAlertState;
  reviewedAt?:string; resolvedAt?:string; note?:string; updatedAt:string;
}

export interface ProgressAlertRecord {
  ruleKey:string; studentId:string; enrollmentId:string; type:ProgressAlertType; severity:ProgressAlertSeverity;
  title:string; detail:string; status:ProgressAlertState; generatedAt:string; href:string;
}

export interface LearnerProgressRow {
  studentId:string; enrollmentId:string; studentName:string; grade:string; courseId:string; courseTitle:string;
  trainerId:string; trainerName:string; enrollmentStatus:EnrollmentStatus; enrollmentType:"one_to_one"|"small_group";
  sessionsAttended:number; totalSessions:number; plannedHours?:number; hoursCompleted?:number; hoursRemaining?:number; progressPercent:number; attendanceRate:number; attendanceRecorded:number; absentCount:number; excusedCount:number;
  currentSignal:LearningStatus; recentSignalCount:number; lastAttendedDate?:string; projectsTotal:number; projectsCompleted:number;
  projectsAwaitingReview:number; activeHold?:EnrollmentHoldRecord; openAlertCount:number;
}


// ---------------- Experience Layer ----------------
export interface ExperienceRecentClass {
  scheduleEventId:string; date:string; startTime:string; endTime:string; title:string; attendance:AttendanceStatus;
  actualDurationMinutes?:number; sessionTopic?:string; projectWorkedOn?:string; skillsWorked?:string[];
}

export interface LearnerExperienceSnapshot {
  learner:LearnerSummary; enrollmentId:string; enrollmentStatus:EnrollmentStatus; enrollmentType:"one_to_one"|"small_group";
  courseId:string; courseTitle:string; trainerId:string; trainerName:string;
  nextClass?:ScheduleEvent; upcomingClassCount:number; recentClasses:ExperienceRecentClass[];
  projects:LearnerProjectRecord[]; feedback:TrainerFeedbackRecord[]; observations:LearningObservationRecord[];
  activeHold?:EnrollmentHoldRecord; attendanceRecorded:number; absentCount:number; excusedCount:number;
  plannedSessions?:number; paidSessionBalance?:number; plannedEndDate?:string; scheduleTimezone?:string; cohortId?:string;
}

// ---------------- Notifications + Communication ----------------
export type NotificationType = "class_scheduled" | "class_rescheduled" | "class_cancelled" | "class_completed" | "attendance_absent" | "feedback_posted" | "project_reviewed" | "enrollment_activated" | "hold_started" | "hold_ended" | "progress_alert" | "onboarding_submitted" | "trainer_assignment" | "project_review_due" | "schedule_conflict" | "message_received" | "class_reminder" | "attendance_update_pending" | "general";
export type NotificationPriority = "info" | "action" | "important";
export interface PortalNotification {
  id:string; recipientRole:UserRole; recipientProfileId?:string; studentId?:string; trainerId?:string;
  type:NotificationType; priority:NotificationPriority; title:string; message:string; href:string; createdAt:string; readAt?:string;
}
export type CommunicationCategory = "schedule" | "progress" | "attendance" | "technical" | "project" | "general";
export type CommunicationThreadStatus = "open" | "waiting_parent" | "waiting_team" | "resolved";
export interface CommunicationThread {
  id:string; category:CommunicationCategory; status:CommunicationThreadStatus; subject:string;
  studentId?:string; studentName?:string; parentId?:string; parentName?:string; trainerId?:string; trainerName?:string;
  assignedTo?:string; lastMessageAt:string; lastMessagePreview:string; unreadAdmin:number; unreadParent:number; unreadTrainer:number; createdAt:string;
}
export interface CommunicationMessage {
  id:string; threadId:string; senderRole:"admin"|"trainer"|"parent"; senderName:string; body:string; createdAt:string;
}
