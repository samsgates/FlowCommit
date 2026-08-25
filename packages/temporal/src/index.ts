// FlowCommit keeps its business transaction state machine in @flowcommit/core.
// This package provides a durable orchestration boundary for deployments that use Temporal.
import { proxyActivities, defineSignal, setHandler, condition } from "@temporalio/workflow";

export interface TransactionActivities {
  validate(id:string):Promise<void>;
  evaluatePolicy(id:string):Promise<{approvalRequired:boolean}>;
  execute(id:string):Promise<void>;
  verify(id:string):Promise<"CONFIRMED"|"UNKNOWN"|"REJECTED">;
  compensate(id:string):Promise<void>;
}
const activities=proxyActivities<TransactionActivities>({startToCloseTimeout:"5 minutes",retry:{maximumAttempts:5}});
export const approvalSignal=defineSignal<[boolean]>("approval");

export async function flowCommitTransactionWorkflow(transactionId:string):Promise<string>{
  await activities.validate(transactionId);
  const policy=await activities.evaluatePolicy(transactionId);
  if(policy.approvalRequired){let approved:boolean|undefined;setHandler(approvalSignal,(v)=>{approved=v;});await condition(()=>approved!==undefined,"7 days");if(!approved)return "REJECTED_BY_POLICY";}
  await activities.execute(transactionId);
  const verified=await activities.verify(transactionId);
  if(verified==="CONFIRMED")return "VERIFIED";
  if(verified==="REJECTED"){await activities.compensate(transactionId);return "COMPENSATED";}
  return "UNKNOWN_EFFECT";
}
