const test = require('node:test');
const assert = require('node:assert');
const { matchScore, isGoodMatch, bestMatch } = require('../src/shared/match');
const { cleanGameName } = require('../src/shared/names');
const { matchesIgnore, DEFAULT_IGNORE, cleanIgnorePatterns } = require('../src/shared/ignore');

test('the reported false matches are rejected', () => {
  assert.ok(!isGoodMatch(cleanGameName('0 - torrent-temp'), 'Torrent Tycoon [v0.1beta]'));
  assert.ok(!isGoodMatch(cleanGameName('0 - PC'), 'Resident Evil 0'));
});

test('the reported real games are accepted', () => {
  const cases = [
    ['CONTROL Resonant [FitGirl Repack]', 'Control Resonant'],
    ["Five Nights at Freddy's - Security Breach [FitGirl Repack]", "Five Nights at Freddy's: Security Breach"],
    ['Grand Theft Auto V Enhanced [FitGirl Repack]', 'Grand Theft Auto V'],
    ['REPLACED [FitGirl Repack]', 'REPLACED'],
    ['God.of.War-v1.0.2', 'God of War'],
    ['Elden.Ring-EMPRESS', 'Elden Ring'],
    ['Cyberpunk_2077_CODEX', 'Cyberpunk 2077'],
    ['The Witcher 3 Wild Hunt Complete Edition', 'The Witcher 3: Wild Hunt']
  ];
  for (const [folder, rawg] of cases) {
    assert.ok(isGoodMatch(cleanGameName(folder), rawg), `${folder} vs ${rawg} = ${matchScore(cleanGameName(folder), rawg)}`);
  }
});

test('different sequel numbers never match', () => {
  assert.strictEqual(matchScore('The Witcher 3', 'The Witcher 2: Assassins of Kings'), 0);
  assert.strictEqual(matchScore('Resident Evil 0', 'Resident Evil 4'), 0);
  assert.ok(isGoodMatch('Resident Evil 4', 'Resident Evil 4'));
});

test('bestMatch picks the closest acceptable result, not the first', () => {
  const results = [{ name: 'Hades II' }, { name: 'Hades' }, { name: 'Hades Star' }];
  assert.strictEqual(bestMatch('Hades', results).name, 'Hades');
  assert.strictEqual(bestMatch('zzqx unknown', results), null);
  assert.strictEqual(bestMatch('Hades', []), null);
});

test('matchScore handles empty input and punctuation', () => {
  assert.strictEqual(matchScore('', 'Hades'), 0);
  assert.strictEqual(matchScore('!!!', 'Hades'), 0);
  assert.strictEqual(matchScore("Baldur's Gate 3", 'Baldurs Gate 3'), 1);
});

test('ignore list: wildcards, case, defaults, comments', () => {
  assert.ok(matchesIgnore('0 - torrent-temp', DEFAULT_IGNORE));
  assert.ok(matchesIgnore('$recycle.bin', DEFAULT_IGNORE));
  assert.ok(matchesIgnore('TEMP', DEFAULT_IGNORE));
  assert.ok(!matchesIgnore('Temple Run', DEFAULT_IGNORE));
  assert.ok(!matchesIgnore('0 - PC', DEFAULT_IGNORE));
  assert.ok(matchesIgnore('0 - PC', ['0 - ?C']));
  assert.ok(matchesIgnore('Anything (old)', ['*(old)']));
  assert.ok(!matchesIgnore('x', ['# comment', '', '   ']));
  assert.deepStrictEqual(cleanIgnorePatterns([' a ', '', '#x', 'b']), ['a', 'b']);
});
