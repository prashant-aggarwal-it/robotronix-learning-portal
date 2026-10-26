export default async () => {
  const started=Date.now();
  const base=(process.env.URL||process.env.DEPLOY_PRIME_URL||"").replace(/\/$/,"");
  const secret=process.env.INTERNAL_CRON_SECRET||"";
  if(!base||!secret){
    console.error("[zoom-retention]",JSON.stringify({status:"failed",code:"RETENTION_CONFIG_MISSING"}));
    return Response.json({ok:false,error:"Retention job is not configured."},{status:500});
  }
  try{
    const response=await fetch(base+"/api/zoom/retention",{method:"POST",headers:{"x-robotronix-cron-secret":secret}});
    const body=await response.json().catch(()=>null);
    const status=response.ok&&body?.ok===true&&!(body?.failed>0)?"success":"failed";
    console[status==="success"?"info":"error"]("[zoom-retention]",JSON.stringify({
      status,http_status:response.status,checked:body?.checked??null,
      deleted:body?.deleted??null,failed:body?.failed??null,duration_ms:Date.now()-started
    }));
    return Response.json(body&&typeof body==="object"?body:{ok:false,error:"Retention service unavailable."},{status:response.ok&&status==="success"?200:502});
  }catch{
    console.error("[zoom-retention]",JSON.stringify({status:"failed",code:"RETENTION_REQUEST_FAILED",duration_ms:Date.now()-started}));
    return Response.json({ok:false,error:"Retention service unavailable."},{status:502});
  }
};
