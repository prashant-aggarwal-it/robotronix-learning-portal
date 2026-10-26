import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'database/01_install/01_CREATE_SCHEMA.sql');
const referencePath = path.join(root, 'database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql');
const observabilityPath = path.join(root, 'database/05_features/operational_logging.sql');
const observability = fs.readFileSync(observabilityPath, 'utf8').trimEnd();
const targetPath = path.join(root, 'database/generated/ROBOTRONIX_FRESH_INSTALL.sql');

const schema = fs.readFileSync(schemaPath, 'utf8').trimEnd();
const reference = fs.readFileSync(referencePath, 'utf8').trimEnd();
if (!schema || !reference || !observability) throw new Error('Canonical schema/reference SQL is empty.');

const output = [
  '-- ROBOTRONIX FRESH INSTALL — GENERATED. NEW, EMPTY SUPABASE PROJECT ONLY.',
  '-- Execute this entire file once in Supabase SQL Editor.',
  '-- Do not run on an existing database. Admin identity bootstrap is separate and conditional.',
  '-- Source: 01_CREATE_SCHEMA.sql + 02_INSERT_MASTER_REFERENCE_DATA.sql + 05_features/operational_logging.sql',
  '',
  '-- PART 1: SCHEMA',
  schema,
  '',
  '-- PART 2: MASTER REFERENCE DATA',
  reference,
  '',
  '-- PART 3: OPERATIONAL LOGGING MODULE',
  observability,
  '',
].join('\n');

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, output, 'utf8');
const actual = fs.readFileSync(targetPath, 'utf8');
if (actual !== output) throw new Error('Generated SQL verification failed.');
console.log(`Generated one-shot fresh installer: ${path.relative(root, targetPath)}`);
console.log('Run ONLY on a new, empty database; then run 03_verify/01_VERIFY_RELEASE.sql.');
