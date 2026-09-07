import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskCredential,
  computeProviderSwitchPreflight,
  isSuccessfulCommandAction,
  rollbackSnapshotFromSwitchResult,
  rollbackSnapshotFromUndoResult,
} from './provider-switch-preflight.ts';

const syntheticKey = (scope: string, value: string) => ['sk', scope, value].join('-');

test('maskCredential protects sensitive API keys', () => {
  assert.equal(maskCredential(''), '(未配置)');
  assert.equal(maskCredential('12345'), '********');
  assert.equal(maskCredential(syntheticKey('proj', '1234567890abcdef')), 'sk-****def');
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
    apiKey: syntheticKey('source', '12345678'),
    sub2apiEnabled: false,
  };

  const target = {
    id: 'deepseek',
    name: 'DeepSeek 主力',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    protocol: 'chat',
    relayMode: 'pureApi',
    apiKey: syntheticKey('target', '87654321'),
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
  assert.equal(authDiff.oldValue.includes(syntheticKey('source', '12345678')), false);
  assert.equal(authDiff.newValue.includes(syntheticKey('target', '87654321')), false);
});

test('provider preflight compares live-impact fields without exposing raw credentials', () => {
  const source = {
    id: 'p1',
    name: 'Profile One',
    configContents: 'base_url = "https://one.example"',
    authContents: 'synthetic-source-secret',
    vlmApiKey: 'synthetic-vlm-source-secret',
    modelRoutes: [{ model: 'a', targetRelayId: 'p1' }],
  };
  const target = {
    id: 'p2',
    name: 'Profile Two',
    configContents: 'base_url = "https://two.example"',
    authContents: 'synthetic-target-secret',
    vlmApiKey: 'synthetic-vlm-target-secret',
    modelRoutes: [{ model: 'a', targetRelayId: 'p2' }],
  };

  const preflight = computeProviderSwitchPreflight(source, target);
  const fields = preflight.diffs.map((diff) => diff.field);
  assert.ok(fields.includes('configContents'));
  assert.ok(fields.includes('authContents'));
  assert.ok(fields.includes('vlmApiKey'));
  assert.ok(fields.includes('modelRoutes'));
  for (const diff of preflight.diffs.filter((item) => item.isSensitive)) {
    assert.equal(diff.oldValue.includes('synthetic-'), false);
    assert.equal(diff.newValue.includes('synthetic-'), false);
  }
});

test('backend action result is the only source of a persistent undo banner', () => {
  const switched = {
    ok: true,
    code: 'ok',
    message: 'switched',
    undo_token: '123e4567-e89b-42d3-a456-426614174000',
    recovery: null,
    data: null,
  };
  const snapshot = rollbackSnapshotFromSwitchResult(switched, 'Profile One', 'Profile Two', 123);
  assert.deepEqual(snapshot, {
    token: switched.undo_token,
    timestamp: 123,
    sourceName: 'Profile One',
    targetName: 'Profile Two',
  });
  assert.equal(isSuccessfulCommandAction(switched), true);

  const loaded = {
    ok: true,
    code: 'ok',
    message: 'loaded',
    undo_token: null,
    recovery: null,
    data: {
      token: switched.undo_token,
      createdAtMs: 456,
      sourceProfileName: 'Profile One',
      targetProfileName: 'Profile Two',
    },
  };
  assert.deepEqual(rollbackSnapshotFromUndoResult(loaded), {
    token: switched.undo_token,
    timestamp: 456,
    sourceName: 'Profile One',
    targetName: 'Profile Two',
  });

  const failed = { ...switched, ok: false, code: 'restore_conflict', recovery: 'manual recovery' };
  assert.equal(isSuccessfulCommandAction(failed), false);
  assert.equal(rollbackSnapshotFromSwitchResult(failed, 'Profile One', 'Profile Two'), null);
});
