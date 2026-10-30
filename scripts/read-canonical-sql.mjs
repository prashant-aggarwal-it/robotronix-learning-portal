import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('database/01_install/modules');
export function readCanonicalSql(group='schema'){
 const dir=path.join(base,group);
 const names=fs.readdirSync(dir).filter(n=>/^\d\d_[a-z0-9_]+\.sql$/.test(n)).sort();
 if(!names.length)throw new Error('Canonical SQL modules missing: '+dir);
 return names.map(n=>fs.readFileSync(path.join(dir,n),'utf8')).join('');
}
