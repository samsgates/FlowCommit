import assert from "node:assert/strict";
import {
  appendEvidence, approvalsSatisfy, calculateRisk, canTransitionTransaction, createTransaction,
  decideVerificationOutcome, renderIdempotencyKey, summarizeVerification, transactionFingerprint,
  verifyEvidenceChain, rankExecutors, validateContract, validateWorkflow, topologicalOrder
} from "../packages/core/dist/index.js";
import { readFile } from "node:fs/promises";

const contract=JSON.parse(await readFile(new URL("../examples/refund/customer-refund.bec.json",import.meta.url),"utf8"));
assert.deepEqual(validateContract(contract),[]);
assert.equal(renderIdempotencyKey("refund:${invoiceId}:${amount}",{invoiceId:"INV-1",amount:20}),"refund:INV-1:20");
assert.equal(transactionFingerprint("a",1,{x:1}),transactionFingerprint("a",1,{x:1}));
assert.equal(canTransitionTransaction("CREATED","VALIDATING"),true);
assert.equal(canTransitionTransaction("CREATED","VERIFIED"),false);
const risk=calculateRisk(contract,{amount:100000,production:true,aiExecutor:true});
assert.ok(risk.score>=70);
const tx=createTransaction({id:"fctx_test",tenantId:"demo",environmentId:"dev",actorId:"tester",contract,input:{invoiceId:"INV-1",amount:850},now:"2026-01-01T00:00:00.000Z"});
assert.equal(tx.status,"CREATED");
assert.ok(tx.proposalHash.length>0);
assert.equal(approvalsSatisfy([{role:"finance-manager",count:1}],[{id:"a",role:"finance-manager",actorId:"u",decision:"APPROVED",proposalHash:tx.proposalHash,createdAt:"x"}],tx.proposalHash),true);
const observations=contract.expectedEffects.map(e=>({effectId:e.id,result:"CONFIRMED",confidence:1,strength:95,source:"independent-api",observedAt:"2026-01-01T00:00:01.000Z"}));
assert.equal(summarizeVerification(contract,observations).confirmed,true);
const verifyTx={...tx,status:"VERIFYING",observations};
assert.equal(decideVerificationOutcome(verifyTx,contract).status,"COMMITTING");
let chain=[];chain.push(appendEvidence(chain,{transactionId:tx.id,type:"transaction.created",timestamp:"2026-01-01T00:00:00.000Z",payload:{status:"CREATED"}}));chain.push(appendEvidence(chain,{transactionId:tx.id,type:"transaction.verified",timestamp:"2026-01-01T00:00:01.000Z",payload:{status:"VERIFIED"}}));assert.equal(verifyEvidenceChain(chain),true);
const ranked=rankExecutors([{name:"vision",kind:"VISION_AGENT",healthy:true,trustScore:90,successRate:90,verificationStrength:80,estimatedCost:10,latencyMs:1000,allowed:true},{name:"api",kind:"API",healthy:true,trustScore:99,successRate:99,verificationStrength:95,estimatedCost:1,latencyMs:100,allowed:true}]);assert.equal(ranked[0].name,"api");
const wf={apiVersion:"flowcommit.io/v1",kind:"Workflow",metadata:{name:"w",version:1},steps:[{id:"a",contract:"a@1"},{id:"b",contract:"b@1",dependsOn:["a"]}]};assert.deepEqual(validateWorkflow(wf),[]);assert.deepEqual(topologicalOrder(wf),["a","b"]);
console.log("FlowCommit core tests passed");
