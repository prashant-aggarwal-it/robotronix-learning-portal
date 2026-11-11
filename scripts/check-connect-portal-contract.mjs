import fs from "node:fs";
import assert from "node:assert/strict";

const contract=JSON.parse(fs.readFileSync(new URL("../docs/connect/contracts/portal-integration-v1.json",import.meta.url),"utf8"));
const openapi=JSON.parse(fs.readFileSync(new URL("../docs/connect/contracts/portal-integration-openapi-v1.json",import.meta.url),"utf8"));
assert.equal(openapi.openapi,"3.1.0");
assert.equal(openapi.info.version,contract.contractVersion);
assert.equal(contract.scope,"edtech");
assert.equal(contract.status,"design-only-not-deployed");
assert.equal(contract.independence.connectRequiresPortal,false);
assert.equal(contract.independence.portalRequiresConnect,false);
assert.ok(contract.operations.length>=7);
assert.equal(new Set(contract.operations.map(op=>op.id)).size,contract.operations.length);
assert.ok(contract.requiredRequestHeaders.includes("X-Correlation-Id"));
assert.ok(contract.mutationHeaders.includes("Idempotency-Key"));
for(const op of contract.operations){
 assert.equal(op.authority,"portal");
 assert.equal(op.idempotent,true);
 assert.ok(contract.accessScopes.includes(op.scope));
 const definition=openapi.paths[op.path]?.[op.method.toLowerCase()];
 assert.ok(definition,`${op.id} missing from OpenAPI`);
 assert.ok(definition.responses["200"]||definition.responses["202"]);
 if(op.method==="POST"){
  assert.ok(op.requiredBody.includes("requestId"));
  if(op.id!=="demo.book"&&op.id!=="enrollment.handoff")assert.ok(op.requiredBody.includes("expectedVersion"));
 }
}
const states=new Set(contract.demoStates);
assert.equal(states.size,contract.demoStates.length);
for(const [from,targets] of Object.entries(contract.demoTransitions)){
 assert.ok(states.has(from));
 for(const to of targets)assert.ok(states.has(to),`${from} -> ${to} not defined`);
}
for(const terminal of ["completed","rejected","cancelled","no_show"]){
 assert.deepEqual(contract.demoTransitions[terminal],[]);
}
assert.equal(contract.eventEnvelope.delivery,"at-least-once");
assert.deepEqual(contract.eventEnvelope.deduplicateBy,["connectionId","eventId"]);
assert.equal(contract.eventEnvelope.orderWithinSubjectBy,"subjectVersion");
assert.ok(contract.events.includes("EnrollmentConfirmed"));
assert.ok(contract.privacy.excludedFromTrainerView.includes("crmSalesNotes"));
assert.match(contract.recordLinks.identityRule,/never-phone-only/);
assert.equal(contract.goLive.requiresAuthenticatedUat,true);
console.log("Connect ↔ Portal v1 architecture contract checks OK (design only; no HTTP implementation).");
