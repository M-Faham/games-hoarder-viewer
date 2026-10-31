const test = require('node:test');
const assert = require('node:assert');
const { classifyRawgResponse } = require('../src/shared/rawg');

test('classifyRawgResponse covers every outcome', () => {
  assert.strictEqual(classifyRawgResponse({ networkError: new Error('x') }), 'offline');
  assert.strictEqual(classifyRawgResponse({ status: 401 }), 'invalid');
  assert.strictEqual(classifyRawgResponse({ status: 403 }), 'invalid');
  assert.strictEqual(classifyRawgResponse({ status: 429 }), 'rate_limited');
  assert.strictEqual(classifyRawgResponse({ status: 200 }), 'ok');
  assert.strictEqual(classifyRawgResponse({ status: 204 }), 'ok');
  assert.strictEqual(classifyRawgResponse({ status: 500 }), 'error');
  assert.strictEqual(classifyRawgResponse({ status: 404 }), 'error');
});
