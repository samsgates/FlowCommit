import { FlowCommitDb } from "@flowcommit/db";
import { ExecutorRegistry, VerifierRegistry, TransactionEngine } from "@flowcommit/runtime";
import { HttpExecutor } from "@flowcommit/adapter-http";
import { MockExecutor, MockVerifier } from "@flowcommit/adapter-mock";

const db=new FlowCommitDb();
const executors=new ExecutorRegistry().register(new HttpExecutor()).register(new MockExecutor());
const verifiers=new VerifierRegistry().register(new MockVerifier());
const engine=new TransactionEngine(db as any,executors,verifiers,undefined,{onEvent:async e=>console.log(JSON.stringify({level:"info",...e}))});
const pollMs=Number(process.env.WORKER_POLL_MS??2000);let stopping=false;let running=false;
console.log(JSON.stringify({level:"info",msg:"flowcommit worker started",pollMs,executors:executors.names()}));
async function tick(){
 if(stopping||running)return;running=true;
 try{
  const {rows}=await db.pool.query("SELECT id,organization_id FROM transactions WHERE status IN ('READY','FAILED_INFRASTRUCTURE') ORDER BY created_at ASC LIMIT 20");
  for(const row of rows){try{await engine.run(row.id,row.organization_id);}catch(e){console.error(JSON.stringify({level:"error",msg:"transaction execution failed",transactionId:row.id,error:String(e)}));}}
 }catch(e){console.error(JSON.stringify({level:"error",msg:"worker poll failed",error:String(e)}));}
 finally{running=false;if(!stopping)setTimeout(tick,pollMs).unref();}
}
tick();
async function stop(){stopping=true;while(running)await new Promise(r=>setTimeout(r,50));await db.close();process.exit(0);}process.on("SIGINT",stop);process.on("SIGTERM",stop);
