const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('result actions occur once between score details and ranking; standalone share copy is absent',()=>{
 for(const id of ['homeCopyBtn','resultCopyBtn'])assert.ok(!html.includes(id));
 for(const id of ['againBtn','resultShareBtn']){assert.equal(html.split(`id="${id}"`).length-1,1);assert.ok(html.indexOf(`id="${id}"`)>html.indexOf('id="resultTime"'));assert.ok(html.indexOf(`id="${id}"`)<html.indexOf('class="card ranking-card"'));}
 assert.equal(html.split("el.againBtn.addEventListener('click',replay)").length-1,1);
});
function harness(type='ok'){
 const events=[],link={click(){events.push('navigate');if(type==='navigation')throw Error('blocked');}},popup={opener:{},document:{createElement:()=>{if(type==='create')throw Error('blocked');return link},body:{append(){events.push('append');if(type==='append')throw Error('blocked')}}},close(){events.push('close')}};
 if(type==='detach')Object.defineProperty(popup,'opener',{get:()=>({}),set:()=>{}});
 const c=vm.createContext({URL,updateShareLinks(){events.push('refresh')},window:{open(...args){events.push(['open',...args]);if(type==='throw')throw Error('blocked');return type==='null'?null:popup},prompt(...args){events.push(['prompt',...args])}},t:x=>x});
 const source=html.match(/  function activateXShare\(event, link\) \{[\s\S]*?\n  \}/);assert.ok(source,'actual inline share handler exists');vm.runInContext(source[0],c);
 return{events,popup,link,run(event={button:0,preventDefault(){events.push('prevent')}}){c.activateXShare(event,{href:'https://twitter.com/intent/tweet?text='+encodeURIComponent('イロナラベ\n確定結果 #ゲーム制作')});}};
}
test('normal tap opens one detached no-referrer composer with exact payload',()=>{const h=harness();h.run();assert.equal(h.popup.opener,null);assert.equal(h.link.target,'_self');assert.equal(h.link.rel,'noreferrer');assert.equal(h.link.referrerPolicy,'no-referrer');assert.equal(new URL(h.link.href).searchParams.get('text'),'イロナラベ\n確定結果 #ゲーム制作');assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='open').length,1);assert.ok(!h.events.some(x=>Array.isArray(x)&&x[0]==='prompt'));});
for(const type of ['null','throw','navigation','detach','create','append'])test(type+' only offers fallback and keeps exact text',()=>{const h=harness(type);h.run();const prompts=h.events.filter(x=>Array.isArray(x)&&x[0]==='prompt');assert.equal(prompts.length,1);assert.equal(prompts[0][2],'イロナラベ\n確定結果 #ゲーム制作');assert.equal(h.events.includes('close'),['navigation','detach','create','append'].includes(type));});
for(const event of [{button:1},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true}])test('modified activation keeps native href '+JSON.stringify(event),()=>{const h=harness();h.run({...event,preventDefault(){assert.fail('native should remain')}});assert.equal(h.events.length,1);assert.equal(h.events[0],'refresh');});
