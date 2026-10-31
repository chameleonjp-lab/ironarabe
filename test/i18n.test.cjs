'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>require('../js/i18n.js');
const storage=(saved)=>{const values=new Map(saved?[['ironarabe.language.v1',saved]]:[]);return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
test('browser priority, Sainome locale mapping, saved manual choice and unsupported fallback',()=>{
 const {createI18n}=load();
 for(const [tags,want] of [[['xx','zh-HK'],'zh-Hant'],[['zh-Hans-TW'],'zh-Hans'],[['pt-PT'],'pt-BR'],[['es-MX'],'es'],[['zz'],'en'],[[],'ja']]){
  assert.equal(createI18n({storage:null,navigatorObject:{languages:tags}}).getLanguage(),want);
 }
 const saved=storage('de');const i18n=createI18n({storage:saved,navigatorObject:{languages:['ja']}});
 assert.equal(i18n.getLanguage(),'de');i18n.setLanguage('fr');i18n.setLanguage('bad');
 assert.equal(i18n.getLanguage(),'fr');assert.equal(createI18n({storage:saved}).getLanguage(),'fr');
});
test('locale formatting affects presentation, never stored score values or names',()=>{
 const i=load().createI18n({storage:null,navigatorObject:{language:'de'}});
 assert.equal(i.formatNumber(1234.5,2),'1234,50');
 assert.equal(i.t('{0}秒',[i.formatNumber(34.15,2)]),'34,15 Sekunden');
 assert.equal(i.t('STAGE {0}・{1}',['1 / 8','<Alice>']).includes('<Alice>'),true);
});
test('storage denial and unknown keys do not stop translation',()=>{
 const i=load().createI18n({storage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}},navigatorObject:{language:'en-US'}});
 i.setLanguage('fr');assert.equal(i.t('遊び方'),'Comment jouer');assert.equal(i.t('unknown'),'unknown');
});
