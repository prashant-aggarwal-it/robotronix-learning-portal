import {test,expect} from "@playwright/test";
import {buildWorkbookBytes} from "../lib/export-workbook";

function entries(data:Uint8Array):Map<string,string>{
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength),decoder=new TextDecoder();
 const files=new Map<string,string>();let offset=0;
 while(offset<data.length && view.getUint32(offset,true)===0x04034b50){
  const size=view.getUint32(offset+18,true);
  const nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  const name=decoder.decode(data.slice(offset+30,offset+30+nameLength));
  const begin=offset+30+nameLength+extra;
  files.set(name,decoder.decode(data.slice(begin,begin+size)));
  offset=begin+size;
 }
 expect(files.size).toBeGreaterThan(0);
 expect(view.getUint32(offset,true)).toBe(0x02014b50);
 return files;
}
test.describe("Export-only XLSX safety and compatibility",()=>{
 test("creates a standard multi-sheet workbook ZIP with required OOXML entries",()=>{
  const bytes=buildWorkbookBytes([{name:"Students",rows:[{Name:"A",Hours:12}]},{name:"Enrollment History",rows:[{Status:"active"}]}]);
  const result=entries(bytes);
  for(const name of ["[Content_Types].xml","_rels/.rels","xl/workbook.xml",
   "xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml","xl/worksheets/sheet2.xml"])
   expect(result.has(name),name).toBe(true);
  expect(result.get("xl/workbook.xml")).toContain('sheet name="Enrollment History"');
  expect(result.get("xl/worksheets/sheet1.xml")).toContain('<v>12</v>');
 });
 test("treats suspicious formula-looking input as literal text",()=>{
  const xml=entries(buildWorkbookBytes([{name:"Test",rows:[{Student:"=1+1",Unsafe:"<script>&",Charge:"+CMD"}]}])).get("xl/worksheets/sheet1.xml")!;
  expect(xml).not.toContain("<f>");
  expect(xml).toContain("&apos;=1+1");
  expect(xml).toContain("&lt;script&gt;&amp;");
  expect(xml).toContain("&apos;+CMD");
 });
 test("sanitizes duplicate or invalid sheet names",()=>{
  const xml=entries(buildWorkbookBytes([{name:"Bad/Name",rows:[]},{name:"Bad/Name",rows:[]}])).get("xl/workbook.xml")!;
  expect(xml).toContain('name="Bad Name"');
  expect(xml).toContain('name="Bad Name 2"');
 });
 test("rejects empty workbook and excessive sheets",()=>{
  expect(()=>buildWorkbookBytes([])).toThrow();
  expect(()=>buildWorkbookBytes(Array.from({length:101},(_,i)=>({name:"Sheet "+i,rows:[]})))).toThrow();
 });
});
