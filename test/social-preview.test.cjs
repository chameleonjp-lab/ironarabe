const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('fixed social preview is metadata-linked and included in release integrity',()=>{
 const html=fs.readFileSync('index.html','utf8'),url='https://chameleonjp-lab.github.io/ironarabe/assets/social-preview.png';
 assert.ok(html.includes(`property="og:image" content="${url}"`));
 assert.ok(html.includes(`name="twitter:image" content="${url}"`));
 assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
 const image=fs.readFileSync('assets/social-preview.png');
 assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
 const {RUNTIME_FILES,validateHtml,verifyContents}=require('../tools/verify-github-pages.cjs');
 assert.ok(RUNTIME_FILES.includes('assets/social-preview.png'));assert.doesNotThrow(()=>validateHtml(html));
});
