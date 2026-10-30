import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

// Non-blocking reporting of selected critical UI workflow failures.
// Never send exception messages, form contents, student data or payment values.
export async function reportOperationalError(code:string):Promise<void>{
 try{
  const supabase=getSupabaseBrowserClient();
  const {data}=supabase?await supabase.auth.getSession():{data:{session:null}};
  if(!data.session?.access_token)return;
  await fetch("/api/client-error",{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+data.session.access_token},
   body:JSON.stringify({kind:"workflow",code}),keepalive:true
  });
 }catch{/* Reporting must never interrupt the user's work. */}
}
