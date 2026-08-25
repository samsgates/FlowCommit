import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult } from "@flowcommit/sdk";
export class WebhookExecutor implements ExecutorAdapter {
  readonly name="webhook"; readonly kind="API" as const;
  constructor(private readonly endpoint:string){}
  async discoverCapabilities(){return ["webhook.emit"];}
  async validate(){if(!this.endpoint.startsWith("https://") && process.env.NODE_ENV==="production") throw new Error("Production webhooks must use HTTPS");}
  async prepare(context:ExecutionContext):Promise<PreparedExecution>{return {executor:this.name,proposal:{transactionId:context.transaction.id,input:context.transaction.input},proposalHash:context.transaction.proposalHash};}
  async execute(_ctx:ExecutionContext,prepared:PreparedExecution):Promise<ExecutionResult>{
    try{const r=await fetch(this.endpoint,{method:"POST",headers:{"content-type":"application/json","idempotency-key":prepared.proposalHash},body:JSON.stringify(prepared.proposal)});if(r.ok)return{status:"EXECUTED",retrySafe:true};return{status:"FAILED",retrySafe:r.status>=500,error:{code:`HTTP_${r.status}`,message:"Webhook rejected request"}};}catch(e:any){return{status:"UNKNOWN_EFFECT",retrySafe:false,error:{code:"NETWORK_UNKNOWN",message:e?.message??String(e)}};}
  }
  async health(){return{healthy:true};}
}
