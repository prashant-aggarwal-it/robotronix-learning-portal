/** RFC 4180-compatible CSV for user-provided task exports and imports. */
export function parseCsv(source:string):string[][]{
 const text=source.replace(/^\uFEFF/,"");const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c;continue}
  if(c==='"'){if(cell.length)throw new Error("Unexpected quote in CSV.");quoted=true}
  else if(c===","){row.push(cell);cell=""}
  else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.length>0))rows.push(row);row=[];cell=""}
  else cell+=c;
 }
 if(quoted)throw new Error("Unclosed CSV quotation mark.");
 row.push(cell);if(row.some(x=>x.length>0))rows.push(row);
 return rows;
}
export const TASK_CSV_FIELDS=["title","description","status","priority","scheduled_date","due_at"] as const;
export type ImportRow={title:string;description?:string;status?:string;priority?:string;scheduled_date?:string;due_at?:string};
export function sanitizeImportRow(value:unknown):ImportRow{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid task row.");
 const obj=value as Record<string,unknown>;
 for(const key of Object.keys(obj))if(!TASK_CSV_FIELDS.includes(key as typeof TASK_CSV_FIELDS[number]))throw new Error("Unknown task field.");
 const string=(key:string)=>obj[key]===undefined||obj[key]===null?"":typeof obj[key]==="string"?String(obj[key]).trim():"!invalid!";
 const title=string("title"),description=string("description"),status=string("status")||"todo",priority=string("priority")||"medium",date=string("scheduled_date"),due=string("due_at");
 if(!title||title.length>240||description.length>12000||!["todo","in_progress","done"].includes(status)||!["low","medium","high"].includes(priority))throw new Error("Invalid task title, description, status, or priority.");
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Scheduled date must be YYYY-MM-DD.");
 if(due&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(due)||!Number.isFinite(Date.parse(due))))throw new Error("Due date needs an ISO timestamp with timezone, such as 2026-11-10T10:00:00+05:30.");
 return {title,description,status,priority,scheduled_date:date,due_at:due};
}
function safeCell(value:string):string{
 // Protect spreadsheet programs from formula injection in user-controlled text.
 const sanitized=/^[\s]*[=+@\-]/.test(value)?"'"+value:value;
 return '"'+sanitized.replace(/"/g,'""')+'"';
}
export function createTasksCsv(rows:Array<Record<string,unknown>>):string{
 const heads=[...TASK_CSV_FIELDS,"created_at","completed_at"];
 return "\uFEFF"+[heads.join(","),...rows.map(row=>heads.map(key=>safeCell(String(row[key]??""))).join(","))].join("\r\n")+"\r\n";
}
