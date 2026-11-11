export type TaskInput={title?:string;description?:string;status?:"todo"|"in_progress"|"done";priority?:"low"|"medium"|"high";scheduled_date?:string|null;due_at?:string|null;category_id?:string|null;focus_date?:string|null;focus_rank?:number|null;reminder_at?:string|null;recurrence?:"none"|"daily"|"weekly"|"monthly"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed=new Set(["title","description","status","priority","scheduled_date","due_at","category_id","focus_date","focus_rank","reminder_at","recurrence"]);
export function validateTask(value:unknown,partial=false):{value?:TaskInput;error?:string}{
 if(!value||typeof value!=="object"||Array.isArray(value))return {error:"Provide a task object."};
 const input=value as Record<string,unknown>;
 if(Object.keys(input).some(k=>!allowed.has(k))||Object.keys(input).length===0)return {error:"Unsupported task field."};
 if(!partial&&!Object.hasOwn(input,"title"))return {error:"Task title is required."};
 if(Object.hasOwn(input,"title")&&(typeof input.title!=="string"||!input.title.trim()||input.title.trim().length>240))return {error:"Task title must contain 1–240 characters."};
 if(Object.hasOwn(input,"description")&&(typeof input.description!=="string"||input.description.length>12000))return {error:"Description is too long."};
 if(Object.hasOwn(input,"status")&&!(["todo","in_progress","done"] as unknown[]).includes(input.status))return {error:"Invalid task status."};
 if(Object.hasOwn(input,"priority")&&!(["low","medium","high"] as unknown[]).includes(input.priority))return {error:"Invalid priority."};
 if(Object.hasOwn(input,"scheduled_date")&&input.scheduled_date!==null&&(typeof input.scheduled_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduled_date)||Number.isNaN(Date.parse(input.scheduled_date))))return {error:"Invalid scheduled date."};
 if(Object.hasOwn(input,"due_at")&&input.due_at!==null&&(typeof input.due_at!=="string"||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.due_at)||Number.isNaN(Date.parse(input.due_at))))return {error:"Due time must include a timezone."};
 if(Object.hasOwn(input,"category_id")&&input.category_id!==null&&(typeof input.category_id!=="string"||!uuid.test(input.category_id)))return {error:"Invalid category."};
 if(Object.hasOwn(input,"focus_date")&&input.focus_date!==null&&(typeof input.focus_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.focus_date)||Number.isNaN(Date.parse(input.focus_date))))return {error:"Invalid focus date."};
 if(Object.hasOwn(input,"focus_rank")&&input.focus_rank!==null&&![1,2,3].includes(input.focus_rank as number))return {error:"Focus rank must be 1, 2 or 3."};
 if(Object.hasOwn(input,"reminder_at")&&input.reminder_at!==null&&(typeof input.reminder_at!=="string"||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.reminder_at)||Number.isNaN(Date.parse(input.reminder_at))))return {error:"Reminder must include a timezone."};
 if(Object.hasOwn(input,"recurrence")&&!(["none","daily","weekly","monthly"] as unknown[]).includes(input.recurrence))return {error:"Invalid recurrence."};
 return {value:{...input,...(typeof input.title==="string"?{title:input.title.trim()}:{})} as TaskInput};
}
