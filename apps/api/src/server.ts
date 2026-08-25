import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { randomUUID, createHash } from "node:crypto";
import { assertValidContract, createTransaction, transitionTransaction, applyPolicy, recordApproval, type BusinessEffectContract, validateWorkflow } from "@flowcommit/core";
import { FlowCommitDb } from "@flowcommit/db";
import { OpaPolicyProvider, AllowAllDevPolicyProvider } from "@flowcommit/policy";

const app = Fastify({logger:{level:process.env.LOG_LEVEL ?? "info"},requestIdHeader:"x-request-id"});
await app.register(cors,{origin:process.env.CORS_ORIGIN?.split(",") ?? true,credentials:true});
await app.register(helmet,{contentSecurityPolicy:false});

const db = new FlowCommitDb();
const policy = process.env.FLOWCOMMIT_DEV_AUTH === "true" ? new AllowAllDevPolicyProvider() : new OpaPolicyProvider();

function actor(req:any){return String(req.headers["x-flowcommit-actor"] ?? "anonymous");}
function tenant(req:any){return String(req.headers["x-flowcommit-tenant"] ?? (req.body as any)?.tenantId ?? req.query?.tenantId ?? "demo");}
function hash(value:unknown){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}

app.get("/healthz",async()=>({status:"ok",service:"flowcommit-api"}));
app.get("/readyz",async(_req,reply)=>{try{await db.pool.query("select 1");return{status:"ready"};}catch(e){reply.code(503);return{status:"not-ready"};}});

app.get("/api/v1/contracts",async(req:any)=>({items:await db.listContracts(tenant(req))}));

app.post("/api/v1/contracts",async(req,reply)=>{
  const contract=req.body as BusinessEffectContract;
  assertValidContract(contract);
  await db.putContract(tenant(req),actor(req),contract,hash(contract),"published");
  reply.code(201); return {name:contract.metadata.name,version:contract.metadata.version,state:"published"};
});

app.get("/api/v1/contracts/:name/:version",async(req:any,reply)=>{
  const doc=await db.getContract(tenant(req),req.params.name,Number(req.params.version));
  if(!doc){reply.code(404);return{error:"contract_not_found"};}
  return doc;
});


app.get("/api/v1/workflows",async(req:any)=>({items:await db.listWorkflows(tenant(req))}));
app.post("/api/v1/workflows",async(req:any,reply)=>{
  const workflow=req.body as any;const issues=validateWorkflow(workflow);if(issues.length){reply.code(400);return{error:"invalid_workflow",issues};}
  await db.putWorkflow(tenant(req),actor(req),workflow,hash(workflow),"published");reply.code(201);return{name:workflow.metadata.name,version:workflow.metadata.version,state:"published"};
});
app.get("/api/v1/workflows/:name/:version",async(req:any,reply)=>{const doc=await db.getWorkflow(tenant(req),req.params.name,Number(req.params.version));if(!doc){reply.code(404);return{error:"workflow_not_found"};}return doc;});

app.post("/api/v1/transactions",async(req:any,reply)=>{
  const body=req.body as any;
  const organizationId=String(body.tenantId ?? tenant(req));
  const environmentId=String(body.environmentId ?? "dev");
  const contract=await db.getContract(organizationId,body.contract?.name,Number(body.contract?.version));
  if(!contract){reply.code(404);return{error:"contract_not_found"};}
  if(body.idempotencyKey){const existing=await db.findByIdempotency(organizationId,environmentId,body.idempotencyKey);if(existing){reply.code(200);return{transaction:existing,deduplicated:true};}}
  let tx=createTransaction({id:`fctx_${randomUUID()}`,tenantId:organizationId,workspaceId:body.workspaceId,environmentId,actorId:actor(req),contract,input:body.input??{},idempotencyKey:body.idempotencyKey});
  tx=transitionTransaction(tx,"VALIDATING");
  tx=transitionTransaction(tx,"POLICY_EVALUATION");
  const decision=await policy.evaluate({actor:{id:actor(req)},transaction:tx,contract});
  tx=applyPolicy(tx,decision as any);
  if(tx.status==="PREPARING") tx=transitionTransaction(tx,"READY");
  await db.putTransaction(tx);
  reply.code(201); return {transaction:tx,deduplicated:false};
});

app.get("/api/v1/transactions",async(req:any)=>({items:await db.listTransactions(tenant(req),Math.min(Number(req.query?.limit??100),500))}));

app.get("/api/v1/transactions/:id",async(req:any,reply)=>{
  const tx=await db.getTransaction(req.params.id,tenant(req));
  if(!tx){reply.code(404);return{error:"transaction_not_found"};}
  return tx;
});

app.post("/api/v1/transactions/:id/approvals",async(req:any,reply)=>{
  let tx=await db.getTransaction(req.params.id,tenant(req));
  if(!tx){reply.code(404);return{error:"transaction_not_found"};}
  const body=req.body as any;
  tx=recordApproval(tx,{id:`appr_${randomUUID()}`,role:String(body.role),actorId:actor(req),decision:body.decision==="REJECTED"?"REJECTED":"APPROVED",proposalHash:tx.proposalHash,createdAt:new Date().toISOString(),reason:body.reason});
  await db.putTransaction(tx); return tx;
});


app.get("/api/v1/transactions/:id/evidence",async(req:any,reply)=>{
  const tx=await db.getTransaction(req.params.id,tenant(req));if(!tx){reply.code(404);return{error:"transaction_not_found"};}
  return {items:await db.getEvidence(req.params.id,tenant(req))};
});


app.get("/api/v1/approvals",async(req:any)=>{
  const {rows}=await db.pool.query("SELECT id,status,contract_name,contract_version,risk_level,risk_score,actor_id,proposal_hash,created_at FROM transactions WHERE organization_id=$1 AND status='AWAITING_APPROVAL' ORDER BY created_at ASC LIMIT 200",[tenant(req)]);
  return {items:rows};
});

app.get("/api/v1/reconciliation",async(req:any)=>{
  const {rows}=await db.pool.query(`SELECT r.* FROM reconciliation_cases r JOIN transactions t ON t.id=r.transaction_id
    WHERE t.organization_id=$1 ORDER BY r.created_at DESC LIMIT 200`,[tenant(req)]);
  return {items:rows};
});

app.post("/api/v1/transactions/:id/cancel",async(req:any,reply)=>{
  let tx=await db.getTransaction(req.params.id,tenant(req));if(!tx){reply.code(404);return{error:"transaction_not_found"};}
  const terminal=new Set(["VERIFIED","VERIFIED_AFTER_RETRY","COMPENSATED","REJECTED_BY_POLICY","HALTED_BEFORE_EFFECT","CANCELLED"]);
  if(terminal.has(tx.status)){reply.code(409);return{error:"terminal_transaction"};}
  try{tx=transitionTransaction(tx,"CANCELLED");}catch{reply.code(409);return{error:"cannot_cancel_from_state",status:tx.status};}
  await db.putTransaction(tx);return tx;
});

app.setErrorHandler((error,req,reply)=>{req.log.error(error);reply.code((error as any).statusCode??500).send({error:"flowcommit_error",message:process.env.NODE_ENV==="production"?"Request failed":error.message,requestId:req.id});});

const port=Number(process.env.PORT??8080);
await app.listen({host:"0.0.0.0",port});

const shutdown=async()=>{await app.close();await db.close();process.exit(0);};
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
