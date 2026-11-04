import fs from "node:fs";
import path from "node:path";
import {test,expect} from "@playwright/test";
import {ensureRoleSession} from "./session";

/** Read-only visual and navigation sweep of every static route in all four portal roles.
 * Dynamic record-specific routes require seeded IDs and existing journey tests.
 * Requires authenticated QA users and a running test deployment; does not write data.
 */
type Role = "admin"|"trainer"|"parent"|"student";
const roles:Role[]=["admin","trainer","parent","student"];
function staticRoutes(role:Role){
 const root=path.join(process.cwd(),"app",role),out:string[]=[];
 function walk(dir:string){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   if(ent.name.startsWith("[")||ent.name.startsWith("(")||ent.name.startsWith("@"))continue;
   const filename=path.join(dir,ent.name);
   if(ent.isDirectory())walk(filename);
   else if(ent.name==="page.tsx")out.push("/"+path.relative(path.join(process.cwd(),"app"),dir).replaceAll(path.sep,"/"));
  }
 }
 walk(root);return out.sort();
}
for(const role of roles){
 test.describe(`${role} complete static route visual sweep`,()=>{
  test.setTimeout(90000);
  for(const route of staticRoutes(role)){
   test(`${route}: desktop and mobile button/layout safety`,async({page})=>{
    await ensureRoleSession(page,role);
    for(const [width,height] of [[1440,900],[390,844]]){
     await page.setViewportSize({width,height});
     const response=await page.goto(route,{waitUntil:"domcontentloaded"});
     expect(response?.status()??200,`${route} HTTP`).toBeLessThan(500);
     await page.locator("body").waitFor({state:"visible"});
     await page.waitForTimeout(200);
     expect(new URL(page.url()).pathname,`${role} denied or redirected from ${route}`).toBe(route);
     const issues=await page.evaluate(()=>{
      const findings:string[]=[];
      const root=document.documentElement;
      if(root.scrollWidth>root.clientWidth+3)findings.push(`page horizontal overflow ${root.scrollWidth}>${root.clientWidth}`);
      for(const el of document.querySelectorAll<HTMLButtonElement|HTMLAnchorElement>("button,.button")){
       const css=getComputedStyle(el),rect=el.getBoundingClientRect();
       if(rect.width===0||rect.height===0||css.display==="none"||css.visibility==="hidden")continue;
       if(el.matches(".button,.zoomActionButton")&&rect.height<30)findings.push(`small control ${(el.textContent||"").trim().slice(0,35)}: ${rect.height}px`);
       if(el.matches(".button,.zoomActionButton")&&el.getAttribute("aria-disabled")==="true"&&css.cursor!=="not-allowed"&&!el.hasAttribute("disabled"))findings.push("aria-disabled visual state missing");
       if(el.matches(".button,.zoomActionButton")&&el.hasAttribute("disabled")&&css.cursor!=="not-allowed")findings.push("native disabled state visual missing");
      }
      return findings.slice(0,30);
     });
     expect(issues,`${route} at ${width}px`).toEqual([]);
    }
   });
  }
 });
}
