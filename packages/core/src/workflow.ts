export interface WorkflowStep {
  id: string;
  contract: string;
  dependsOn?: string[];
  when?: string;
  onFailure?: "STOP" | "CONTINUE" | "COMPENSATE" | "RECONCILE";
}
export interface WorkflowDefinition {
  apiVersion: "flowcommit.io/v1";
  kind: "Workflow";
  metadata: { name: string; version: number; description?: string };
  steps: WorkflowStep[];
}
export interface WorkflowIssue { path:string; message:string }
export function validateWorkflow(w:WorkflowDefinition):WorkflowIssue[]{
 const issues:WorkflowIssue[]=[];if(w.apiVersion!=="flowcommit.io/v1")issues.push({path:"apiVersion",message:"must equal flowcommit.io/v1"});if(w.kind!=="Workflow")issues.push({path:"kind",message:"must equal Workflow"});if(!w.metadata?.name)issues.push({path:"metadata.name",message:"required"});if(!Number.isInteger(w.metadata?.version)||w.metadata.version<1)issues.push({path:"metadata.version",message:"must be a positive integer"});
 const ids=new Set<string>();for(const s of w.steps??[]){if(!s.id)issues.push({path:"steps[].id",message:"required"});if(ids.has(s.id))issues.push({path:`steps.${s.id}`,message:"duplicate step id"});ids.add(s.id);if(!s.contract)issues.push({path:`steps.${s.id}.contract`,message:"required"});}
 for(const s of w.steps??[])for(const d of s.dependsOn??[])if(!ids.has(d))issues.push({path:`steps.${s.id}.dependsOn`,message:`unknown dependency ${d}`});
 try{topologicalOrder(w);}catch(e:any){issues.push({path:"steps",message:e.message});}return issues;
}
export function topologicalOrder(w:WorkflowDefinition):string[]{
 const byId=new Map(w.steps.map(s=>[s.id,s]));const indegree=new Map<string,number>();const out=new Map<string,string[]>();for(const s of w.steps){indegree.set(s.id,0);out.set(s.id,[]);}for(const s of w.steps)for(const d of s.dependsOn??[]){if(!byId.has(d))continue;indegree.set(s.id,(indegree.get(s.id)??0)+1);out.get(d)!.push(s.id);}const q=[...indegree].filter(([,n])=>n===0).map(([id])=>id);const ordered:string[]=[];while(q.length){const id=q.shift()!;ordered.push(id);for(const n of out.get(id)??[]){indegree.set(n,indegree.get(n)!-1);if(indegree.get(n)===0)q.push(n);}}if(ordered.length!==w.steps.length)throw new Error("workflow contains a dependency cycle");return ordered;
}
