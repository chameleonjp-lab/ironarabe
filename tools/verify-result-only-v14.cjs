#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const indexPath = path.join(process.cwd(), "index.html");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

check(fs.existsSync(indexPath), "index.html is missing");
const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
check(scripts.length === 1, "production HTML must contain exactly one inline script");
if (scripts.length === 1) {
  try { new Function(scripts[0]); }
  catch (error) { errors.push(`inline JavaScript syntax error: ${error.message}`); }
}

const required = [
  ["CLIENT_VERSION='ironarabe-web-1.4.1-stagepack001-v2'", "result-only client version mismatch"],
  ["<h3 id=\"nameRecordTitle\">登録名の記録</h3>", "registered-name record heading missing"],
  ["登録名の初回記録", "registered-name first score missing"],
  ["登録名のベスト記録", "registered-name best score missing"],
  ["登録名のプレイ回数", "registered-name play count missing"],
  ["id=\"resultRankingList\"", "result ranking list missing"],
  ["get_best_score_ranking", "ranking RPC missing"],
  ["p_limit:RANKING_LIMIT", "ranking limit payload missing"],
  ["function setRankingState(status,message){const statusEl=el.resultRankingStatus", "ranking state must target result only"],
  ["function applyRankingRows(rows){state.rankingRows=rows;renderRankingList(el.resultRankingList,rows)", "ranking renderer must target result only"],
  ["function replay(){clearReplayCachePreserveName();openNameConfirm();}", "replay entry point missing"],
  ["el.againBtn.addEventListener('click',replay)", "replay button must use cache-clearing path"],
  ["const LOCAL_CACHE_PREFIX='ironarabe.'", "application cache namespace missing"],
  ["const LS={playerName:'ironarabe.v2.playerName',oldPlayerName:'ironarabe.playerName'}", "only current and legacy player-name keys may remain"],
  ["key!==LS.playerName", "current player name must be preserved"],
  ["clearStorageNamespace(localStorage)", "localStorage cleanup missing"],
  ["clearStorageNamespace(sessionStorage)", "sessionStorage cleanup missing"],
  ["state.playId+=1", "replay must invalidate prior play callbacks"],
  ["state.rankingRequestId+=1", "replay must invalidate prior ranking callbacks"],
  ["state.rankingRows=[]", "ranking memory cache must be cleared"],
  ["state.tiles=[]", "tile cache must be cleared"],
  ["state.solution=[]", "solution cache must be cleared"],
  ["state.board=[]", "board cache must be cleared"],
  ["state.fixedSet=new Set()", "fixed-position cache must be cleared"],
  ["el.resultRankingList.innerHTML=''", "result ranking DOM must be cleared"],
  ["resetNameRecord()", "registered-name result UI must be reset"],
  ["setRankingState('idle','')", "result ranking UI must return to idle"],
  ["loadRankings(false)", "result-screen ranking load missing"],
  ["loadRankings(true)", "post-submit ranking refresh missing"]
];
for (const [needle, message] of required) check(html.includes(needle), message);

const forbidden = [
  ["id=\"homeRankingList\"", "home ranking list remains"],
  ["id=\"homeRankingStatus\"", "home ranking status remains"],
  ["id=\"homeRankingScroll\"", "home ranking scroll remains"],
  ["id=\"homeBest\"", "home device best remains"],
  ["この端末のベスト記録", "device-best wording remains"],
  ["この端末に保存されたローカル記録", "local-record description remains"],
  ["refreshHomeRecords", "home record refresh function remains"],
  ["loadLocalRecords", "local records loader remains"],
  ["updateLocalResult", "local result writer remains"],
  ["incrementPlayCountOnce", "local play-count writer remains"],
  ["playCountIncrementedPlayId", "local play-count state remains"],
  ["firstScore:'ironarabe.", "local first-score key remains"],
  ["bestScore:'ironarabe.", "local best-score key remains"],
  ["playCount:'ironarabe.", "local play-count key remains"],
  ["lastResult:'ironarabe.", "local result key remains"]
];
for (const [needle, message] of forbidden) check(!html.includes(needle), message);

const returnHome = (html.match(/function returnHome\(\)\{[^\n]+/) || [""])[0];
const showResult = (html.match(/function showResult\(playId\)\{[^\n]+/) || [""])[0];
const startup = html.slice(html.lastIndexOf("buildLogoChips();"));
const submitFlow = (html.match(/function submitScoreForCurrentPlay\([^\n]+/) || [""])[0];

check(returnHome.length > 0, "returnHome function missing");
check(!returnHome.includes("loadRankings("), "home return still performs ranking I/O");
check(!returnHome.includes("refreshHomeRecords"), "home return still touches local record UI");
check(showResult.includes("loadRankings(false)"), "result screen does not load ranking");
check(!showResult.includes("refreshHomeRecords"), "result screen calls removed local record code");
check(!startup.includes("loadRankings(true)"), "startup still performs ranking I/O");
check(submitFlow.includes("loadRankings(true)"), "successful score submission does not refresh ranking");
check(!/setPhase\('home'\);\s*loadRankings\(/.test(html), "ranking request follows home activation");
check(!/Authorization\s*:/i.test(html), "Authorization header must not be used");
check(!/service_role/i.test(html), "service_role must not be present");

if (errors.length) {
  console.error(`NG: ${errors.length} result-only/cache issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: home is network-free, result uses registered-name records, and replay preserves only the name");
