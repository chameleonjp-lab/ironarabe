// Reuse the actual pure game palette/board generator; no live request or player data.
const fs=require('node:fs');
const {loadGameStages}=require('./game-stage-contract.cjs');
const game=loadGameStages(),stage=game.STAGES[0],fixed=new Set(game.FIXED_COORDS.map(([x,y])=>y*7+x));
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#12131c"/><g font-family="Noto Sans CJK JP, sans-serif"><text x="64" y="213" fill="#e7e9f2" font-size="68" font-weight="bold">イロナラベ</text><text x="68" y="279" fill="#7fd7c4" font-size="29">色の流れを、並べ直す。</text><text x="68" y="329" fill="#9aa0b8" font-size="25">7 × 9 のカラータイルパズル</text><rect x="68" y="382" width="338" height="54" rx="27" fill="#242739"/><text x="237" y="418" text-anchor="middle" fill="#e7e9f2" font-size="24">40問のタイムアタック</text><rect x="620" y="35" width="443" height="560" rx="20" fill="#1c1e2b"/>';
for(const tile of game.buildTiles(stage.challenge)){const x=637+tile.targetCol*59,y=52+tile.targetRow*59;svg+=`<rect x="${x}" y="${y}" width="57" height="57" rx="4" fill="${tile.color}"/>`;if(fixed.has(tile.id))svg+=`<circle cx="${x+47}" cy="${y+10}" r="4" fill="#12131c" stroke="white" stroke-width="1.5"/>`;}
svg+='</g></svg>\n';fs.writeFileSync('assets/social-preview.svg',svg);
