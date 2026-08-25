import {
  addObservation, decideVerificationOutcome, transitionTransaction,
  type BusinessEffectContract, type EvidenceEntry, type Transaction, type TransactionAction
} from "@flowcommit/core";
import type { ExecutorAdapter, ExecutionResult, VerifierAdapter } from "@flowcommit/sdk";

export interface RuntimeStore {
  getTransaction(id:string, tenantId:string):Promise<Transaction|null>;
  putTransaction(tx:Transaction):Promise<void>;
  getContract(tenantId:string,name:string,version:number):Promise<BusinessEffectContract|null>;
  appendEvidence?(entry:Omit<EvidenceEntry,"sequence"|"previousHash"|"hash">):Promise<void>;
  openReconciliation?(transactionId:string,reason:string,recommendation?:Record<string,unknown>):Promise<void>;
}

export interface CredentialResolver {
  resolve(refs:string[], context:{tenantId:string;environmentId:string;transactionId:string}):Promise<Record<string,string>>;
}

export class ExecutorRegistry {
  private readonly map=new Map<string,ExecutorAdapter>();
  register(adapter:ExecutorAdapter,...aliases:string[]){this.map.set(adapter.name,adapter);for(const a of aliases)this.map.set(a,adapter);return this;}
  get(name:string){return this.map.get(name);}
  names(){return [...this.map.keys()];}
}

export class VerifierRegistry {
  private readonly map=new Map<string,VerifierAdapter>();
  register(adapter:VerifierAdapter,...aliases:string[]){this.map.set(adapter.name,adapter);for(const a of aliases)this.map.set(a,adapter);return this;}
  get(name:string){return this.map.get(name);}
}

export interface EngineHooks {
  onEvent?(event:{transactionId:string;type:string;payload:Record<string,unknown>}):Promise<void>|void;
}

export class TransactionEngine {
  constructor(
    private readonly store:RuntimeStore,
    private readonly executors:ExecutorRegistry,
    private readonly verifiers:VerifierRegistry,
    private readonly credentials?:CredentialResolver,
    private readonly hooks:EngineHooks={}
  ){}

  async run(transactionId:string,tenantId:string):Promise<Transaction>{
    let tx=await this.requireTransaction(transactionId,tenantId);
    const contract=await this.store.getContract(tenantId,tx.contract.name,tx.contract.version);
    if(!contract) throw new Error(`Contract not found: ${tx.contract.name}@${tx.contract.version}`);
    if(tx.status!=="READY" && tx.status!=="FAILED_INFRASTRUCTURE" && tx.status!=="UNKNOWN_EFFECT") return tx;

    if(tx.status==="UNKNOWN_EFFECT") return this.reconcileUnknown(tx,contract);
    if(tx.status==="FAILED_INFRASTRUCTURE") tx=await this.transition(tx,"EXECUTING","transaction.retrying");
    else tx=await this.transition(tx,"EXECUTING","transaction.executing");

    const selection=this.selectExecutor(contract);
    if(!selection){
      tx=await this.transition(tx,"FAILED_INFRASTRUCTURE","transaction.no_executor",{available:this.executors.names()});
      return tx;
    }

    const adapter=selection.adapter;
    const action:TransactionAction={id:`act_${tx.id}_${tx.actions.length+1}`,executor:selection.name,status:"EXECUTING",attempts:1,startedAt:new Date().toISOString()};
    tx={...tx,actions:[...tx.actions,action],updatedAt:new Date().toISOString()};await this.store.putTransaction(tx);

    const credentialRefs=String(contract.metadata.labels?.["flowcommit.io/credential-refs"]??"").split(",").map(v=>v.trim()).filter(Boolean);
    const resolved=this.credentials && credentialRefs.length ? await this.credentials.resolve(credentialRefs,{tenantId:tx.tenantId,environmentId:tx.environmentId,transactionId:tx.id}) : undefined;
    const context={transaction:tx,contract,credentials:resolved};
    let result:ExecutionResult;
    try{
      await adapter.validate(context);
      const prepared=await adapter.prepare(context);
      if(prepared.proposalHash!==tx.proposalHash) throw new Error("Executor proposal hash does not match approved transaction proposal");
      result=await adapter.execute(context,prepared);
    }catch(error:any){
      result={status:"FAILED",retrySafe:true,error:{code:"EXECUTOR_EXCEPTION",message:error?.message??String(error)}};
    }

    tx=this.finishAction(tx,action.id,result);
    await this.store.putTransaction(tx);
    await this.event(tx,"action.finished",{executor:selection.name,result:result.status,retrySafe:result.retrySafe,externalReference:result.externalReference??null});

    if(result.status==="UNKNOWN_EFFECT"){
      tx=await this.transition(tx,"UNKNOWN_EFFECT","transaction.unknown_effect",{executor:selection.name});
      return this.reconcileUnknown(tx,contract,result);
    }
    if(result.status==="FAILED"){
      tx=await this.transition(tx,"FAILED_INFRASTRUCTURE","transaction.execution_failed",{retrySafe:result.retrySafe,code:result.error?.code??"FAILED"});
      return tx;
    }

    tx=await this.transition(tx,"VERIFYING","transaction.verifying");
    tx=await this.verifyAll(tx,contract,result);
    tx=decideVerificationOutcome(tx,contract);
    await this.store.putTransaction(tx);await this.event(tx,"transaction.verification_decided",{status:tx.status});

    if(tx.status==="COMMITTING"){
      tx=await this.transition(tx,tx.retryCount>0?"VERIFIED_AFTER_RETRY":"VERIFIED","transaction.verified");
      return tx;
    }
    if(tx.status==="COMPENSATING") return this.compensate(tx,contract,adapter,result);
    if(tx.status==="UNKNOWN_EFFECT" || tx.status==="RECONCILIATION_REQUIRED") return this.reconcileUnknown(tx,contract,result);
    return tx;
  }

