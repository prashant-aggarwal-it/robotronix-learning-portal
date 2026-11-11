import {NextResponse} from "next/server";
import {resolveDeploymentConfig} from "@/lib/platform/deployment";

// Public capability discovery for the application UI. Never returns secrets,
// database project IDs, individual authorisations or user subscriptions.
export const dynamic="force-dynamic";
export function GET(){
  try {
    const deployment=resolveDeploymentConfig(process.env);
    return NextResponse.json({
      ok:true,
      mode:deployment.mode,
      products:deployment.products,
      legacyDefault:deployment.legacyDefault,
      integrations:deployment.integrations,
      defaultPath:deployment.products.includes("portal")?"/":
        deployment.products.includes("crm")?"/connect":"/tasks"
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({ok:false,error:"Module configuration unavailable"},{
      status:503,headers:{"Cache-Control":"no-store"}
    });
  }
}
