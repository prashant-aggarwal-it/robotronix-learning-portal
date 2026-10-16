import fs from 'node:fs';
import path from 'node:path';
function load(file){const p=path.resolve(file);if(!fs.existsSync(p))return;for(const raw of fs.readFileSync(p,'utf8').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const i=line.indexOf('=');if(i<1)continue;const k=line.slice(0,i).trim();let v=line.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(process.env[k]===undefined)process.env[k]=v}}
load('.env.sanity.local');
if(process.env.QA_TARGET!=='production')throw new Error('qa:prod-sanity requires QA_TARGET=production in .env.sanity.local.');
for(const k of ['QA_BASE_URL','SANITY_SUPABASE_URL','SANITY_SUPABASE_ANON_KEY','SANITY_SUPABASE_SERVICE_ROLE_KEY','SANITY_ADMIN_EMAIL','SANITY_ADMIN_PASSWORD','SANITY_TRAINER_EMAIL','SANITY_TRAINER_PASSWORD','SANITY_PARENT_EMAIL','SANITY_PARENT_PASSWORD','SANITY_STUDENT_EMAIL','SANITY_STUDENT_PASSWORD'])if(!process.env[k])throw new Error(`Missing ${k} in .env.sanity.local.`);
if(!String(process.env.QA_BASE_URL).startsWith('https://'))throw new Error('QA_BASE_URL must be HTTPS for production sanity.');
console.log(`Production sanity target confirmed: ${process.env.QA_BASE_URL}`);
