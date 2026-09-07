import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActionableEnvConflicts,
  isMaskedEnvConflictValue,
  restoreRequestFromRemoval,
} from './env-conflicts-guard.ts';

const activeProfile = {
  apiKey: 'sk-active-secret-1234',
  baseUrl: 'https://relay.example/v1',
};

function conflict(overrides: Record<string, unknown>) {
  return {
    name: 'OPENAI_API_KEY',
    source: 'process',
    valuePresent: true,
    status: 'divergent',
    currentValueMasked: 'sk-***9999',
    expectedValueMasked: 'sk-***1234',
    ...overrides,
  } as const;
}

test('environment guard suppresses aligned and unconfigured external values', () => {
  const actionable = getActionableEnvConflicts(activeProfile, [
    conflict({ status: 'aligned', currentValueMasked: 'sk-***1234' }),
    conflict({ name: 'OPENAI_BASE_URL', status: 'divergent' }),
    conflict({ name: 'OPENAI_API_URL', status: 'external' }),
  ]);

  assert.deepEqual(actionable.map((item) => item.name), ['OPENAI_BASE_URL']);
});

test('environment guard deduplicates the same variable across process and user sources', () => {
  const actionable = getActionableEnvConflicts(activeProfile, [
    conflict({ source: 'user' }),
    conflict({ source: 'process' }),
  ]);

  assert.equal(actionable.length, 1);
  assert.equal(actionable[0]?.name, 'OPENAI_API_KEY');
  assert.equal(actionable[0]?.source, 'process');
});

test('environment guard accepts masked values but rejects raw credential display', () => {
  assert.equal(isMaskedEnvConflictValue('sk-***1234'), true);
  assert.equal(isMaskedEnvConflictValue('sk-active-secret-1234'), false);
  assert.equal(isMaskedEnvConflictValue('<empty>'), true);
});

test('environment guard exposes a backup path only as a restorable action contract', () => {
  assert.deepEqual(
    restoreRequestFromRemoval({
      status: 'ok',
      backupPath: 'C:/local/backups/env-conflicts-1.json',
      undo: { backupPath: 'C:/local/backups/env-conflicts-1.json' },
    }),
    { backupPath: 'C:/local/backups/env-conflicts-1.json' },
  );
  assert.equal(
    restoreRequestFromRemoval({ status: 'failed', backupPath: 'C:/local/backups/env-conflicts-2.json' }),
    null,
  );
});
