'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const modulePath=path.join(__dirname,'../js/stage-pack.js');
const anchorIndices=[0,3,6,34,62,59,56,28];

function stagePack(){
  assert.ok(fs.existsSync(modulePath),'the browser-compatible stage pack module exists');
  return require(modulePath);
}

function channels(color){
  const match=/^rgb\((\d+),(\d+),(\d+)\)$/.exec(color);
  assert.ok(match,'tile colors use integer RGB channels');
  return match.slice(1).map(Number);
}

function hexChannels(hex){
  return [1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
}

function distance(first,second){
  return Math.hypot(...first.map((channel,index)=>channel-second[index]));
}

test('the classic browser script exposes the same stage builders as CommonJS',()=>{
  const api=stagePack();
  const context={};
  vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),context);
  assert.equal(typeof context.IronarabeStages.rotateAnchors,'function');
  assert.equal(typeof context.IronarabeStages.buildAnchorTiles,'function');
  assert.equal(JSON.stringify(context.IronarabeStages.ADDITIONAL_PALETTES),JSON.stringify(api.ADDITIONAL_PALETTES));
  assert.equal(JSON.stringify(context.IronarabeStages.buildAnchorTiles(api.ADDITIONAL_PALETTES[0].anchors)),JSON.stringify(api.buildAnchorTiles(api.ADDITIONAL_PALETTES[0].anchors)));
});

