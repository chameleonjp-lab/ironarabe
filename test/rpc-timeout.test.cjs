'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  function postRpc(')>=0?html.indexOf('  function postRpc('):html.indexOf('  async function postRpc('),html.indexOf('  function updateRankingStatus('));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function environment(response){
 const timers=new Map();let signal;
 const context={Promise,Error,JSON,AbortController,getRpcUrl:()=>'/rpc/guest',isRankingConfigured:()=>true,RANKING_CONFIG:{publishableKey:'public-fixture'},setTimeout(fn){timers.set(1,fn);return 1;},clearTimeout(id){timers.delete(id);},fetch(url,options){signal=options.signal;return Promise.resolve(response(()=>signal));}};
 const send=vm.runInNewContext(source+';postRpc;',context);
 return {send,timers,signal:()=>signal};
}
test('RPC deadline stays active after headers until the complete body is read',async()=>{
 const e=environment(signal=>({ok:true,text:()=>new Promise((resolve,reject)=>signal().addEventListener('abort',()=>reject(new Error('body aborted')),{once:true}))}));
 let outcome='pending';const task=e.send('guest',{},10000).then(()=>outcome='success',()=>outcome='failed');await flush();
 assert.equal(e.timers.size,1,'headers must not cancel the body deadline');for(const timeout of e.timers.values())timeout();await task;
 assert.equal(e.signal().aborted,true);assert.equal(outcome,'failed');assert.equal(e.timers.size,0);
});
test('a completed RPC removes its deadline on success and parsing/HTTP failures',async()=>{
 for(const response of [{ok:true,text:async()=>'{"accepted":true}'},{ok:true,text:async()=>'{bad'},{ok:false,status:503,text:async()=>'{"message":"offline"}'}]){
  const e=environment(()=>response);let settled=false;await e.send('guest',{},10000).then(()=>settled=true,()=>settled=true);await flush();assert.equal(settled,true);assert.equal(e.timers.size,0);assert.equal(e.signal().aborted,false);
 }
});
