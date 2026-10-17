import crypto from "crypto";

const API="https://api.razorpay.com/v1";

function credentials(){
  const key=process.env.RAZORPAY_KEY_ID;
  const secret=process.env.RAZORPAY_KEY_SECRET;
  if(!key||!secret)throw new Error("Razorpay server credentials are not configured.");
  return{key,secret};
}

export function razorpayMode(){
  const key=process.env.RAZORPAY_KEY_ID||"";
  return key.startsWith("rzp_live_")?"live":key.startsWith("rzp_test_")?"test":"unknown";
}

export async function razorpayRequest(path:string,options:{method?:string;body?:unknown}={}){
  const {key,secret}=credentials();
  const response=await fetch(`${API}${path}`,{
    method:options.method||"GET",
    cache:"no-store",
    headers:{
      "Authorization":`Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type":"application/json",
      "Accept":"application/json"
    },
    body:options.body===undefined?undefined:JSON.stringify(options.body)
  });
  const data=await response.json().catch(()=>null) as any;
  if(!response.ok){
    const message=data?.error?.description||data?.error?.reason||data?.message||`Razorpay request failed (${response.status}).`;
    throw new Error(message);
  }
  return data;
}

export function verifyRazorpayWebhook(raw:string,signature:string){
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret)return false;
  const expected=crypto.createHmac("sha256",secret).update(raw).digest("hex");
  const a=Buffer.from(expected,"utf8"),b=Buffer.from(signature||"","utf8");
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
