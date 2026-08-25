import { chromium } from "playwright";
import type { ExecutorAdapter, ExecutionContext, PreparedExecution, ExecutionResult } from "@flowcommit/sdk";
export class PlaywrightExecutor implements ExecutorAdapter {
  readonly name="playwright"; readonly kind="STRUCTURED_BROWSER" as const;
  async discoverCapabilities(){return["browser.navigate","browser.click","browser.fill","browser.extract"];}
  async validate(context:ExecutionContext){if(!(context.contract.metadata.labels?.["flowcommit.io/browser-url"])) throw new Error("flowcommit.io/browser-url label required");}
  async prepare(context:ExecutionContext):Promise<PreparedExecution>{return{executor:this.name,proposal:{url:context.contract.metadata.labels?.["flowcommit.io/browser-url"],input:context.input},proposalHash:context.transaction.proposalHash};}
  async execute(_context:ExecutionContext,prepared:PreparedExecution):Promise<ExecutionResult>{
    const browser=await chromium.launch({headless:true});
    try{const page=await browser.newPage();await page.goto(String((prepared.proposal as any).url),{waitUntil:"domcontentloaded"});return{status:"EXECUTED",retrySafe:false,output:{title:await page.title(),url:page.url()}};}catch(e:any){return{status:"UNKNOWN_EFFECT",retrySafe:false,error:{code:"BROWSER_UNKNOWN",message:e?.message??String(e)}};}finally{await browser.close();}
  }
  async health(){return{healthy:true};}
}
