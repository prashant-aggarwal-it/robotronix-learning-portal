import crypto from "node:crypto";

function signingSecret(){
 const raw=process.env.ZOOM_RECORDING_ACCESS_SECRET?.trim()||process.env.ZOOM_TOKEN_ENCRYPTION_KEY?.trim();
 if(!raw)throw new Error("Recording access signing secret is not configured.");
 return raw;
}
function eq(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
export function createRecordingStreamToken(recordingId:string,profileId:string,ttlSeconds=600){
 const payload=Buffer.from(JSON.stringify({recordingId,profileId,exp:Math.floor(Date.now()/1000)+ttlSeconds})).toString("base64url");
 const sig=crypto.createHmac("sha256",signingSecret()).update(payload).digest("base64url");
 return payload+"."+sig;
}
export function readRecordingStreamToken(token:string){
 const [payload,sig]=token.split(".");if(!payload||!sig)throw new Error("Invalid recording access token.");
 const expected=crypto.createHmac("sha256",signingSecret()).update(payload).digest("base64url");
 if(!eq(sig,expected))throw new Error("Invalid recording access token.");
 const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {recordingId:string;profileId:string;exp:number};
 if(!parsed.recordingId||!parsed.profileId||!parsed.exp||parsed.exp<Math.floor(Date.now()/1000))throw new Error("Recording access token expired.");
 return parsed;
}
