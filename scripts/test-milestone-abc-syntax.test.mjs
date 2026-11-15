import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const files=[
 "app/signup/page.tsx",
 "app/login/page.tsx",
 "app/workspace/page.tsx",
 "app/invite/page.tsx",
 "app/invite/family/page.tsx",
 "app/workspace/invitations/page.tsx",
 "app/workspace/families/page.tsx",
 "app/workspace/trainers/page.tsx",
 "app/[academySlug]/family/page.tsx",
 "app/[academySlug]/manage/page.tsx",
 "app/[academySlug]/manage/records/page.tsx",
 "app/[academySlug]/trainer/page.tsx",
 "app/api/platform/academy-records/route.ts",
 "app/api/platform/invitations/route.ts",
 "app/api/platform/invitations/accept/route.ts",
 "app/api/platform/memberships/route.ts",
 "lib/platform/auth-client.ts",
 "lib/platform/auth-routing.ts"
];

test("All milestone A/B/C TypeScript and TSX entrypoints parse",()=>{
 for(const file of files){
  const source=readFileSync(file,"utf8");
  const result=ts.transpileModule(source,{
   fileName:file,
   reportDiagnostics:true,
   compilerOptions:{
    target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,
    jsx:ts.JsxEmit.Preserve
   }
  });
  const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+": "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; "));
 }
});
