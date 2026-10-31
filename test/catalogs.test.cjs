const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const catalogPath = path.join(__dirname, '../js/translations.js');
const messages = require('../js/messages.json');
const languages = [
  'ja', 'en', 'es', 'pt-BR', 'zh-Hans', 'fr', 'de', 'ko',
  'ru', 'it', 'zh-Hant', 'id', 'tr', 'vi', 'th'
];

test('every supported language provides every source message and its placeholders', () => {
  assert.ok(fs.existsSync(catalogPath), 'the local translation catalog must exist');
  const catalogs = require(catalogPath);
  assert.deepEqual(Object.keys(catalogs).sort(), [...languages].sort());

  for (const language of languages) {
    assert.deepEqual(Object.keys(catalogs[language]).sort(), [...messages].sort(), language);
    for (const source of messages) {
      const translated = catalogs[language][source];
      assert.equal(typeof translated, 'string', `${language}: ${source}`);
      assert.ok(translated.trim(), `${language}: ${source} must not be empty`);
      assert.deepEqual(
        (translated.match(/\{\d+\}/g) || []).sort(),
        (source.match(/\{\d+\}/g) || []).sort(),
        `${language}: ${source} must retain every placeholder`
      );
    }
  }
});

test('the catalog loads as a classic browser script without a module loader', () => {
  assert.ok(fs.existsSync(catalogPath), 'the local translation catalog must exist');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(catalogPath, 'utf8'), context);
  const catalog = context.IronarabeTranslations;
  assert.ok(catalog);
  assert.equal(catalog.ja['イロナラベ'], 'イロナラベ');
  assert.equal(catalog.en['イロナラベ'], 'Ironarabe');
  assert.equal(catalog.ja['{0}回操作'], '{0}回');
  assert.equal(catalog.ja['{0}回プレイ'], '{0}回');
  assert.equal(Object.keys(catalog).length, languages.length);
});
