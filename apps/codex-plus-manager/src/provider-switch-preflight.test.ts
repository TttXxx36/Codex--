import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskCredential,
  computeProviderSwitchPreflight,
  createSwitchRollbackSnapshot,
  restoreSwitchRollback,
} from './provider-switch-preflight.ts';

test('maskCredential protects sensitive API keys', () => {
  assert.equal(maskCredential(''), '(未配置)');
  assert.equal(maskCredential('12345'), '********');
  assert.equal(maskCredential('sk-proj-1234567890abcdef'), 'sk-****def');
});

test('computeProviderSwitchPreflight returns empty diff for identical profile', () => {
  const profile = {
    id: 'openai-default',
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    protocol: 'responses',
  };

  const preflight = computeProviderSwitchPreflight(profile, profile);
  assert.equal(preflight.hasChanges, false);
  assert.equal(preflight.requiresConfirmation, false);
  assert.equal(preflight.diffs.length, 0);
});

test('computeProviderSwitchPreflight detects endpoint, model, protocol and auth diffs', () => {
  const source = {
    id: 'openai',
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    protocol: 'responses',
    relayMode: 'pureApi',
    apiKey: 'sk-source-12345678',
    sub2apiEnabled: false,
  };

  const target = {
    id: 'deepseek',
    name: 'DeepSeek 主力',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    protocol: 'chat',
    relayMode: 'pureApi',
    apiKey: 'sk-target-87654321',
    sub2apiEnabled: true,
  };

  const preflight = computeProviderSwitchPreflight(source, target);
  assert.equal(preflight.hasChanges, true);
  assert.equal(preflight.requiresConfirmation, true);
  assert.equal(preflight.sourceName, 'OpenAI 官方');
  assert.equal(preflight.targetName, 'DeepSeek 主力');

  // Verify categories
  const categories = preflight.diffs.map((d) => d.category);
  assert.ok(categories.includes('endpoint'));
  assert.ok(categories.includes('model'));
  assert.ok(categories.includes('protocol'));
  assert.ok(categories.includes('auth'));
  assert.ok(categories.includes('other'));

  // Verify masked auth diff
  const authDiff = preflight.diffs.find((d) => d.category === 'auth');
  assert.ok(authDiff);
  assert.ok(authDiff.oldValue.includes('****'));
  assert.ok(authDiff.newValue.includes('****'));
  assert.equal(authDiff.oldValue.includes('sk-source-12345678'), false);
  assert.equal(authDiff.newValue.includes('sk-target-87654321'), false);
});

test('createSwitchRollbackSnapshot and restoreSwitchRollback allow safe one-click undo', () => {
  const initialSettings = {
    activeRelayId: 'p1',
    relayProfiles: [
      { id: 'p1', name: 'Profile One', baseUrl: 'https://p1.com' },
      { id: 'p2', name: 'Profile Two', baseUrl: 'https://p2.com' },
    ],
    launchMode: 'patch',
  };

  const snapshot = createSwitchRollbackSnapshot(initialSettings, 'p2');
  assert.ok(snapshot.token.startsWith('rb-'));
  assert.equal(snapshot.previousActiveRelayId, 'p1');
  assert.equal(snapshot.targetActiveRelayId, 'p2');
  assert.equal(snapshot.sourceName, 'Profile One');
  assert.equal(snapshot.targetName, 'Profile Two');

  const restored = restoreSwitchRollback(snapshot);
  assert.deepEqual(restored, initialSettings);
});
