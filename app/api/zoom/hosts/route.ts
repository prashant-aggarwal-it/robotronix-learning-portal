import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {safeHost} from "@/lib/server/zoom";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){const auth=await requireAdmin(request);if("error" in auth)return auth.error;const {data,error}=await auth.admin.from("zoom_host_accounts").select("id,label,zoom_user_id,zoom_email,zoom_account_id,status,connected_at,last_sync_at").order("connected_at");if(error)return NextResponse.json({ok:false,error:error.message},{status:500});return NextResponse.json({ok:true,hosts:(data||[]).map(safeHost)},{headers:{"Cache-Control":"no-store"}})}
