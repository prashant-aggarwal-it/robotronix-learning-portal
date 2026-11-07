import {NextRequest,NextResponse} from "next/server";
import {equalSecret} from "@/lib/server/connect-ingestion";
import {drainWhatsAppHistory} from "@/lib/server/connect-history-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 const token=req.headers.get("authorization");
 if(!process.env.CONNECT_HISTORY_DRAIN_ENABLED||process.env.CONNECT_HISTORY_DRAIN_ENABLED!=="true"||
  !process.env.CONNECT_HISTORY_JOB_SECRET||process.env.CONNECT_HISTORY_JOB_SECRET.length<24||
  !token?.startsWith("Bearer ")||!equalSecret(token.slice(7),process.env.CONNECT_HISTORY_JOB_SECRET))
  return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 try{
  const result=await drainWhatsAppHistory();
  return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch{
  console.error("[connect-history] Worker unavailable");
  return NextResponse.json({ok:false,error:"History worker unavailable"},{status:503});
 }
}
