// DEV ONLY. Supabase-managed users must be removed through Admin Auth API, not SQL.
// Defaults to DRY RUN. Explicit --delete-dev-auth plus two guards required.
import fs from "node:fs";
import {createClient} from "@supabase/supabase-js";
if(fs.existsSync(".env.local"))for(const line of fs.readFileSync(".env.local","utf8").split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const expected=process.env.ROBOTRONIX_DEV_PROJECT_REF;
if(!url||!key||!expected)throw Error("SUPABASE_URL, service-role key, and ROBOTRONIX_DEV_PROJECT_REF are required");
const project=new URL(url).hostname.split(".")[0];
if(project!==expected||expected!=="uzzuquxeeqonxeqcuohh")throw Error("Refusing auth operation: target must match reviewed Robotronix DEV project");
const deleting=process.argv.includes("--delete-dev-auth");
if(deleting && process.env.CONFIRM_DELETE_ALL_DEV_AUTH!=="DELETE_ALL_DEV_AUTH_USERS")throw Error("Deletion requires CONFIRM_DELETE_ALL_DEV_AUTH=DELETE_ALL_DEV_AUTH_USERS");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
for(let page=1;;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:1000});if(error)throw error;users.push(...data.users);if(data.users.length<1000)break;}
console.log("DEV Auth users found: "+users.length);
if(!deleting){console.log("DRY RUN: no users deleted. To delete, use --delete-dev-auth and explicit confirmation env.");process.exit(0);}
for(const u of users){const {error}=await client.auth.admin.deleteUser(u.id);if(error)throw Error("Failed to remove Auth user "+u.id+": "+error.message);}
console.log("Deleted "+users.length+" DEV Auth users. Existing client sessions should be signed out.");
