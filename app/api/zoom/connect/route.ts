import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {zoomAuthorizationUrl} from "@/lib/server/zoom";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{const body=await request.json().catch(()=>({})) as {label?:string};const label=(body.label||"Zoom Host").trim().slice(0,80);return NextResponse.json({ok:true,authorizationUrl:zoomAuthorizationUrl(auth.actorId,label)},{headers:{"Cache-Control":"no-store"}});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
