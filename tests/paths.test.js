const test = require('node:test');
const assert = require('node:assert');
const { normalizePath, isSamePath, basename } = require('../src/shared/paths');

test('normalizePath unifies slashes, case and trailing separators', () => {
  assert.strictEqual(normalizePath('D:/Games/Elden Ring/'), 'd:\\games\\elden ring');
  assert.strictEqual(normalizePath('D:\\Games\\\\'), 'd:\\games');
});

test('normalizePath keeps a drive root', () => {
  assert.strictEqual(normalizePath('C:\\'), 'c:\\');
  assert.strictEqual(normalizePath('C:'), 'c:\\');
  assert.strictEqual(normalizePath('c:/'), 'c:\\');
});

test('isSamePath is case-insensitive', () => {
  assert.ok(isSamePath('D:\\Games', 'd:/games/'));
  assert.ok(!isSamePath('D:\\Games', 'D:\\Games2'));
});

test('basename ignores trailing separators', () => {
  assert.strictEqual(basename('D:\\Games\\Repacks\\'), 'Repacks');
  assert.strictEqual(basename('D:/Games/Hades'), 'Hades');
  assert.strictEqual(basename(''), '');
});
