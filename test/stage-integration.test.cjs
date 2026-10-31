'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),crypto=require('node:crypto');
const {loadGameStages}=require('../tools/game-stage-contract.cjs'),legacy=require('./fixtures/legacy-eight-stages.json');
const hash=tiles=>crypto.createHash('sha256').update(JSON.stringify(tiles.map(t=>t.color))).digest('hex');
test('the real game offers forty different problems while preserving its original eight exactly',()=>{
 const game=loadGameStages();assert.equal(game.STAGES.length,40);assert.equal(new Set(game.STAGES.map(s=>s.id)).size,40);
 for(const before of legacy.stages){const stage=game.STAGES.find(s=>s.id===before.id);assert.ok(stage);assert.equal(stage.number,before.number);assert.equal(stage.challenge.id,before.challengeId);assert.equal(hash(game.buildTiles(stage.challenge)),before.colorHash);}
 assert.equal(new Set(game.STAGES.map(s=>hash(game.buildTiles(s.challenge)))).size,40,'all forty complete color boards must differ');
});
test('the real forty-problem shuffle bag has no duplicates or repeats at its boundary',()=>{
 const game=loadGameStages();const picks=Array.from({length:80},()=>game.chooseNextStage().id);
 assert.equal(new Set(picks.slice(0,40)).size,40);assert.equal(new Set(picks.slice(40)).size,40);assert.notEqual(picks[39],picks[40]);
});
test('new colors keep the original fixed positions, tile IDs, seed and official swap problem',()=>{
 const game=loadGameStages();game.initFixedSet();assert.equal(game.SHUFFLE_SEED,'ironarabe-official-001-v1');
 const expected='cb6e637f2e901a5c831b135efbdd36926d14c76f0260d3893d4241d2033681e2';
 for(const stage of game.STAGES){const tiles=game.buildTiles(stage.challenge);assert.equal(tiles.length,63);assert.deepEqual(Array.from(tiles,t=>t.id),Array.from({length:63},(_,i)=>i));assert.equal(crypto.createHash('sha256').update(JSON.stringify(game.shuffledBoard().board)).digest('hex'),expected);}
});
test('the anonymous queue accepts every real stage version without changing the ranking version prefix',async()=>{
 const game=loadGameStages(),{createGuestPlayCounter}=require('../js/guest-plays.js');const calls=[];let id=0;
 const queue=createGuestPlayCounter({storage:null,randomUUID:()=>`10000000-0000-4000-8000-${String(++id).padStart(12,'0')}`,send:async payload=>{calls.push(payload);return {accepted:true,start_id:payload.p_start_id,play_id:'90000000-0000-4000-8000-000000000001',game_slug:'ironarabe',client_version:payload.p_client_version};}});
 for(const stage of game.STAGES){assert.ok(queue.record(game.CLIENT_VERSION+'-'+stage.id),stage.id);await queue.retry();}
 assert.equal(calls.length,40);assert.equal(new Set(calls.map(c=>c.p_client_version)).size,40);
});
