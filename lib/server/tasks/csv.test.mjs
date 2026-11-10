import test from "node:test";
import assert from "node:assert/strict";
import {parseCsv,sanitizeImportRow,createTasksCsv} from "./csv.ts";

test("CSV parses quoted commas, multiline notes, doubled quotes and CRLF",()=>{
 const rows=parseCsv('\uFEFFtitle,description\r\n"Call, parent","Line 1\nLine ""2"""\r\n');
 assert.deepEqual(rows,[["title","description"],["Call, parent",'Line 1\nLine "2"']]);
});
test("CSV rejects an unfinished quoted field",()=>assert.throws(()=>parseCsv('title\n"unfinished'),/Unclosed/));
test("Import has strict field allowlist and length bounds",()=>{
 assert.equal(sanitizeImportRow({title:" Contact school ",priority:"high"}).title,"Contact school");
 assert.throws(()=>sanitizeImportRow({title:"A",owner_user_id:"other-user"}),/Unknown/);
 assert.throws(()=>sanitizeImportRow({title:"A",status:"deleted"}),/Invalid/);
 assert.throws(()=>sanitizeImportRow({title:"A",scheduled_date:"tomorrow"}),/Scheduled date/);
 assert.throws(()=>sanitizeImportRow({title:"A",due_at:"2026-11-10T09:00"}),/timezone/);
});
test("Export escapes formulas and retains proper quotes",()=>{
 const csv=createTasksCsv([{title:"=IMPORTXML(1)",description:'hello "world"',priority:"medium",status:"todo"}]);
 assert.match(csv,/'=IMPORTXML/);assert.match(csv,/hello ""world""/);
 assert.equal(parseCsv(csv)[1][0],"'=IMPORTXML(1)");
});
