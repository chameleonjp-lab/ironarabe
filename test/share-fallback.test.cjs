const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('result actions occur once between score details and ranking; standalone share copy is absent',()=>{
 for(const id of ['homeCopyBtn','resultCopyBtn'])assert.ok(!html.includes(id));
 for(const id of ['againBtn','resultXShare']){assert.equal(html.split(`id="${id}"`).length-1,1);assert.ok(html.indexOf(`id="${id}"`)>html.indexOf('id="resultTime"'));assert.ok(html.indexOf(`id="${id}"`)<html.indexOf('class="card ranking-card"'));}
 assert.equal(html.split("el.againBtn.addEventListener('click',replay)").length-1,1);
});
function harness(type='ok'){
 const events=[],link={click(){events.push('navigate');if(type==='navigation')throw Error('blocked');}},popup={opener:{},document:{createElement:()=>{if(type==='create')throw Error('blocked');return link},body:{append(){events.push('append');if(type==='append')throw Error('blocked')}}},close(){events.push('close')}};
 if(type==='detach')Object.defineProperty(popup,'opener',{get:()=>({}),set:()=>{}});
 const state={phase:'home'},button={dataset:{shareUrl:'https://twitter.com/intent/tweet?text='+encodeURIComponent('イロナラベ\n確定結果 #ゲーム制作')}};let now=1000;
 const c=vm.createContext({URL,Date:{now:()=>now},state,refreshShareActions(){events.push('refresh')},window:{open(...args){events.push(['open',...args]);if(type==='throw')throw Error('blocked');return type==='null'?null:popup},prompt(...args){events.push(['prompt',...args])}},t:x=>x});
 const source=html.match(/  function createShareAction\(button, phase\) \{[\s\S]*?\n  \}/);assert.ok(source,'actual rebuilt controller exists');vm.runInContext(source[0],c);const run=c.createShareAction(button,'home');
 return{events,popup,link,state,button,advance(){now+=501},run(event={button:0,preventDefault(){events.push('prevent')}}){run(event);}};
}
test('one native activation opens detached noreferrer composer with exact payload',()=>{const h=harness();h.run();assert.equal(h.popup.opener,null);assert.equal(h.link.target,'_self');assert.equal(h.link.rel,'noreferrer');assert.equal(h.link.referrerPolicy,'no-referrer');assert.equal(new URL(h.link.href).searchParams.get('text'),'イロナラベ\n確定結果 #ゲーム制作');assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='open').length,1);assert.ok(!h.events.some(x=>Array.isArray(x)&&x[0]==='prompt'));});
for(const type of ['null','throw','navigation','detach','create','append'])test(type+' only offers fallback and keeps exact text',()=>{const h=harness(type);h.run();const prompts=h.events.filter(x=>Array.isArray(x)&&x[0]==='prompt');assert.equal(prompts.length,1);assert.equal(prompts[0][2],'イロナラベ\n確定結果 #ゲーム制作');assert.equal(h.events.includes('close'),['navigation','detach','create','append'].includes(type));});
test('rapid activation is coalesced but later deliberate activation is usable',()=>{const h=harness();h.run();h.run();h.run();assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='open').length,1);h.advance();h.run();assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='open').length,2);});
test('hidden phase and disabled controls cannot open or prompt; return home works',()=>{const h=harness();h.state.phase='playing';h.run();h.state.phase='home';h.button.disabled=true;h.run();assert.deepEqual(h.events,[]);h.button.disabled=false;h.run();assert.ok(h.events.includes('navigate'));});
test('keyboard click without mouse button works; middle button is ignored',()=>{const h=harness();h.run({button:1});assert.deepEqual(h.events,[]);h.run({preventDefault(){}});assert.ok(h.events.includes('navigate'));});
test('failure can be retried after cooldown using newest payload',()=>{const h=harness('null');h.run();h.advance();h.button.dataset.shareUrl='https://twitter.com/intent/tweet?text=new';h.run();assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='prompt').at(-1)[2],'new');});
