// Every-five-minute just-in-time Zoom provisioning, capacity and cancellation recovery.
export default async () => {
 const started=Date.now();
 const base=(process.env.URL||process.env.DEPLOY_PRIME_URL||"").replace(/\/$/,"");
 const secret=process.env.INTERNAL_CRON_SECRET||"";
 if(!base||!secret){
  console.error("[zoom-jit]",JSON.stringify({status:"failed",code:"ZOOM_CRON_CONFIG_MISSING"}));
  return Response.json({ok:false,error:"Zoom scheduled job configuration missing."},{status:500});
 }
 try{
  const response=await fetch(base+"/api/zoom/auto-reconcile",{method:"POST",
   headers:{"x-robotronix-cron-secret":secret},cache:"no-store"});
  const body=await response.json().catch(()=>null);
  const success=response.ok&&body?.ok===true;
  console[success?"info":"error"]("[zoom-jit]",JSON.stringify({
   status:success?"success":"failed",http_status:response.status,
   created:body?.created??null,repaired:body?.repaired??null,
   cancelled:body?.cancelled??null,failed:body?.failed??null,
   reservations_recovered:body?.reservationsRecovered??null,duration_ms:Date.now()-started
  }));
  return Response.json(body&&typeof body==="object"?body:{ok:false,error:"Zoom scheduled job unavailable."},
   {status:success?200:502});
 }catch{
  console.error("[zoom-jit]",JSON.stringify({status:"failed",code:"ZOOM_JOB_REQUEST_FAILED",duration_ms:Date.now()-started}));
  return Response.json({ok:false,error:"Zoom scheduled job unavailable."},{status:502});
 }
};
