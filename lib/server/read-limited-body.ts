/**
 * Bounded request reader for signed provider webhooks. Limit bytes BEFORE
 * parsing JSON or doing crypto/DB work, even when Content-Length is omitted.
 */
export class RequestBodyTooLarge extends Error{
 constructor(){super("Request payload exceeds allowed size");this.name="RequestBodyTooLarge";}
}
export async function readTextBodyLimited(request:Request,maxBytes=1048576):Promise<string>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error("Invalid body size limit");
 const declared=request.headers.get("content-length");
 if(declared!==null && Number(declared)>maxBytes)throw new RequestBodyTooLarge();
 if(!request.body)return "";
 const reader=request.body.getReader();
 const chunks:Uint8Array[]=[];
 let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>maxBytes)throw new RequestBodyTooLarge();
   chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
