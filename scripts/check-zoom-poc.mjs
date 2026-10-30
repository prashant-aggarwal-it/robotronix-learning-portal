import fs from 'node:fs';
import {readCanonicalSql} from './read-canonical-sql.mjs';
const required=[
 'app/api/zoom/connect/route.ts','app/api/zoom/oauth/callback/route.ts','app/api/zoom/hosts/route.ts','app/api/zoom/test-meeting/route.ts','app/api/zoom/sdk-session/route.ts','app/admin/zoom-test/page.tsx','app/zoom-poc/classroom/page.tsx','public/zoom-poc-frame.html','lib/server/zoom.ts','ZOOM-CLASSROOM-POC.md'
];
for(const f of required)if(!fs.existsSync(f))throw new Error(`Missing Zoom POC file: ${f}`);
const schema=readCanonicalSql();
for(const token of ['zoom_host_accounts','zoom_meetings'])if(!schema.includes(token))throw new Error(`Main schema is missing ${token}`);
const frame=fs.readFileSync('public/zoom-poc-frame.html','utf8');
if(!frame.includes('zoom-meeting-6.5.0.min.js'))throw new Error('Zoom POC frame SDK version missing.');

if(!frame.includes('react-redux.min.js'))throw new Error('Zoom POC frame is missing the Client View react-redux dependency.');
const nextConfig=fs.readFileSync('next.config.ts','utf8');
for(const marker of ['https://source.zoom.us', "camera=(self)", "microphone=(self)", "worker-src 'self' blob:", "'unsafe-eval'"]){
 if(!nextConfig.includes(marker))throw new Error(`Zoom POC CSP/permissions configuration missing: ${marker}`);
}
console.log('Zoom POC structure: OK');
