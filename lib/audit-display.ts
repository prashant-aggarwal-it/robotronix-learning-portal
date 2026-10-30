/** Conservative allow-list for displaying audit data in the admin UI and exports.
 * Raw audit payloads remain database-protected; never render arbitrary JSON.
 */
const visible=/^(id|status|record_status|active|role|course_id|trainer_id|cohort_id|enrollment_id|schedule_event_id|student_id|parent_id|event_type|enrollment_type|date|start_date|end_date|started_at|start_time|end_time|duration_minutes|actual_duration_minutes|schedule_timezone|draft_schedule_timezone|schedule_rules|draft_schedule_rules|assigned_course_id|assigned_trainer_id|hold_from|hold_until|payment_date|amount|total_amount|base_rate|adjustment|gross_amount|payable_amount|currency|session_count|class_outcome|attendance|signal|grade|created_at|updated_at|activated_at|approved_at|paid_at|submitted_at|capacity|title|code)$/;
export function safeAuditSnapshot(input:Record<string,unknown>|undefined){
 return Object.fromEntries(Object.entries(input??{}).filter(([key,value])=>visible.test(key)&&(value===null||["string","number","boolean"].includes(typeof value)||["schedule_rules","draft_schedule_rules"].includes(key))));
}
export function safeAuditChanges(before:Record<string,unknown>|undefined,after:Record<string,unknown>|undefined){
 const a=safeAuditSnapshot(before),b=safeAuditSnapshot(after);
 const fields=[...new Set([...Object.keys(a),...Object.keys(b)])];
 return fields.filter(key=>JSON.stringify(a[key])!==JSON.stringify(b[key])).map(key=>({name:key.replaceAll("_"," "),from:a[key],to:b[key]}));
}
