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
  previousActiveRelayId: string;
  previousSettingsJson: string;
  targetActiveRelayId: string;
  sourceName: string;
  targetName: string;
}

export function maskCredential(value: string): string {
  if (!value) return '(未配置)';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`;
}

/**
 * Compares two provider profiles and generates structured preflight diffs
 * so the user can visually review what configuration will change before switching.
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

  // 1. Base URL
  const srcBase = source.baseUrl || '';
  const tgtBase = target.baseUrl || '';
  if (srcBase !== tgtBase) {
    diffs.push({
      field: 'baseUrl',
      label: 'API 地址 (Base URL)',
      oldValue: srcBase || '(默认)',
      newValue: tgtBase || '(默认)',
      category: 'endpoint',
    });
  }

  // 2. Default Model
  const srcModel = source.model || '';
  const tgtModel = target.model || '';
  if (srcModel !== tgtModel) {
    diffs.push({
      field: 'model',
      label: '默认模型',
      oldValue: srcModel || '(默认)',
      newValue: tgtModel || '(默认)',
      category: 'model',
    });
  }

  // 3. Protocol
  const srcProtocol = source.protocol || 'responses';
  const tgtProtocol = target.protocol || 'responses';
  if (srcProtocol !== tgtProtocol) {
    diffs.push({
      field: 'protocol',
      label: '接口协议',
      oldValue: srcProtocol,
      newValue: tgtProtocol,
      category: 'protocol',
    });
  }

  // 4. Relay Mode
  const srcMode = source.relayMode || 'pureApi';
  const tgtMode = target.relayMode || 'pureApi';
  if (srcMode !== tgtMode) {
    diffs.push({
      field: 'relayMode',
      label: '转发模式',
      oldValue: srcMode,
      newValue: tgtMode,
      category: 'other',
    });
  }

  // 5. Auth / API Key (masked)
  const srcKey = source.apiKey || '';
  const tgtKey = target.apiKey || '';
  if (srcKey !== tgtKey) {
    diffs.push({
      field: 'apiKey',
      label: '认证凭据 (API Key)',
      oldValue: maskCredential(srcKey),
      newValue: maskCredential(tgtKey),
      category: 'auth',
      isSensitive: true,
    });
  }

  // 6. Upstream Base URL
  const srcUpstream = source.upstreamBaseUrl || '';
  const tgtUpstream = target.upstreamBaseUrl || '';
  if (srcUpstream !== tgtUpstream) {
    diffs.push({
      field: 'upstreamBaseUrl',
      label: '上游基准地址',
      oldValue: srcUpstream || '(无)',
      newValue: tgtUpstream || '(无)',
      category: 'endpoint',
    });
  }

  // 7. Sub2api
  const srcSub2api = Boolean(source.sub2apiEnabled);
  const tgtSub2api = Boolean(target.sub2apiEnabled);
  if (srcSub2api !== tgtSub2api) {
    diffs.push({
      field: 'sub2apiEnabled',
      label: 'Sub2api 代理转换',
      oldValue: srcSub2api ? '已启用' : '已禁用',
      newValue: tgtSub2api ? '已启用' : '已禁用',
      category: 'other',
    });
  }

  const hasChanges = diffs.length > 0;
  const requiresConfirmation = diffs.some(
    (d) => d.category === 'endpoint' || d.category === 'protocol' || d.category === 'auth',
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

/**
 * Creates a rollback snapshot token capturing the current active settings before a switch.
 */
export function createSwitchRollbackSnapshot(
  currentSettings: any,
  targetRelayId: string,
): SwitchRollbackSnapshot {
  const previousActiveRelayId = currentSettings?.activeRelayId || '';
  const profiles = currentSettings?.relayProfiles || [];
  const source = profiles.find((p: any) => p.id === previousActiveRelayId);
  const target = profiles.find((p: any) => p.id === targetRelayId);

  return {
    token: `rb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    previousActiveRelayId,
    previousSettingsJson: JSON.stringify(currentSettings),
    targetActiveRelayId: targetRelayId,
    sourceName: source?.name || previousActiveRelayId || '前一供应商',
    targetName: target?.name || targetRelayId || '当前供应商',
  };
}

/**
 * Restores the previous settings from a snapshot.
 */
export function restoreSwitchRollback(snapshot: SwitchRollbackSnapshot): any {
  if (!snapshot?.previousSettingsJson) return null;
  try {
    return JSON.parse(snapshot.previousSettingsJson);
  } catch {
    return null;
  }
}
