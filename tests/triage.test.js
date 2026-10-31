const test = require('node:test');
const assert = require('node:assert');
const { formatBytes, fingerprint } = require('../src/shared/format');
const { queryLibrary, allGenres, isFiltered } = require('../src/shared/query');
const { duplicateGroups } = require('../src/shared/dupes');
const { pickGame, pickPool } = require('../src/shared/pick');
const { compareVersions } = require('../src/shared/versions');
const { exportRows, toCsv, toHtml } = require('../src/shared/export');

const game = (name, extra = {}, data = {}) => ({
  folderPath: 'D:\\G\\' + name, rootId: 'r1', searchName: name, skipped: false,
  data: data === null ? null : { id: data.id ?? name, name, rating: 0, genres: [], ...data },
  ...extra
});

// ── format ──
test('formatBytes', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(58291234816), '54.3 GB');
  assert.strictEqual(formatBytes(null), '');
});

test('fingerprint changes when top-level entries change', () => {
  const a = fingerprint({ mtimeMs: 10 }, [{ mtimeMs: 1, size: 5 }]);
  const b = fingerprint({ mtimeMs: 10 }, [{ mtimeMs: 1, size: 5 }, { mtimeMs: 2, size: 1 }]);
  assert.notStrictEqual(a, b);
  assert.strictEqual(a, fingerprint({ mtimeMs: 10 }, [{ mtimeMs: 1, size: 5 }]));
});

// ── query ──
test('sort by metacritic puts missing values last in both directions', () => {
  const games = [game('A', {}, { metacritic: 80 }), game('B', {}, { metacritic: null }), game('C', {}, { metacritic: 90 })];
  const desc = queryLibrary(games, { sort: { field: 'metacritic', dir: 'desc' } }).list.map(g => g.searchName);
  const asc = queryLibrary(games, { sort: { field: 'metacritic', dir: 'asc' } }).list.map(g => g.searchName);
  assert.deepStrictEqual(desc, ['C', 'A', 'B']);
  assert.deepStrictEqual(asc, ['A', 'C', 'B']);
});

test('filters combine with AND, genres with OR', () => {
  const games = [
    game('RPG2020', {}, { genres: ['RPG'], released: '2020-01-01', rating: 4.5 }),
    game('Strat2010', {}, { genres: ['Strategy'], released: '2010-01-01', rating: 4.5 }),
    game('RPG2021low', {}, { genres: ['RPG'], released: '2021-01-01', rating: 2 }),
    game('Action2020', {}, { genres: ['Action'], released: '2020-01-01', rating: 5 }),
    game('Unmatched', {}, null)
  ];
  const r = queryLibrary(games, { genres: ['RPG', 'Strategy'], yearMin: 2015, ratingMin: 4 });
  assert.deepStrictEqual(r.list.map(g => g.searchName), ['RPG2020']);
  assert.strictEqual(r.total, 5);
  assert.deepStrictEqual(queryLibrary(games, { match: 'unmatched' }).list.map(g => g.searchName), ['Unmatched']);
});

test('ctx filters: text, rootIds, hideUnavailable; skipped never shown', () => {
  const games = [
    game('Hades', { rootId: 'r1' }), game('Hades II', { rootId: 'r2', unavailable: true }),
    game('Doom', { rootId: 'r1' }), game('Hidden', { skipped: true })
  ];
  assert.deepStrictEqual(queryLibrary(games, {}, { text: 'hades' }).list.map(g => g.searchName), ['Hades', 'Hades II']);
  assert.deepStrictEqual(queryLibrary(games, {}, { rootIds: ['r2'] }).list.map(g => g.searchName), ['Hades II']);
  const hidden = queryLibrary(games, {}, { hideUnavailable: true });
  assert.deepStrictEqual(hidden.list.map(g => g.searchName), ['Doom', 'Hades']);
  assert.strictEqual(hidden.total, 2);
});

test('statuses filter treats no status as "none"; shownBytes sums known sizes', () => {
  const games = [
    game('A', { status: 'delete', size: { bytes: 100 } }),
    game('B', { status: 'delete' }),
    game('C', { size: { bytes: 5 } })
  ];
  const r = queryLibrary(games, { statuses: ['delete'] });
  assert.deepStrictEqual(r.list.map(g => g.searchName), ['A', 'B']);
  assert.strictEqual(r.shownBytes, 100);
  assert.deepStrictEqual(queryLibrary(games, { statuses: ['none'] }).list.map(g => g.searchName), ['C']);
});

