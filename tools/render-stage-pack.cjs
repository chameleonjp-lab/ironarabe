#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadGameStages}=require('./game-stage-contract.cjs');
const game=loadGameStages(),fixed=new Set(game.FIXED_COORDS.map(([x,y])=>y*7+x));
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const columns=8,width=columns*144+24,height=Math.ceil(game.STAGES.length/columns)*206+60;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#12131c"/><text x="18" y="28" fill="#e7e9f2" font-family="sans-serif" font-size="18">イロナラベ — ${game.STAGES.length} problems · 10 palettes × 4 orientations</text>`;
for(const stage of game.STAGES){
 const x=12+((stage.number-1)%columns)*144,y=44+Math.floor((stage.number-1)/columns)*206;
 svg+=`<g transform="translate(${x},${y})"><rect width="136" height="198" rx="8" fill="#1c1e2b"/><text x="8" y="19" fill="#e7e9f2" font-family="sans-serif" font-size="12">${stage.number}. ${escape(stage.paletteName)} ${stage.rotationLabel}</text><text x="8" y="34" fill="#9aa0b8" font-family="sans-serif" font-size="10">${escape(stage.id)}</text>`;
 for(const tile of game.buildTiles(stage.challenge)){
  const tx=10+tile.targetCol*17,ty=43+tile.targetRow*16;
  svg+=`<rect x="${tx}" y="${ty}" width="16" height="15" rx="1" fill="${tile.color}"/>`;
  if(fixed.has(tile.id))svg+=`<circle cx="${tx+13}" cy="${ty+3}" r="1.6" fill="#12131c" stroke="#fff" stroke-width=".6"/>`;
 }
 svg+='</g>';
}
svg+='</svg>\n';const out=path.resolve(process.argv[2]||'docs/stage-pack-40-preview.svg');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,svg);console.log('Preview written: '+out);
