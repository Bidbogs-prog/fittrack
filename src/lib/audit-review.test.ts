import { afterEach, expect, it, vi } from "vitest";
import {enqueue,readQueue} from "./offline-queue";
afterEach(()=>vi.unstubAllGlobals());
it("AUD-03: offline entries have no account isolation",()=>{
 const data=new Map<string,string>();
 vi.stubGlobal("window",{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 enqueue("quick",{name:"Account A meal",kcal:"100"});
 // A new session uses exactly the same queue API; no user parameter exists.
 expect(readQueue()[0].fields.name).toBe("Account A meal");
 expect(readQueue()[0]).not.toHaveProperty("userId");
});
it("AUD-04: storage failure reports success but loses the meal",()=>{
 vi.stubGlobal("window",{localStorage:{getItem:()=>null,setItem:()=>{throw new Error("QuotaExceededError");}}});
 expect(()=>enqueue("quick",{name:"Lost meal"})).not.toThrow();
 expect(readQueue()).toEqual([]);
});
it("AUD-04: the 101st queued entry silently evicts the first",()=>{
 const data=new Map<string,string>();
 vi.stubGlobal("window",{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 for(let n=0;n<101;n++) enqueue("quick",{name:String(n)});
 expect(readQueue()).toHaveLength(100);
 expect(readQueue()[0].fields.name).toBe("1");
});
