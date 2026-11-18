import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {generatePalette,paletteFromPixels,validatePublicLogoUrl} from "../lib/theme/logo-palette.ts";
import {hasReadableContrast} from "../lib/theme/tokens.ts";
import {detectRasterLogo,MAX_LOGO_BYTES} from "../lib/theme/logo-file-validation.ts";
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
 assert.deepEqual(a,b);assert.equal(a.primary,"#242424");
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
 assert.equal(white.onPrimary,"#14213d");
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
 assert.match(upload,/authorizeBranding/);assert.match(upload,/detectRasterLogo/);assert.match(upload,/MAX_LOGO_BYTES/);
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

test("reject missing, mismatched, truncated and oversized image files",()=>{
 assert.equal(detectRasterLogo(new Uint8Array([]),"image/png"),null);
 assert.equal(detectRasterLogo(new Uint8Array(34),"image/png"),null);
 assert.equal(detectRasterLogo(new Uint8Array(MAX_LOGO_BYTES+1),"image/jpeg"),null);
 const truncatedPng=new Uint8Array([137,80,78,71,13,10,26,10]);
 assert.equal(detectRasterLogo(truncatedPng,"image/png"),null);
});
test("accept a well-formed PNG header with reasonable dimensions and reject huge image",()=>{
 const png=new Uint8Array(64);png.set([137,80,78,71,13,10,26,10]);png.set([73,72,68,82],12);
 const view=new DataView(png.buffer);view.setUint32(16,1200);view.setUint32(20,600);
 assert.equal(detectRasterLogo(png,"image/png")?.mime,"image/png");
 assert.equal(detectRasterLogo(png,"image/jpeg"),null);
 view.setUint32(16,40000);assert.equal(detectRasterLogo(png,"image/png"),null);
});

test("large dark wordmark does not overwhelm smaller vivid logo icon",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:240},()=>[7,23,42,255]),
  ...Array.from({length:55},()=>[100,56,213,255]),
  ...Array.from({length:35},()=>[7,174,247,255]),
  ...Array.from({length:30},()=>[178,14,232,255])
 ]));
 assert.notEqual(p.primary,"#07172a");
 assert.ok([p.primary,p.secondary,p.accent].some(c=>c==="#6438d5"));
 assert.ok(hasReadableContrast(p.onPrimary,p.primary));
});
test("monochrome logo remains neutral and transparent pixels are ignored",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:60},()=>[34,34,34,255]),
  ...Array.from({length:60},()=>[255,0,0,0]),
  ...Array.from({length:60},()=>[255,255,255,255])
 ]));
 assert.equal(p.primary,"#222222");assert.equal(p.secondary,"#222222");
});
test("gradient shades do not fill all three suggestions with duplicates",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:30},()=>[86,48,202,255]),
  ...Array.from({length:30},()=>[98,54,212,255]),
  ...Array.from({length:30},()=>[113,60,223,255]),
  ...Array.from({length:24},()=>[0,176,231,255]),
  ...Array.from({length:24},()=>[220,15,183,255])
 ]));
 assert.notEqual(p.primary,p.secondary);assert.notEqual(p.secondary,p.accent);
});

test("vivid logo accents outrank a large dark wordmark in all three slots",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:260},()=>[8,23,43,255]),
  ...Array.from({length:60},()=>[8,161,247,255]),
  ...Array.from({length:45},()=>[168,18,226,255]),
  ...Array.from({length:20},()=>[232,12,151,255])
 ]));
 const colors=[p.primary,p.secondary,p.accent];
 assert.ok(colors.includes("#08a1f7"));
 assert.ok(colors.includes("#a812e2"));
 assert.ok(colors.includes("#e80c97"));
 assert.ok(!colors.includes("#08172b"));
});
test("two vivid colors do not get a dark wordmark as invented accent",()=>{
 const p=paletteFromPixels(pixels([
  ...Array.from({length:180},()=>[8,23,43,255]),
  ...Array.from({length:40},()=>[8,161,247,255]),
  ...Array.from({length:30},()=>[168,18,226,255])
 ]));
 assert.notEqual(p.primary,"#08172b");
 assert.notEqual(p.secondary,"#08172b");
 assert.notEqual(p.accent,"#08172b");
});

test("palette selection uses contrast-safe navy for bright primary and white for deep primary",()=>{
 const blue=generatePalette("#08a1f7","#a812e2","#2858f5");
 assert.equal(blue.onPrimary,"#14213d");
 assert.ok(hasReadableContrast(blue.onPrimary,blue.primary));
 const dark=generatePalette("#22115e");
 assert.equal(dark.onPrimary,"#ffffff");
});

test("Branding Studio preview uses full-scale legible controls and adapts to narrow screens",()=>{
 const css=read("features/branding/branding-studio.css");
 assert.match(css,/Phase 5B\.2/);
 assert.match(css,/\.brandingPreviewNav\{font-size:12px/);
 assert.match(css,/\.brandingPreviewTop strong\{font-size:18px/);
 assert.match(css,/\.brandingPreviewKpis strong\{font-size:24px/);
 assert.match(css,/\.brandingPreviewInput input\{font-size:13px;min-height:43px/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/background:var\(--brand-primary\);color:var\(--brand-on-primary\)/);
 const ui=read("features/branding/BrandingStudio.tsx");
 assert.match(ui,/className="brandingPreview"/);
 assert.match(ui,/style=\{previewStyle\}/);
});
