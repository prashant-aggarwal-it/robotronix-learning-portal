import {NextRequest,NextResponse} from "next/server";
import {encryptZoomSecret,exchangeZoomCode,readZoomState,zoomServiceClient} from "@/lib/server/zoom";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const base=new URL("/admin/zoom-test",request.url);
 try{
  const error=request.nextUrl.searchParams.get("error");if(error)throw new Error(request.nextUrl.searchParams.get("reason")||error);
  const code=request.nextUrl.searchParams.get("code"),state=request.nextUrl.searchParams.get("state");if(!code||!state)throw new Error("Zoom did not return an authorization code and state.");
  const parsed=readZoomState(state);const tokens=await exchangeZoomCode(code);
  const meResponse=await fetch("https://api.zoom.us/v2/users/me",{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store"});
  const me=await meResponse.json().catch(()=>({})) as any;if(!meResponse.ok)throw new Error(me?.message||"Unable to read the authorized Zoom user. Add the user:read:user scope and authorize again.");
  const db=zoomServiceClient();const row={label:parsed.label||`Zoom · ${me.email||me.id}`,zoom_user_id:String(me.id),zoom_email:String(me.email||""),zoom_account_id:me.account_id?String(me.account_id):null,status:"connected",access_token_encrypted:encryptZoomSecret(tokens.access_token),refresh_token_encrypted:encryptZoomSecret(tokens.refresh_token),access_token_expires_at:new Date(Date.now()+Math.max(60,tokens.expires_in-60)*1000).toISOString(),connected_by:parsed.actorId,connected_at:new Date().toISOString(),last_sync_at:new Date().toISOString()};
  const {error:saveError}=await db.from("zoom_host_accounts").upsert(row,{onConflict:"zoom_user_id"});if(saveError)throw new Error(saveError.message);
  base.searchParams.set("connected","1");base.searchParams.set("email",String(me.email||""));return NextResponse.redirect(base);
 }catch(error){base.searchParams.set("zoom_error",error instanceof Error?error.message:String(error));return NextResponse.redirect(base);}
}
