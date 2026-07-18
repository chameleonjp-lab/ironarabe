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
      // Compile only. The browser IIFE is not executed in Node.
      new Function(inlineScripts[0]);
    } catch (error) {
      errors.push(`inline JavaScript syntax error: ${error.message}`);
    }
  }

  const required = [
    ["const COLS=7, ROWS=9, TOTAL=COLS*ROWS", "7x9 board constants changed"],
    ["BOARD_VERSION=2", "BOARD_VERSION changed"],
    ["CLIENT_VERSION='ironarabe-web-1.2.0-official001-v2'", "CLIENT_VERSION is not the visual/touch revision"],
    ["SCORE_SCALE=100", "score scale changed"],
    ["SCORE_DECIMALS=2", "score decimals changed"],
    ["SWAP_ANIMATION_MS=140", "swap animation duration missing or changed"],
    ["topLeft:'#f36b6b'", "top-left color changed"],
    ["topRight:'#f0c46a'", "top-right color changed"],
    ["bottomLeft:'#7b6ff0'", "bottom-left color changed"],
    ["bottomRight:'#5fd0b5'", "bottom-right color changed"],
    ["SHUFFLE_SEED='ironarabe-official-001-v1'", "official seed changed"],
    ["FIXED_COORDS=[[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]]", "fixed coordinates changed"],
    ["/rest/v1/rpc/submit_score", "shared submit_score RPC missing"],
    ["p_display_name", "ranking display-name field missing"],
    ["p_game_slug", "ranking slug field missing"],
    ["p_score", "ranking score field missing"],
    ["p_client_version", "ranking client-version field missing"],
    ["'apikey':RANKING_CONFIG.publishableKey", "apikey header missing"],
    ["swapTimerId", "swap timer state missing"],
    ["clearSwapTimer", "swap timer cleanup missing"],
    ["state.inputLocked=true", "swap input lock missing"],
    ["tileSwapPulse", "swap visual animation missing"],
    ["prefers-reduced-motion:reduce", "reduced-motion CSS missing"],
    ["prefersReducedMotion", "reduced-motion JavaScript handling missing"],
    ["@media (max-height:620px)", "short-screen layout missing"],
    ["--gap:2px", "tile gap is not 2px"],
    ["--tile-radius:4px", "tile radius is not 4px"],
    ["transform:scale(1.025)", "selected tile scale is not restrained"],
    ["top:4px", "fixed marker is not placed near a corner"],
    ["right:4px", "fixed marker is not placed near a corner"],
  ];

  for (const [needle, message] of required) {
    check(html.includes(needle), message);
  }

  check(!/Authorization\s*:/i.test(html), "Authorization header must not be added");
  check(!/service_role/i.test(html), "service_role text/value must not be added to production HTML");
  check(!/secret[_-]?key/i.test(html), "secret key text/value must not be added to production HTML");
  check(!/--gap:3px/.test(html), "old 3px tile gap remains");
  check(!/transform:scale\(1\.08\)/.test(html), "old oversized selected state remains");
  check(!/top:50%;\s*left:50%/.test(html), "old center fixed marker remains");
  check(/clearPendingTimers\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "clearPendingTimers does not clear swap timer");
  check(/onClear\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "onClear does not clear swap timer");
  check(/returnHome\(\)\{[^}]*clearSwapTimer\(\)/.test(html), "returnHome does not clear swap timer");
  check(/pagehide[^]*clearSwapTimer\(\)/.test(html), "pagehide cleanup does not clear swap timer");
}

if (errors.length > 0) {
  console.error(`NG: ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: production visual/touch contract verified");
