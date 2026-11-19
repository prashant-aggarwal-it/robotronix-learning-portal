import "server-only";
import nodemailer from "nodemailer";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export type AcademySmtpSettings={host:string;port:number;secure:boolean;username:string;password:string;senderEmail:string};
const email=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
export function validateSmtpSettings(s:AcademySmtpSettings){
 if(!/^(?=.{4,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])$/i.test(s.host)||s.host.includes("..")||isIP(s.host)||
  ![465,587].includes(s.port)||s.secure!==(s.port===465)||!email.test(s.username)||!email.test(s.senderEmail)||!s.password||s.password.length>2048)
  throw new SaaSAccessError(400,"Invalid SMTP settings. Use TLS port 465 or STARTTLS port 587");
}
function publicIPv4(ip:string){const n=ip.split(".").map(Number);return n.length===4&&n.every(v=>v>=0&&v<=255)&&n[0]!==0&&n[0]!==10&&n[0]!==127&&n[0]<224&&!(n[0]===169&&n[1]===254)&&!(n[0]===172&&n[1]>=16&&n[1]<=31)&&!(n[0]===192&&n[1]===168)&&!(n[0]===100&&n[1]>=64&&n[1]<=127)&&!(n[0]===192&&n[1]===0)&&!(n[0]===198&&[18,19].includes(n[1]));}
export async function resolvePublicSmtpHost(host:string){
 const records=await lookup(host,{all:true,verbatim:true});
 if(!records.length||records.some(r=>r.family!==4||!publicIPv4(r.address)))throw new SaaSAccessError(400,"SMTP host must resolve only to public IPv4 addresses");
 return records[0].address;
}
export async function smtpTransport(s:AcademySmtpSettings){
 validateSmtpSettings(s);
 const address=await resolvePublicSmtpHost(s.host);
 return nodemailer.createTransport({host:address,port:s.port,secure:s.secure,requireTLS:!s.secure,
  auth:{user:s.username,pass:s.password},tls:{servername:s.host,minVersion:"TLSv1.2",rejectUnauthorized:true},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
  disableFileAccess:true,disableUrlAccess:true});
}
export async function verifyAcademySmtp(s:AcademySmtpSettings){
 const transport=await smtpTransport(s);
 try{await transport.verify();return true;}finally{transport.close();}
}
export async function deliverAcademySmtp(s:AcademySmtpSettings,to:string,subject:string,text:string){
 if(!email.test(to)||/[\r\n]/.test(subject)||subject.length>240||text.length>100000)throw new SaaSAccessError(400,"Invalid email");
 const transport=await smtpTransport(s);
 try{
  const result=await transport.sendMail({from:s.senderEmail,to,subject,text,disableFileAccess:true,disableUrlAccess:true});
  if(!result.accepted?.some(a=>a.toLowerCase()===to.toLowerCase()))throw new SaaSAccessError(503,"SMTP recipient not accepted");
  return {provider:"smtp",messageId:result.messageId};
 }finally{transport.close();}
}
