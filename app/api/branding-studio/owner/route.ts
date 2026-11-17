import {NextRequest,NextResponse} from "next/server";
import {platformService} from "@/lib/server/saas/platform-admin";
import {readBearerToken} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
 const token=readBearerToken(request.headers.get("authorization"));
 if(!token)return NextResponse.json({ok:false,error:"Sign in required"},{status:401,headers});
 const db=platformService();
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous||!user.email_confirmed_at)
  return NextResponse.json({ok:false,error:"Verified session required"},{status:401,headers});
 const {data:memberships,error:memberError}=await db.schema("saas").from("memberships")
  .select("organization_id").eq("user_id",user.id).eq("role_key","owner").eq("status","active");
 if(memberError)return NextResponse.json({ok:false,error:"Owner access unavailable"},{status:503,headers});
 const orgIds=(memberships||[]).map(x=>x.organization_id);
 if(!orgIds.length)return NextResponse.json({ok:true,organizations:[]},{headers});
 const {data:organizations,error:orgError}=await db.schema("saas").from("organizations")
  .select("id,display_name,slug,status").in("id",orgIds).eq("status","active");
 const {data:enabled,error:enabledError}=await db.schema("saas").from("module_entitlements")
  .select("organization_id").in("organization_id",orgIds).eq("module_key","academy").eq("enabled",true);
 if(orgError||enabledError)return NextResponse.json({ok:false,error:"Owner organizations unavailable"},{status:503,headers});
 const granted=new Set((enabled||[]).map(x=>x.organization_id));
 return NextResponse.json({ok:true,organizations:(organizations||[]).filter(x=>granted.has(x.id))},{headers});
}
