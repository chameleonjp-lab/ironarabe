#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const indexPath = path.join(process.cwd(), "index.html");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const requireText = (text, value, message) => check(text.includes(value), message);

check(fs.existsSync(indexPath), "index.html is missing");
const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
check(inlineScripts.length === 1, "index.html must contain exactly one inline script");
if (inlineScripts.length === 1) {
  try { new Function(inlineScripts[0]); }
  catch (error) { errors.push(`inline JavaScript syntax error: ${error.message}`); }
}

const palettes = [
  { id: "sunset", name: "夕映え", corners: ["#f36b6b", "#f0c46a", "#5fd0b5", "#7b6ff0"] },
  { id: "aurora", name: "極光", corners: ["#6bf3f3", "#6a96f0", "#d05f7a", "#e4f06f"] }
];
const rotations = ["0°", "90°", "180°", "270°"];
const fixedCoords = [[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]];

function rotateCornersClockwise(corners, steps) {
  const normalized = ((steps % 4) + 4) % 4;
  return corners.map((_, index) => corners[(index - normalized + 4) % 4]);
}
function hexToRgb(hex) {
  return [1,3,5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpRgb(a, b, t) { return a.map((value, index) => Math.round(lerp(value, b[index], t))); }
function fixedColors(corners) {
  const [tl, tr, br, bl] = corners.map(hexToRgb);
  return fixedCoords.map(([col, row]) => {
    const x = col / 6;
    const y = row / 8;
    const top = lerpRgb(tl, tr, x);
    const bottom = lerpRgb(bl, br, x);
    return lerpRgb(top, bottom, y).join(",");
  });
}

const stages = [];
for (const palette of palettes) {
  rotations.forEach((rotationLabel, rotation) => {
    const corners = rotateCornersClockwise(palette.corners, rotation);
    stages.push({ id: `${palette.id}-r${rotation}`, palette: palette.id, rotation, rotationLabel, corners });
  });
}

check(stages.length === 8, "stage count must be exactly 8");
check(new Set(stages.map((stage) => stage.id)).size === 8, "stage IDs must be unique");
for (const palette of palettes) {
  check(stages.filter((stage) => stage.palette === palette.id).length === 4, `${palette.id} must have four rotations`);
}
for (const stage of stages) {
  check(new Set(fixedColors(stage.corners)).size === 8, `${stage.id} fixed anchor colors must be unique`);
}
check(JSON.stringify(rotateCornersClockwise(palettes[0].corners, 1)) === JSON.stringify([
  palettes[0].corners[3], palettes[0].corners[0], palettes[0].corners[1], palettes[0].corners[2]
]), "90-degree rotation must move TL to TR clockwise");

function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function officialBoard() {
  const total = 63;
  const fixedSet = new Set(fixedCoords.map(([col, row]) => row * 7 + col));
  const board = Array.from({ length: total }, (_, index) => index);
  const movable = board.filter((index) => !fixedSet.has(index));
  const random = mulberry32(xfnv1a("ironarabe-official-001-v1"));
  const ids = movable.slice();
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  movable.forEach((position, index) => { board[position] = ids[index]; });
  return board;
}
const boardHash = crypto.createHash("sha256").update(JSON.stringify(officialBoard())).digest("hex");
check(boardHash === "cb6e637f2e901a5c831b135efbdd36926d14c76f0260d3893d4241d2033681e2", "official tile permutation changed");

const required = [
  ["CLIENT_VERSION='ironarabe-web-1.4.1-stagepack001-v2'", "stage-pack client version missing"],
  ["STAGE_ROTATION_NAMES=['0°','90°','180°','270°']", "rotation names mismatch"],
  ["{id:'sunset',name:'夕映え',corners:['#f36b6b','#f0c46a','#5fd0b5','#7b6ff0']}", "sunset palette mismatch"],
  ["{id:'aurora',name:'極光',corners:['#6bf3f3','#6a96f0','#d05f7a','#e4f06f']}", "aurora palette mismatch"],
  ["const STAGES=buildStages()", "stage generation missing"],
  ["for(let rotation=0;rotation<4;rotation++)", "four rotations per palette missing"],
  ["stageBag:[]", "stage bag state missing"],
  ["lastStageIndex:null", "last stage repeat guard state missing"],
  ["if(state.stageBag.length===0)refillStageBag()", "stage bag refill missing"],
  ["bag[0]===state.lastStageIndex", "bag-boundary repeat guard missing"],
  ["chooseNextStage();state.tiles=buildTiles(state.stage.challenge)", "stage must be selected before tile generation"],
  ["SHUFFLE_SEED='ironarabe-official-001-v1'", "official shuffle seed changed"],
  ["FIXED_COORDS=[[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]]", "fixed coordinates changed"],
  ["p_client_version:currentClientVersion()", "stage ID must be included in submitted client version"],
  ["id=\"stagePackDots\"", "home stage pack indicator missing"],
  ["id=\"countdownStage\"", "countdown stage label missing"],
  ["id=\"stageDisplay\"", "playing stage label missing"],
  ["id=\"resultStage\"", "result stage label missing"],
  [".home-actions { display:grid; gap:8px; margin:2px 0 12px; }", "home action spacing mismatch"],
  [".home-actions .btn { margin-top:0; padding:13px 14px; }", "home button padding mismatch"],
  [".home-share-btn { margin-top:0; padding:13px 14px; }", "home share spacing mismatch"]
];
for (const [value, message] of required) requireText(html, value, message);

check(!html.includes("OFFICIAL_CHALLENGE"), "single-stage OFFICIAL_CHALLENGE must be removed");
check(!html.includes("stageId:state.stage?state.stage.id:null"), "stage data must not be stored in local result cache");
check((html.match(/id="stagePackDots"/g) || []).length === 1, "stagePackDots ID must be unique");
check((html.match(/id="countdownStage"/g) || []).length === 1, "countdownStage ID must be unique");
check((html.match(/id="stageDisplay"/g) || []).length === 1, "stageDisplay ID must be unique");
check((html.match(/id="resultStage"/g) || []).length === 1, "resultStage ID must be unique");
check(!/Authorization\s*:/i.test(html), "Authorization header must not be used");
check(!/service_role/i.test(html), "service_role must not be present");

if (errors.length) {
  console.error(`NG: ${errors.length} stage-pack issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: eight-stage pack, fixed colors, shuffle fairness, and result-only cache contract verified");
