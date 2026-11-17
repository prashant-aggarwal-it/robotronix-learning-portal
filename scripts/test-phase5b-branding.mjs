import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {generatePalette,paletteFromPixels,validatePublicLogoUrl} from "../lib/theme/logo-palette.ts";
import {hasReadableContrast} from "../lib/theme/tokens.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pixels=(a)=>new Uint8ClampedArray(a.flat());
test("detect prominent brand color without counting transparent or white background",()=>{
 const samples=[...Array.from({length:30},()=>[255,255,255,255]),...Array.from({length:20},()=>[30,120,210,255]),...Array.from({length:8},()=>[255,0,0,0])];
 const p=paletteFromPixels(pixels(samples));
 assert.equal(p.primary,"#1e78d2");
 assert.ok(hasReadableContrast(p.onPrimary,p.primary));
});
test("brand logo monochrome produces deterministic accessible default",()=>{
 const sample=pixels(Array.from({length:25},()=>[255,255,255,255]));
 const a=paletteFromPixels(sample),b=paletteFromPixels(sample);
 assert.deepEqual(a,b);assert.equal(a.primary,"#6d3cc9");
});
test("three brand hues produce usable palette",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:30},()=>[15,75,190,255]),
  ...Array.from({length:22},()=>[240,75,105,255]),
  ...Array.from({length:16},()=>[5,175,140,255])
 ]));
 assert.match(p.primary,/^#[0-9a-f]{6}$/);assert.match(p.secondary,/^#[0-9a-f]{6}$/);
 assert.notEqual(p.primary,p.secondary);assert.ok(hasReadableContrast(p.onPrimary,p.primary));
});
test("brightness contrast and safe manual overrides",()=>{
 const white=generatePalette("#ffffff","#123abc","#ff8844");
 assert.equal(white.onPrimary,"#000000");
 const deep=generatePalette("#100040");
 assert.equal(deep.onPrimary,"#ffffff");
});
test("logo URL validation rejects scripts, credentials, external protocols and queries",()=>{
 for(const bad of ["javascript:alert(1)","http://example.com/logo.png","https://a:b@foo.test/a.png","https://example.com/a.png?test=1"])assert.equal(validatePublicLogoUrl(bad),false,bad);
 assert.equal(validatePublicLogoUrl("https://static.example.com/logo.png"),true);
});
test("Branding Studio has server-side actor authorization, isolated preview, and accessible file controls",()=>{
 const route=read("app/api/branding-studio/route.ts"),upload=read("app/api/branding-studio/upload/route.ts");
 assert.match(route,/authorizeBranding/);assert.match(route,/saas_branding_save_v1/);
 assert.match(upload,/authorizeBranding/);assert.match(upload,/image\/png/);assert.match(upload,/MAX=3\*1024\*1024/);
 const ui=read("features/branding/BrandingStudio.tsx");
 assert.match(ui,/role="alert"/);assert.match(ui,/brandingPreview/);assert.match(ui,/detectLogoPalette/);
 assert.ok(!ui.includes("document.documentElement.style"));
});
test("branding RPC migration forbids anonymous access and restricts writes to exact organization",()=>{
 const sql=read("database/saas/73_phase5b_branding_rpc.sql");
 assert.match(sql,/revoke all on function public.saas_branding_save_v1/);
 assert.match(sql,/saas_branding_access_v1\(p_actor,p_org\)/);
 assert.match(sql,/organization_id,setting_key/);
});
