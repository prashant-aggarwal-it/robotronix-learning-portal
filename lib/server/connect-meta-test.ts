// Test-only Meta Cloud API adapter. Deliberately never accepts phone ID, token,
// recipient, or graph URL from the browser. Production numbers cannot be used.
type TestConfig={phoneNumberId:string;accessToken:string;recipients:Set<string>;version:string};
export function metaTestConfig():TestConfig|null{
 if(process.env.CONNECT_META_TEST_SEND_ENABLED!=="true")return null;
 const id=process.env.CONNECT_META_TEST_PHONE_NUMBER_ID?.trim()||"";
 const token=process.env.CONNECT_META_TEST_ACCESS_TOKEN?.trim()||"";
 const values=process.env.CONNECT_META_TEST_RECIPIENTS||"";
 const recipients=new Set(values.split(",").map(x=>x.replace(/[^\d]/g,"")).filter(x=>/^\d{8,15}$/.test(x)));
 const version=process.env.CONNECT_META_GRAPH_VERSION||"v26.0";
 if(!/^\d{5,25}$/.test(id)||!token||recipients.size===0||!/^v\d{1,2}\.\d$/.test(version))return null;
 return {phoneNumberId:id,accessToken:token,recipients,version};
}
export function metaTestReady(phoneNumberId:string,recipient:string){
 const conf=metaTestConfig();
 return Boolean(conf&&conf.phoneNumberId===phoneNumberId&&conf.recipients.has(recipient));
}
export type SendResult=
 |{outcome:"accepted";messageId:string}
 |{outcome:"rejected";failureCode:string}
 |{outcome:"unknown";failureCode:string};
export async function sendMetaTestText(phoneNumberId:string,recipient:string,body:string):Promise<SendResult>{
 const config=metaTestConfig();
 if(!config||config.phoneNumberId!==phoneNumberId||!config.recipients.has(recipient))
  return {outcome:"rejected",failureCode:"test_sender_not_allowed"};
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(
   "https://graph.facebook.com/"+config.version+"/"+encodeURIComponent(config.phoneNumberId)+"/messages",{
    method:"POST",cache:"no-store",
    headers:{"Authorization":"Bearer "+config.accessToken,"Content-Type":"application/json"},
    body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to:recipient,
      type:"text",text:{preview_url:false,body}}),
    signal:controller.signal
   });
  if(!response.ok){
   // 429/5xx are ambiguous: Meta might have accepted the message.
   return response.status===429||response.status>=500?
    {outcome:"unknown",failureCode:"provider_unavailable"}:
    {outcome:"rejected",failureCode:"provider_rejected_"+response.status};
  }
  const value:unknown=await response.json().catch(()=>null);
  const messageId=(value&&typeof value==="object"&&Array.isArray((value as any).messages))?
   (value as {messages:Array<{id?:unknown}>}).messages[0]?.id:null;
  if(typeof messageId!=="string"||messageId.length<5||messageId.length>250)
   return {outcome:"unknown",failureCode:"missing_provider_message_id"};
  return {outcome:"accepted",messageId};
 }catch{
  return {outcome:"unknown",failureCode:"provider_network_uncertain"};
 }finally{clearTimeout(timeout);}
}
