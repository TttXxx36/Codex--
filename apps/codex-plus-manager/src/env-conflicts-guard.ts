export type EnvConflictStatus = 'aligned' | 'divergent' | 'external';
export type EnvConflictSource = 'process' | 'user' | string;

export interface EnvConflict {
  name: string;
  source: EnvConflictSource;
  valuePresent: boolean;
  status: EnvConflictStatus;
  currentValueMasked: string;
  expectedValueMasked: string | null;
}

export interface EnvConflictProfile {
  apiKey?: string | null;
  api_key?: string | null;
  baseUrl?: string | null;
  base_url?: string | null;
}

export interface EnvConflictUndoContract {
  backupPath: string;
}

export interface EnvConflictRemovalContract {
  status?: string;
  backupPath?: string | null;
  undo?: { backupPath?: string | null } | null;
}

const API_KEY_VARIABLES = new Set([
  'OPENAI_API_KEY',
  'CODEX_PLUS_OPENAI_API_KEY',
  'CODEX_PLUS_API_KEY',
]);

const BASE_URL_VARIABLES = new Set([
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_API_URL',
  'CODEX_PLUS_OPENAI_BASE_URL',
  'CODEX_PLUS_BASE_URL',
]);

function profileValue(profile: EnvConflictProfile | null | undefined, name: string): string {
  if (!profile) return '';
  const normalized = name.trim().toUpperCase();
  const value = API_KEY_VARIABLES.has(normalized)
    ? profile.apiKey ?? profile.api_key
    : BASE_URL_VARIABLES.has(normalized)
      ? profile.baseUrl ?? profile.base_url
      : '';
  return typeof value === 'string' ? value.trim() : '';
}

function sourcePriority(source: string): number {
  return source.trim().toLowerCase() === 'process' ? 0 : 1;
}

/**
 * Keep only actionable value-divergent entries for the active profile and
 * collapse process/user duplicates to one prompt per variable name.
 */
export function getActionableEnvConflicts(
  profile: EnvConflictProfile | null | undefined,
  conflicts: ReadonlyArray<EnvConflict>,
): EnvConflict[] {
  const actionable = conflicts.filter(
    (conflict) => conflict.status === 'divergent' && Boolean(profileValue(profile, conflict.name)),
  );
  const unique = new Map<string, EnvConflict>();
  for (const conflict of actionable) {
    const key = conflict.name.trim().toUpperCase();
    const existing = unique.get(key);
    if (!existing || sourcePriority(conflict.source) < sourcePriority(existing.source)) {
      unique.set(key, conflict);
    }
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/** Values sent to the manager UI must contain a deliberate mask marker. */
export function isMaskedEnvConflictValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed === '<empty>' || trimmed === '***' || trimmed.includes('***');
}

/** Convert a successful removal into the only shape accepted by the restore UI. */
export function restoreRequestFromRemoval(
  result: EnvConflictRemovalContract | null | undefined,
): EnvConflictUndoContract | null {
  if (!result || result.status !== 'ok') return null;
  const backupPath = result.undo?.backupPath?.trim() || result.backupPath?.trim() || '';
  return backupPath ? { backupPath } : null;
}
