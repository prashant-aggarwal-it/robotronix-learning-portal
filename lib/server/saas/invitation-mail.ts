import "server-only";
export type InvitationEmail={to:string;academy:string;url:string;expiresAt:string};
const escape=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function invitationOrigin(){
 const raw=process.env.INVITATION_APP_URL||process.env.NEXT_PUBLIC_APP_URL||"";
 if(!raw)throw Error("Invitation public URL not configured");
 const u=new URL(raw);
 const local=["localhost","127.0.0.1"].includes(u.hostname);
 if((u.protocol!=="https:"&&!local)||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw Error("Invalid invitation public origin");
 if(local&&process.env.NODE_ENV==="production")throw Error("Local invitation origins forbidden in production");
 return u.origin;
}
export function invitationEmail(data:InvitationEmail){
 const link=escape(data.url),academy=escape(data.academy);
 const date=new Date(data.expiresAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
 const subject="Activate your academy — Robotronix Education Suite";
 const text=`Hello,\n\nYou've been invited to manage ${data.academy} on Robotronix Education Suite.\n\nActivate your academy: ${data.url}\n\nThis link expires on ${date}. Sign in using the invited email, or create and verify your account.\n\nIf you were not expecting this invitation, ignore this email.\n\nRobotronix Education Suite Team`;
 const html=`<!doctype html><html><body style="margin:0;background:#f7f5fc;padding:32px 12px;font-family:Arial,sans-serif;color:#2d2143"><table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:auto;background:white;border-radius:16px"><tr><td style="padding:32px"><p style="font-weight:800;color:#6134a6;letter-spacing:1px">ROBOTRONIX EDUCATION SUITE</p><h1 style="font-size:27px">Your academy invitation</h1><p>You've been invited to manage <strong>${academy}</strong>.</p><p>Run courses, classes and day-to-day academy operations in one connected workspace.</p><p style="margin:32px 0"><a href="${link}" style="background:#6835b4;color:#fff;padding:15px 22px;border-radius:9px;text-decoration:none;font-weight:bold">Activate My Academy</a></p><p>This secure invitation expires on ${escape(date)}. Sign in with your invited email address, or register and verify your email first.</p><p style="font-size:12px;color:#6c647b">If the button does not work, paste this secure URL into your browser:<br/><a href="${link}">${link}</a></p><p style="font-size:12px;color:#6c647b">If you did not expect this invitation, you can ignore this message.</p><p>Robotronix Education Suite Team</p></td></tr></table></body></html>`;
 return {subject,text,html};
}
export async function deliverInvitation(data:InvitationEmail,idempotencyKey:string){
 const key=process.env.RESEND_API_KEY,from=process.env.INVITATION_FROM_EMAIL;
 if(!key||!from)return {status:"not_configured" as const};
 const content=invitationEmail(data);
 try{
  const response=await fetch("https://api.resend.com/emails",{method:"POST",
   headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},
   body:JSON.stringify({from,to:[data.to],reply_to:process.env.INVITATION_REPLY_TO||undefined,...content}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {status:"failed" as const};
  const result=await response.json().catch(()=>null);
  if(typeof result?.id!=="string")return {status:"failed" as const};
  return {status:"provider_accepted" as const,messageId:result.id};
 }catch{return {status:"failed" as const};}
}
