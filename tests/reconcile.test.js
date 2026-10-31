const test = require('node:test');
const assert = require('node:assert');
const { reconcileGames } = require('../src/shared/reconcile');
const { isSamePath } = require('../src/shared/paths');

const clean = n => n.toUpperCase();
const rec = (path, rootId, extra = {}) => ({ folderPath: path, rootId, folderName: path.split('\\').pop(), searchName: 'saved', skipped: false, ...extra });
const entry = path => ({ name: path.split('\\').pop(), path });

test('new, vanished and known paths', () => {
  const saved = [rec('D:\\A\\Known', 'r1', { searchName: 'Edited', skipped: true }), rec('D:\\A\\Gone', 'r1')];
  const scans = [{ id: 'r1', available: true, entries: [entry('d:\\a\\known'), entry('D:\\A\\New')] }];
  const { games, added, removedCount } = reconcileGames(saved, scans, clean, isSamePath);
  assert.strictEqual(removedCount, 1);
  assert.strictEqual(games.length, 2);
  const known = games.find(g => g.folderPath === 'D:\\A\\Known');
  assert.strictEqual(known.searchName, 'Edited');
  assert.strictEqual(known.skipped, true);
  assert.deepStrictEqual(added.map(a => a.folderPath), ['D:\\A\\New']);
  assert.strictEqual(added[0].searchName, 'NEW');
});

test('unavailable root keeps its games', () => {
  const saved = [rec('X:\\B\\Game', 'r2')];
  const scans = [{ id: 'r2', available: false, entries: [] }];
  const { games, added, removedCount } = reconcileGames(saved, scans, clean, isSamePath);
  assert.strictEqual(games.length, 1);
  assert.strictEqual(added.length, 0);
  assert.strictEqual(removedCount, 0);
});

test('records of roots missing from scans are kept untouched', () => {
  const saved = [rec('Y:\\C\\Game', 'r9')];
  const { games } = reconcileGames(saved, [], clean, isSamePath);
  assert.strictEqual(games.length, 1);
});