test('duplicatesOnly keeps copies adjacent', () => {
  const games = [
    game('Elden Ring A', { copies: 2, size: { bytes: 10 } }, { id: 1 }),
    game('Hades A', { copies: 2, size: { bytes: 50 } }, { id: 2 }),
    game('Elden Ring B', { copies: 2, size: { bytes: 90 } }, { id: 1 }),
    game('Hades B', { copies: 2, size: { bytes: 20 } }, { id: 2 }),
    game('Solo', { copies: 1 }, { id: 3 })
  ];
  const r = queryLibrary(games, { duplicatesOnly: true, sort: { field: 'size', dir: 'desc' } });
  assert.deepStrictEqual(r.list.map(g => g.searchName), ['Elden Ring B', 'Elden Ring A', 'Hades A', 'Hades B']);
});

test('allGenres and isFiltered', () => {
  assert.deepStrictEqual(allGenres([game('A', {}, { genres: ['RPG', 'Action'] }), game('B', {}, { genres: ['RPG'] })]), ['Action', 'RPG']);
  assert.strictEqual(isFiltered({ sort: { field: 'size', dir: 'desc' } }), false);
  assert.strictEqual(isFiltered({}, { text: 'x' }), true);
  assert.strictEqual(isFiltered({ duplicatesOnly: true }), true);
});

// ── dupes ──
test('duplicateGroups ignores unmatched and skipped games', () => {
  const games = [
    game('A1', {}, { id: 7 }), game('A2', {}, { id: 7 }), game('A3', { skipped: true }, { id: 7 }),
    game('U1', {}, null), game('U2', {}, null), game('Solo', {}, { id: 8 })
  ];
  const groups = duplicateGroups(games);
  assert.strictEqual(groups.size, 1);
  assert.strictEqual(groups.get(7).length, 2);
});

// ── pick ──
function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

test('pickGame prefers backlog and weights by rating', () => {
  const games = [
    game('Low', { status: 'backlog' }, { rating: 0.5 }), game('High', { status: 'backlog' }, { rating: 5 }),
    game('Other', {}, { rating: 5 })
  ];
  const rng = seeded(42);
  const counts = { Low: 0, High: 0, Other: 0 };
  for (let i = 0; i < 400; i++) counts[pickGame(games, rng).searchName]++;
  assert.strictEqual(counts.Other, 0);
  assert.ok(counts.High > counts.Low);
});

test('pickGame falls back to matched games excluding played and delete', () => {
  const games = [game('Played', { status: 'played' }), game('Del', { status: 'delete' }), game('Ok'), game('Unmatched', {}, null)];
  assert.strictEqual(pickPool(games).reason, 'matched');
  for (let i = 0; i < 20; i++) assert.strictEqual(pickGame(games).searchName, 'Ok');
  assert.strictEqual(pickGame([game('P', { status: 'played' })]), null);
});

test('pickGame reroll excludes the current game when possible', () => {
  const games = [game('A'), game('B')];
  for (let i = 0; i < 20; i++) assert.strictEqual(pickGame(games, Math.random, 'D:\\G\\A').searchName, 'B');
  assert.strictEqual(pickGame([game('A')], Math.random, 'D:\\G\\A').searchName, 'A');
});

// ── versions ──
test('compareVersions', () => {
  assert.strictEqual(compareVersions('v1.2.0', '1.1.9'), 1);
  assert.strictEqual(compareVersions('1.0', '1.0.0'), 0);
  assert.strictEqual(compareVersions('1.0.0', 'v1.0.1'), -1);
  assert.strictEqual(compareVersions('2.0.0', '10.0.0'), -1);
});

// ── export ──
test('CSV quotes commas, quotes and keeps unicode with a BOM', () => {
  const games = [game('Hello, "World"', { rootName: 'Main', status: 'backlog', size: { bytes: 2048 } }, { rating: 4.25, genres: ['RPG', 'Action'] }),
                 game('Pokémon Ü', { rootName: 'USB' }, null)];
  const csv = toCsv(exportRows(games, { includePaths: false }));
  assert.ok(csv.startsWith('\uFEFF"Title"'));
  assert.ok(csv.includes('"Hello, ""World"""'));
  assert.ok(csv.includes('"Pokémon Ü"'));
  assert.ok(!csv.includes('"Path"'));
  assert.ok(csv.includes('"Backlog"'));
  assert.strictEqual(csv.trim().split('\r\n').length, 3);
  assert.ok(toCsv(exportRows(games, { includePaths: true })).includes('"Path"'));
});

test('HTML export escapes values and includes attribution', () => {
  const html = toHtml(exportRows([game('<script>alert(1)</script>', { rootName: 'A&B' })], { includePaths: false }));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A&amp;B'));
  assert.ok(html.includes('https://rawg.io'));
});
