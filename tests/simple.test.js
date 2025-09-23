const { test } = require('node:test');
const assert = require('node:assert/strict');

test('simple test that always passes', () => {
  assert.equal(1 + 1, 2);
});

test('basic API structure test', () => {
  // Test that basic modules can be loaded
  const config = require('../src/config');
  assert.ok(config);
  
  // Test that basic functions exist
  assert.ok(typeof config.loadEnv === 'function');
});
