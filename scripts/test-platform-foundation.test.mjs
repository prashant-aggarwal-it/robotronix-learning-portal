#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync('database/platform/01_additive_foundation.sql','utf8');
test('additive foundation cannot redefine or delete legacy business objects',()=>{
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE\s+FROM|CREATE\s+OR\s+REPLACE\s+FUNCTION)\b/i);
 assert.doesNotMatch(sql,/\bALTER\s+TABLE\s+(?:public|connect|tasks)\./i);
 for(const name of ['organizations','organization_memberships','product_entitlements'])
  assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS platform\\.'+name,'i'));
});
test('all new tables have RLS enabled, with no accidental permissive policies',()=>{
 for(const name of ['organizations','organization_memberships','product_entitlements'])
  assert.match(sql,new RegExp('ALTER TABLE platform\\.'+name+' ENABLE ROW LEVEL SECURITY','i'));
 assert.doesNotMatch(sql,/\bCREATE\s+POLICY\b/i);
 assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM PUBLIC, anon, authenticated/i);
});
test('memberships reference actual auth identities and cannot duplicate org/user',()=>{
 assert.match(sql,/user_id uuid NOT NULL REFERENCES auth\.users\(id\)/i);
 assert.match(sql,/PRIMARY KEY \(organization_id,user_id\)/);
 assert.match(sql,/PRIMARY KEY \(organization_id,product_id\)/);
});
test('tenant status and entitlement state use closed allowlists',()=>{
 assert.match(sql,/status IN \('active','suspended','archived'\)/);
 assert.match(sql,/role IN \('owner','admin','manager','member','viewer'\)/);
 assert.match(sql,/product_id IN \('portal','crm','tasks'\)/);
});
test('existing role, workspace and product routes still have explicit test coverage',()=>{
 const routing=readFileSync('lib/platform/auth-routing.ts','utf8');
 const deployment=readFileSync('lib/platform/deployment.test.mjs','utf8');
 for(const word of ['admin','trainer','parent','student','crm','tasks'])
  assert.ok(routing.toLowerCase().includes(word), 'missing auth route role/product '+word);
 for(const word of ['portal','crm','tasks','combined'])
  assert.ok(deployment.toLowerCase().includes(word), 'missing deployment coverage '+word);
});
