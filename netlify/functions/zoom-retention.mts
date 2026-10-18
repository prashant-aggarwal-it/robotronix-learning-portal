export default async () => {
  const base=(process.env.URL||process.env.DEPLOY_PRIME_URL||"").replace(/\/$/,"");
  const secret=process.env.INTERNAL_CRON_SECRET||"";
  if(!base||!secret)return new Response("Retention job is not configured.",{status:500});
  const response=await fetch(base+"/api/zoom/retention",{method:"POST",headers:{"x-robotronix-cron-secret":secret}});
  const body=await response.text();
  return new Response(body,{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json"}});
};
