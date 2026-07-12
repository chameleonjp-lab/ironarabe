#!/usr/bin/env node
"use strict";
const crypto = require("crypto");
const core = require("./difficulty-core.js");
const expected = {
  A:{seed:"ironarabe-study-easy-074306",movableTileCount:55,minSwaps:42,minTaps:84,initialCorrect:4,cycleCount:13,cycleLengths:[21,8,7,5,2,2,2,2,2,1,1,1,1],averageManhattan:4.9818181818181815,medianManhattan:5,maxManhattan:11,manhattanLe1:4,manhattanLe2:12,sameRow:7,sameCol:11,averageRgbDistance:77.23593659692706,rgbDistanceLe15:4,rgbDistanceLe25:4,sha256:"93976c14fe2a29952a5aee49eba8b7813147fc571b85fea8abaab79a0f25a2ad"},
  B:{seed:"ironarabe-official-001-v1",movableTileCount:55,minSwaps:49,minTaps:98,initialCorrect:2,cycleCount:6,cycleLengths:[33,12,5,3,1,1],averageManhattan:5.0181818181818185,medianManhattan:5,maxManhattan:12,manhattanLe1:5,manhattanLe2:12,sameRow:9,sameCol:9,averageRgbDistance:78.26798144013215,rgbDistanceLe15:2,rgbDistanceLe25:5,sha256:"c8baaed99b3df36a7092faf2c98e330374627726e9668816b476521bf738f362"},
  C:{seed:"ironarabe-study-hard-000010",movableTileCount:55,minSwaps:54,minTaps:108,initialCorrect:0,cycleCount:1,cycleLengths:[55],averageManhattan:5.3090909090909095,medianManhattan:5,maxManhattan:11,manhattanLe1:3,manhattanLe2:9,sameRow:4,sameCol:9,averageRgbDistance:81.24239955909745,rgbDistanceLe15:0,rgbDistanceLe25:3,sha256:"d55891fe2531eed9d1985f5105b9cfcce30cb422910dce0e3c3215f1d5877946"}
};
function sha256(board){return crypto.createHash("sha256").update(board.join(","),"utf8").digest("hex");}
function nearly(a,b){return Math.abs(a-b)<=1e-9;}
function eqArray(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);}
function compare(id, actual){ const exp=expected[id], errors=[]; for(const [k,v] of Object.entries(exp)){ if(k==="seed") continue; const av=actual[k]; if(Array.isArray(v)?!eqArray(av,v):(typeof v==="number"&&!Number.isInteger(v)?!nearly(av,v):av!==v)) errors.push(`${id}.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(av)}`); } return errors; }
const rows=[]; let errors=[];
for(const c of core.candidates){ const board=core.buildBoard(c.seed); core.validateBoard(board); const a=core.analyzeBoard(board); const row={candidateId:c.candidateId,seed:c.seed,board,sha256:sha256(board),...a}; rows.push(row); if(c.seed!==expected[c.candidateId].seed) errors.push(`${c.candidateId}.seed mismatch`); errors=errors.concat(compare(c.candidateId,row)); }
if(process.argv.includes("--json")){ console.log(JSON.stringify({ok:errors.length===0, errors, results:rows}, null, 2)); } else { console.log("候補 | seed | 理論最少交換 | 理論最少タップ | 初期正解数 | サイクル数 | 最大サイクル | 平均距離 | 最大距離 | 平均RGB距離 | 盤面ハッシュ"); console.log("---|---|---:|---:|---:|---:|---:|---:|---:|---:|---"); for(const r of rows){ console.log(`${r.candidateId} | ${r.seed} | ${r.minSwaps} | ${r.minTaps} | ${r.initialCorrect} | ${r.cycleCount} | ${r.cycleLengths[0]} | ${r.averageManhattan.toFixed(12)} | ${r.maxManhattan} | ${r.averageRgbDistance.toFixed(12)} | ${r.sha256}`); } console.log(errors.length ? `NG: ${errors.length} mismatch(es)` : "OK: 3候補すべて期待値と一致"); if(errors.length) console.error(errors.join("\n")); }
process.exit(errors.length ? 1 : 0);
