const test = require('node:test');
const assert = require('node:assert');
const { cleanGameName, validateRootName, defaultRootName } = require('../src/shared/names');

test('cleanGameName strips tags and versions (regression cases)', () => {
  assert.strictEqual(cleanGameName('God.of.War-FitGirl'), 'God of War');
  assert.strictEqual(cleanGameName('[DODI] Red Dead Redemption 2 v1.14'), 'Red Dead Redemption 2');
  assert.strictEqual(cleanGameName('Cyberpunk_2077_CODEX'), 'Cyberpunk 2077');
  assert.strictEqual(cleanGameName('Elden.Ring-EMPRESS'), 'Elden Ring');
});

test('validateRootName: required, length, uniqueness, trimming', () => {
  assert.deepStrictEqual(validateRootName('', []), { ok: false, code: 'NAME_REQUIRED' });
  assert.deepStrictEqual(validateRootName('   ', []), { ok: false, code: 'NAME_REQUIRED' });
  assert.deepStrictEqual(validateRootName('x'.repeat(30), []), { ok: true, name: 'x'.repeat(30) });
  assert.deepStrictEqual(validateRootName('x'.repeat(31), []), { ok: false, code: 'NAME_TOO_LONG' });
  assert.deepStrictEqual(validateRootName('main ssd', ['Main SSD']), { ok: false, code: 'NAME_TAKEN' });
  assert.deepStrictEqual(validateRootName('  USB  ', ['Main']), { ok: true, name: 'USB' });
});

test('defaultRootName uses basename and suffixes clashes', () => {
  assert.strictEqual(defaultRootName('D:\\Games', []), 'Games');
  assert.strictEqual(defaultRootName('E:\\Games', ['Games']), 'Games (2)');
  assert.strictEqual(defaultRootName('F:\\Games', ['games', 'Games (2)']), 'Games (3)');
});

test('defaultRootName handles drive roots', () => {
  assert.strictEqual(defaultRootName('D:\\', []), 'D:');
});
