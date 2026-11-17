import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ROBOTRONIX_THEME,BRAND_TOKEN_KEYS,normalizeHexColor,contrastRatio,hasReadableContrast,resolveTenantTheme,themeToCssVariables} from "../lib/theme/tokens.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("default Robotronix colors and WCAG contrast",()=>{
 assert.equal(ROBOTRONIX_THEME.primary,"#6d3cc9");
 assert.ok(contrastRatio("#000000","#ffffff")>20.9);
 assert.equal(hasReadableContrast("#ffffff","#ffffff"),false);
 assert.equal(hasReadableContrast("#ffffff","#000000"),true);
});
test("strict hex parsing prevents arbitrary CSS injection",()=>{
 assert.equal(normalizeHexColor("#ABC"),"#aabbcc");
 assert.equal(normalizeHexColor(" #Aa12Ff "),"#aa12ff");
 for(const x of ["red","var(--x)","url(javascript:1)","#1234","#GGGGGG",{},null])assert.equal(normalizeHexColor(x),null);
});
test("invalid and incomplete themes safely fall back",()=>{
 const empty=resolveTenantTheme({});
 assert.deepEqual(empty,ROBOTRONIX_THEME);
 const valid=resolveTenantTheme({secondary:"#123",primary:"bad"});
 assert.equal(valid.secondary,"#112233");
 assert.equal(valid.primary,ROBOTRONIX_THEME.primary);
 const contrast=resolveTenantTheme({primary:"#ffffff",onPrimary:"#ffffff"});
 assert.ok(hasReadableContrast(contrast.onPrimary,contrast.primary));
});
test("CSS export includes every approved token and never unknown keys",()=>{
 const tokens=themeToCssVariables({primary:"#0a0a0a",unknown:"url(javascript:1)"});
 assert.equal(Object.keys(tokens).length,6);
 assert.equal(tokens["--brand-primary"],"#0a0a0a");
 assert.deepEqual(Object.keys(tokens).sort(),Object.values(BRAND_TOKEN_KEYS).sort());
});
test("canonical design token stylesheet is loaded before compatibility layers",()=>{
 const layout=read("app/layout.tsx");
 assert.ok(layout.indexOf("./design-tokens.css")<layout.indexOf("./globals.css"));
 const css=read("app/design-tokens.css");
 for(const variable of ["--brand-primary","--brand-primary-hover","--brand-primary-soft","--brand-secondary","--brand-accent","--brand-on-primary","--app-background","--app-surface","--app-surface-muted","--app-border","--app-text","--app-text-muted","--app-text-on-brand","--nav-background","--nav-text","--nav-active-background","--nav-active-text","--button-primary-background","--button-primary-hover","--button-primary-text","--card-background","--card-border","--input-border","--input-focus-ring","--state-success","--state-warning","--state-error","--state-info"])
  assert.ok(css.includes(variable+":"),variable);
});
test("existing themes and module-level baselines remain available",()=>{
 assert.match(read("app/theme.css"),/data-portal-theme="ai-flow"/);
 assert.match(read("components/ThemeSwitcher.tsx"),/classic/);
 assert.match(read("app/connect/connect.css"),/var\(--product-accent/);
 assert.match(read("app/tasks/v2/v2.css"),/var\(--product-primary/);
 assert.match(read("app/platform-admin/platform-admin.css"),/var\(--nav-background/);
 assert.match(read("app/suite-shell.css"),/var\(--input-focus-ring/);
});

test("major workspace tokens retain equivalent existing paint values",()=>{
 const css=read("app/design-tokens.css");
 const checks=[
 ["--product-focus-ring","#62bed7"],
 ["--product-nav-active-start","#e6f5fc"],
 ["--product-nav-active-end","#eff6fc"],
 ["--platform-focus-ring","#bb9aef"],
 ["--platform-action-start","#7142d2"]
 ];
 for(const [token,value] of checks)assert.ok(css.includes(token+":"+value),token);
 assert.match(read("app/tasks/product-experience.css"),/var\(--product-nav-active-start\)/);
 assert.match(read("app/connect/connect.css"),/var\(--product-focus-ring\)/);
 assert.match(read("app/platform-admin/platform-admin.css"),/var\(--platform-action-start\)/);
});

test("Phase 5A preserves original CRM, Tasks and Platform Admin colors",()=>{
 const tokens=read("app/design-tokens.css");
 for(const pair of [
  "--product-success:#128764","--product-primary:#147cad",
  "--product-navigation-primary:#237cb5","--platform-nav-border:#eee9f5",
  "--platform-nav-hover:#f6f1ff"
 ])assert.ok(tokens.includes(pair),pair);
 assert.match(read("app/connect/connect.css"),/--cx-green:var\(--product-success,#128764\)/);
 assert.match(read("app/tasks/v2/v2.css"),/--mt2-blue:var\(--product-navigation-primary,#237cb5\)/);
 assert.match(read("app/tasks/product-experience.css"),/--mt2-brand:var\(--product-primary,#147cad\)/);
 assert.match(read("app/platform-admin/platform-admin.css"),/var\(--platform-nav-border,#eee9f5\)/);
});
