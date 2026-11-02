const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function line(name){return html.match(new RegExp('  function '+name+'[^\\n]+'))[0]}
test('leaving result invalidates prior ranking response before next run',async()=>{
 let resolve;const applied=[];const noop=()=>{};const c={state:{rankingRequestId:0,rankingRows:[],scorePlay:{id:'old'}},isRankingConfigured:()=>true,setRankingState:noop,postRpc:()=>new Promise(r=>resolve=r),normalizeRankingRows:r=>r,applyRankingRows:r=>applied.push(r),GAME_SLUG:'ironarabe',RANKING_LIMIT:30,RANKING_FETCH_TIMEOUT_MS:1000,sound:{stop:noop},stopTimer:noop,clearPendingTimers:noop,hideCompletion:noop,el:{retireBtn:{},board:{},playerNameInput:{},nameError:{}},getSavedPlayerName:()=>'',setMessage:noop,setPhase:p=>c.state.phase=p};
 vm.createContext(c);vm.runInContext(line('loadRankings')+'\n'+line('returnHome'),c);
 const old=c.loadRankings(true);c.returnHome();c.state.scorePlay={id:'new'};c.state.phase='result';resolve([{rank_no:1,display_name:'old',best_score:100}]);await old;assert.equal(applied.length,0);
});
test('old queue ACK cannot update current result',()=>{
 const c={state:{scorePlay:{id:'new'}},document:{getElementById(){throw Error('old callback touched DOM')}},el:{},updateRankingStatus(){throw Error('old changed status')}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('  function onScoreQueueChange('),html.indexOf('  function submitScoreForCurrentPlay(')),c);c.onScoreQueueChange({id:'old',state:'submitted'},{});
});
