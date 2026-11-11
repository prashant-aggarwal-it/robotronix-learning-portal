/** V2 validation is separate from the legacy Tasks API to avoid breaking existing clients. */
export type V2Payload=Record<string,unknown>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
const colors=["slate","blue","green","amber","red","purple"] as const;
const projectStatuses=["active","paused","completed"] as const;
const isDate=(value:string)=>date.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const isUuidOrNull=(v:unknown)=>v===null||(typeof v==="string"&&uuid.test(v));
export function validateV2(kind:"area"|"project"|"task",value:unknown):{value?:V2Payload;error?:string}{
 if(!value||typeof value!=="object"||Array.isArray(value))return {error:"Provide an object."};
 const data=value as V2Payload;
 const fields:Record<typeof kind,string[]>={area:["id","name","color","icon","sort_order","archived"],project:["id","area_id","name","description","status","target_date","sort_order","archived"],task:["area_id","project_id","board_rank","important","estimated_minutes","done_definition","resume_note","waiting_for","followup_date","status"]};
 if(!Object.keys(data).length||Object.keys(data).some(k=>!fields[kind].includes(k)))return {error:"Unsupported or empty fields."};
 if("id" in data&&!(typeof data.id==="string"&&uuid.test(data.id)))return {error:"Invalid record ID."};
 if("name" in data&&!(typeof data.name==="string"&&data.name.trim().length>0&&data.name.trim().length<=(kind==="area"?80:160)))return {error:"Invalid name."};
 if(kind!=="task"&&!("id" in data)&&!("name" in data))return {error:"Name is required."};
 for(const f of ["area_id","project_id"])if(f in data&&!isUuidOrNull(data[f]))return {error:"Invalid "+f+"."};
 if("color" in data&&!colors.includes(data.color as typeof colors[number]))return {error:"Invalid color."};
 if("icon" in data&&!(typeof data.icon==="string"&&data.icon.length>=1&&data.icon.length<=40))return {error:"Invalid icon."};
 if("description" in data&&!(typeof data.description==="string"&&data.description.length<=4000))return {error:"Description is too long."};
 if("status" in data&&!(kind==="project"?projectStatuses.includes(data.status as typeof projectStatuses[number]):data.status==="waiting"))return {error:"Invalid status for this operation."};
 for(const f of ["target_date","followup_date"])if(f in data&&data[f]!==null&&!(typeof data[f]==="string"&&isDate(data[f])))return {error:"Invalid "+f+"."};
 if("sort_order" in data&&!(typeof data.sort_order==="number"&&Number.isSafeInteger(data.sort_order)&&Math.abs(data.sort_order)<1000000))return {error:"Invalid sort order."};
 if("board_rank" in data&&!(typeof data.board_rank==="number"&&Number.isFinite(data.board_rank)&&Math.abs(data.board_rank)<100000000))return {error:"Invalid board position."};
 if("important" in data&&typeof data.important!=="boolean")return {error:"Important must be true or false."};
 if("archived" in data&&typeof data.archived!=="boolean")return {error:"Archived must be true or false."};
 if("estimated_minutes" in data&&data.estimated_minutes!==null&&!(typeof data.estimated_minutes==="number"&&Number.isInteger(data.estimated_minutes)&&data.estimated_minutes>=1&&data.estimated_minutes<=1440))return {error:"Estimate must be 1–1440 minutes."};
 for(const [f,max] of [["done_definition",2000],["resume_note",4000],["waiting_for",500]] as const)if(f in data&&!(typeof data[f]==="string"&&data[f].length<=max))return {error:"Invalid "+f+"."};
 if("project_id" in data&&kind!=="task")return {error:"Invalid project association."};
 return {value:{...data,...("name" in data?{name:(data.name as string).trim()}:{})}};
}
