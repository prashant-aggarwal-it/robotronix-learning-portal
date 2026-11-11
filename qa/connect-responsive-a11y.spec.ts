import {test,expect,devices} from "@playwright/test";

test.describe("Connect public entry accessibility and responsive smoke",()=>{
 for(const {name,viewport} of [
  {name:"desktop",viewport:{width:1366,height:768}},
  {name:"mobile",viewport:devices["Pixel 7"].viewport!}
 ]){
  test(`${name}: sign-in screen has visible content without horizontal document overflow`,async({page})=>{
   await page.setViewportSize(viewport);
   await page.goto("/connect",{waitUntil:"domcontentloaded"});
   await expect(page.locator("main").first()).toBeVisible();
   await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
   const buttons=page.getByRole("button");
   const count=await buttons.count();
   for(let i=0;i<count;i++){
    const button=buttons.nth(i);
    if(!await button.isVisible())continue;
    const label=await button.getAttribute("aria-label")||await button.innerText();
    expect(label.trim(),`Unlabelled button ${i}`).not.toBe("");
   }
  });
 }
});
