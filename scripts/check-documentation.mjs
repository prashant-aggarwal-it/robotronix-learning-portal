import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scripts = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts ?? {}));
const files = ['README.md', 'OPERATIONS_WORKFLOW_GUIDE.md', 'ENROLLMENT-INVOICE-WORKFLOW.md'];
function collect(directory) {
  for (const name of fs.readdirSync(directory)) {
    const full = path.join(directory, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== 'archive') collect(full);
    } else if (name.toLowerCase().endsWith('.md')) {
      files.push(path.relative(root, full));
    }
  }
}
collect(path.join(root, 'docs'));
files.push('database/README.md');

const errors = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const destination = match[1].trim().split(/\s+"/)[0].split('#')[0];
    if (!destination || /^(https?:|mailto:|tel:|data:|\/)/i.test(destination)) continue;
    const target = path.resolve(root, path.dirname(file), decodeURIComponent(destination));
    if (!fs.existsSync(target)) errors.push(`${file}: broken link ${destination}`);
  }
  for (const match of source.matchAll(/npm run ([a-z][a-z0-9:_-]*)/gi)) {
    if (!scripts.has(match[1])) errors.push(`${file}: nonexistent npm script ${match[1]}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed: ${files.length} maintained Markdown files; relative links and npm scripts resolve.`);
}
