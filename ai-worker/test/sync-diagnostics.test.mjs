import assert from "node:assert/strict";
import test from "node:test";
import { LineActivation } from "../src/index.js";
test("sync diagnostics omit credentials, order identifiers and business contents", async () => {
 const object = new LineActivation({storage:{}});
 object.readerSocket={readyState:1};object.erpWritebackSocket={readyState:1};
 object.readerHello={browser:{started:true,url:"private"}};
 const response=Response.json({error:"ORDER_TOO_LARGE",transactionNo:"10760001",limitBytes:98304,receivedBytes:99999,token:"secret",orders:[{name:"private"}]},{status:413});
 const logs=[];const original=console.log;console.log=(...args)=>logs.push(args);
 try{assert.equal(await object.logErpSyncDiagnostics("orders",response),response);}finally{console.log=original;}
 assert.deepEqual(JSON.parse(logs[0][1]),{kind:"orders",status:413,error:"ORDER_TOO_LARGE",limitBytes:98304,receivedBytes:99999});
 assert.equal((await response.json()).transactionNo,"10760001");
});

import worker from "../src/index.js";
test("NAS health checks use each existing broker and auth only after an authorized order push", async () => {
 const calls=[],background=[],logs=[];
 const env={ERP_SYNC_TOKEN:"erp-fixture",SHOPEE_READER_TOKEN:"reader-fixture",LINE_ACTIVATION:{idFromName:name=>name,get:name=>({async fetch(url,init={}){
  calls.push({name,url,init});
  if(name==="shopee-reader-broker-v1") {assert.equal(init.headers.Authorization,"Bearer reader-fixture");return Response.json({connected:true,hello:{browser:{started:true,controlUrl:"private-url"}}});}
  if(name==="erp-writeback-broker-v1") {assert.equal(init.headers["X-Erp-Sync-Token"],"erp-fixture");return Response.json({connected:true});}
  return Response.json({ok:false,error:"ORDER_TOO_LARGE"},{status:413});
 }})}};
 const context={waitUntil:promise=>background.push(promise)};
 const bad=await worker.fetch(new Request("https://worker/erp/orders/push",{method:"POST",body:JSON.stringify({orders:[]})}),env,context);
 assert.equal(bad.status,401);assert.equal(calls.length,0);assert.equal(background.length,0);
 const original=console.log;console.log=(...args)=>logs.push(args);
 try {
  const response=await worker.fetch(new Request("https://worker/erp/orders/push",{method:"POST",headers:{"X-Erp-Sync-Token":"erp-fixture"},body:JSON.stringify({orders:[]})}),env,context);
  assert.equal(response.status,413);await Promise.all(background);
 }finally{console.log=original;}
 assert.deepEqual(calls.map(c=>c.name).sort(),["erp-writeback-broker-v1","line-schedule:global-v1","shopee-reader-broker-v1"]);
 assert.deepEqual(JSON.parse(logs[0][1]),{readerStatus:200,readerConnected:true,browserStarted:true,writebackStatus:200,writebackConnected:true});
 assert.ok(!JSON.stringify(logs).includes("private-url"));
});
