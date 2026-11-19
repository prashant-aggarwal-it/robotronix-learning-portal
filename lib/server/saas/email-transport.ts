import "server-only";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
type MailResult={messageId:string};
type Mailer={createTransport:(options:Record<string,unknown>)=>{sendMail:(mail:Record<string,unknown>)=>Promise<MailResult>;close:()=>void}};
const nodemailer=require("nodemailer") as Mailer;
export type OutboundEmail={to:string;subject:string;text:string;html:string};
const address=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
export function smtpConfigured(){
 return Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD&&process.env.SMTP_FROM_EMAIL);
}
export function smtpSettings(){
 const host=process.env.SMTP_HOST||"";
 const port=Number(process.env.SMTP_PORT||465);
 const secure=process.env.SMTP_SECURE!=="false";
 const user=process.env.SMTP_USER||"",pass=process.env.SMTP_PASSWORD||"";
 const from=process.env.SMTP_FROM_EMAIL||"";
 if(!smtpConfigured()||!host||!/^[a-z0-9.-]+$/i.test(host)||!Number.isInteger(port)||port<1||port>65535||
    !address.test(user)||!address.test(from)||!pass||((port===465)!==secure&&[465,587].includes(port)))
   throw new Error("SMTP configuration invalid");
 return {host,port,secure,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
  tls:{minVersion:"TLSv1.2",rejectUnauthorized:true}};
}
export async function sendEmail(mail:OutboundEmail):Promise<{status:"smtp_accepted";messageId:string}|{status:"not_configured"|"failed"}>{
 if(!smtpConfigured())return {status:"not_configured"};
 if(!address.test(mail.to)||/[\r\n]/.test(mail.subject))return {status:"failed"};
 let transport:ReturnType<Mailer["createTransport"]>|undefined;
 try{
  transport=nodemailer.createTransport(smtpSettings());
  const fromName=(process.env.SMTP_FROM_NAME||"Robotronix Education Suite").replace(/[\r\n<>]/g,"").slice(0,120);
  const result=await transport.sendMail({
   from:{name:fromName,address:process.env.SMTP_FROM_EMAIL},
   to:mail.to,replyTo:process.env.SMTP_REPLY_TO||undefined,
   subject:mail.subject,text:mail.text,html:mail.html,
   disableFileAccess:true,disableUrlAccess:true
  });
  return result.messageId?{status:"smtp_accepted",messageId:result.messageId}:{status:"failed"};
 }catch{return {status:"failed"}}
 finally{transport?.close()}
}
