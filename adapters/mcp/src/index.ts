import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult } from "@flowcommit/sdk";
// This adapter intentionally exposes a transport-neutral boundary. Production deployments
// should instantiate an MCP client with the organization's approved authorization flow.
export class McpToolExecutor implements ExecutorAdapter {
  readonly name="mcp"; readonly kind="CONNECTOR" as const;
  constructor(private readonly invoke:(tool:string,args:Record<string,unknown>)=>Promise<any>, private readonly tool:string){}
  async discoverCapabilities(){return[`mcp.${this.tool}`];}
  async validate(){}
  async prepare(context:ExecutionContext):Promise<PreparedExecution>{return{executor:this.name,proposal:{tool:this.tool,args:context.input},proposalHash:context.transaction.proposalHash};}
  async execute(_context:ExecutionContext,prepared:PreparedExecution):Promise<ExecutionResult>{
    try{const p:any=prepared.proposal;const output=await this.invoke(p.tool,p.args);return{status:"EXECUTED",retrySafe:false,output:{result:output}};}catch(e:any){return{status:"UNKNOWN_EFFECT",retrySafe:false,error:{code:"MCP_UNKNOWN",message:e?.message??String(e)}};}
  }
  async health(){return{healthy:true};}
}
