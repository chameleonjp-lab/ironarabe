(function(root){
'use strict';
const languages=typeof module==='object'&&module.exports?require('./language-options.js'):root.IronarabeLanguages;
const catalogs=typeof module==='object'&&module.exports?require('./translations.js'):root.IronarabeTranslations;
const {SUPPORTED_LANGUAGES,isSupportedLanguage,getLanguageLocale,languageFromLocale}=languages;
const LANGUAGE_STORAGE_KEY='ironarabe.language.v1';
function safeStorage(){try{return root.localStorage;}catch{return null;}}
// Same preferred-language ordering and fallbacks as Sainome.
function browserLanguage(navigatorObject){
  const values=Array.isArray(navigatorObject?.languages)?navigatorObject.languages:[];
  const preferences=[...values,navigatorObject?.language].filter(value=>typeof value==='string'&&value.trim());
  for(const locale of preferences){const language=languageFromLocale(locale);if(language)return language;}
  return preferences.length?'en':'ja';
}
function createI18n({storage=safeStorage(),navigatorObject=root.window?.navigator}={}){
  let language=browserLanguage(navigatorObject);
  try{const saved=storage?.getItem(LANGUAGE_STORAGE_KEY);if(isSupportedLanguage(saved))language=saved;}catch{}
  const parameters=new WeakMap(),originalAttributes=new WeakMap(),formatters=new Map();
  function t(source,values={}){
    const catalog=catalogs[language];
    const message=catalog&&Object.hasOwn(catalog,source)?catalog[source]:source;
    return message.replace(/\{(\d+)\}/gu,(placeholder,key)=>Object.hasOwn(values,key)?String(values[key]):placeholder);
  }
  function formatNumber(value,decimals=0){const key=language+':'+decimals;if(!formatters.has(key))formatters.set(key,new Intl.NumberFormat(getLanguageLocale(language),{minimumFractionDigits:decimals,maximumFractionDigits:decimals,useGrouping:false}));return formatters.get(key).format(value);}
  function renderMessage(element){const values=parameters.get(element);element.textContent=t(element.getAttribute('data-i18n'),typeof values==='function'?values():values);}
  function setMessage(element,source,values={}){element.setAttribute('data-i18n',source);parameters.set(element,values);renderMessage(element);}
  function applyTranslations(documentObject=root.document){
    for(const element of documentObject.querySelectorAll('[data-i18n], [data-i18n-attrs]')){
      if(element.hasAttribute('data-i18n'))renderMessage(element);
      let originals=originalAttributes.get(element);
      if(!originals){originals={};for(const attr of (element.getAttribute('data-i18n-attrs')||'').split(/\s+/u).filter(Boolean))originals[attr]=element.getAttribute(attr);originalAttributes.set(element,originals);}
      for(const [attr,source] of Object.entries(originals))element.setAttribute(attr,t(source));
    }
    if(documentObject.documentElement)documentObject.documentElement.lang=language;
  }
  return Object.freeze({getLanguage:()=>language,setLanguage(next){if(!isSupportedLanguage(next))return;language=next;try{storage?.setItem(LANGUAGE_STORAGE_KEY,next);}catch{}},t,formatNumber,setMessage,applyTranslations});
}
const api={createI18n,LANGUAGE_STORAGE_KEY,SUPPORTED_LANGUAGES,getLanguageLocale};
if(typeof module==='object'&&module.exports)module.exports=api;else root.IronarabeI18n=api;
}(globalThis));
