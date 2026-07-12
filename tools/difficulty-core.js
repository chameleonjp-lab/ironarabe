"use strict";
(function () {
  const constants = {
    COLS: 7,
    ROWS: 9,
    TOTAL: 63,
    topLeft: "#f36b6b",
    topRight: "#f0c46a",
    bottomLeft: "#7b6ff0",
    bottomRight: "#5fd0b5",
    fixedCoords: [[0,0],[3,0],[6,0],[0,4],[6,4],[0,8],[3,8],[6,8]],
  };
  constants.fixedIndices = constants.fixedCoords.map(([c,r]) => r * constants.COLS + c);
  const fixedSet = new Set(constants.fixedIndices);
  const candidates = [
    { candidateId: "A", seed: "ironarabe-study-easy-074306", note: "理論上は現在より少ない交換回数" },
    { candidateId: "B", seed: "ironarabe-official-001-v1", note: "現在の公式問題そのもの" },
    { candidateId: "C", seed: "ironarabe-study-hard-000010", note: "理論上は現在より多い交換回数" },
  ];
  function hexToRgb(hex) { const h = String(hex).replace("#", ""); if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("Invalid hex color: " + hex); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
  function lerp(a,b,t) { return a + (b - a) * t; }
  function lerpRgb(c1,c2,t) { return [Math.round(lerp(c1[0],c2[0],t)), Math.round(lerp(c1[1],c2[1],t)), Math.round(lerp(c1[2],c2[2],t))]; }
  function rgbToCss(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function buildTiles() { const tl=hexToRgb(constants.topLeft), tr=hexToRgb(constants.topRight), bl=hexToRgb(constants.bottomLeft), br=hexToRgb(constants.bottomRight), tiles=[]; for(let row=0; row<constants.ROWS; row++){ for(let col=0; col<constants.COLS; col++){ const x=col/(constants.COLS-1), y=row/(constants.ROWS-1), top=lerpRgb(tl,tr,x), bottom=lerpRgb(bl,br,x), rgb=lerpRgb(top,bottom,y), id=row*constants.COLS+col; tiles.push({ id, targetRow: row, targetCol: col, rgb, color: rgbToCss(rgb) }); } } return tiles; }
  function xfnv1a(str) { if (typeof str !== "string" || str.length === 0) throw new Error("seed must be a non-empty string"); let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function mulberry32(seed) { let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
  function movableIndices() { const xs=[]; for(let i=0;i<constants.TOTAL;i++) if(!fixedSet.has(i)) xs.push(i); return xs; }
  function buildBoard(seed) { const board=Array.from({length: constants.TOTAL}, (_,i)=>i), movable=movableIndices(), rand=mulberry32(xfnv1a(seed)), ids=movable.map(i=>board[i]); for(let i=ids.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); const tmp=ids[i]; ids[i]=ids[j]; ids[j]=tmp; } let allSame=true; for(let i=0;i<ids.length;i++){ if(ids[i]!==movable[i]) { allSame=false; break; } } if(allSame && ids.length>=2){ const t=ids[0]; ids[0]=ids[1]; ids[1]=t; } for(let i=0;i<movable.length;i++) board[movable[i]]=ids[i]; return board; }
  function validateBoard(board) { if(!Array.isArray(board)) throw new Error("board must be an array"); if(board.length !== constants.TOTAL) throw new Error("board length must be 63"); const seen=new Set(); for(const id of board){ if(!Number.isInteger(id) || id<0 || id>=constants.TOTAL) throw new Error("board contains an out-of-range tile id: " + id); if(seen.has(id)) throw new Error("board contains duplicate tile id: " + id); seen.add(id); } for(const idx of constants.fixedIndices){ if(board[idx] !== idx) throw new Error("fixed position " + idx + " must contain fixed tile " + idx); } for(let i=0;i<constants.TOTAL;i++){ if(!fixedSet.has(i) && fixedSet.has(board[i])) throw new Error("movable position " + i + " contains fixed tile " + board[i]); } return true; }
  function median(values) { const xs=values.slice().sort((a,b)=>a-b), n=xs.length; return n%2 ? xs[(n-1)/2] : (xs[n/2-1]+xs[n/2])/2; }
  function analyzeBoard(board) { validateBoard(board); const tiles=buildTiles(), movable=movableIndices(), visited=new Set(), cycleLengths=[]; let initialCorrect=0, manhattanSum=0, maxManhattan=0, le1=0, le2=0, sameRow=0, sameCol=0, rgbSum=0, rgbLe15=0, rgbLe25=0; for(const pos of movable){ if(board[pos]===pos) initialCorrect++; const tile=tiles[board[pos]], row=Math.floor(pos/constants.COLS), col=pos%constants.COLS; const d=Math.abs(row-tile.targetRow)+Math.abs(col-tile.targetCol); manhattanSum+=d; maxManhattan=Math.max(maxManhattan,d); if(d<=1) le1++; if(d<=2) le2++; if(row===tile.targetRow) sameRow++; if(col===tile.targetCol) sameCol++; const targetRgb=tiles[pos].rgb, tileRgb=tile.rgb; const rd=Math.sqrt((targetRgb[0]-tileRgb[0])**2+(targetRgb[1]-tileRgb[1])**2+(targetRgb[2]-tileRgb[2])**2); rgbSum+=rd; if(rd<=15) rgbLe15++; if(rd<=25) rgbLe25++; }
    for(const start of movable){ if(visited.has(start)) continue; let cur=start, len=0; while(!visited.has(cur)){ visited.add(cur); len++; cur=board[cur]; if(fixedSet.has(cur)) throw new Error("permutation reached fixed tile unexpectedly: " + cur); } cycleLengths.push(len); }
    cycleLengths.sort((a,b)=>b-a); const cycleCount=cycleLengths.length; const distances=movable.map(pos=>{ const tile=tiles[board[pos]], row=Math.floor(pos/constants.COLS), col=pos%constants.COLS; return Math.abs(row-tile.targetRow)+Math.abs(col-tile.targetCol); });
    return { movableTileCount: movable.length, minSwaps: movable.length-cycleCount, minTaps: (movable.length-cycleCount)*2, initialCorrect, cycleCount, cycleLengths, averageManhattan: manhattanSum/movable.length, medianManhattan: median(distances), maxManhattan, manhattanLe1: le1, manhattanLe2: le2, sameRow, sameCol, averageRgbDistance: rgbSum/movable.length, rgbDistanceLe15: rgbLe15, rgbDistanceLe25: rgbLe25 };
  }
  function isSolved(board) { validateBoard(board); return board.every((id,i)=>id===i); }
  function swap(board,a,b) { validateBoard(board); if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=constants.TOTAL||b>=constants.TOTAL) throw new Error("swap indices out of range"); if(fixedSet.has(a)||fixedSet.has(b)) throw new Error("fixed tiles cannot be swapped"); const next=board.slice(); const t=next[a]; next[a]=next[b]; next[b]=t; return next; }
  const api = { constants, candidates, buildTiles, buildBoard, validateBoard, analyzeBoard, isSolved, swap, _internal: { xfnv1a, mulberry32, movableIndices } };
  if (typeof module === "object" && module.exports) module.exports = api;
  globalThis.IronarabeDifficulty = api;
}());
