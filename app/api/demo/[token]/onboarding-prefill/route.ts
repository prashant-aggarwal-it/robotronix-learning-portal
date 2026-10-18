import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {zoomServiceClient} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

function hash(value:string){return crypto.createHash("sha256").update(value).digest("hex")}

export async function GET(_request:NextRequest,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;const db=zoomServiceClient();
  const {data,error}=await db.from("demo_session_participants")
   .select("id,guest_token_expires_at,lead:demo_leads(parent_name,parent_whatsapp,parent_email,child_name,grade,interest,experience_level,source)")
   .eq("guest_token_hash",hash(token)).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data||new Date(data.guest_token_expires_at).getTime()<Date.now())return NextResponse.json({ok:false,error:"This demo link is invalid or has expired."},{status:404,headers:{"Cache-Control":"no-store"}});
  const lead:any=data.lead;
  return NextResponse.json({ok:true,prefill:{
   parentName:lead?.parent_name||"",parentWhatsApp:lead?.parent_whatsapp||"",parentEmail:lead?.parent_email||"",
   childName:lead?.child_name||"",grade:lead?.grade||"",interest:lead?.interest||"",experienceLevel:lead?.experience_level||"new",source:"Demo / Discovery Session"
  }},{headers:{"Cache-Control":"no-store, private"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400,headers:{"Cache-Control":"no-store"}})}
}
