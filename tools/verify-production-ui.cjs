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
    ["CLIENT_VERSION='ironarabe-web-1.3.0-official001-v2'", "CLIENT_VERSION is not the ranking/result revision"],
    ["SCORE_SCALE=100", "score scale changed"],
    ["SCORE_DECIMALS=2", "score decimals changed"],
    ["SWAP_ANIMATION_MS=140", "swap animation duration missing or changed"],
    ["CLEAR_BOARD_DISPLAY_MS=4000", "completed board display duration missing or changed"],
    ["RANKING_LIMIT=30", "ranking limit missing or changed"],
    ["topLeft:'#f36b6b'", "top-left color changed"],
    ["topRight:'#f0c46a'", "top-right color changed"],
    ["bottomLeft:'#7b6ff0'", "bottom-left color changed"],
    ["bottomRight:'#5fd0b5'", "bottom-right color changed"],
    ["SHUFFLE_SEED='ironarabe-official-001-v1'", "official seed changed"],
    ["FIXED_COORDS=[[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]]", "fixed coordinates changed"],
    ["postRpc('submit_score'", "shared submit_score RPC missing"],
    ["postRpc('get_best_score_ranking'", "best ranking RPC missing"],
    ["p_display_name", "ranking display-name field missing"],
    ["p_game_slug", "ranking slug field missing"],
    ["p_score", "ranking score field missing"],
    ["p_client_version", "ranking client-version field missing"],
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
    ["id=\"homeRankingList\"", "home ranking list missing"],
    ["id=\"resultRankingList\"", "result ranking list missing"],
    ["id=\"completionBanner\"", "completion banner missing"],
    ["この名前のプレイ回数", "server-side name play count missing"]
  ];

  for (const [needle, message] of required) check(html.includes(needle), message);

  check(!/Authorization\s*:/i.test(html), "Authorization header must not be added");
  check(!/service_role/i.test(html), "service_role text/value must not be added to production HTML");
  check(!/secret[_-]?key/i.test(html), "secret key text/value must not be added to production HTML");
  check(!/--gap:3px/.test(html), "old 3px tile gap remains");
  check(!/transform:scale\(1\.08\)/.test(html), "old oversized selected state remains");
  check(!/移動回数/.test(html), "old movement-count wording remains");
  check(!/この端末のプレイ回数/.test(html), "device play count remains on result screen");
  check(/clearPendingTimers\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "clearPendingTimers does not clear swap timer");
  check(/onClear\(\)\{[\s\S]*?clearSwapTimer\(\)/.test(html), "onClear does not clear swap timer");
  check(/returnHome\(\)\{[^}]*clearPendingTimers\(\)/.test(html) || /returnHome\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "returnHome does not clear pending timers");
  check(/pagehide[\s\S]*clearSwapTimer\(\)/.test(html), "pagehide cleanup does not clear swap timer");
  check(/onClear\(\)[\s\S]*stopTimer\(\)[\s\S]*state\.elapsedMs=Math\.round\(performance\.now\(\)-state\.startTime\)/.test(html), "clear does not freeze time immediately");
  check(/state\.operations\+=1;[\s\S]*?if\(checkCleared\(\)\)\{onClear\(\);return;\}[\s\S]*?const aEl=el\.board\.children\[a\]/.test(html), "solving operation does not clear before swap animation");
}

if (errors.length > 0) {
  console.error(`NG: ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: production visual, ranking, and result contract verified");
