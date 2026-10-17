export type WorkbookSheet={name:string;rows:Array<Record<string,unknown>>};

function safeCell(value:unknown){
 if(value===null||value===undefined)return "";
 if(typeof value==="string"&&/^[=+\-@]/.test(value))return "'"+value;
 return value;
}

function safeRows(rows:Array<Record<string,unknown>>){
 return rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,safeCell(v)])));
}

function widths(rows:Array<Record<string,unknown>>){
 const keys=Object.keys(rows[0]||{});
 return keys.map(key=>({wch:Math.min(44,Math.max(12,key.length+2,...rows.slice(0,300).map(r=>String(r[key]??"").length+2)))}));
}

export async function exportWorkbook(filename:string,sheets:WorkbookSheet[]){
 const XLSX=await import("xlsx");
 const wb=XLSX.utils.book_new();
 for(const sheet of sheets){
  const rows=safeRows(sheet.rows.length?sheet.rows:[{Status:"No records"}]);
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=widths(rows);
  XLSX.utils.book_append_sheet(wb,ws,sheet.name.slice(0,31));
 }
 XLSX.writeFile(wb,filename.endsWith(".xlsx")?filename:filename+".xlsx",{compression:true});
}
