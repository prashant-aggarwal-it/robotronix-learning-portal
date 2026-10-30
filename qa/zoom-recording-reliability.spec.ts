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
