import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult, VerifierAdapter, VerifierContext } from "@flowcommit/sdk";

export class HttpExecutor implements ExecutorAdapter {
  readonly name = "http";
  readonly kind = "API" as const;
  async discoverCapabilities(){ return ["http.request"]; }
  async validate(context: ExecutionContext){
    const c:any = context.contract;
    const cfg:any = c.metadata.labels ?? {};
    if (!cfg["flowcommit.io/http-url"]) throw new Error("Contract label flowcommit.io/http-url is required");
  }
  async prepare(context: ExecutionContext): Promise<PreparedExecution>{
    const labels:any = context.contract.metadata.labels ?? {};
    const proposal = {url: labels["flowcommit.io/http-url"], method: labels["flowcommit.io/http-method"] ?? "POST", body: context.input};
    return {executor:this.name,proposal,proposalHash:context.transaction.proposalHash};
  }
  async execute(_context: ExecutionContext, prepared: PreparedExecution): Promise<ExecutionResult>{
    const p:any = prepared.proposal;
    try {
      const res = await fetch(p.url,{method:p.method,headers:{"content-type":"application/json","idempotency-key": prepared.proposalHash},body:["GET","HEAD"].includes(p.method)?undefined:JSON.stringify(p.body)});
      const text = await res.text();
      const output = {status:res.status, body:text.slice(0,100000)};
      if (res.ok) return {status:"EXECUTED",output,retrySafe:true,externalReference:res.headers.get("x-request-id") ?? undefined};
      return {status:"FAILED",output,retrySafe:res.status>=500,error:{code:`HTTP_${res.status}`,message:`HTTP request failed with ${res.status}`}};
    } catch (error:any) {
      // A network failure after sending a consequential request can have unknown effect.
      return {status:"UNKNOWN_EFFECT",retrySafe:false,error:{code:"NETWORK_UNKNOWN",message:error?.message ?? String(error)}};
    }
  }
  async health(){return {healthy:true};}
}

export class HttpJsonVerifier implements VerifierAdapter {
  readonly name="http-json";
  constructor(private readonly urlFrom: (ctx:VerifierContext)=>string, private readonly predicate:(payload:any,ctx:VerifierContext)=>boolean, private readonly strength=95){}
  async verify(context: VerifierContext){
    try{
      const res=await fetch(this.urlFrom(context),{headers:{accept:"application/json"}});
      if(!res.ok) return {effectId:context.effectId,result:"INCONCLUSIVE" as const,confidence:0,strength:this.strength,source:this.name,observed:{status:res.status},observedAt:new Date().toISOString()};
      const payload=await res.json();
      const ok=this.predicate(payload,context);
      return {effectId:context.effectId,result:ok?"CONFIRMED" as const:"REJECTED" as const,confidence:1,strength:this.strength,source:this.name,observed:payload as any,observedAt:new Date().toISOString()};
    }catch(error:any){
      return {effectId:context.effectId,result:"INCONCLUSIVE" as const,confidence:0,strength:this.strength,source:this.name,evidence:{error:error?.message ?? String(error)},observedAt:new Date().toISOString()};
    }
  }
  async health(){return {healthy:true};}
}
