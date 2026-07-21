#!/usr/bin/env python3
from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count == 0 and new and new in text:
        print(f"already patched: {label}")
        return
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    text = text.replace(old, new, 1)
    print(f"patched: {label}")


def replace_regex(pattern: str, replacement: str, label: str) -> None:
    global text
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 regex match, found {count}")
    text = updated
    print(f"patched: {label}")


replace_once(
    "  .best-line, .record-line { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }\n",
    "  .record-line { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }\n",
    "local best css",
)
replace_once(
    "  .best-line .val, .record-line .val { font-size:22px; font-weight:700; color:var(--text); font-variant-numeric:tabular-nums; white-space:nowrap; }\n",
    "  .record-line .val { font-size:22px; font-weight:700; color:var(--text); font-variant-numeric:tabular-nums; white-space:nowrap; }\n",
    "local best value css",
)

replace_regex(
    r'\n    <div class="card best-line">\n      <div>\n        <h3 style="margin-bottom:2px;">この端末のベスト記録</h3>\n        <p style="font-size:11px;">この端末に保存されたローカル記録です。サーバーランキングではありません。</p>\n      </div>\n      <div class="val"><span id="homeBest">--.--</span>秒</div>\n    </div>',
    "",
    "home local best card",
)
replace_regex(
    r'\n    <div class="card ranking-card" aria-label="ベストタイムランキング30位まで">\n      <div class="ranking-title"><h3>ベストタイムランキング</h3><span>30位まで</span></div>\n      <div class="ranking-status" id="homeRankingStatus" aria-live="polite">読み込み中…</div>\n      <div class="ranking-scroll" id="homeRankingScroll" hidden><div id="homeRankingList" role="list"></div></div>\n    </div>',
    "",
    "home ranking card",
)

replace_once('<h3 id="nameRecordTitle">この名前の記録</h3>', '<h3 id="nameRecordTitle">登録名の記録</h3>', "record heading")
replace_once('この名前の初回記録', '登録名の初回記録', "first record label")
replace_once('この名前のベスト記録', '登録名のベスト記録', "best record label")
replace_once('この名前のプレイ回数', '登録名のプレイ回数', "play count label")

