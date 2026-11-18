import {NextRequest,NextResponse} from "next/server";
import {createHmac,timingSafeEqual} from "node:crypto";
import {platformService} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const secret=process.env.RESEND_WEBHOOK_SECRET;
 if(!secret?.startsWith("whsec_"))return NextResponse.json({ok:false},{status:503});
 const id=request.headers.get("svix-id"),ts=request.headers.get("svix-timestamp"),sig=request.headers.get("svix-signature");
 if(!id||!ts||!sig||!/^[0-9]+$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300)return NextResponse.json({ok:false},{status:401});
 const raw=await request.text();if(raw.length>200000)return NextResponse.json({ok:false},{status:413});
 let valid=false;
 try{
  const key=Buffer.from(secret.slice(6),"base64");
  const expected=createHmac("sha256",key).update(id+"."+ts+"."+raw).digest();
  valid=sig.split(" ").some(part=>{
   const [version,value]=part.split(",");
   if(version!=="v1"||!value)return false;
   const actual=Buffer.from(value,"base64");
   return actual.length===expected.length&&timingSafeEqual(actual,expected);
  });
 }catch{return NextResponse.json({ok:false},{status:401});}
 if(!valid)return NextResponse.json({ok:false},{status:401});
 const event=JSON.parse(raw) as {type?:string;data?:{email_id?:string}};
 if(typeof event.type!=="string"||typeof event.data?.email_id!=="string")return NextResponse.json({ok:true,ignored:true});
 const {error}=await platformService().rpc("saas_invitation_delivery_webhook_v1",{
  p_event_id:id,p_message_id:event.data.email_id,p_type:event.type
 });
 if(error)return NextResponse.json({ok:false},{status:503});
 return NextResponse.json({ok:true});
}
