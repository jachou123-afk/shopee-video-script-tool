import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join } from "node:path";
const require=createRequire(process.env.WORKER_TEST_NODE_MODULES?join(process.env.WORKER_TEST_NODE_MODULES,"package.json"):import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require("miniflare");
const {build}=require("esbuild");
const encoder=new TextEncoder();
function order(index){
 const transactionNo=String(10760000+index),number="0350000-"+transactionNo;
 const items=Array.from({length:2},(_,variant)=>({orderNo:"ORDER-"+transactionNo,subOrderNo:"0350000"+transactionNo,sku:"A817-0"+(variant+1),name:"娃娃機商品".repeat(25),style:"規格".repeat(12)+variant,quantity:variant+1,unitPrice:12.5+variant,subtotalAmount:(variant+1)*(12.5+variant),warehouseArea:"02-L09-03/T2"}));
 return {transactionNo,status:"已完成",platform:"蝦皮",platformOrderNumbers:["SHOP-"+transactionNo],printableOrderNumbers:[number],totalQuantity:3,totalAmount:39.5,items,printableOrders:[{number,subOrderNo:"0350000"+transactionNo,totalQuantity:3,subtotalAmount:39.5,items}],recipientName:"private-fixture",lastSeenAt:"2026-10-17T15:00:00Z"};
}
function payload(count,at,corrupt=false){let cursor=-1,bytes=0;return {get bytes(){return bytes;},stream:new ReadableStream({pull(controller){let value;if(cursor===-1){cursor=0;value='{"orders":[';}else if(cursor<count){const parts=[];const end=Math.min(count,cursor+16);for(;cursor<end;cursor++)parts.push((cursor?',':'')+JSON.stringify(order(cursor)));value=parts.join('');}else{value=corrupt?'] garbage':'],"retentionDays":90,"updatedAt":'+JSON.stringify(at)+'}';controller.enqueue(encoder.encode(value));bytes+=encoder.encode(value).length;controller.close();return;}const chunk=encoder.encode(value);bytes+=chunk.length;controller.enqueue(chunk);}})};}
test("real Workers runtime publishes every order beyond 20,000 without whole-body reads, and retains atomic fallback",{timeout:180000},async t=>{
 const bundled=await build({stdin:{contents: `import worker,{LineActivation as Base} from "./src/index.js";
 import {loadSnapshot} from "./src/snapshot-blocks.js";
 export class LineActivation extends Base{
  async fetch(request){
   if(new URL(request.url).pathname!=="/test-summary")return super.fetch(request);
   const meta=await loadSnapshot(this.storage,await this.storage.get("erp-order-active"));
   let count=0,quantity=0,amount=0;const ids=new Set();
   for(let i=0;i<meta.chunkCount;i++){
    const chunk=await this.storage.get(meta.blockRefs["erp-order:"+i].key);
    for(const order of Object.values(chunk)){
     if(order.items.length!==2||order.printableOrders.length!==1||order.itemsTruncated||order.printableOrdersTruncated||order.recipientName||order.lastSeenAt)throw Error("incomplete or unsafe business record");
     const printable=order.printableOrders[0];
     if(printable.number!=="0350000-"+order.transactionNo||order.platformOrderNumbers[0]!=="SHOP-"+order.transactionNo||printable.items.length!==2)throw Error("identifiers or printable details lost");
     for(const [index,item]of order.items.entries()){
      if(item.sku!=="A817-0"+(index+1)||item.name!=="娃娃機商品".repeat(25)||item.style!=="規格".repeat(12)+index||item.quantity!==index+1||item.unitPrice!==12.5+index||item.subtotalAmount!==(index+1)*(12.5+index)||item.warehouseArea!=="02-L09-03/T2"||JSON.stringify(item)!==JSON.stringify(printable.items[index]))throw Error("business field mismatch");
     }
     count++;ids.add(order.transactionNo);quantity+=order.totalQuantity;amount+=order.totalAmount;
    }
   }
   return Response.json({count,distinct:ids.size,quantity,amount,orderCount:meta.orderCount,retentionDays:meta.retentionDays,version:meta.version,previousVersion:meta.previousSnapshot?.version});
  }
 }
 export default {fetch(request,env,ctx){if(new URL(request.url).pathname==="/test-summary")return env.LINE_ACTIVATION.get(env.LINE_ACTIVATION.idFromName("line-schedule:global-v1")).fetch(request);return worker.fetch(request,env,ctx);}};`,resolveDir:process.cwd()},bundle:true,write:false,format:"esm",platform:"browser",target:"es2022"});
 const options={name:"order-capacity-test",modules:true,script:bundled.outputFiles[0].text,compatibilityDate:"2026-07-14",durableObjects:{LINE_ACTIVATION:{className:"LineActivation",useSQLite:true}},bindings:{ERP_SYNC_TOKEN:"test-erp",SHOPEE_READER_TOKEN:"test-reader"}};
 const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);t.after(()=>mf.dispose());
 const push=async(source)=>{const response=await mf.dispatchFetch("http://local/erp/orders/push",{method:"POST",headers:{"X-Erp-Sync-Token":"test-erp","Connection":"close"},body:source.stream,duplex:"half"});return {status:response.status,data:await response.json()};};
 const small=await push(payload(1,"2026-10-17T15:00:00Z"));assert.equal(small.status,200,JSON.stringify(small.data));
 const before=await(await mf.dispatchFetch("http://local/test-summary",{headers:{Connection:"close"}})).json();
 const large=payload(20276,"2026-10-17T15:10:00Z");
 const first=await push(large);assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.orderCount,20276);assert.equal(first.data.receivedOrderCount,20276);assert.equal(first.data.incompleteOrderCount,0);assert.ok(large.bytes>53*1024*1024,"fixture must exceed real rejected payload size");
 const summary=await(await mf.dispatchFetch("http://local/test-summary")).json();
 assert.deepEqual({...summary,version:undefined,previousVersion:undefined},{count:20276,distinct:20276,quantity:20276*3,amount:20276*39.5,orderCount:20276,retentionDays:90,version:undefined,previousVersion:undefined});assert.equal(summary.previousVersion,before.version);
 const second=await push(payload(20276,"2026-10-17T15:20:00Z"));assert.equal(second.status,200,JSON.stringify(second.data));assert.equal(second.data.unchanged,true);assert.equal(second.data.syncStats.writtenBlocks,0);
 const failed=await push(payload(2,"2026-10-17T15:30:00Z",true));assert.equal(failed.status,400);
 // Inspect through the binding after cancellation closes the malformed HTTP upload.
 const namespace=await mf.getDurableObjectNamespace("LINE_ACTIVATION");
 const after=await(await namespace.get(namespace.idFromName("line-schedule:global-v1")).fetch("http://local/test-summary")).json();
 assert.equal(after.version,summary.version);assert.equal(after.count,20276);
 console.log(JSON.stringify({fixtureOrders:20276,fixtureBytes:large.bytes,quantity:summary.quantity,amount:summary.amount,unchangedWrittenBlocks:second.data.syncStats.writtenBlocks}));
});

