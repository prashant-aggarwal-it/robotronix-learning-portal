/** Minimal, export-only OOXML workbook writer. No spreadsheet parsing or eval. */
export type WorkbookSheet={name:string;rows:Array<Record<string,unknown>>};

const encoder=new TextEncoder();
function cleanText(value:unknown):string{
 const text=String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,"");
 // Defense in depth for spreadsheet formula injection if exports are re-imported.
 return /^[=+\-@\t\r]/.test(text)?"'"+text:text;
}
function xml(s:string):string{
 return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function colName(index:number):string{
 let name="";for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;
}
function cell(ref:string,value:unknown):string{
 if(value===null||value===undefined)return "";
 if(typeof value==="number"&&Number.isFinite(value))
  return '<c r="'+ref+'"><v>'+String(value)+'</v></c>';
 if(typeof value==="boolean")return '<c r="'+ref+'" t="b"><v>'+(value?"1":"0")+'</v></c>';
 return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(cleanText(value))+'</t></is></c>';
}
const spreadsheetNs="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const officeRel="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRel="http://schemas.openxmlformats.org/package/2006/relationships";
function sheetXml(rows:Array<Record<string,unknown>>):string{
 const actual=rows.length?rows:[{Status:"No records"}];
 if(actual.length>100000)throw new Error("Excel export exceeds supported row limit");
 const columns=Object.keys(actual[0]);
 if(columns.length>256)throw new Error("Excel export exceeds supported column limit");
 const lines=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<worksheet xmlns="'+spreadsheetNs+'"><sheetViews><sheetView workbookViewId="0"/></sheetViews>',
  '<sheetFormatPr defaultRowHeight="15"/>','<sheetData>'];
 const all=[Object.fromEntries(columns.map(key=>[key,key])),...actual];
 for(let i=0;i<all.length;i++){
  const row=all[i];const items=['<row r="'+(i+1)+'">'];
  for(let j=0;j<columns.length;j++)items.push(cell(colName(j)+(i+1),row[columns[j]]));
  items.push("</row>");lines.push(items.join(""));
 }
 lines.push("</sheetData></worksheet>");return lines.join("");
}
const CRC_TABLE=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRC_TABLE[i]=c>>>0}
function crc32(bytes:Uint8Array):number{let c=0xFFFFFFFF;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function header(size:number){return new Uint8Array(size)}
function write16(b:Uint8Array,at:number,n:number){b[at]=n&255;b[at+1]=(n>>>8)&255}
function write32(b:Uint8Array,at:number,n:number){write16(b,at,n);write16(b,at+2,n>>>16)}
function concat(parts:Uint8Array[]):Uint8Array{
 const length=parts.reduce((n,v)=>n+v.length,0);const result=new Uint8Array(length);let i=0;
 for(const part of parts){result.set(part,i);i+=part.length}return result;
}
function storedZip(files:Array<{name:string;content:string}>):Uint8Array{
 if(files.length>1000)throw new Error("Too many workbook files");
 const local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const f of files){
  const name=encoder.encode(f.name),bytes=encoder.encode(f.content),crc=crc32(bytes);
  if(name.length>65535||bytes.length>0xFFFFFFFF)throw new Error("Excel export entry too large");
  const lh=header(30);write32(lh,0,0x04034b50);write16(lh,4,20);write16(lh,6,0x0800);
  write32(lh,14,crc);write32(lh,18,bytes.length);write32(lh,22,bytes.length);write16(lh,26,name.length);
  local.push(lh,name,bytes);
  const ch=header(46);write32(ch,0,0x02014b50);write16(ch,4,20);write16(ch,6,20);write16(ch,8,0x0800);
  write32(ch,16,crc);write32(ch,20,bytes.length);write32(ch,24,bytes.length);write16(ch,28,name.length);write32(ch,42,offset);
  central.push(ch,name);offset+=lh.length+name.length+bytes.length;
 }
 const directory=concat(central),end=header(22);write32(end,0,0x06054b50);
 write16(end,8,files.length);write16(end,10,files.length);write32(end,12,directory.length);write32(end,16,offset);
 return concat([...local,directory,end]);
}
function sheetName(input:string,index:number,used:Set<string>):string{
 const base=(input||"Sheet "+index).replace(/[\\[\\]*?:\\/\\\\]/g," ").slice(0,31).trim()||"Sheet "+index;
 let name=base;let n=2;while(used.has(name.toLowerCase()))name=base.slice(0,Math.max(1,31-String(n).length-1))+" "+n++;
 used.add(name.toLowerCase());return name;
}
/** Pure helper enables archive/XML regression tests without triggering downloads. */
export function buildWorkbookBytes(sheets:WorkbookSheet[]):Uint8Array{
 if(!sheets.length)throw new Error("Export must contain at least one worksheet");
 if(sheets.length>100)throw new Error("Too many worksheets");
 const used=new Set<string>(),files:Array<{name:string;content:string}>=[];
 const names=sheets.map((s,i)=>sheetName(s.name,i+1,used));
 const types=['<?xml version="1.0" encoding="UTF-8"?>',
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
  '<Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
 const workbook=['<?xml version="1.0" encoding="UTF-8"?>',
  '<workbook xmlns="'+spreadsheetNs+'" xmlns:r="'+officeRel+'"><sheets>'];
 const relationships=['<?xml version="1.0" encoding="UTF-8"?>','<Relationships xmlns="'+packageRel+'">'];
 sheets.forEach((sheet,i)=>{
  const n=i+1;
  types.push('<Override PartName="/xl/worksheets/sheet'+n+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
  workbook.push('<sheet name="'+xml(names[i])+'" sheetId="'+n+'" r:id="rId'+n+'"/>');
  relationships.push('<Relationship Id="rId'+n+'" Type="'+officeRel+'/worksheet" Target="worksheets/sheet'+n+'.xml"/>');
  files.push({name:"xl/worksheets/sheet"+n+".xml",content:sheetXml(sheet.rows)});
 });
 workbook.push("</sheets></workbook>");
 relationships.push('<Relationship Id="rId'+(sheets.length+1)+'" Type="'+officeRel+'/styles" Target="styles.xml"/>','</Relationships>');
 types.push("</Types>");
 files.push({name:"[Content_Types].xml",content:types.join("")});
 files.push({name:"_rels/.rels",content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+packageRel+'"><Relationship Id="rId1" Type="'+officeRel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
 files.push({name:"xl/workbook.xml",content:workbook.join("")});
 files.push({name:"xl/_rels/workbook.xml.rels",content:relationships.join("")});
 files.push({name:"xl/styles.xml",content:'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="'+spreadsheetNs+'"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'});
 return storedZip(files);
}
export async function exportWorkbook(filename:string,sheets:WorkbookSheet[]):Promise<void>{
 const data=buildWorkbookBytes(sheets);
 const blob=new Blob([new Uint8Array(data)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename.endsWith(".xlsx")?filename:filename+".xlsx";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
