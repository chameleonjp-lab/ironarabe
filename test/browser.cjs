'use strict';
// Local-only full-game acceptance: every Supabase request is intercepted.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const target=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}
});
const languages=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
const boardFixture=[0,29,42,3,15,49,6,50,22,33,41,13,55,43,16,36,57,17,37,14,47,20,54,1,31,24,35,46,28,61,4,25,45,18,34,9,53,10,38,40,27,7,51,2,5,8,23,12,32,26,48,21,60,30,11,52,56,39,44,59,58,19,62];
async function bounds(page){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
 const bad=await page.locator('.screen.active button,.screen.active input,.screen.active select,.screen.active .record-line,.screen.active .hud,.screen.active .result-head,.screen.active .completion-banner,.screen.active .countdown-value').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.id||n.className));
 assert.deepEqual(bad,[],'no clipped controls/text');
}
async function switchLanguage(page,language){
 await page.locator('#languageSelect').evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));},language);
 assert.equal(await page.locator('html').getAttribute('lang'),language);
 await bounds(page);
}
async function acceptance(engine,viewport,failAudio=false){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'en-US'});
 const page=await context.newPage();const errors=[];const calls=[];let releaseSubmit;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({failAudio})=>{
  window.__sounds=[];window.__shared=[];window.__notes=[];
  Object.defineProperty(navigator,'share',{value:async data=>{window.__shared.push(data);},configurable:true});
  if(failAudio){window.AudioContext=function(){throw Error('audio unavailable')};window.webkitAudioContext=window.AudioContext;}
  else{const NativeContext=window.AudioContext||window.webkitAudioContext;if(NativeContext)window.AudioContext=function(){const ctx=new NativeContext();const create=ctx.createOscillator.bind(ctx);ctx.createOscillator=function(){const osc=create(),start=osc.start.bind(osc);osc.start=function(when){window.__notes.push(when);return start(when);};return osc;};return ctx;};}
 },{failAudio});
 await page.route('**/js/sound-effects.js',async route=>{
  const source=fs.readFileSync(path.join(root,'js/sound-effects.js'),'utf8');
  await route.fulfill({contentType:'text/javascript',body:source+`\nconst originalSoundFactory=IronarabeSound.createSoundEffects;IronarabeSound.createSoundEffects=(options)=>{const api=originalSoundFactory(options);return {...api,play(kind){window.__sounds.push(kind);return api.play(kind);}};};`});
 });
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request();const payload=request.postDataJSON();const method=new URL(request.url()).pathname.split('/').pop();calls.push({method,payload});
  if(method==='submit_score'){
   await new Promise(resolve=>{releaseSubmit=resolve;});
   await route.fulfill({json:[{accepted:true,result_display_name:'Alice 日本語',result_first_score:12345,result_best_score:3456,result_play_count:8,is_first_play:false,is_new_best:true}]});
  }else if(method==='get_best_score_ranking')await route.fulfill({json:[{rank_no:1,display_name:'<保持名>',best_score:3456},{rank_no:1,display_name:'Tie',best_score:3456}]});
  else throw Error('Unexpected RPC '+method);
 });
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.locator('#languageSelect option').count(),15);
  assert.equal(calls.length,0,'home does not fetch rankings');
  await page.click('#howToBtn');
  for(const language of languages){await page.selectOption('#languageSelect',language);await bounds(page);}
  await page.click('#howToBtn');
  await page.selectOption('#languageSelect','en');
  await page.tap('#homeSoundBtn');assert.equal(await page.locator('#homeSoundBtn').getAttribute('aria-pressed'),'false');
  await page.tap('#homeSoundBtn');assert.equal(await page.locator('#homeSoundBtn').getAttribute('aria-pressed'),'true');
  await page.fill('#playerNameInput','x'.repeat(21));await page.tap('#startBtn');assert.ok((await page.locator('#nameError').innerText()).length);
  await switchLanguage(page,'de');assert.match(await page.locator('#nameError').innerText(),/Spieler/);
  await page.fill('#playerNameInput','Alice 日本語');await page.tap('#startBtn');
  await page.clock.runFor(3150);assert.equal(await page.locator('body').getAttribute('data-phase'),'playing');
  assert.equal(await page.locator('.tile').count(),63);assert.equal(await page.locator('.tile.fixed').count(),8);
  await page.tap('.tile[data-pos="0"]');assert.equal(await page.locator('.selected').count(),0);
  await page.tap('.tile[data-pos="1"]');await page.tap('.tile[data-pos="1"]');
  assert.deepEqual(await page.evaluate(()=>__sounds),['select','cancel']);
  for(const language of languages){await switchLanguage(page,language);}
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
  const board=boardFixture.slice();let moves=0;
  for(let i=0;i<board.length;i++)if(board[i]!==i){const j=board.indexOf(i);await page.click(`.tile[data-pos="${i}"]`);await page.click(`.tile[data-pos="${j}"]`);[board[i],board[j]]=[board[j],board[i]];moves++;}
  assert.equal(await page.locator('#completionBanner').isVisible(),true);
  const frozen=await page.locator('#timeDisplay').innerText();
  await page.clock.runFor(3990);assert.equal(await page.locator('body').getAttribute('data-phase'),'playing');assert.equal(await page.locator('#timeDisplay').innerText(),frozen);
  await page.clock.runFor(30);assert.equal(await page.locator('body').getAttribute('data-phase'),'result');
  assert.equal(calls.filter(c=>c.method==='submit_score').length,1);
  const sent=calls.find(c=>c.method==='submit_score').payload;
  assert.equal(sent.p_game_slug,'ironarabe');assert.equal(sent.p_display_name,'Alice 日本語');assert.ok(Number.isInteger(sent.p_score)&&sent.p_score>0);
  assert.match(sent.p_client_version,/^ironarabe-web-1\.4\.1-stagepack001-v2-(sunset|aurora|ocean|leaf|amber|wisteria|coral|nebula|breeze|autumn)-r[0-3]$/);
  assert.equal(await page.evaluate(()=>__sounds.filter(s=>s==='complete').length),1);assert.equal(await page.evaluate(()=>__sounds.filter(s=>s==='result').length),1);
  assert.equal(await page.evaluate(()=>__sounds.filter(s=>s==='swap').length),moves);
  releaseSubmit();await page.waitForFunction(()=>document.querySelector('#namePlayCountDisplay').textContent.includes('8'));
  for(const language of languages){await switchLanguage(page,language);await bounds(page);assert.equal(await page.locator('#recordNameDisplay').innerText(),'Alice 日本語');assert.equal(await page.locator('.ranking-name').first().innerText(),'<保持名>');}
  await switchLanguage(page,'de');assert.match(await page.locator('#bestScoreDisplay').innerText(),/34,56/);
  fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts',`${engine.name()}-${viewport.width}x${viewport.height}-result.png`),fullPage:true});
  await page.click('#resultShareBtn');const shared=await page.evaluate(()=>__shared.at(-1));assert.ok(shared.text.includes('https://chameleonjp-lab.github.io/ironarabe/'));assert.ok(!shared.text.includes('codeberg'));
  await page.tap('#resultSoundBtn');assert.equal(await page.locator('#resultSoundBtn').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.sound.v1')),'false');await page.tap('#resultSoundBtn');
  assert.equal(await page.locator('#resultSoundBtn').getAttribute('aria-pressed'),'true');
  if(!failAudio)assert.ok(await page.evaluate(()=>__notes.length>0),'gesture-enabled native Web Audio schedules tones');
  await page.evaluate(()=>{localStorage.setItem('ironarabe.old.cache','stale');sessionStorage.setItem('ironarabe.old.cache','stale')});
  await page.click('#againBtn');assert.equal(await page.inputValue('#playerNameInput'),'Alice 日本語');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.language.v1')),'de');assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.sound.v1')),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.old.cache')),null);assert.equal(await page.evaluate(()=>sessionStorage.getItem('ironarabe.old.cache')),null);
  const before=calls.length;await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'de');assert.equal(await page.locator('#homeSoundBtn').getAttribute('aria-pressed'),'true');assert.equal(calls.length,before);
  await page.click('#homeShareBtn');assert.ok((await page.evaluate(()=>__shared.at(-1).text)).includes('https://chameleonjp-lab.github.io/ironarabe/'));
  if(failAudio){await page.evaluate(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('blocked','SecurityError')},configurable:true});document.querySelector('#againBtn').click();});assert.equal(await page.locator('body').getAttribute('data-phase'),'home','replay survives storage denial');}
  assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} ${viewport.width}x${viewport.height} audioFailure=${failAudio}: 15 locales, full game, timing, ranking, replay, shares`);
 }finally{if(releaseSubmit)releaseSubmit();await context.close();await browser.close();}
}
async function failureAcceptance(engine){
 const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'en-US'}),page=await context.newPage();
 const errors=[],calls=[];let round=1,releaseSubmit,releaseRanking;page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.supabase.co/**',async route=>{
  const method=new URL(route.request().url()).pathname.split('/').pop();calls.push(method);
  if(round===1){await route.fulfill({status:503,json:{message:'offline'}});return;}
  if(method==='submit_score'){await new Promise(resolve=>{releaseSubmit=resolve});await route.fulfill({json:[{accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:12345,result_best_score:3456,result_play_count:9,is_first_play:false,is_new_best:true}]});}
  else{await new Promise(resolve=>{releaseRanking=resolve});await route.fulfill({json:[{rank_no:1,display_name:'Late stale name',first_score:12345,best_score:3456,play_count:9,updated_at:'2026-10-31T00:00:00Z'}]});}
 });
 async function solve(){
  await page.fill('#playerNameInput','Alice');await page.tap('#startBtn');await page.clock.runFor(3200);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
  const board=boardFixture.slice();for(let i=0;i<board.length;i++)if(board[i]!==i){const j=board.indexOf(i);await page.locator(`.tile[data-pos="${i}"]`).dispatchEvent('click');await page.locator(`.tile[data-pos="${j}"]`).dispatchEvent('click');[board[i],board[j]]=[board[j],board[i]];}
  await page.clock.runFor(4001);
 }
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);await solve();
  await page.waitForFunction(()=>document.querySelector('#rankNote').classList.contains('err')&&document.querySelector('#resultRankingStatus').classList.contains('err'));
  const catalog=require('../js/translations.js');for(const language of languages){await switchLanguage(page,language);assert.equal(await page.locator('#rankNote').innerText(),catalog[language]['ランキング送信に失敗しました']);assert.equal(await page.locator('#nameRecordStatus').innerText(),catalog[language]['登録名の記録を取得できませんでした。']);assert.equal(await page.locator('#resultRankingStatus').innerText(),catalog[language]['ランキングを読み込めませんでした。']);}
  assert.equal(calls.filter(method=>method==='submit_score').length,1);await page.tap('#againBtn');round=2;await solve();
  assert.equal(await page.locator('body').getAttribute('data-phase'),'result');await page.waitForFunction(()=>document.querySelector('#resultRankingStatus').getAttribute('data-i18n')==='ランキングを読み込み中…');
  assert.ok(releaseSubmit&&releaseRanking);await page.tap('#againBtn');const count=calls.length;releaseSubmit();releaseRanking();
  await page.waitForTimeout(100);assert.equal(await page.locator('body').getAttribute('data-phase'),'home');assert.equal(await page.locator('#recordNameDisplay').innerText(),'--');assert.equal(await page.locator('#resultRankingList').innerText(),'');assert.equal(calls.length,count,'stale submit does not start another ranking request');assert.equal(await page.inputValue('#playerNameInput'),'Alice');assert.deepEqual(errors,[]);
  console.log(`PASS ${engine.name()} communication failure: 15 locales, retry-free submit, stale async response isolation`);
 }finally{releaseSubmit?.();releaseRanking?.();await context.close();await browser.close();}
}
async function guestAcceptance(engine,viewport){
 const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'en-US'}),page=await context.newPage();const calls=[],errors=[];let releaseGuest;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://*.supabase.co/**',async route=>{
  const method=new URL(route.request().url()).pathname.split('/').pop(),payload=route.request().postDataJSON();calls.push({method,payload});
  if(method==='start_ironarabe_guest_play_v1'){
   await new Promise(resolve=>{releaseGuest=resolve});await route.fulfill({json:{accepted:true,duplicate:false,start_id:payload.p_start_id,play_id:'00000000-0000-4000-8000-000000000001',game_slug:'ironarabe',client_version:payload.p_client_version}});
  }else if(method==='get_best_score_ranking'){assert.equal(payload.p_limit,30);await route.fulfill({json:Array.from({length:30},(_,i)=>({rank_no:i===1?1:i+1,display_name:`Existing ${i+1} <&>`,best_score:i===1?1000:1000+i*100}))});}
  else throw Error('Guest attempted unexpected RPC '+method);
 });
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);assert.equal(await page.locator('#guestStartBtn').count(),1,'explicit unnamed play choice');
  const details='https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=ironarabe';assert.equal(await page.locator('#homeLabLink').getAttribute('href'),details);
  assert.equal(await page.inputValue('#playerNameInput'),'');await page.tap('#startBtn');await page.clock.runFor(3150);assert.equal(await page.locator('body').getAttribute('data-phase'),'playing','empty name starts normally');
  assert.equal(calls.filter(c=>c.method==='start_ironarabe_guest_play_v1').length,1);const first=calls[0].payload;assert.equal(first.p_game_slug,'ironarabe');assert.ok(!('p_display_name' in first)&&!('p_score' in first));
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));const board=boardFixture.slice();for(let i=0;i<board.length;i++)if(board[i]!==i){const j=board.indexOf(i);await page.locator(`.tile[data-pos="${i}"]`).dispatchEvent('click');await page.locator(`.tile[data-pos="${j}"]`).dispatchEvent('click');[board[i],board[j]]=[board[j],board[i]];}
  await page.clock.runFor(4001);assert.equal(await page.locator('body').getAttribute('data-phase'),'result','guest count response never blocks results');await page.locator('.ranking-row').nth(29).waitFor();assert.equal(await page.locator('.ranking-row').count(),30);
  assert.equal(calls.filter(c=>c.method==='submit_score').length,0);assert.equal(await page.locator('#firstScoreDisplay').isVisible(),false);assert.equal(await page.locator('#bestScoreDisplay').isVisible(),false);assert.equal(await page.locator('#namePlayCountDisplay').isVisible(),false);
  const catalog=require('../js/translations.js');for(const language of languages){await switchLanguage(page,language);assert.equal(await page.locator('#recordNameDisplay').innerText(),catalog[language]['名前なし（ランキング対象外）']);assert.equal(await page.locator('#rankNote').innerText(),catalog[language]['プレイ回数を送信中…']);}
  assert.equal(await page.locator('#resultLabLink').getAttribute('href'),details);await page.locator('.ranking-row').nth(29).scrollIntoViewIfNeeded();assert.equal(await page.locator('.ranking-name').nth(29).innerText(),'Existing 30 <&>');
  const scroll=await page.locator('#resultRankingScroll').evaluate(n=>({scroll:n.scrollTop,max:n.scrollHeight-n.clientHeight}));assert.ok(scroll.scroll>0&&scroll.max>0,'all 30 entries are reachable inside the ranking scroll');
  await page.evaluate(()=>localStorage.setItem('ironarabe.v2.playerName','Saved Alice'));await page.tap('#againBtn');assert.equal(await page.inputValue('#playerNameInput'),'Saved Alice');assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.'))),'replay retains the unacknowledged count');
  releaseGuest();await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.')));assert.equal(await page.locator('body').getAttribute('data-phase'),'home');
  await page.tap('#guestStartBtn');await page.clock.runFor(3200);await page.waitForFunction(()=>document.body.dataset.phase==='playing');assert.equal(calls.filter(c=>c.method==='start_ironarabe_guest_play_v1').length,2);assert.notEqual(calls.at(-1).payload.p_start_id,first.p_start_id);assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.v2.playerName')),'Saved Alice');releaseGuest();await page.tap('#retireBtn');
  assert.equal(calls.filter(c=>c.method==='submit_score').length,0);assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} guest ${viewport.width}x${viewport.height}: optional name, count once/start, no score, 30 ranks, saved name and pending replay`);
 }finally{releaseGuest?.();await context.close();await browser.close();}
}
async function guestRecoveryAcceptance(engine){
 const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();let mode='hold',releaseFirst;const calls=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.supabase.co/**',async route=>{
  assert.ok(route.request().url().endsWith('/start_ironarabe_guest_play_v1'),'guest recovery sends count-only RPCs');const payload=route.request().postDataJSON();calls.push(payload);
  if(mode==='hold'){await new Promise(resolve=>{releaseFirst=resolve});await route.fulfill({status:503,json:{message:'old offline request'}});}
  else if(mode==='fail')await route.fulfill({status:503,json:{message:'offline'}});
  else await route.fulfill({json:{accepted:true,duplicate:true,start_id:payload.p_start_id,play_id:'00000000-0000-4000-8000-000000000001',game_slug:'ironarabe',client_version:payload.p_client_version}});
 });
 async function start(){await page.tap('#startBtn');await page.clock.runFor(3200);assert.equal(await page.locator('body').getAttribute('data-phase'),'playing');}
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);await start();assert.equal(calls.length,1);assert.ok(releaseFirst);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));mode='ack';releaseFirst();await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.')));
  assert.equal(calls.length,2);assert.deepEqual(calls[1],calls[0],'online race retries the original immutable ID/version');await page.tap('#retireBtn');
  mode='fail';const rejected=page.waitForResponse(r=>r.url().endsWith('/start_ironarabe_guest_play_v1')&&r.status()===503);await start();await rejected;assert.equal(calls.length,3);const pending=calls[2];
  assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.'))));mode='ack';await page.reload();await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.')));assert.equal(calls.length,4);assert.deepEqual(calls[3],pending,'reload retries the previous start without inventing another play');assert.equal(await page.locator('body').getAttribute('data-phase'),'home');assert.deepEqual(errors,[]);
  console.log(`PASS ${engine.name()} guest recovery: online during failed request and reload preserve exact start IDs`);
 }finally{releaseFirst?.();await context.close();await browser.close();}
}
async function stagePackAcceptance(engine){
 const {loadGameStages}=require('../tools/game-stage-contract.cjs'),game=loadGameStages(),catalog=require('../js/translations.js');
 const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'en-US'}),page=await context.newPage();
 const calls=[],errors=[],seen=new Set();page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('ironarabe.sound.v1','false'));
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),method=new URL(request.url()).pathname.split('/').pop(),payload=request.postDataJSON();calls.push({method,payload});
  if(method==='submit_score')await route.fulfill({json:[{accepted:true,result_display_name:'Stage Audit',result_first_score:100,result_best_score:100,result_play_count:calls.filter(c=>c.method==='submit_score').length,is_first_play:false,is_new_best:false}]});
  else if(method==='get_best_score_ranking'){assert.equal(payload.p_limit,30);await route.fulfill({json:[{rank_no:1,display_name:'Existing record',best_score:100}]});}
  else throw Error('Unexpected stage audit RPC '+method);
 });
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.fill('#playerNameInput','Stage Audit');
  for(let play=0;play<40;play++){
   const language=languages[play%languages.length];await switchLanguage(page,language);
   await page.locator('#startBtn').dispatchEvent('click');await page.clock.runFor(4200);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
   assert.equal(await page.locator('body').getAttribute('data-phase'),'playing');assert.equal(await page.locator('.tile').count(),63);assert.equal(await page.locator('.tile.fixed').count(),8);
   for(const viewport of [{width:402,height:874},{width:874,height:402}]){await page.setViewportSize(viewport);await bounds(page);}
   const response=page.waitForResponse(r=>r.url().endsWith('/submit_score'));
   const moves=await page.evaluate(board=>{
    let moves=0;for(let i=0;i<board.length;i++)if(board[i]!==i){const j=board.indexOf(i);document.querySelector(`.tile[data-pos="${i}"]`).click();document.querySelector(`.tile[data-pos="${j}"]`).click();[board[i],board[j]]=[board[j],board[i]];moves++;}return moves;
   },boardFixture.slice());
   assert.equal(moves,49);assert.equal(await page.locator('#completionBanner').isVisible(),true);await response;
   const submitted=calls.filter(c=>c.method==='submit_score');assert.equal(submitted.length,play+1,'one score submission per clear');
   const payload=submitted.at(-1).payload;assert.equal(payload.p_game_slug,'ironarabe');assert.equal(payload.p_display_name,'Stage Audit');assert.ok(Number.isInteger(payload.p_score)&&payload.p_score>0);
   const stage=game.STAGES.find(s=>game.CLIENT_VERSION+'-'+s.id===payload.p_client_version);assert.ok(stage,'a real stage ID is sent using the unchanged version prefix');assert.ok(!seen.has(stage.id),'no repeated problem in the forty-stage bag');seen.add(stage.id);
   const colors=await page.locator('.tile').evaluateAll(tiles=>tiles.map(tile=>tile.style.background.replace(/\s/g,'')));
   assert.deepEqual(colors,Array.from(game.buildTiles(stage.challenge),tile=>tile.color.replace(/\s/g,'')),stage.id+' actual browser colors match the complete board');
   const nf=new Intl.NumberFormat(language);assert.equal(await page.locator('#stageDisplay').innerText(),nf.format(stage.number)+' / '+nf.format(40));assert.equal(await page.locator('#stageDisplay').getAttribute('title'),catalog[language][stage.paletteName]+' '+nf.format(stage.rotation*90)+'°');
   await page.clock.runFor(4001);assert.equal(await page.locator('body').getAttribute('data-phase'),'result');await page.locator('.ranking-row').waitFor();await bounds(page);
   assert.equal(await page.locator('#resultStage').innerText(),catalog[language][stage.paletteName]+' '+nf.format(stage.rotation*90)+'° ('+nf.format(stage.number)+' / '+nf.format(40)+')');
   if(play<39){await page.locator('#againBtn').dispatchEvent('click');assert.equal(await page.inputValue('#playerNameInput'),'Stage Audit');assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.sound.v1')),'false');}
  }
  assert.equal(seen.size,40);assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} all 40 stages: 63 colors, 8 anchors, 49 swaps, portrait/landscape, translated names, results, compatible mock scores`);
 }finally{await context.close();await browser.close();}
}
async function homeStartAcceptance(engine){
 const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'en-US'}),page=await context.newPage();
 const calls=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('ironarabe.v2.playerName','Saved Alice');localStorage.setItem('ironarabe.sound.v1','false');});
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),method=new URL(request.url()).pathname.split('/').pop(),payload=request.postDataJSON();assert.equal(method,'start_ironarabe_guest_play_v1','starting or retiring never submits a named score');calls.push(payload);
  await route.fulfill({json:{accepted:true,duplicate:false,start_id:payload.p_start_id,play_id:'00000000-0000-4000-8000-000000000001',game_slug:'ironarabe',client_version:payload.p_client_version}});
 });
 try{
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.locator('#playerNameInput').isVisible(),true,'the optional name is editable on the initial home screen');assert.equal(await page.inputValue('#playerNameInput'),'Saved Alice');
  assert.notEqual(await page.evaluate(()=>document.activeElement.id),'playerNameInput','home does not open the keyboard automatically');
  for(const viewport of [{width:402,height:874},{width:874,height:402}]){
   await page.setViewportSize(viewport);
   for(const language of languages){await switchLanguage(page,language);await page.evaluate(()=>scrollTo(0,0));const box=await page.locator('#startBtn').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height,`${language}: start is on the initial ${viewport.width}x${viewport.height} viewport`);}
   await switchLanguage(page,'ja');fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts',`${engine.name()}-${viewport.width}x${viewport.height}-home-name.png`),fullPage:true});
  }
  await page.fill('#playerNameInput','x'.repeat(21));await page.tap('#startBtn');assert.equal(await page.locator('body').getAttribute('data-phase'),'home');assert.ok((await page.locator('#nameError').innerText()).length);assert.equal(calls.length,0);
  await page.fill('#playerNameInput','  Alice 日本語  ');await page.locator('#playerNameInput').dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await page.locator('body').getAttribute('data-phase'),'home','IME confirmation does not start a game');
  await page.locator('#playerNameInput').dispatchEvent('keydown',{key:'Enter',keyCode:229,isComposing:false});assert.equal(await page.locator('body').getAttribute('data-phase'),'home','Safari IME confirmation with keyCode 229 does not start a game');
  await page.locator('#playerNameInput').dispatchEvent('keydown',{key:'Enter',isComposing:false});assert.equal(await page.locator('body').getAttribute('data-phase'),'countdown','Enter starts directly from home');await page.locator('#startBtn').dispatchEvent('click');
  assert.notEqual(await page.evaluate(()=>document.activeElement.id),'playerNameInput','starting closes the input keyboard');await page.clock.runFor(3200);assert.equal(await page.locator('body').getAttribute('data-phase'),'playing');assert.equal(calls.length,0);assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.v2.playerName')),'Alice 日本語');
  await page.tap('#retireBtn');assert.equal(await page.locator('body').getAttribute('data-phase'),'home');assert.equal(await page.inputValue('#playerNameInput'),'Alice 日本語');
  await page.fill('#playerNameInput','');await page.tap('#startBtn');assert.equal(await page.locator('body').getAttribute('data-phase'),'countdown','one start tap with an empty name enters countdown');await page.locator('#startBtn').dispatchEvent('click');await page.locator('#guestStartBtn').dispatchEvent('click');assert.equal(calls.length,0,'counting waits for actual play');
  await page.clock.runFor(3200);assert.equal(calls.length,1,'repeated start controls count one actual play');assert.equal(calls[0].p_game_slug,'ironarabe');assert.ok(!('p_score' in calls[0])&&!('p_display_name' in calls[0]));await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.')));await page.tap('#retireBtn');assert.equal(await page.inputValue('#playerNameInput'),'Alice 日本語');
  await page.tap('#guestStartBtn');assert.equal(await page.locator('body').getAttribute('data-phase'),'countdown','saved names still allow an explicit immediate guest start');await page.clock.runFor(3200);assert.equal(calls.length,2);assert.notEqual(calls[0].p_start_id,calls[1].p_start_id);await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('ironarabe.guestPlay.v1.')));await page.tap('#retireBtn');assert.equal(await page.evaluate(()=>localStorage.getItem('ironarabe.v2.playerName')),'Alice 日本語');
  assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} home name: direct start, optional/saved names, validation, IME, repeat taps, 15 languages and portrait/landscape`);
 }finally{await context.close();await browser.close();}
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{
 const engines=process.env.BROWSER_ENGINES==='chromium'?[chromium]:[chromium,webkit],suite=process.env.BROWSER_SUITE;
 if(suite==='home-start'){for(const engine of engines)await homeStartAcceptance(engine);return;}
 if(suite!=='guest'&&suite!=='stage-pack')for(const engine of engines)for(const viewport of [{width:402,height:874},{width:874,height:402}])await acceptance(engine,viewport,viewport.width===874);
 if(suite!=='guest'&&suite!=='stage-pack')for(const engine of engines)await failureAcceptance(engine);
 if(suite!=='stage-pack')for(const engine of engines)for(const viewport of [{width:402,height:874},{width:874,height:402}])await guestAcceptance(engine,viewport);
 if(suite!=='stage-pack')for(const engine of engines)await guestRecoveryAcceptance(engine);
 if(suite!=='guest')for(const engine of engines)await stagePackAcceptance(engine);
 if(!suite)for(const engine of engines)await homeStartAcceptance(engine);
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
