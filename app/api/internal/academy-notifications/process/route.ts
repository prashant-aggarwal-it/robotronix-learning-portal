import {NextRequest,NextResponse} from "next/server";
import {processAcademyNotifications} from "@/lib/server/saas/academy-notifications";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 const expected=process.env.ACADEMY_NOTIFICATION_WORKER_SECRET;
 if(!expected||expected.length<32||req.headers.get("authorization")!=="Bearer "+expected)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const processed=await processAcademyNotifications(10);return NextResponse.json({ok:true,processed:processed.length,results:processed},{headers:{"Cache-Control":"no-store"}});}
 catch{return NextResponse.json({error:"Notification worker failed"},{status:503});}
}
