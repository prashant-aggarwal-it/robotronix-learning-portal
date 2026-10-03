import {createClient} from "@supabase/supabase-js";
export default async ()=>{
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return new Response(JSON.stringify({ok:false,error:"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}),{status:500,headers:{"content-type":"application/json"}});
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data,error}=await client.rpc("process_class_reminders");
 return new Response(JSON.stringify(error?{ok:false,error:error.message}:{ok:true,result:data}),{status:error?500:200,headers:{"content-type":"application/json"}});
};
export const config={schedule:"*/5 * * * *"};
