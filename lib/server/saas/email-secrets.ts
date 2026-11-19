import "server-only";
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
function key(){const raw=process.env.ACADEMY_EMAIL_ENCRYPTION_KEY||"";const b=Buffer.from(raw,"base64");if(b.length!==32)throw Error("Academy email encryption key unavailable");return b;}
export function seal(value:string){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),ciphertext.toString("base64url")].join(".");}
export function unseal(payload:string){const [version,iv,tag,data]=payload.split(".");if(version!=="v1"||!iv||!tag||!data)throw Error("Invalid encrypted credential");const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");}
