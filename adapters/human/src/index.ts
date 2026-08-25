import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult } from "@flowcommit/sdk";
export class HumanTaskExecutor implements ExecutorAdapter {
  readonly name="human-task"; readonly kind="HUMAN" as const;
  async discoverCapabilities(){return ["human.review","human.execute"];}
  async validate(){}
  async prepare(context:ExecutionContext):Promise<PreparedExecution>{return{executor:this.name,proposal:{transactionId:context.transaction.id,input:context.transaction.input},proposalHash:context.transaction.proposalHash};}
  async execute():Promise<ExecutionResult>{return{status:"FAILED",retrySafe:false,error:{code:"HUMAN_TASK_PENDING",message:"Human task must be completed through the approval/task API"}};}
  async health(){return{healthy:true};}
}
