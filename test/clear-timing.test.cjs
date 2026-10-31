'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('costly audio scheduling cannot change the solving score or stop result scheduling',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const select=html.slice(html.indexOf('  function selectTile('),html.indexOf('  function checkCleared('));
 const clear=html.slice(html.indexOf('  function onClear('),html.indexOf('  function onBoardTap('));
 let now=2000;const calls=[];const noop=()=>{};const tile=()=>({classList:{add:noop,remove:noop}});
 const state={phase:'playing',inputLocked:false,cleared:false,fixedSet:new Set(),selectedIndex:0,playId:1,resultShownPlayId:null,board:[1,0],solution:[0,1],operations:0,startTime:1000,playerName:'Alice'};
 const context={state,TOTAL:2,el:{board:{children:[tile(),tile()],classList:{add:noop}},operationDisplay:{},retireBtn:{},timeDisplay:{},completionSummary:{},completionBanner:{}},sound:{play(kind){calls.push(kind);now+=500;}},performance:{now:()=>now},checkCleared:()=>state.board.every((value,i)=>value===i),clearClearTimer:noop,clearSwapTimer:noop,stopTimer:noop,updateTileVisual:noop,formatNumber:String,formatElapsedMs:String,setMessage:noop,setNameRecordPending:noop,submitScoreForCurrentPlay:(play,name,ms)=>{calls.push({play,name,ms});},setTimeout:(fn,delay)=>{calls.push({delay});return 1;},CLEAR_BOARD_DISPLAY_MS:4000};
 vm.runInNewContext(select+clear+';selectTile(1);',context);
 assert.equal(state.elapsedMs,1000,'audio scheduling must run after the time freezes');
 assert.deepEqual(calls.filter(c=>typeof c==='string'),['swap','complete']);
 assert.deepEqual(calls.find(c=>c.ms),{play:1,name:'Alice',ms:1000});assert.ok(calls.some(c=>c.delay===4000));
});
