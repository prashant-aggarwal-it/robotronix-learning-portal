import test from "node:test";
import assert from "node:assert/strict";
import {nextHistoryBatch} from "./connect-history-batches.ts";

test("splits large history across a stable cursor",()=>{
 const threads=[{id:"919999000002",messages:Array.from({length:423},(_,i)=>i)}];
 let cursor={threadIndex:0,messageIndex:0};const collected=[];
 for(let n=0;n<3;n++){
  const step=nextHistoryBatch(threads,cursor);
  collected.push(...step.messages);cursor=step.next;
 }
 assert.deepEqual(collected,threads[0].messages);
 assert.deepEqual(cursor,{threadIndex:1,messageIndex:0});
 assert.equal(nextHistoryBatch(threads,cursor).complete,true);
});
test("skips empty threads without losing the next contact",()=>{
 const step=nextHistoryBatch([{id:"919999000003",messages:[]},{id:"919999000004",messages:[1]}],
  {threadIndex:0,messageIndex:0});
 assert.equal(step.contact,"919999000004");assert.deepEqual(step.next,{threadIndex:2,messageIndex:0});
});
test("rejects invalid cursors and malformed contacts",()=>{
 assert.throws(()=>nextHistoryBatch([],{threadIndex:-1,messageIndex:0}),/BAD_HISTORY_PAYLOAD/);
 assert.throws(()=>nextHistoryBatch([],{threadIndex:1,messageIndex:0}),/BAD_HISTORY_PAYLOAD/);
 assert.throws(()=>nextHistoryBatch([{id:"bad",messages:[1]}],{threadIndex:0,messageIndex:0}),/BAD_HISTORY_PAYLOAD/);
});
