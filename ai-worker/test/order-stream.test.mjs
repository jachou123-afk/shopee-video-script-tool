import assert from "node:assert/strict";
import test from "node:test";
import { readOrderSnapshot, OrderStreamError } from "../src/order-stream.js";
const encoder=new TextEncoder();
function request(chunks){return new Request("https://local/sync",{method:"POST",duplex:"half",body:new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(typeof chunk==="string"?encoder.encode(chunk):chunk);controller.close();}})});}
test("streaming retains UTF-8 values across every byte boundary, metadata after orders, and numeric order keys",async()=>{
 const raw=encoder.encode(JSON.stringify({orders:[{transactionNo:"10760001",name:"娃娃🦒",items:[{name:"規格\"",quantity:3,price:12.5}]}],updatedAt:"2026-10-17T15:00:00Z",retentionDays:90}));
 const orders=[];const meta=await readOrderSnapshot(request(Array.from(raw,byte=>new Uint8Array([byte]))),(value,index)=>orders.push([index,value]));
 assert.equal(meta.orderCount,1);assert.equal(meta.retentionDays,90);assert.equal(meta.receivedBytes,raw.length);
 assert.deepEqual(orders,[[0,{transactionNo:"10760001",name:"娃娃🦒",items:[{name:'規格"',quantity:3,price:12.5}]}]]);
});
for(const body of ['{}','{"orders":{}}','[]','{"orders":[],"orders":[]}','{"orders":[{}]','{"orders":[]} garbage'])test("invalid stream preserves rejection: "+body,async()=>{
 await assert.rejects(readOrderSnapshot(request([body]),()=>{}),OrderStreamError);
});
test("input byte bound fails closed without silently accepting a prefix",async()=>{
 let seen=0;await assert.rejects(readOrderSnapshot(request(['{"orders":[{}',',{}]}']),()=>seen++,15),error=>error.data.error==="ORDER_PAYLOAD_TOO_LARGE"&&error.status===413);
 assert.equal(seen,1);
});
test("business validation errors survive parser callbacks",async()=>{
 await assert.rejects(readOrderSnapshot(request(['{"orders":[{}]}']),()=>{throw new OrderStreamError("INVALID_ORDER_DATA",400,{index:0});}),error=>error.data.error==="INVALID_ORDER_DATA"&&error.data.index===0);
});

test("malformed bounded uploads drain to EOF rather than resetting the caller connection",async()=>{
 let reads=0,cancelled=false;
 const body=new ReadableStream({pull(controller){reads++;if(reads===1)controller.enqueue(encoder.encode('{"orders":{}}'));else if(reads===2)controller.enqueue(encoder.encode(' '));else controller.close();},cancel(){cancelled=true;}});
 await assert.rejects(readOrderSnapshot(new Request("https://local",{method:"POST",body,duplex:"half"}),()=>{}),error=>error.data.error==="INVALID_ORDER_DATA");
 assert.equal(cancelled,false);assert.equal(reads,3);
});
