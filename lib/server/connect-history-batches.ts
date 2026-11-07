export type HistoryThread={id:string;messages:unknown[]};
export type HistoryCursor={threadIndex:number;messageIndex:number};
export function nextHistoryBatch(threads:HistoryThread[],cursor:HistoryCursor,maxSize=200){
 if(!Number.isInteger(cursor.threadIndex)||!Number.isInteger(cursor.messageIndex)||
    cursor.threadIndex<0||cursor.messageIndex<0||cursor.threadIndex>threads.length||
    (cursor.threadIndex===threads.length&&cursor.messageIndex!==0)||maxSize<1||maxSize>200)
  throw Error("BAD_HISTORY_PAYLOAD");
 let ti=cursor.threadIndex,mi=cursor.messageIndex;
 while(ti<threads.length){
  const t=threads[ti];
  if(!t||typeof t.id!=="string"||!/^[0-9+]{8,16}$/.test(t.id)||
     !Array.isArray(t.messages)||t.messages.length>200_000||mi>t.messages.length)
   throw Error("BAD_HISTORY_PAYLOAD");
  if(mi===t.messages.length){ti++;mi=0;continue;}
  const messages=t.messages.slice(mi,mi+maxSize);
  mi+=messages.length;
  if(mi>=t.messages.length){ti++;mi=0;}
  return {contact:t.id,messages,next:{threadIndex:ti,messageIndex:mi},complete:ti===threads.length};
 }
 return {contact:null,messages:[],next:{threadIndex:ti,messageIndex:0},complete:true};
}
