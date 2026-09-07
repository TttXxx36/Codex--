export interface CommandActionResult<T = unknown> {
  ok: boolean;
  code: string | null;
  message: string | null;
  undo_token: string | null;
  recovery: string | null;
  data: T | null;
}

export interface ProfileDiffItem {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  category: 'endpoint' | 'model' | 'auth' | 'protocol' | 'other';
  isSensitive?: boolean;
}

export interface ProviderSwitchPreflight {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  diffs: ProfileDiffItem[];
  hasChanges: boolean;
  requiresConfirmation: boolean;
  summary: string;
}

export interface SwitchRollbackSnapshot {
  token: string;
  timestamp: number;
  sourceName: string;
  targetName: string;
}

export interface RelaySwitchUndoData {
  token: string;
  createdAtMs: number;
  sourceProfileName: string;
  targetProfileName: string;
}

export function maskCredential(value: string): string {
  if (!value) return '(未配置)';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`;
}

export function isSuccessfulCommandAction<T>(
  result: CommandActionResult<T> | null | undefined,
): result is CommandActionResult<T> & { ok: true } {
  return result?.ok === true;
}

export function rollbackSnapshotFromUndoResult(
  result: CommandActionResult<RelaySwitchUndoData> | null | undefined,
): SwitchRollbackSnapshot | null {
  if (!isSuccessfulCommandAction(result) || !result.data?.token) return null;
  return {
    token: result.data.token,
    timestamp: result.data.createdAtMs,
    sourceName: result.data.sourceProfileName,
    targetName: result.data.targetProfileName,
  };
}

export function rollbackSnapshotFromSwitchResult(
  result: CommandActionResult<unknown> | null | undefined,
  sourceName: string,
  targetName: string,
  timestamp = Date.now(),
): SwitchRollbackSnapshot | null {
  if (!isSuccessfulCommandAction(result) || !result.undo_token) return null;
  return {
    token: result.undo_token,
    timestamp,
    sourceName,
    targetName,
  };
}

function profileValue(profile: any, ...keys: string[]): unknown {
  for (const key of keys) {
    if (profile && profile[key] !== undefined && profile[key] !== null) return profile[key];
  }
  return '';
}

function comparableValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function displayValue(value: unknown, sensitive: boolean, emptyLabel: string): string {
  const comparable = comparableValue(value);
  if (!comparable) return emptyLabel;
  if (sensitive) return maskCredential(comparable);
  return comparable;
}

type DiffDefinition = {
  field: string;
  label: string;
  category: ProfileDiffItem['category'];
  keys: string[];
  sensitive?: boolean;
  emptyLabel?: string;
};

const DIFF_DEFINITIONS: DiffDefinition[] = [
  { field: 'baseUrl', label: 'API 地址 (Base URL)', category: 'endpoint', keys: ['baseUrl', 'base_url'], emptyLabel: '(默认)' },
  { field: 'upstreamBaseUrl', label: '上游基准地址', category: 'endpoint', keys: ['upstreamBaseUrl', 'upstream_base_url'], emptyLabel: '(无)' },
  { field: 'model', label: '默认模型', category: 'model', keys: ['model'], emptyLabel: '(默认)' },
  { field: 'testModel', label: '测试模型', category: 'model', keys: ['testModel', 'test_model'], emptyLabel: '(默认)' },
  { field: 'protocol', label: '接口协议', category: 'protocol', keys: ['protocol'], emptyLabel: 'responses' },
  { field: 'relayMode', label: '转发模式', category: 'other', keys: ['relayMode', 'relay_mode'], emptyLabel: 'pureApi' },
  { field: 'officialMixApiKey', label: '官方混合 API Key', category: 'auth', keys: ['officialMixApiKey', 'official_mix_api_key'] },
  { field: 'noAuth', label: '上游免鉴权', category: 'auth', keys: ['noAuth', 'no_auth'] },
  { field: 'hideOfficialUsageAlert', label: '隐藏官方用量提醒', category: 'other', keys: ['hideOfficialUsageAlert', 'hide_official_usage_alert'] },
  { field: 'useCommonConfig', label: '使用通用配置', category: 'other', keys: ['useCommonConfig', 'use_common_config'] },
  { field: 'contextWindow', label: '上下文窗口', category: 'model', keys: ['contextWindow', 'context_window'], emptyLabel: '(默认)' },
  { field: 'autoCompactLimit', label: '自动压缩阈值', category: 'model', keys: ['autoCompactLimit', 'auto_compact_limit'], emptyLabel: '(默认)' },
  { field: 'modelInsertMode', label: '模型写入模式', category: 'model', keys: ['modelInsertMode', 'model_insert_mode'], emptyLabel: '(默认)' },
  { field: 'modelList', label: '模型列表', category: 'model', keys: ['modelList', 'model_list'], emptyLabel: '(未配置)' },
  { field: 'modelWindows', label: '模型上下文窗口映射', category: 'model', keys: ['modelWindows', 'model_windows'], emptyLabel: '(未配置)' },
  { field: 'modelAutoCompact', label: '模型自动压缩映射', category: 'model', keys: ['modelAutoCompact', 'model_auto_compact'], emptyLabel: '(未配置)' },
  { field: 'modelMetadata', label: '模型元数据覆盖', category: 'model', keys: ['modelMetadata', 'model_metadata'], emptyLabel: '(未配置)' },
  { field: 'modelVlm', label: 'VLM 模型映射', category: 'model', keys: ['modelVlm', 'model_vlm'], emptyLabel: '(未配置)' },
  { field: 'vlmApiKey', label: 'VLM 认证凭据', category: 'auth', keys: ['vlmApiKey', 'vlm_api_key'], sensitive: true },
  { field: 'vlmModel', label: 'VLM 模型', category: 'model', keys: ['vlmModel', 'vlm_model'], emptyLabel: '(未配置)' },
  { field: 'vlmBaseUrl', label: 'VLM API 地址', category: 'endpoint', keys: ['vlmBaseUrl', 'vlm_base_url'], emptyLabel: '(未配置)' },
  { field: 'userAgent', label: 'User-Agent', category: 'other', keys: ['userAgent', 'user_agent'], emptyLabel: '(默认)' },
  { field: 'sub2apiEnabled', label: 'Sub2api 代理转换', category: 'other', keys: ['sub2apiEnabled', 'sub2api_enabled'] },
  { field: 'sub2apiMultiplier', label: 'Sub2api 倍率', category: 'other', keys: ['sub2apiMultiplier', 'sub2api_multiplier'], emptyLabel: '(默认)' },
  { field: 'modelRoutes', label: '模型路由', category: 'other', keys: ['modelRoutes', 'model_routes'], emptyLabel: '(未配置)' },
  { field: 'apiKey', label: '认证凭据 (API Key)', category: 'auth', keys: ['apiKey', 'api_key'], sensitive: true },
  { field: 'authContents', label: '认证文件', category: 'auth', keys: ['authContents', 'auth_contents'], sensitive: true, emptyLabel: '(未配置)' },
  { field: 'configContents', label: '独立 config.toml', category: 'other', keys: ['configContents', 'config_contents'], sensitive: true, emptyLabel: '(未配置)' },
];

/**
 * Compares the profile fields that can affect generated live files or provider requests.
 * Credentials and raw config/auth bodies are compared by their real value but rendered masked.
 */
export function computeProviderSwitchPreflight(
  source: any,
  target: any,
): ProviderSwitchPreflight {
  const sourceId = source?.id || '';
  const sourceName = source?.name || sourceId || '未知供应商';
  const targetId = target?.id || '';
  const targetName = target?.name || targetId || '目标供应商';

  if (!source || !target || sourceId === targetId) {
    return {
      sourceId,
      sourceName,
      targetId,
      targetName,
      diffs: [],
      hasChanges: false,
      requiresConfirmation: false,
      summary: '供应商配置未发生变更',
    };
  }

  const diffs: ProfileDiffItem[] = [];
  for (const definition of DIFF_DEFINITIONS) {
    const sourceValue = profileValue(source, ...definition.keys);
    const targetValue = profileValue(target, ...definition.keys);
    if (comparableValue(sourceValue) === comparableValue(targetValue)) continue;
    diffs.push({
      field: definition.field,
      label: definition.label,
      oldValue: displayValue(sourceValue, Boolean(definition.sensitive), definition.emptyLabel || '(未配置)'),
      newValue: displayValue(targetValue, Boolean(definition.sensitive), definition.emptyLabel || '(未配置)'),
      category: definition.category,
      isSensitive: definition.sensitive,
    });
  }

  const hasChanges = diffs.length > 0;
  const requiresConfirmation = diffs.some(
    (diff) => diff.category === 'endpoint' || diff.category === 'protocol' || diff.category === 'auth',
  );

  const summary = hasChanges
    ? `准备从 "${sourceName}" 切换到 "${targetName}"，共有 ${diffs.length} 项配置发生改变。`
    : `从 "${sourceName}" 切换到 "${targetName}"，配置保持一致。`;

  return {
    sourceId,
    sourceName,
    targetId,
    targetName,
    diffs,
    hasChanges,
    requiresConfirmation,
    summary,
  };
}
