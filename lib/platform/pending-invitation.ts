/** Only internal, token-shaped invitation URLs may survive an auth round trip. */
const key="robotronix:pending-organization-invitation";
const allowed=/^\/invite(?:\/family)?\?token=[a-f0-9]{64}$/;
export function preserveInvitation(path:string):void{
 if(typeof window!=="undefined"&&allowed.test(path))window.sessionStorage.setItem(key,path);
}
export function consumeInvitation():string|null{
 if(typeof window==="undefined")return null;
 const destination=window.sessionStorage.getItem(key);
 window.sessionStorage.removeItem(key);
 return destination&&allowed.test(destination)?destination:null;
}
export function clearInvitation():void{
 if(typeof window!=="undefined")window.sessionStorage.removeItem(key);
}
