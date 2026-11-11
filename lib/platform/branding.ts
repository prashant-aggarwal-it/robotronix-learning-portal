import {resolveDeploymentConfig,type DeploymentEnv} from "./deployment";

export type ProductBrand={
 appName:string;title:string;description:string;category:string;landing:string;
};
export function getProductBrand(env:DeploymentEnv):ProductBrand{
 const config=resolveDeploymentConfig(env);
 if(config.legacyDefault||config.mode==="portal")
  return {appName:"Robotronix™ Learning Portal",title:"Robotronix™ Learning Portal",
   description:"Secure learning and operations portal for Robotronix™ families, learners, trainers and administrators.",
   category:"education",landing:"/"};
 if(config.mode==="crm"||(config.mode==="combined"&&config.products.length===1&&config.products[0]==="crm"))
  return {appName:"Robotronix Connect CRM",title:"Robotronix Connect CRM",
   description:"Manage contacts, enquiries, conversations, campaigns and customer relationships.",
   category:"business",landing:"/connect"};
 if(config.mode==="tasks"||(config.mode==="combined"&&config.products.length===1&&config.products[0]==="tasks"))
  return {appName:"My Tasks",title:"My Tasks | Robotronix",
   description:"Plan your day, organize work, focus, and collaborate with your team.",
   category:"productivity",landing:"/tasks"};
 return {appName:"Robotronix Workspace",title:"Robotronix Workspace",
  description:"Your enabled learning, customer relationship and task management applications.",
  category:"business",landing:"/"};
}
