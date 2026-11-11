import {resolveDeploymentConfig} from "../lib/platform/deployment.ts";
import {checkDeploymentReadiness} from "../lib/platform/deployment-readiness.mjs";
// Run with environment already provided by the deploy platform (not with a
// checked-in credentials file). Errors contain codes only, never secret values.
try{
 const config=resolveDeploymentConfig(process.env);
 const errors=checkDeploymentReadiness(process.env,config);
 if(errors.length){for(const error of errors)console.error("FAIL "+error);process.exitCode=1;}
 else console.log("PASS explicit deployment environment for "+config.products.join("+")+" (configuration only)");
}catch{console.error("FAIL INVALID_PRODUCT_CONFIGURATION");process.exitCode=1;}
