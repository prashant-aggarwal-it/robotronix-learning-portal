import fs from 'node:fs';
import path from 'node:path';

// Produces a LOCAL copy of the QA seed with the four configured email addresses.
// Run after configuring .env.portal-qa.local; never commit the generated copy.
const envFile=path.resolve('.env.portal-qa.local');
if(!fs.existsSync(envFile))throw new Error('Copy .env.portal-qa.example to .env.portal-qa.local and configure the four addresses.');
const vars={};
for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
  const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if(match){let v=match[2];if(/^['"].*['"]$/.test(v))v=v.slice(1,-1);vars[match[1]]=v;}
}
const roles=['admin','trainer','parent','student'];
const emails=roles.map(role=>{
 const email=vars[`PORTAL_QA_${role.toUpperCase()}_EMAIL`];
 if(!email||! /^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email))throw new Error(`Configure a valid PORTAL_QA_${role.toUpperCase()}_EMAIL`);
 return email.toLowerCase();
});
if(new Set(emails).size!==4)throw new Error('QA email addresses must be four distinct identities.');
let sql=fs.readFileSync('database/archive/legacy/02_qa__03_PERMANENT_PROD_QA_SEED.sql','utf8');
roles.forEach((role,i)=>{sql=sql.replaceAll(`portal-qa-${role}@robotronix.local`,emails[i]);});
const target=path.resolve('database/02_qa/04_GENERATED_LOCAL_PROD_QA_SEED.sql');
fs.writeFileSync(target,sql,{flag:'w',mode:0o600});
console.log('Generated local QA seed: '+target+' (gitignored).');
