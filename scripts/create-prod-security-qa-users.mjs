import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// Create dedicated Auth/profile identities for database/02_qa/03_PROD_SECURITY_QA_SEED.sql.
// No existing users/passwords/profiles are modified. Requires service_role key.
const envPath=resolve('.env.security-qa.local');
if(existsSync(envPath))for(const raw of readFileSync(envPath,'utf8').split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const pos=line.indexOf('=');if(pos<1)continue;
  const key=line.slice(0,pos).trim();let value=line.slice(pos+1).trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  if(!(key in process.env))process.env[key]=value;
}

const url=process.env.SECURITY_QA_SUPABASE_URL;
const secret=process.env.SECURITY_QA_SUPABASE_SERVICE_ROLE_KEY;
const ack=process.env.SECURITY_QA_PRODUCTION_ACK;
if(ack!=='CREATE_SEVEN_SYNTHETIC_USERS' || !url || !secret)
  throw new Error('Set SECURITY_QA_PRODUCTION_ACK=CREATE_SEVEN_SYNTHETIC_USERS and Supabase URL/service-role key in .env.security-qa.local.');

const roles=[['admin','admin'],['trainer-a','trainer'],['trainer-b','trainer'],['parent-a','parent'],['parent-b','parent'],['student-a','student'],['student-b','student']];
const expectedHost='robotronixstemlab.com';
const users=roles.map(([suffix,role])=>({email:`qa-sec-${suffix}@${expectedHost}`,role,fullName:`QA Security ${suffix}`}));
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});

async function listAll(){
 const result=[];
 for(let page=1;page<=100;page++){
  const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
  if(error)throw error;
  const batch=data?.users??[];result.push(...batch);
  if(batch.length<1000)return result;
 }
 throw new Error('Too many Auth users; explicit review required.');
}

const existing=await listAll();
const collisions=users.filter(u=>existing.some(e=>e.email?.toLowerCase()===u.email));
if(collisions.length)throw new Error('Refusing to modify existing Auth users: '+collisions.map(u=>u.email).join(', '));

for(const fixture of users){
 const password=randomBytes(30).toString('base64url');
 const {data,error}=await supabase.auth.admin.createUser({email:fixture.email,password,email_confirm:true,
   user_metadata:{full_name:fixture.fullName,security_qa_user:true}});
 if(error)throw new Error(`Could not create ${fixture.email}: ${error.message}`);
 const {error:profileError}=await supabase.from('profiles').insert({id:data.user.id,full_name:fixture.fullName,
   role:fixture.role,active:true});
 if(profileError)throw new Error(`Auth created but profile failed for ${fixture.email}: ${profileError.message}`);
 console.log(`${fixture.email} (${fixture.role}) created. Password: ${password}`);
}
console.log('Seven QA identities created. Store passwords securely; the script will not display them again.');
