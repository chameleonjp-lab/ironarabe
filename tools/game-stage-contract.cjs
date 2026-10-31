'use strict';
// Read-only adapter for audits and preview generation; runs the actual pure game functions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function loadGameStages(root=path.resolve(__dirname,'..')){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const constants=script.slice(script.indexOf('  const COLS='),script.indexOf('  const state='));
 const names=['rotateCornersClockwise','buildStages','hexToRgb','lerp','lerpRgb','rgbToCss','buildTiles','randomInt','refillStageBag','chooseNextStage','xfnv1a','mulberry32','coordIndex','initFixedSet','shuffledBoard'];
 const functions=names.map(name=>{const line=script.split('\n').find(l=>l.trim().startsWith('function '+name+'('));if(!line)throw Error('Missing game function '+name);return line;}).join('\n');
 let sequence=0;
 const stageFile=path.join(root,'js/stage-pack.js');
 const context={IronarabeStages:fs.existsSync(stageFile)?require(stageFile):{ADDITIONAL_PALETTES:[]},crypto:{getRandomValues(array){array[0]=sequence++;return array;}},Uint32Array};
 return vm.runInNewContext(constants+functions+"\nconst state={stageBag:[],lastStageIndex:null,stage:null,fixedSet:new Set()};function updateStageUi(){};({STAGES,STAGE_PALETTES,SHUFFLE_SEED,FIXED_COORDS,CLIENT_VERSION,CHALLENGE_ID,BOARD_VERSION,buildTiles,chooseNextStage,initFixedSet,shuffledBoard,state});",context);
}
module.exports={loadGameStages};
