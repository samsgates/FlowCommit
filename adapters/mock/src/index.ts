import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult, VerifierAdapter, VerifierContext } from "@flowcommit/sdk";
export class MockExecutor implements ExecutorAdapter {
 readonly name="mock";readonly kind="API" as const;
 async discoverCapabilities(){return["demo.execute"];}
 async validate(){}
 async prepare(context:ExecutionContext):Promise<PreparedExecution>{return{executor:this.name,proposal:{input:context.transaction.input},proposalHash:context.transaction.proposalHash};}
 async execute(_c:ExecutionContext,p:PreparedExecution):Promise<ExecutionResult>{return{status:"EXECUTED",retrySafe:true,externalReference:`mock:${p.proposalHash}`,output:{accepted:true}};}
 async health(){return{healthy:true};}
}
export class MockVerifier implements VerifierAdapter {
 readonly name="mock-verifier";
 async verify(context:VerifierContext){return{effectId:context.effectId,result:"CONFIRMED" as const,confidence:1,strength:100,source:this.name,observed:{verified:true},observedAt:new Date().toISOString()};}
 async health(){return{healthy:true};}
}
