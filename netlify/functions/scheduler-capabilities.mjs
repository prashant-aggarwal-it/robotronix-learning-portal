// Netlify Scheduled Functions are Node .mjs entrypoints, not Next.js routes.
// Keep this small and dependency-free; check parity against the typed deployment
// configuration with npm run check:backend-modules.
const modes=new Set(["portal","crm","tasks","combined"]);
const products=new Set(["portal","crm","tasks"]);
const integrations={crmPortal:["crm","portal"],crmTasks:["crm","tasks"],portalTasks:["portal","tasks"]};
function parseList(value,allowed){
 if(typeof value!=="string"||!value.trim())throw Error("Empty module allowlist");
 const parts=value.split(",").map(x=>x.trim());
 if(parts.some(x=>!allowed.has(x))||new Set(parts).size!==parts.length)throw Error("Invalid module allowlist");
 return parts;
}
export function schedulerCapabilityEnabled(capability,env=process.env){
 try{
  if(!products.has(capability)&&!Object.hasOwn(integrations,capability))return false;
  const mode=env.PRODUCT_MODE?.trim();
  if(!mode)return true; // Existing Portal combined deploy keeps original behavior.
  if(!modes.has(mode))return false;
  const enabled=env.ENABLED_PRODUCTS===undefined?
   (mode==="combined"?[...products]:[mode]):parseList(env.ENABLED_PRODUCTS,products);
  if(mode!=="combined"&&(enabled.length!==1||enabled[0]!==mode))return false;
  const enabledIntegrations=env.ENABLED_INTEGRATIONS===undefined?[]:
   parseList(env.ENABLED_INTEGRATIONS,new Set(Object.keys(integrations)));
  if(enabledIntegrations.some(key=>integrations[key].some(product=>!enabled.includes(product))))return false;
  return products.has(capability)?enabled.includes(capability):
    enabledIntegrations.includes(capability);
 }catch{return false;}
}
