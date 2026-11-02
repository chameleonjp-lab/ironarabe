const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('rebuilt share actions are two native non-submit buttons with no old anchor or handler',()=>{
 for(const id of ['homeXShare','resultXShare'])assert.match(html,new RegExp('<button[^>]*id="'+id+'"[^>]*type="button"'));
 for(const old of ['homeShareBtn','resultShareBtn','activateXShare'])assert.ok(!html.includes(old),old+' removed');
});
