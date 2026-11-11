import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
import {defaultProductPath,isRouteAvailable,resolveDeploymentConfig} from "@/lib/platform/deployment";

// Deployment isolation only. Authentication, tenant entitlements and permissions
// remain the responsibility of each API endpoint (Phase 3/4).
export function proxy(request:NextRequest){
  let deployment;
  try {
    deployment=resolveDeploymentConfig(process.env);
  } catch {
    // Invalid deployment flags must fail closed rather than expose another product.
    return NextResponse.json({error:"Invalid module configuration"},{
      status:503,headers:{"Cache-Control":"no-store"}
    });
  }
  const pathname=request.nextUrl.pathname;
  // Public static assets are shared across product shells; never bypass API checks.
  if(!pathname.startsWith("/api/") && /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|css|js)$/i.test(pathname)){
    return NextResponse.next();
  }
  if(pathname==="/" && !deployment.products.includes("portal")){
    return NextResponse.redirect(new URL(defaultProductPath(deployment),request.url));
  }
  if(!isRouteAvailable(deployment,pathname)){
    if(pathname.startsWith("/api/")){
      return NextResponse.json({error:"Module unavailable"},{status:404,headers:{"Cache-Control":"no-store"}});
    }
    return new NextResponse("Not Found",{status:404,headers:{"Cache-Control":"no-store","Content-Type":"text/plain; charset=utf-8"}});
  }
  return NextResponse.next();
}

export const config={
  matcher:["/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)"]
};
