import { NextRequest, NextResponse } from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {logSystemEvent} from "@/lib/server/system-log";

// This endpoint accepts only authenticated, first-party error-boundary reports.
// Never persist browser-provided messages, stacks, URLs or arbitrary exception data.
export async function POST(request: NextRequest) {
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return new NextResponse(null,{status:403});
  const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);
  if("error" in auth)return auth.error;
  if(!(request.headers.get("content-type")||"").startsWith("application/json"))
    return new NextResponse(null,{status:415});
  const length=Number(request.headers.get("content-length")||0);
  if(length>1024)return new NextResponse(null,{status:413});
  let body:unknown;
  try{
    const raw=await request.text();
    if(raw.length>1024)return new NextResponse(null,{status:413});
    body=JSON.parse(raw);
  }catch{return new NextResponse(null,{status:400});}
  if(!body||typeof body!=="object")return new NextResponse(null,{status:400});
  const report=body as {name?:unknown;digest?:unknown;path?:unknown};
  const workflowCodes=new Set(["ONBOARDING_LOAD","ONBOARDING_SAVE","ENROLLMENT_CREATE","COHORT_CREATE","ENROLLMENT_FINANCE","SCHEDULE_LOAD","SCHEDULE_SAVE","AVAILABILITY_SAVE","FINANCE_LOAD","FINANCE_SAVE"]);
  const workflowCode=typeof (report as {code?:unknown}).code==="string"?(report as {code:string}).code:"";
  if((report as {kind?:unknown}).kind==="workflow"&&!workflowCodes.has(workflowCode))return new NextResponse(null,{status:400});
  const path=typeof report.path==="string"?report.path:"";
  const routeBucket=(path.match(/^\/(admin|trainer|parent|student|login)(?:\/|$)/)||[])[1]||"other";
  const errorName=report.name==="TypeError"?"TYPE":report.name==="RangeError"?"RANGE":"BOUNDARY";
  const isWorkflow=(report as {kind?:unknown}).kind==="workflow";
  const referenceId=await logSystemEvent({
    source:isWorkflow?"client-workflow":"client-runtime",action:isWorkflow?"mutation":routeBucket,
    code:isWorkflow?workflowCode:"CLIENT_"+errorName,
    message:isWorkflow?"Authenticated user encountered an operational workflow failure":"Authenticated user encountered an application error boundary"
  });
  console.error("[portal-client-error]",{referenceId,code:isWorkflow?workflowCode:errorName,routeBucket});
  return NextResponse.json({ok:true,referenceId},{status:202,headers:{"Cache-Control":"no-store"}});
}
