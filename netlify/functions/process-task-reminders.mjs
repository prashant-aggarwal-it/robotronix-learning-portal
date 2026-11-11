import {createClient} from "@supabase/supabase-js";

export default async () => {
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({ok:false,error:"Task reminder configuration unavailable"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("task_reminder_process",{p_limit:100});
 if(error){console.error("[tasks] reminder worker failed",error.code||"unknown");return Response.json({ok:false},{status:500});}
 return Response.json({ok:true,processed:data||0});
};
export const config={schedule:"*/5 * * * *"};