  private selectExecutor(contract:BusinessEffectContract):{name:string;adapter:ExecutorAdapter}|null{
    for(const name of [...contract.execution.preferred,...(contract.execution.fallback??[])]){const adapter=this.executors.get(name);if(adapter)return{name,adapter};}
    return null;
  }

  private async verifyAll(tx:Transaction,contract:BusinessEffectContract,result:ExecutionResult):Promise<Transaction>{
    if(!contract.verification.required){
      for(const effect of contract.expectedEffects){tx=addObservation(tx,{effectId:effect.id,result:"CONFIRMED",confidence:1,strength:0,source:"verification-not-required",observedAt:new Date().toISOString()});}
      await this.store.putTransaction(tx);return tx;
    }
    for(const effect of contract.expectedEffects){
      const rules=contract.verification.rules.filter(r=>!r.effectId||r.effectId===effect.id);
      if(!rules.length){tx=addObservation(tx,{effectId:effect.id,result:"INCONCLUSIVE",confidence:0,strength:0,source:"no-verifier",observedAt:new Date().toISOString()});continue;}
      for(const rule of rules){
        const verifier=this.verifiers.get(rule.verifier);
        if(!verifier){tx=addObservation(tx,{effectId:effect.id,result:"INCONCLUSIVE",confidence:0,strength:rule.strength??0,source:`missing:${rule.verifier}`,observedAt:new Date().toISOString()});continue;}
        const observation=await verifier.verify({transaction:tx,contract,effectId:effect.id,executionResult:result});
        tx=addObservation(tx,{...observation,strength:observation.strength||rule.strength||0});
        await this.event(tx,"effect.observed",{effectId:effect.id,verifier:rule.verifier,result:observation.result,strength:observation.strength});
      }
    }
    await this.store.putTransaction(tx);return tx;
  }

  private async compensate(tx:Transaction,_contract:BusinessEffectContract,adapter:ExecutorAdapter,result:ExecutionResult):Promise<Transaction>{
    if(!adapter.compensate){return this.reconcileUnknown(await this.transition(tx,"RECONCILIATION_REQUIRED","compensation.unavailable"),_contract,result);}
    try{
      const c=await adapter.compensate({transaction:tx,contract:_contract},result);
      if(c.status==="EXECUTED"){tx=await this.transition(tx,"COMPENSATED","transaction.compensated");return tx;}
      return this.reconcileUnknown(await this.transition(tx,"RECONCILIATION_REQUIRED","compensation.failed"),_contract,c);
    }catch(error:any){return this.reconcileUnknown(await this.transition(tx,"RECONCILIATION_REQUIRED","compensation.exception",{message:error?.message??String(error)}),_contract,result);}
  }

  private async reconcileUnknown(tx:Transaction,_contract:BusinessEffectContract,result?:ExecutionResult):Promise<Transaction>{
    if(tx.status==="UNKNOWN_EFFECT") tx=await this.transition(tx,"RECONCILIATION_REQUIRED","reconciliation.required",{externalReference:result?.externalReference??null});
    await this.store.openReconciliation?.(tx.id,"Effect could not be determined safely",{action:"verify_external_state_before_retry",externalReference:result?.externalReference});
    return tx;
  }

  private finishAction(tx:Transaction,id:string,result:ExecutionResult):Transaction{
    const now=new Date().toISOString();
    return {...tx,actions:tx.actions.map(a=>a.id===id?{...a,status:result.status==="EXECUTED"?"EXECUTED":result.status==="UNKNOWN_EFFECT"?"EFFECT_UNKNOWN":"FAILED",finishedAt:now,externalReference:result.externalReference,output:result.output,error:result.error}:a),updatedAt:now};
  }

  private async transition(tx:Transaction,to:any,eventType:string,payload:Record<string,unknown>={}):Promise<Transaction>{
    const next=transitionTransaction(tx,to);await this.store.putTransaction(next);await this.event(next,eventType,{from:tx.status,to,...payload});return next;
  }
  private async event(tx:Transaction,type:string,payload:Record<string,unknown>){
    await this.hooks.onEvent?.({transactionId:tx.id,type,payload});
    await this.store.appendEvidence?.({transactionId:tx.id,type,timestamp:new Date().toISOString(),payload});
  }
  private async requireTransaction(id:string,tenantId:string){const tx=await this.store.getTransaction(id,tenantId);if(!tx)throw new Error(`Transaction not found: ${id}`);return tx;}
}
