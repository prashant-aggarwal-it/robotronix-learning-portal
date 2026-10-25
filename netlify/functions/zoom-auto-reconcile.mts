// Scheduled, server-authenticated retry for unprovisioned future Zoom classrooms.
export default async () => {
 const base=(process.env.URL||process.env.DEPLOY_PRIME_URL||"").replace(/\/$/,"");
 const secret=process.env.INTERNAL_CRON_SECRET||"";
 if(!base||!secret)return new Response("Automatic Zoom reconciliation is not configured.",{status:500});
 const response=await fetch(base+"/api/zoom/auto-reconcile",{method:"POST",headers:{"x-robotronix-cron-secret":secret}});
 return new Response(await response.text(),{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json"}});
};
