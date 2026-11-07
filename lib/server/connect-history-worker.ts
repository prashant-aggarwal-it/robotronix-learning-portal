import {ingestionClient} from "@/lib/server/connect-ingestion";
import {nextHistoryBatch,type HistoryThread} from "@/lib/server/connect-history-batches";

type Job={id:string;leaseToken:string;phoneId:string;payload:{threads?:unknown};threadIndex:number;messageIndex:number};
type RpcResult={imported?:number};
const MAX_RUNTIME_MS=20_000;

export async function drainWhatsAppHistory(){
 const db=ingestionClient();const started=Date.now();
 const cleanup=await db.rpc("connect_cleanup_whatsapp_history_jobs");
 if(cleanup.error)throw new Error("History queue cleanup unavailable: "+cleanup.error.code);
 const {data,error}=await db.rpc("connect_claim_whatsapp_history_jobs",{p_limit:2});
 if(error)throw new Error("History queue claim unavailable: "+error.code);
 let completed=0,imported=0,paused=0,failed=0;
 for(const job of (Array.isArray(data)?data:[]) as Job[]){
  let code="HISTORY_DB_UNAVAILABLE";
  try{
   const threads=job.payload?.threads;
   if(!Array.isArray(threads)||threads.length>500||!job.phoneId)throw Error("BAD_HISTORY_PAYLOAD");
   let ti=job.threadIndex,mi=job.messageIndex,progressed=false;
   while(ti<threads.length){
    if(Date.now()-started>=MAX_RUNTIME_MS){paused++;break;}
    const step=nextHistoryBatch(threads as HistoryThread[],{threadIndex:ti,messageIndex:mi});
    let batchImported=0;
    if(step.messages.length){
     const result=await db.rpc("connect_import_whatsapp_history_thread",{
      p_external_account_id:job.phoneId,p_contact_wa_id:step.contact,p_messages:step.messages
     });
     if(result.error){code="HISTORY_IMPORT_FAILED";throw Error(code);}
     batchImported=Number((result.data as RpcResult)?.imported)||0;
     imported+=batchImported;
    }
    ti=step.next.threadIndex;mi=step.next.messageIndex;
    const progress=await db.rpc("connect_advance_whatsapp_history_job",{
     p_id:job.id,p_lease_token:job.leaseToken,p_thread_index:ti,p_message_index:mi,
     p_imported:batchImported,p_completed:ti===threads.length
    });
    if(progress.error||progress.data!==true){code="HISTORY_DB_UNAVAILABLE";throw Error(code);}
    progressed=true;
   }
   if(ti===threads.length&&!progressed){
    const final=await db.rpc("connect_advance_whatsapp_history_job",{
     p_id:job.id,p_lease_token:job.leaseToken,p_thread_index:ti,p_message_index:mi,
     p_imported:0,p_completed:true
    });
    if(final.error||final.data!==true)throw Error("HISTORY_DB_UNAVAILABLE");
   }
   if(ti===threads.length)completed++;
  }catch(e){
   if(e instanceof Error&&e.message==="BAD_HISTORY_PAYLOAD")code="BAD_HISTORY_PAYLOAD";
   const failure=await db.rpc("connect_fail_whatsapp_history_job",{
    p_id:job.id,p_lease_token:job.leaseToken,p_code:code
   });
   if(failure.error)throw new Error("History queue failure recording unavailable: "+failure.error.code);
   failed++;
  }
 }
 return {claimed:(Array.isArray(data)?data:[]).length,completed,imported,paused,failed};
}
