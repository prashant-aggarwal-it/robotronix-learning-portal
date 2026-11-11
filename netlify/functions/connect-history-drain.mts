// Scheduled safely: disabled unless the dedicated feature flag and secret exist.
export default async()=>{
 if(process.env.CONNECT_HISTORY_DRAIN_ENABLED!=="true")return Response.json({ok:true,disabled:true});
 const base=(process.env.URL||process.env.DEPLOY_PRIME_URL||"").replace(/\/$/,"");
 const secret=process.env.CONNECT_HISTORY_JOB_SECRET||"";
 if(!base||secret.length<24)return Response.json({ok:false,error:"History worker configuration missing"},{status:503});
 try{
  const r=await fetch(base+"/api/connect/jobs/whatsapp-history",{
   method:"POST",headers:{Authorization:"Bearer "+secret},cache:"no-store",
   signal:AbortSignal.timeout(25_000)
  });
  const value=await r.json().catch(()=>null);
  return Response.json(value&&typeof value==="object"?value:{ok:false},{status:r.ok?200:503});
 }catch{return Response.json({ok:false,error:"History worker request failed"},{status:503});}
};
