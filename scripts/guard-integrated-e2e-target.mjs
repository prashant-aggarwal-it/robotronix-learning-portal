// Fail closed before any credentialed browser or service-role QA operation.
// Explicitly target a separate QA Supabase project and nonproduction preview URL.
const required=[
 "QA_BASE_URL","SECURITY_QA_PROJECT_REF","SUPABASE_URL",
 "NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
 ...["ADMIN","TRAINER","PARENT","STUDENT"].flatMap(role=>[`QA_${role}_EMAIL`,`QA_${role}_PASSWORD`])
];
const missing=required.filter(key=>!process.env[key]?.trim());
if(missing.length)throw new Error("Isolated QA E2E environment is incomplete: "+missing.join(", "));
if(process.env.QA_TARGET==="production"||process.env.QA_TARGET==="prod")
 throw new Error("Integrated E2E suite refuses production QA target.");
const base=new URL(process.env.QA_BASE_URL);
const db=new URL(process.env.SUPABASE_URL);
const ref=process.env.SECURITY_QA_PROJECT_REF;
if(base.protocol!=="https:"||!base.hostname.endsWith(".netlify.app")||base.hostname.includes("portal.robotronixstemlab.com")||!base.hostname.includes("deploy-preview-"))
 throw new Error("E2E URL must be a nonproduction Netlify Deploy Preview.");
if(db.protocol!=="https:"||db.hostname!==ref+".supabase.co")
 throw new Error("E2E database must match the explicitly configured isolated QA Supabase project.");
if(process.env.NEXT_PUBLIC_SUPABASE_URL&&new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!==db.hostname)
 throw new Error("Public and service-role Supabase endpoints differ.");
console.log("Isolated QA E2E target guard passed (no production access).");
