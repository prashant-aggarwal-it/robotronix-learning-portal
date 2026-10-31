// Runs daily; writes a heartbeat through the authenticated internal cron endpoint.
export default async () => {
 const base=(process.env.URL||"").replace(/\/$/,"");
 const secret=process.env.INTERNAL_CRON_SECRET||"";
 if(!base||!secret)return Response.json({ok:false,error:"Retention cron not configured"},{status:503});
 try{
  const response=await fetch(base+"/api/cron/system-log-retention",{method:"POST",headers:{"x-robotronix-cron-secret":secret},cache:"no-store"});
  if(!response.ok)console.error("[system-log-retention]",{status:response.status});
  return new Response(await response.text(),{status:response.status,headers:{"Content-Type":"application/json"}});
 }catch{
  console.error("[system-log-retention]",{code:"SCHEDULED_REQUEST_FAILED"});
  return Response.json({ok:false,error:"Retention job failed"},{status:502});
 }
};
