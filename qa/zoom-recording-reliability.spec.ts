import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const source=(path:string)=>readFileSync(path,"utf8");

test.describe("Zoom recording resilience contracts (offline)",()=>{
 test("media URL uses current host access token rather than a stale embedded one",()=>{
  const zoom=source("lib/server/zoom.ts");
  expect(zoom).toContain('target.searchParams.set("access_token",token)');
  expect(zoom).not.toContain('if(!target.searchParams.has("access_token"))');
  expect(zoom).toContain('target.protocol!=="https:"');
 });
 test("rotating OAuth refresh tokens require a distributed expiring lease",()=>{
  const zoom=source("lib/server/zoom.ts");
  const schema=source("database/01_install/modules/schema/08_operational_logging.sql");
  expect(zoom).toContain('acquire_zoom_refresh_lease');
  expect(zoom).toContain('release_zoom_refresh_lease');
  expect(zoom).toContain('refresh_token_encrypted",current.refresh_token_encrypted');
  expect(schema).toContain('zoom_refresh_leases');
  expect(schema).toContain('on conflict(host_id) do update');
 });
 test("authorized playback viewer refreshes a failed stream without exposing provider URL",()=>{
  const viewer=source("app/recordings/[recordingId]/page.tsx");
  const actions=source("components/ZoomClassActions.tsx");
  expect(viewer).toContain('portalApi("/api/zoom/recordings/"');
  expect(viewer).toContain('automaticRetryUsed');
  expect(viewer).toContain('resumeAt.current');
  expect(actions).toContain('"/recordings/"+encodeURIComponent');
 });
 test("partial deletion retries only the local status update",()=>{
  const route=source("app/api/zoom/recordings/[recordingId]/route.ts");
  const webhook=source("app/api/zoom/webhook/route.ts");
  expect(route).toContain('for(let attempt=0;attempt<3;attempt++)');
  expect(route).toContain('Remote trash succeeded but local status update failed.');
  expect(webhook).toContain('.in("zoom_recording_file_id",fileIds)');
 });
 test("reconciliation refreshes provider metadata without changing local deletion policy",()=>{
  const sourceCode=source("lib/server/zoom-recording-reconcile.ts");
  expect(sourceCode).toContain('select("id,status").eq("zoom_recording_file_id",fileId)');
  expect(sourceCode).toContain('existing.status!=="completed"');
  expect(sourceCode).toContain('download_url:row.download_url');
  expect(sourceCode).toContain('.eq("id",existing.id).eq("status","completed")');
  expect(sourceCode).not.toContain("update({...row");
 });
 test("streaming rejects provider login pages disguised as successful downloads",()=>{
  const stream=source("app/api/zoom/recordings/[recordingId]/stream/route.ts");
  expect(stream).toContain('ZOOM_STREAM_NON_MEDIA');
  expect(stream).toContain('mediaType.includes("text/html")');
  expect(stream).toContain('mediaType.includes("application/json")');
 });
 test("deletion is protected, stage-tracked and distinguishes provider from ledger errors",()=>{
  const route=source("app/api/zoom/recordings/[recordingId]/route.ts");
  expect(route).toContain('recording.protected_from_deletion');
  expect(route).toContain('stage="zoom-trash"');
  expect(route).toContain('stage="save-deleted-status"');
  expect(route).toContain('referenceId=await logSystemEvent');
  expect(route).toContain("error instanceof ZoomApiError");
  expect(route).toContain('"_HTTP_"+upstreamStatus');
 });
});
