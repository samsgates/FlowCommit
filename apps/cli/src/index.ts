#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { assertValidContract } from "@flowcommit/core";
const program=new Command();
program.name("flowcommit").description("FlowCommit CLI").version("0.1.0");
program.command("contract:validate").argument("<file>").action(async file=>{const doc=JSON.parse(await readFile(file,"utf8"));assertValidContract(doc);console.log("Contract is valid");});
program.command("transaction:get").argument("<id>").option("--api <url>","API URL","http://localhost:8080").option("--tenant <id>","Tenant","demo").action(async(id,o)=>{const r=await fetch(`${o.api}/api/v1/transactions/${id}`,{headers:{"x-flowcommit-tenant":o.tenant}});console.log(JSON.stringify(await r.json(),null,2));process.exitCode=r.ok?0:1;});
program.command("health").option("--api <url>","API URL","http://localhost:8080").action(async o=>{const r=await fetch(`${o.api}/healthz`);console.log(JSON.stringify(await r.json(),null,2));});
await program.parseAsync();
