const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),catalogs=require('../js/translations.js');
const source=html.match(/  function xShareUrl\(text\)\{[^\n]+/)[0]+'\n'+html.match(/  function updateShareLinks\(\)\{[^\n]+/)[0];
const GAME_URL='https://chameleonjp-lab.github.io/ironarabe/';
for(const [language,catalog] of Object.entries(catalogs))test(language+': both X texts preserve records, URL and exact two hashtags',()=>{
 const c=vm.createContext({URL,GAME_URL,el:{homeShareBtn:{},resultShareBtn:{}},state:{stage:{},elapsedMs:99999999,operations:9999},stageShortLabel:()=>40,stageLongLabel:()=>catalog['夕映え']||'夕映え',formatElapsedMs:()=> '99999.99',formatNumber:n=>String(n),t:(s,p=[])=> (catalog[s]||s).replace(/\{(\d+)\}/g,(_,i)=>p[i])});vm.runInContext(source+'\nupdateShareLinks();',c);
 for(const element of [c.el.homeShareBtn,c.el.resultShareBtn]){const text=new URL(element.href).searchParams.get('text');assert.equal(text.split('#イロナラベ').length-1,1);assert.equal(text.split('#ゲーム制作').length-1,1);assert.equal(text.split(GAME_URL).length-1,1);assert.ok(text.endsWith(GAME_URL));const length=[...text.replace(GAME_URL,'x'.repeat(23))].reduce((n,char)=>n+(char.codePointAt(0)<=4351?1:2),0);assert.ok(length<=280,language+' '+length);}
 const result=new URL(c.el.resultShareBtn.href).searchParams.get('text');assert.ok(result.includes('99999.99'));assert.ok(result.includes('9999'));
});