test('the additional families provide eight independent anchor colors in stage order',()=>{
  const {ADDITIONAL_PALETTES}=stagePack();
  assert.deepEqual(ADDITIONAL_PALETTES.map(palette=>[palette.id,palette.name]),[
    ['ocean','青海'],['leaf','若葉'],['amber','琥珀'],['wisteria','藤霞'],
    ['coral','珊瑚'],['nebula','星雲'],['breeze','潮風'],['autumn','紅葉']
  ]);
  const allAnchors=[];
  for(const palette of ADDITIONAL_PALETTES){
    assert.equal(palette.anchors.length,8,palette.id);
    palette.anchors.forEach(color=>assert.match(color,/^#[0-9a-f]{6}$/i));
    allAnchors.push(...palette.anchors.map(color=>color.toLowerCase()));
  }
  assert.equal(new Set(allAnchors).size,64,'the eight new base colors differ within and across families');
});

test('anchor rotation moves the top left to the top right and normalizes full turns',()=>{
  const {rotateAnchors}=stagePack();
  const anchors=['a','b','c','d','e','f','g','h'];
  const original=anchors.slice();
  assert.deepEqual(rotateAnchors(anchors,1),['g','h','a','b','c','d','e','f']);
  assert.deepEqual(rotateAnchors(anchors,2),['e','f','g','h','a','b','c','d']);
  assert.deepEqual(rotateAnchors(anchors,3),['c','d','e','f','g','h','a','b']);
  assert.deepEqual(rotateAnchors(anchors,-1),['c','d','e','f','g','h','a','b']);
  assert.deepEqual(rotateAnchors(anchors,9),['g','h','a','b','c','d','e','f']);
  assert.deepEqual(rotateAnchors(anchors,-8),original);
  assert.deepEqual(rotateAnchors(anchors,0),original);
  assert.notEqual(rotateAnchors(anchors,0),anchors,'identity rotation returns an independent array');
  assert.deepEqual(anchors,original,'rotations never mutate palette definitions');
});

const fixture=['#000000','#603030','#c0c000','#f060c0','#c0c0c0','#60f060','#0060c0','#30c060'];

test('anchor tiles keep all eight specified colors at the shared fixed positions',()=>{
  const {buildAnchorTiles}=stagePack();
  const tiles=buildAnchorTiles(fixture);
  assert.equal(tiles.length,63);
  assert.deepEqual(anchorIndices.map(index=>tiles[index].color),[
    'rgb(0,0,0)','rgb(96,48,48)','rgb(192,192,0)','rgb(240,96,192)',
    'rgb(192,192,192)','rgb(96,240,96)','rgb(0,96,192)','rgb(48,192,96)'
  ]);
  tiles.forEach((tile,index)=>{
    assert.deepEqual(Object.keys(tile).sort(),['color','id','targetCol','targetRow']);
    assert.equal(tile.id,index);
    assert.equal(tile.targetRow,Math.floor(index/7));
    assert.equal(tile.targetCol,index%7);
  });
});

test('quadrants interpolate through the arithmetic-mean center and shared seams',()=>{
  const {buildAnchorTiles}=stagePack();
  const tiles=buildAnchorTiles(fixture);
  const samples=[
    [0,1,'rgb(32,16,16)'],
    [2,1,'rgb(50,94,57)'],
    [2,2,'rgb(76,92,66)'],
    [2,3,'rgb(102,90,75)'],
    [1,5,'rgb(169,135,53)'],
    [3,4,'rgb(146,114,107)'],
    [4,3,'rgb(108,132,102)'],
    [5,5,'rgb(187,133,162)'],
    [7,1,'rgb(41,151,145)']
  ];
  for(const [row,col,color] of samples){
    assert.equal(tiles[row*7+col].color,color,`row ${row}, column ${col}`);
  }
});

test('only final tile channels are rounded, including a fractional center control',()=>{
  const {buildAnchorTiles}=stagePack();
  const tiles=buildAnchorTiles(['#000000','#000002','#000002','#000000','#000000','#000000','#000000','#000000']);
  assert.equal(tiles[31].color,'rgb(0,0,1)','the center mean of 0.5 rounds for display');
  assert.equal(tiles[15].color,'rgb(0,0,0)','interpolation retains the unrounded center mean of 0.5');
});

test('all 32 new boards are deterministic, distinct, bounded and solvable by color',()=>{
  const {ADDITIONAL_PALETTES,rotateAnchors,buildAnchorTiles}=stagePack();
  const signatures=new Set();
  for(const palette of ADDITIONAL_PALETTES){
    const original=palette.anchors.slice();
    for(let rotation=0;rotation<4;rotation++){
      const label=`${palette.id}-r${rotation}`;
      const anchors=rotateAnchors(palette.anchors,rotation);
      const tiles=buildAnchorTiles(anchors);
      assert.deepEqual(buildAnchorTiles(anchors),tiles,`${label}: deterministic`);
      assert.equal(new Set(tiles.map(tile=>tile.color)).size,63,`${label}: every tile has a unique color`);
      assert.deepEqual(anchorIndices.map(index=>channels(tiles[index].color)),anchors.map(hexChannels),`${label}: rotation preserves the anchors`);
      const colors=tiles.map(tile=>channels(tile.color));
      const controls=anchors.map(hexChannels);
      colors.forEach(color=>color.forEach((channel,index)=>{
        assert.ok(channel>=0&&channel<=255,`${label}: integer RGB bounds`);
        assert.ok(channel>=Math.min(...controls.map(control=>control[index]))&&channel<=Math.max(...controls.map(control=>control[index])),`${label}: interpolation stays within its controls`);
      }));
      let closestPair=Infinity;
      let closestAdjacent=Infinity;
      let closestAnchor=Infinity;
      for(let first=0;first<colors.length;first++){
        for(let second=first+1;second<colors.length;second++)closestPair=Math.min(closestPair,distance(colors[first],colors[second]));
        if(first%7<6)closestAdjacent=Math.min(closestAdjacent,distance(colors[first],colors[first+1]));
        if(first<56)closestAdjacent=Math.min(closestAdjacent,distance(colors[first],colors[first+7]));
      }
      for(let first=0;first<controls.length;first++){
        for(let second=first+1;second<controls.length;second++)closestAnchor=Math.min(closestAnchor,distance(controls[first],controls[second]));
      }
      assert.ok(closestPair>=6,`${label}: closest tile pair ${closestPair.toFixed(2)} must be at least 6 RGB units apart`);
      assert.ok(closestAdjacent>=8,`${label}: closest neighbors ${closestAdjacent.toFixed(2)} must be at least 8 RGB units apart`);
      assert.ok(closestAnchor>=30,`${label}: closest anchors ${closestAnchor.toFixed(2)} must be at least 30 RGB units apart`);
      signatures.add(tiles.map(tile=>tile.color).join('|'));
    }
    assert.deepEqual(palette.anchors,original,`${palette.id}: building boards does not mutate anchors`);
  }
  assert.equal(signatures.size,32,'every family and rotation produces its own board');
});
