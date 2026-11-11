import {isRouteAvailable,resolveDeploymentConfig,type IntegrationId,type ProductId} from "./deployment";

/**
 * Server-side deployment guard (not authentication or per-customer entitlement).
 * Use at every server entry point that can run independently of Next.js Proxy.
 * Invalid configuration fails closed. Never use caller-controlled headers or
 * browser capability responses to decide what modules are installed.
 */
export type ModuleCheck = {ok:true}|{ok:false;status:404|503;message:string};
export function checkServerModule(
 pathname:string,
 env:Record<string,string|undefined>=process.env
):ModuleCheck{
 try{
  const config=resolveDeploymentConfig(env);
  return isRouteAvailable(config,pathname)?
   {ok:true}:{ok:false,status:404,message:"Module unavailable"};
 }catch{
  return {ok:false,status:503,message:"Module configuration unavailable"};
 }
}
export function checkServerCapability(
 id:ProductId|IntegrationId,
 env:Record<string,string|undefined>=process.env
):ModuleCheck{
 try{
  const config=resolveDeploymentConfig(env);
  return (config.products as readonly string[]).includes(id)||
   (config.integrations as readonly string[]).includes(id)?
   {ok:true}:{ok:false,status:404,message:"Module unavailable"};
 }catch{
  return {ok:false,status:503,message:"Module configuration unavailable"};
 }
}
export function moduleJsonError(check:Extract<ModuleCheck,{ok:false}>):Response{
 return Response.json({ok:false,error:check.message},{status:check.status,
  headers:{"Cache-Control":"no-store"}});
}
export function requireServerModule(pathname:string,env:Record<string,string|undefined>=process.env):Response|null{
 const check=checkServerModule(pathname,env);
 return check.ok?null:moduleJsonError(check);
}
export function requireServerCapability(id:ProductId|IntegrationId,env:Record<string,string|undefined>=process.env):Response|null{
 const check=checkServerCapability(id,env);
 return check.ok?null:moduleJsonError(check);
}
