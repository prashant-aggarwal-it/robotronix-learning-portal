import {test,expect,type Page} from "@playwright/test";
import {deflateSync} from "node:zlib";

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
type Brand={tagline:string;logoUrl:string;accentColor:string;palette:null|Record<string,string>};
const original=()=>({
 [A]:{tagline:"Alpha learning",logoUrl:"",accentColor:"#4537a5",palette:null} as Brand,
 [B]:{tagline:"Beta explores",logoUrl:"",accentColor:"#1e78d2",palette:null} as Brand
});
function crc32(data:Buffer):number {
 let crc=0xffffffff;
 for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
 return (crc^0xffffffff)>>>0;
}
function chunk(type:string,data:Buffer):Buffer{
 const name=Buffer.from(type);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
 const length=Buffer.alloc(4);length.writeUInt32BE(data.length);
 return Buffer.concat([length,name,data,crc]);
}
function png(r:number,g:number,b:number):Buffer{
 const width=16,height=16,head=Buffer.alloc(13);
 head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
 const lines=Buffer.alloc(height*(1+width*3));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=y*(1+width*3)+1+x*3;lines[at]=r;lines[at+1]=g;lines[at+2]=b;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",head),chunk("IDAT",deflateSync(lines)),chunk("IEND",Buffer.alloc(0))]);
}
async function mockApi(page:Page,opts:{rejectSave?:boolean;rejectUpload?:boolean}={}){
 const records=original();
 let uploads=0,saves=0;
 await page.addInitScript(()=>{
  const session={
   access_token:"qa-synthetic-access-token",
   refresh_token:"qa-synthetic-refresh-token",
   token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+36000,
   expires_in:36000,user:{id:"33333333-3333-4333-8333-333333333333",email:"qa@example.test",
    app_metadata:{provider:"email"},user_metadata:{},aud:"authenticated",role:"authenticated",
    created_at:new Date().toISOString()}
  };
  localStorage.setItem("sb-mock-auth-token",JSON.stringify(session));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
 await page.route("**/api/branding-studio**",async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  const response=(obj:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj)});
  if(url.pathname.endsWith("/upload")){
   uploads++;
   return opts.rejectUpload?response({ok:false,error:"Upload denied"},403):response({ok:true,logoUrl:"https://cdn.example.test/"+A+"/logo.png"});
  }
  if(method==="GET"){
   const org=url.searchParams.get("organizationId")||A;
   return response({ok:true,organization:{id:org,slug:org===A?"qa-academy-a":"qa-academy-b",display_name:org===A?"QA Academy Alpha":"QA Academy Beta"},branding:records[org as keyof typeof records]});
  }
  if(method==="POST"){
   saves++;
   if(opts.rejectSave)return response({ok:false,error:"Not authorized to modify branding"},403);
   const body=JSON.parse(req.postData()||"{}");
   const org=body.organizationId as keyof typeof records;
   if(!records[org])return response({ok:false,error:"Invalid tenant"},403);
   const updated:Brand={tagline:body.tagline,logoUrl:body.logoUrl,accentColor:body.primary,
    palette:{primary:body.primary,secondary:body.secondary,accent:body.accent,
     primaryHover:body.primary,onPrimary:"#ffffff",primarySoft:"#f0f0f0"}};
   records[org]=updated;
   return response({ok:true,organizationId:org,slug:"qa-academy-a",branding:updated});
  }
  return response({ok:false},404);
 });
 return {records,counts:()=>({uploads,saves})};
}
test.beforeEach(async({page})=>{await page.goto("about:blank");});
test("loads tenant-specific branding, previews changes and persists after refresh",async({page})=>{
 const api=await mockApi(page);
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await expect(page.locator(".brandingPreviewTop strong")).toHaveText("QA Academy Alpha");
 await page.getByLabel("Tagline").fill("Alpha rebranded");
 await expect(page.getByText("Unsaved changes")).toBeVisible();
 await page.getByLabel("primary hex").fill("#185c89");
 await page.getByLabel("primary hex").blur();
 await expect.poll(async()=>page.locator(".brandingPreview").evaluate(node=>getComputedStyle(node).getPropertyValue("--brand-primary").trim())).toBe("#185c89");
 await page.getByRole("button",{name:"Save branding"}).click();
 await expect(page.getByText(/Branding saved for QA Academy Alpha/)).toBeVisible();
 expect(api.counts().saves).toBe(1);
 await page.reload();
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha rebranded");
 await expect(page.getByLabel("primary color")).toHaveValue("#185c89");
});
test("switches organizations without leaking unsaved values",async({page})=>{
 await mockApi(page);
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Tagline").fill("Unsaved A only");
 await page.getByLabel("Choose organization").selectOption(B);
 await expect(page.getByLabel("Tagline")).toHaveValue("Beta explores");
 await expect(page.locator(".brandingPreviewTop strong")).toHaveText("QA Academy Beta");
 await page.getByLabel("Choose organization").selectOption(A);
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
});
test("extracts color from a real PNG and uploads before saving",async({page})=>{
 const api=await mockApi(page);
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Upload organization logo").setInputFiles({
  name:"school-logo.png",mimeType:"image/png",buffer:png(30,120,210)
 });
 await expect(page.getByText(/Brand colors detected/)).toBeVisible();
 await expect(page.getByLabel("primary color")).toHaveValue("#1e78d2");
 await page.getByRole("button",{name:"Save branding"}).click();
 await expect(page.getByText(/Branding saved for QA Academy Alpha/)).toBeVisible();
 expect(api.counts()).toEqual({uploads:1,saves:1});
 await page.reload();
 await expect(page.getByLabel("primary color")).toHaveValue("#1e78d2");
});
test("invalid image cannot be saved as an uploaded file",async({page})=>{
 const api=await mockApi(page);
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Upload organization logo").setInputFiles({
  name:"broken.png",mimeType:"image/png",buffer:Buffer.from("this is not an image")
 });
 await expect(page.locator(".brandingError")).toBeVisible();
 await expect(page.getByRole("button",{name:"Save branding"})).toBeDisabled();
 expect(api.counts().uploads).toBe(0);
});
test("API denial is shown without pretending branding is saved",async({page})=>{
 const api=await mockApi(page,{rejectSave:true});
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Tagline").fill("Rejected branding");
 await page.getByRole("button",{name:"Save branding"}).click();
 await expect(page.locator(".brandingError")).toContainText("Not authorized");
 await expect(page.getByText(/Branding saved for/)).toHaveCount(0);
 expect(api.records[A].tagline).toBe("Alpha learning");
});
test("mobile viewport keeps all editor controls and live preview accessible",async({page})=>{
 await mockApi(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await expect(page.locator(".brandingPreview")).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test("failed upload never changes persisted branding or invokes save",async({page})=>{
 const api=await mockApi(page,{rejectUpload:true});
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Upload organization logo").setInputFiles({
  name:"qa-logo.png",mimeType:"image/png",buffer:png(30,120,210)
 });
 await expect(page.getByText(/Brand colors detected/)).toBeVisible();
 await page.getByRole("button",{name:"Save branding"}).click();
 await expect(page.locator(".brandingError")).toContainText("Upload denied");
 expect(api.counts()).toEqual({uploads:1,saves:0});
 expect(api.records[A].logoUrl).toBe("");
 await page.getByRole("button",{name:"Reset changes"}).click();
 await expect(page.getByRole("button",{name:"Save branding"})).toBeDisabled();
});
test("reset discards unsaved identity changes",async({page})=>{
 await mockApi(page);
 await page.goto("/qa-branding-preview");
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await page.getByLabel("Tagline").fill("Scratch Academy");
 await page.getByRole("button",{name:"Reset changes"}).click();
 await expect(page.getByLabel("Tagline")).toHaveValue("Alpha learning");
 await expect(page.getByRole("button",{name:"Save branding"})).toBeDisabled();
});
