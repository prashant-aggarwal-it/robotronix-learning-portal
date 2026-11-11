import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore} from "@/lib/server/tasks/auth";
import {sanitizeImportRow,createTasksCsv} from "@/lib/server/tasks/csv";
import {logSystemEvent} from "@/lib/server/system-log";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const format=request.nextUrl.searchParams.get("format")||"csv";
 if(!["csv","json"].includes(format))return taskError("Invalid export format.",400);
 const items:Record<string,unknown>[]=[];
 for(let offset=0;offset<=10000;offset+=100){const {data,error}=await session.db.rpc("task_list",{p_actor_id:session.userId,p_status:null,p_limit:100,p_offset:offset});
  if(error)return taskError("Export unavailable.",500);
  const page=(data||[]) as Record<string,unknown>[];
  items.push(...page.filter(t=>t.owner_user_id===session.userId&&t.workspace_id===null));if(page.length<100)break;
 }
 if(format==="json")return new NextResponse(JSON.stringify({version:1,exported_at:new Date().toISOString(),tasks:items}),{headers:{...noStore,"Content-Type":"application/json; charset=utf-8","Content-Disposition":"attachment; filename=my-tasks.json"}});
 return new NextResponse(createTasksCsv(items),{headers:{...noStore,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=my-tasks.csv"}});
}
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>300000)return taskError("Import is too large.",413);
 const payload:unknown=await request.json().catch(()=>null);
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return taskError("Provide task rows.",400);
 const rows=(payload as Record<string,unknown>).rows;
 if(!Array.isArray(rows)||rows.length<1||rows.length>200)return taskError("Import 1–200 tasks at a time.",400);
 let checked:ReturnType<typeof sanitizeImportRow>[];
 try{checked=rows.map(sanitizeImportRow)}catch(e){return taskError(e instanceof Error?e.message:"Invalid import.",400)}
 const {data,error}=await session.db.rpc("task_bulk_import",{p_actor_id:session.userId,p_rows:checked});
 if(error){if(["22023","22007","22008","22P02","23514"].includes(error.code||""))return taskError("Invalid tasks or your active-task limit was reached.",400);
  const reference=await logSystemEvent({source:"my-tasks",action:"bulk-import",code:"TASK_IMPORT_FAILED",message:"Atomic personal task import failed"});
  return taskError("Import failed; no rows were saved. Reference: "+reference,500);
 }
 return NextResponse.json({ok:true,...data},{headers:noStore});
}