replace_once(
    "CLIENT_VERSION='ironarabe-web-1.4.0-stagepack001-v2'",
    "CLIENT_VERSION='ironarabe-web-1.4.1-stagepack001-v2'",
    "client version",
)
replace_once(
    "  const LS={playerName:'ironarabe.v2.playerName',firstScore:'ironarabe.v2.official001.firstScore',bestScore:'ironarabe.v2.official001.bestScore',playCount:'ironarabe.v2.official001.playCount',lastResult:'ironarabe.v2.official001.lastResult',oldPlayerName:'ironarabe.playerName',oldBestTimeMs:'ironarabe.bestTimeMs',oldLastResult:'ironarabe.lastResult'};\n",
    "  const LOCAL_CACHE_PREFIX='ironarabe.';\n  const LS={playerName:'ironarabe.v2.playerName',oldPlayerName:'ironarabe.playerName'};\n",
    "storage contract",
)
replace_once(
    "    playCountIncrementedPlayId:null, clearTimerId:null, swapTimerId:null, submittedPlayId:null,\n",
    "    clearTimerId:null, swapTimerId:null, submittedPlayId:null,\n",
    "local play count state",
)
replace_once(
    "    homeBest:document.getElementById('homeBest'), homeShareBtn:document.getElementById('homeShareBtn'),\n    homeToast:document.getElementById('homeToast'), homeLabLink:document.getElementById('homeLabLink'),\n    homeRankingStatus:document.getElementById('homeRankingStatus'), homeRankingScroll:document.getElementById('homeRankingScroll'),\n    homeRankingList:document.getElementById('homeRankingList'), playerNameInput:document.getElementById('playerNameInput'),\n",
    "    homeShareBtn:document.getElementById('homeShareBtn'), homeToast:document.getElementById('homeToast'),\n    homeLabLink:document.getElementById('homeLabLink'), playerNameInput:document.getElementById('playerNameInput'),\n",
    "home record and ranking references",
)
replace_once(
    "  function parsePositiveInt(raw){if(raw===null)return null;const n=Number(raw);return Number.isFinite(n)&&Number.isInteger(n)&&n>0?n:null;}\n",
    "",
    "unused local integer parser",
)
replace_once(
    "  function migrateOldStorage(){if(!safeStorageGet(LS.playerName)){const old=validateName(safeStorageGet(LS.oldPlayerName)||'');if(old.ok)safeStorageSet(LS.playerName,old.name);}if(!safeStorageGet(LS.bestScore)){const oldMs=parsePositiveInt(safeStorageGet(LS.oldBestTimeMs));if(oldMs)safeStorageSet(LS.bestScore,String(elapsedMsToScore(oldMs)));}}\n  function loadLocalRecords(){return {playerName:safeStorageGet(LS.playerName)||'',firstScore:parsePositiveInt(safeStorageGet(LS.firstScore)),bestScore:parsePositiveInt(safeStorageGet(LS.bestScore)),playCount:parsePositiveInt(safeStorageGet(LS.playCount))||0};}\n  function refreshHomeRecords(){const r=loadLocalRecords();state.playerName=r.playerName;el.homeBest.textContent=formatScore(r.bestScore);}\n",
    "  function migrateOldPlayerName(){if(safeStorageGet(LS.playerName))return;const old=validateName(safeStorageGet(LS.oldPlayerName)||'');if(old.ok)safeStorageSet(LS.playerName,old.name);}\n  function getSavedPlayerName(){return safeStorageGet(LS.playerName)||'';}\n  function clearStorageNamespace(storage){try{const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&key.startsWith(LOCAL_CACHE_PREFIX)&&key!==LS.playerName)keys.push(key);}keys.forEach(function(key){storage.removeItem(key);});}catch(e){}}\n  function clearReplayCachePreserveName(){const savedName=getSavedPlayerName()||state.playerName;state.playId+=1;state.rankingRequestId+=1;state.rankingRows=[];clearPendingTimers();clearStorageNamespace(localStorage);clearStorageNamespace(sessionStorage);if(savedName)safeStorageSet(LS.playerName,savedName);state.stage=null;state.tiles=[];state.solution=[];state.board=[];state.selectedIndex=null;state.operations=0;state.startTime=null;state.elapsedMs=0;state.cleared=false;state.clearPlayId=null;state.resultShownPlayId=null;state.submittedPlayId=null;state.inputLocked=true;el.board.innerHTML='';el.resultRankingList.innerHTML='';setRankingState('idle','');resetNameRecord();clearToast('result');}\n  function replay(){clearReplayCachePreserveName();openNameConfirm();}\n",
    "name-only replay cache",
)
replace_once(
    "function returnHome(){stopTimer();clearPendingTimers();hideCompletion();state.selectedIndex=null;state.inputLocked=true;el.retireBtn.disabled=true;el.board.innerHTML='';setPhase('home');refreshHomeRecords();loadRankings(false);}",
    "function returnHome(){stopTimer();clearPendingTimers();hideCompletion();state.selectedIndex=null;state.inputLocked=true;el.retireBtn.disabled=true;el.board.innerHTML='';setPhase('home');}",
    "home return without fetch",
)
replace_once(
    "function beginPlaying(playId){if(playId!==state.playId)return;requestAnimationFrame(function(){if(playId!==state.playId)return;renderBoard();setPhase('playing');state.startTime=performance.now();state.elapsedMs=0;state.inputLocked=false;el.retireBtn.disabled=false;incrementPlayCountOnce(playId);state.rafId=requestAnimationFrame(tick);});}",
    "function beginPlaying(playId){if(playId!==state.playId)return;requestAnimationFrame(function(){if(playId!==state.playId)return;renderBoard();setPhase('playing');state.startTime=performance.now();state.elapsedMs=0;state.inputLocked=false;el.retireBtn.disabled=false;state.rafId=requestAnimationFrame(tick);});}",
    "remove local play count increment",
)
replace_once(
    "function openNameConfirm(){stopTimer();clearPendingTimers();hideCompletion();el.retireBtn.disabled=true;const r=loadLocalRecords();el.playerNameInput.value=r.playerName;el.savedNameLabel.textContent=r.playerName||'--';",
    "function openNameConfirm(){stopTimer();clearPendingTimers();hideCompletion();el.retireBtn.disabled=true;const savedName=getSavedPlayerName();el.playerNameInput.value=savedName;el.savedNameLabel.textContent=savedName||'--';",
    "name confirmation",
)
replace_once(
    "  function incrementPlayCountOnce(playId){if(state.playCountIncrementedPlayId===playId)return;state.playCountIncrementedPlayId=playId;const current=parsePositiveInt(safeStorageGet(LS.playCount))||0;safeStorageSet(LS.playCount,String(current+1));}\n",
    "",
    "local play count function",
)
replace_once("    updateLocalResult(state.playerName,state.elapsedMs,state.operations);\n", "", "local result write")
replace_regex(
    r"\n  function updateLocalResult\(playerName,elapsedMs,operations\)\{[^\n]+\}",
    "",
    "local result function",
)
replace_once(
    "  function setRankingState(status,message){['home','result'].forEach(function(name){const statusEl=name==='home'?el.homeRankingStatus:el.resultRankingStatus;const scrollEl=name==='home'?el.homeRankingScroll:el.resultRankingScroll;statusEl.classList.toggle('err',status==='error');statusEl.textContent=message||'';statusEl.hidden=status==='ready';scrollEl.hidden=status!=='ready';});}\n",
    "  function setRankingState(status,message){const statusEl=el.resultRankingStatus,scrollEl=el.resultRankingScroll;statusEl.classList.toggle('err',status==='error');statusEl.textContent=message||'';statusEl.hidden=status==='ready'||status==='idle';scrollEl.hidden=status!=='ready';}\n",
    "result-only ranking state",
)
replace_once(
    "function applyRankingRows(rows){state.rankingRows=rows;renderRankingList(el.homeRankingList,rows);renderRankingList(el.resultRankingList,rows);",
    "function applyRankingRows(rows){state.rankingRows=rows;renderRankingList(el.resultRankingList,rows);",
    "result-only ranking render",
)
replace_once("この名前の記録を取得中…", "登録名の記録を取得中…", "record loading text")
replace_once("この名前の記録を取得できませんでした。", "登録名の記録を取得できませんでした。", "record failure text")
replace_once("Supabaseに保存された、この名前の記録です。", "Supabaseに保存された登録名の記録です。", "record source text")
replace_once("この名前の初回記録", "登録名の初回記録", "first record badge")
replace_once("この名前のベスト更新！", "登録名のベスト更新！", "best record badge")
replace_once("el.againBtn.addEventListener('click',openNameConfirm);", "el.againBtn.addEventListener('click',replay);", "replay handler")
replace_once(
    "  buildLogoChips();\n  buildStagePackDots();\n  migrateOldStorage();\n  refreshHomeRecords();\n  resetNameRecord();\n  setPhase('home');\n  loadRankings(true);\n",
    "  buildLogoChips();\n  buildStagePackDots();\n  migrateOldPlayerName();\n  state.playerName=getSavedPlayerName();\n  resetNameRecord();\n  setRankingState('idle','');\n  setPhase('home');\n",
    "startup without ranking fetch",
)

path.write_text(text, encoding="utf-8")
print("OK: index patch completed")
