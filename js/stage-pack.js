(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IronarabeStages = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // Clockwise controls: top left, top middle, top right, right middle,
  // bottom right, bottom middle, bottom left, left middle.
  const ADDITIONAL_PALETTES = [
    {id:'ocean',name:'青海',anchors:['#0b2d59','#02698b','#15bac6','#52d9c7','#a8e7db','#92afbe','#6468b9','#3f567d']},
    {id:'leaf',name:'若葉',anchors:['#1c563d','#569841','#a9c747','#cecb77','#e1e6a9','#9cd1b0','#55b9a4','#2c866a']},
    {id:'amber',name:'琥珀',anchors:['#583038','#a6682d','#ef9b35','#e9b678','#f8ddb1','#bfa8ac','#a26391','#715769']},
    {id:'wisteria',name:'藤霞',anchors:['#3b246b','#8b5183','#d173b5','#eaa9bd','#eedadd','#abc7cd','#4fa5c7','#4d599b']},
    {id:'coral',name:'珊瑚',anchors:['#704066','#a6535f','#f05e61','#f7957e','#f9d78e','#d1c6aa','#c09bc5','#94639e']},
    {id:'nebula',name:'星雲',anchors:['#241b5a','#62356f','#9a3d9e','#c57bab','#e8bca8','#a3aab6','#458cc6','#275988']},
    {id:'breeze',name:'潮風',anchors:['#275b86','#469299','#80d3b7','#bae3ab','#efedbb','#d6b0c9','#b07dc6','#676cb3']},
    {id:'autumn',name:'紅葉',anchors:['#57353e','#98492f','#d25b38','#eb8a5b','#e9ca70','#a2b767','#74925c','#6d6540']}
  ];

  function rotateAnchors(anchors, steps) {
    const turns = ((steps % 4) + 4) % 4;
    return anchors.map(function (_, index) {
      return anchors[(index - turns * 2 + 8) % 8];
    });
  }

  function buildAnchorTiles(anchors) {
    const colors = anchors.map(function (hex) {
      return [1,3,5].map(function (offset) {
        return parseInt(hex.slice(offset, offset + 2), 16);
      });
    });
    const center = [0,1,2].map(function (channel) {
      return colors.reduce(function (sum, color) { return sum + color[channel]; }, 0) / 8;
    });
    const controls = [
      [colors[0], colors[1], colors[2]],
      [colors[7], center, colors[3]],
      [colors[6], colors[5], colors[4]]
    ];
    const tiles = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 7; col++) {
        const x = col / 6, y = row / 8;
        const controlCol = x < 0.5 ? 0 : 1;
        const controlRow = y < 0.5 ? 0 : 1;
        const localCol = col - controlCol * 3;
        const localRow = row - controlRow * 4;
        const topLeft = controls[controlRow][controlCol];
        const topRight = controls[controlRow][controlCol + 1];
        const bottomLeft = controls[controlRow + 1][controlCol];
        const bottomRight = controls[controlRow + 1][controlCol + 1];
        // Integer weights express local x/3 and y/4 without early rounding.
        const color = [0,1,2].map(function (channel) {
          return Math.round((
            topLeft[channel] * (3 - localCol) * (4 - localRow) +
            topRight[channel] * localCol * (4 - localRow) +
            bottomLeft[channel] * (3 - localCol) * localRow +
            bottomRight[channel] * localCol * localRow
          ) / 12);
        });
        tiles.push({id:row * 7 + col,targetRow:row,targetCol:col,color:'rgb(' + color.join(',') + ')'});
      }
    }
    return tiles;
  }

  return {ADDITIONAL_PALETTES, rotateAnchors, buildAnchorTiles};
});
