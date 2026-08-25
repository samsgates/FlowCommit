const base=process.env.FLOWCOMMIT_API_URL??"http://localhost:8080";
const tenant=process.env.FLOWCOMMIT_TENANT??"demo";
export async function api<T>(path:string):Promise<T>{
 const r=await fetch(`${base}${path}`,{headers:{"x-flowcommit-tenant":tenant},cache:"no-store"});if(!r.ok)throw new Error(`FlowCommit API ${path} returned ${r.status}`);return r.json() as Promise<T>;
}
export async function safeApi<T>(path:string,fallback:T):Promise<T>{try{return await api<T>(path);}catch{return fallback;}}
