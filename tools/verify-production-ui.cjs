#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const indexPath = path.join(root, "index.html");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(fs.existsSync(indexPath), "index.html is missing");

if (errors.length === 0) {
  const html = fs.readFileSync(indexPath, "utf8");
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const externalScripts = [...html.matchAll(/<script\s+src=/g)];

  check(inlineScripts.length === 1, "index.html must contain exactly one inline game script");
  check(externalScripts.length === 0, "production index.html must not require external scripts");

  if (inlineScripts.length === 1) {
    try {
      new Function(inlineScripts[0]);
    } catch (error) {
      errors.push(`inline JavaScript syntax error: ${error.message}`);
    }
  }

  const required = [
    ["const COLS=7, ROWS=9, TOTAL=COLS*ROWS", "7x9 board constants changed"],
    ["BOARD_VERSION=2", "BOARD_VERSION changed"],
    ["CLIENT_VERSION='ironarabe-web-1.4.1-stagepack001-v2'", "CLIENT_VERSION is not the result-only revision"],
    ["SCORE_SCALE=100", "score scale changed"],
    ["SCORE_DECIMALS=2", "score decimals changed"],
    ["SWAP_ANIMATION_MS=140", "swap animation duration missing or changed"],
    ["CLEAR_BOARD_DISPLAY_MS=4000", "completed board display duration missing or changed"],
    ["RANKING_LIMIT=30", "ranking limit missing or changed"],
    ["STAGE_ROTATION_NAMES=['0°','90°','180°','270°']", "stage rotation contract missing"],
    ["{id:'sunset',name:'夕映え',corners:['#f36b6b','#f0c46a','#5fd0b5','#7b6ff0']}", "sunset palette changed"],
    ["{id:'aurora',name:'極光',corners:['#6bf3f3','#6a96f0','#d05f7a','#e4f06f']}", "aurora palette changed"],
    ["const STAGES=buildStages()", "eight-stage generation missing"],
    ["SHUFFLE_SEED='ironarabe-official-001-v1'", "official seed changed"],
    ["FIXED_COORDS=[[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]]", "fixed coordinates changed"],
    ["chooseNextStage();state.tiles=buildTiles(state.stage.challenge)", "stage selection is not wired into play preparation"],
    ["postRpc('submit_score'", "shared submit_score RPC missing"],
    ["postRpc('get_best_score_ranking'", "best ranking RPC missing"],
    ["p_display_name", "ranking display-name field missing"],
    ["p_game_slug", "ranking slug field missing"],
    ["p_score", "ranking score field missing"],
    ["p_client_version:currentClientVersion()", "stage-aware client-version field missing"],
    ["'apikey':RANKING_CONFIG.publishableKey", "apikey header missing"],
    ["swapTimerId", "swap timer state missing"],
    ["clearSwapTimer", "swap timer cleanup missing"],
    ["state.inputLocked=true", "input lock missing"],
    ["tileSwapPulse", "swap visual animation missing"],
    ["prefers-reduced-motion:reduce", "reduced-motion CSS missing"],
    ["prefersReducedMotion", "reduced-motion JavaScript handling missing"],
    ["@media (max-height:620px)", "short-screen layout missing"],
    ["--gap:2px", "tile gap is not 2px"],
    ["--tile-radius:4px", "tile radius is not 4px"],
    ["transform:scale(1.025)", "selected tile scale is not restrained"],
    ["操作回数", "operation count label missing"],
    ["id=\"resultRankingList\"", "result ranking list missing"],
    ["id=\"completionBanner\"", "completion banner missing"],
    ["id=\"stagePackDots\"", "home stage-pack indicator missing"],
    ["id=\"countdownStage\"", "countdown stage label missing"],
    ["id=\"stageDisplay\"", "playing stage label missing"],
    ["id=\"resultStage\"", "result stage label missing"],
    [".home-actions .btn { margin-top:0; padding:13px 14px; }", "home button spacing missing"],
    ["登録名のベスト記録", "registered-name best record missing"],
    ["登録名のプレイ回数", "registered-name play count missing"],
    ["const LOCAL_CACHE_PREFIX='ironarabe.'", "cache namespace missing"],
    ["function replay(){clearReplayCachePreserveName();openNameConfirm();}", "replay cache clearing missing"],
    ["clearStorageNamespace(localStorage)", "localStorage cache clearing missing"],
    ["clearStorageNamespace(sessionStorage)", "sessionStorage cache clearing missing"],
    ["key!==LS.playerName", "saved-name preservation missing"],
    ["el.againBtn.addEventListener('click',replay)", "replay handler mismatch"]
  ];

  for (const [needle, message] of required) check(html.includes(needle), message);

  const forbidden = [
    ["id=\"homeRankingList\"", "home ranking list must be removed"],
    ["id=\"homeRankingStatus\"", "home ranking status must be removed"],
    ["id=\"homeRankingScroll\"", "home ranking scroll must be removed"],
    ["id=\"homeBest\"", "home local best must be removed"],
    ["この端末のベスト記録", "device best wording must be removed"],
    ["この端末に保存されたローカル記録", "device record description must be removed"],
    ["refreshHomeRecords", "home local record refresh must be removed"],
    ["loadLocalRecords", "local record loader must be removed"],
    ["updateLocalResult", "local result writer must be removed"],
    ["incrementPlayCountOnce", "local play-count increment must be removed"],
    ["playCountIncrementedPlayId", "local play-count state must be removed"],
    ["firstScore:'ironarabe.", "local first-score cache key must be removed"],
    ["bestScore:'ironarabe.", "local best-score cache key must be removed"],
    ["playCount:'ironarabe.", "local play-count cache key must be removed"],
    ["lastResult:'ironarabe.", "local result cache key must be removed"]
  ];
  for (const [needle, message] of forbidden) check(!html.includes(needle), message);

  check(!/Authorization\s*:/i.test(html), "Authorization header must not be added");
  check(!/service_role/i.test(html), "service_role text/value must not be added to production HTML");
  check(!/secret[_-]?key/i.test(html), "secret key text/value must not be added to production HTML");
  check(!/--gap:3px/.test(html), "old 3px tile gap remains");
  check(!/transform:scale\(1\.08\)/.test(html), "old oversized selected state remains");
  check(!/移動回数/.test(html), "old movement-count wording remains");
  check(!/この端末のプレイ回数/.test(html), "device play count remains on result screen");
  check(!html.includes("OFFICIAL_CHALLENGE"), "single-stage challenge remains");
  check(/clearPendingTimers\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "clearPendingTimers does not clear swap timer");
  check(/onClear\(\)\{[\s\S]*?clearSwapTimer\(\)/.test(html), "onClear does not clear swap timer");
  check(/returnHome\(\)\{[^}]*clearPendingTimers\(\)/.test(html), "returnHome does not clear pending timers");
  check(/pagehide[\s\S]*clearSwapTimer\(\)/.test(html), "pagehide cleanup does not clear swap timer");
  check(/onClear\(\)[\s\S]*stopTimer\(\)[\s\S]*state\.elapsedMs=Math\.round\(performance\.now\(\)-state\.startTime\)/.test(html), "clear does not freeze time immediately");
  check(/state\.operations\+=1;[\s\S]*?if\(checkCleared\(\)\)\{onClear\(\);return;\}[\s\S]*?const aEl=el\.board\.children\[a\]/.test(html), "solving operation does not clear before swap animation");
  check(!/setPhase\('home'\);\s*loadRankings\(true\)/.test(html), "startup ranking request remains");
  const returnHome = (html.match(/function returnHome\(\)\{[^\n]+/) || [""])[0];
  check(!returnHome.includes("loadRankings("), "home return ranking request remains");
  const showResult = (html.match(/function showResult\(playId\)\{[^\n]+/) || [""])[0];
  check(showResult.includes("loadRankings(false)"), "result screen ranking load is missing");
  check(!showResult.includes("refreshHomeRecords"), "result screen still calls removed local record code");
  check(/submitScoreForCurrentPlay[\s\S]*loadRankings\(true\)/.test(html), "ranking refresh after successful submission is missing");
}

if (errors.length > 0) {
  console.error(`NG: ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: production result-only ranking and name-only cache contract verified");
