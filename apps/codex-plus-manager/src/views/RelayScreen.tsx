import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileCode2,
  GripVertical,
  Info,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TestTube,
  Trash2,
} from "lucide-react";
import { ProviderPresetSelector } from "@/components/ProviderPresetSelector";
import type { PresetPatch } from "@/components/ProviderPresetSelector";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UiBadge } from "@/components/ui/badge";
import { DEFAULT_AUTO_COMPACT_PERCENT, normalizeAutoCompactEditing, normalizeAutoCompactPercent } from "../auto-compact";
import {
  clearModelMetadataForSlug,
  parseModelMetadataDocument,
  parseModelMetadataMap,
  remapModelMetadataSlugs,
  replaceModelMetadataForSlug,
  retainModelMetadataForSlugs,
  serializeModelMetadataDocument,
  synchronizeModelMetadataDocumentLimitsPreview,
  type ImportedModelMetadata,
} from "../model-metadata";
import { modelRouteSaveRequiresRestart, normalizeRelayModelRoutes, type RelayModelRoute } from "../model-routes";
import {
  mergeModelWindowRows,
  modelWindowRowsFromProfile,
  modelWindowRowsValidationError,
  serializeModelWindowRows,
  type ModelWindowRow,
  type ModelWindowRowsValidationIssue,
} from "../model-windows";
import { codexGoalsFeatureState, setCodexGoalsFeatureInConfig } from "../goals-config";
import { relayAuthForLiveDraft } from "../relay-live-files";
import { getActionableEnvConflicts, type EnvConflictProfile } from "../env-conflicts-guard";
import { runConcurrentSpeedMatrix, type SpeedMatrixSummary } from "../speed-matrix";
import type { ProviderSwitchPreflight, SwitchRollbackSnapshot } from "../provider-switch-preflight";
import { vlmTestTranslation } from "../vlm-test-translation";
import { t, tf } from "@/i18n";
import {
  AppSelect,
  CardHead,
  Field,
  Metric,
  Panel,
  Toolbar,
  ToggleVisual,
} from "./ScreenPrimitives";
import type {
  BackendSettings,
  CcsProvidersResult,
  CodexContextEntries,
  EnvConflictsResult,
  ExtractRelayCommonConfigResult,
  ProviderDoctorResult,
  RelayAggregateConfig,
  RelayAggregateStrategy,
  RelayFilesResult,
  RelayProfile,
  RelayProfileTestResult,
  Sub2ApiBillingResult,
} from "../App";

export type RelayScreenActions = {
  showMessage: (title: string, message: string, status?: string) => Promise<void>;
  saveSettingsValue: (settings: BackendSettings, silent?: boolean) => Promise<BackendSettings | null>;
  refreshRelayFiles: () => Promise<RelayFilesResult | null>;
  refreshEnvConflicts: (silent?: boolean) => Promise<EnvConflictsResult | null>;
  removeEnvConflicts: (names: string[]) => Promise<void>;
  restoreEnvConflicts: () => Promise<void>;
  refreshCcsProviders: (silent?: boolean) => Promise<CcsProvidersResult | null>;
  importCcsProviders: () => Promise<void>;
  testRelayProfile: (profile: RelayProfile) => Promise<void>;
  diagnoseRelayProfile: (profile: RelayProfile) => Promise<ProviderDoctorResult | null>;
  restart: (syncActiveRelay?: boolean) => Promise<boolean>;
  fetchRelayProfileModels: (profile: RelayProfile) => Promise<string[] | null>;
  fetchSub2ApiBilling: (profile: RelayProfile) => Promise<Sub2ApiBillingResult | null>;
  extractRelayCommonConfig: (configContents: string) => Promise<ExtractRelayCommonConfigResult | null>;
  switchRelayProfile: (settings: BackendSettings, previousActiveRelayId?: string, skipPreflight?: boolean) => Promise<void>;
  undoProviderSwitch?: () => Promise<void>;
  relaySwitching: boolean;
  confirmPendingSwitch: () => Promise<void>;
  dismissPendingSwitch: () => void;
  dismissSwitchRollback: () => void;
};

export type RelayScreenHelpers = {
  normalizeSettings: (settings: BackendSettings) => BackendSettings;
  activeRelayProfile: (settings: BackendSettings) => RelayProfile;
  createRelayProfile: (settings: BackendSettings) => RelayProfile;
  createAggregateRelayProfile: (settings: BackendSettings) => RelayProfile;
  normalizeAggregateConfig: (
    aggregate: RelayAggregateConfig | null | undefined,
    candidates: RelayProfile[],
  ) => RelayAggregateConfig;
  aggregateMemberCandidates: (settings: BackendSettings, aggregateId: string) => RelayProfile[];
  ccsProviderSummary: (result: CcsProvidersResult | null) => string;
  reorderRelayProfiles: (settings: BackendSettings, sourceId: string, targetId: string) => BackendSettings;
  syncLegacyRelayFields: (settings: BackendSettings) => BackendSettings;
  duplicateRelayProfile: (settings: BackendSettings, id: string) => BackendSettings;
  removeRelayProfile: (settings: BackendSettings, id: string) => BackendSettings;
  isAggregateRelayProfile: (profile: Pick<RelayProfile, "relayMode" | "aggregate">) => boolean;
  relayModeLabel: (mode: RelayProfile["relayMode"]) => string;
  relayProtocolLabel: (protocol: RelayProfile["protocol"]) => string;
  relayProfileConfigBrief: (profile: RelayProfile) => string;
  relaySub2ApiMultiplierLabel: (profile: RelayProfile) => string;
  relayProfileUsesLiveFiles: (profile: RelayProfile) => boolean;
  addRelayProfile: (settings: BackendSettings, profile: RelayProfile) => BackendSettings;
  updateRelayProfile: (settings: BackendSettings, id: string, patch: Partial<RelayProfile>) => BackendSettings;
  normalizeAggregateRelayProfile: (profile: RelayProfile, settings: BackendSettings | null) => RelayProfile;
  deriveRelayProfileFromFiles: (profile: RelayProfile) => RelayProfile;
  applyRelayProfilePatchToFiles: (
    profile: RelayProfile,
    patch: Partial<RelayProfile>,
    options?: { allowGenerateFiles?: boolean },
  ) => RelayProfile;
  relaySettingsWithDraft: (
    settings: BackendSettings,
    profileId: string,
    draft: RelayProfile,
    isNew: boolean,
  ) => BackendSettings;
  relaySessionProvider: (profile: Pick<RelayProfile, "configContents" | "sessionProvider">) => RelayProfile["sessionProvider"];
  relaySessionProviderValidation: (profile: RelayProfile) => string | null;
  aggregateRelayProfileValidation: (profile: RelayProfile) => string | null;
  relayModelRoutesSettingsValidation: (settings: BackendSettings) => string | null;
  relaySettingsValidation: (settings: BackendSettings) => string | null;
  codexBaseUrlFromConfig: (contents: string) => string;
  relayProfileEditorStatus: (profile: RelayProfile, form: BackendSettings, isNew: boolean) => string;
  formatMultiplierValue: (value: number) => string;
  normalizeRelaySessionProvider: (value: string | undefined) => RelayProfile["sessionProvider"];
  clampAggregateWeight: (value: number) => number;
  aggregateStrategyOptions: Array<{ value: RelayAggregateStrategy; label: string; description: string }>;
  aggregateStrategyLabel: (strategy: RelayAggregateStrategy) => string;
  aggregateStrategyHelp: (strategy: RelayAggregateStrategy) => string;
  relayProfileModeHelp: (profile: RelayProfile) => string;
  defaultRelayTestModel: string;
  effectiveRelayConfigPreview: (profile: RelayProfile, settings: BackendSettings, contextProfile?: RelayProfile) => string;
  contextEntriesForProfile: (settings: BackendSettings, profile: RelayProfile) => CodexContextEntries;
  stripCommonConfigTextFallback: (configContents: string, commonConfig: string) => string;
  relayCombinedCommonConfig: (settings: BackendSettings) => string;
  stripContextEntriesFromConfig: (configContents: string, entries: CodexContextEntries) => string;
  splitContextConfigText: (contents: string) => { common: string; context: string };
  joinTomlSectionsRootFirst: (sections: string[]) => string;
};

export type RelayScreenProps = {
  relayFiles: RelayFilesResult | null;
  envConflicts: EnvConflictsResult | null;
  envConflictBackupPath: string | null;
  ccsProviders: CcsProvidersResult | null;
  form: BackendSettings;
  pendingSwitchPreflight: {
    preflight: ProviderSwitchPreflight;
    nextSettings: BackendSettings;
    previousActiveRelayId: string;
  } | null;
  lastSwitchRollback: SwitchRollbackSnapshot | null;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
};

function modelWindowRowsValidationMessage(issue: ModelWindowRowsValidationIssue | null): string | null {
  if (!issue) return null;
  if (issue.code === "duplicateModel") return tf("模型名称重复：{0}", [issue.model]);
  if (issue.code === "invalidWindow") {
    return tf("模型 {0} 的上下文窗口无效；请输入正整数，或使用 K/M 整数后缀。", [issue.model]);
  }
  return tf("模型 {0} 的自动压缩百分比无效；请输入 0 到 100 之间、最多 6 位小数的十进制数。", [issue.model]);
}

function providerInitial(name: string): string {
  const trimmed = (name || t("供应商")).trim();
  return Array.from(trimmed)[0]?.toUpperCase() || t("供");
}

function isSuccessStatus(status?: string): boolean {
  return status === "ok" || status === "accepted";
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const RelayScreen = memo(function RelayScreen({
  relayFiles,
  envConflicts,
  envConflictBackupPath,
  ccsProviders,
  form,
  pendingSwitchPreflight,
  lastSwitchRollback,
  actions,
  helpers,
}: RelayScreenProps) {
  const {
    activeRelayProfile,
    aggregateMemberCandidates,
    ccsProviderSummary,
    createAggregateRelayProfile,
    createRelayProfile,
    normalizeAggregateConfig,
    normalizeSettings,
  } = helpers;
  const normalized = normalizeSettings(form);
  const [detailProfileId, setDetailProfileId] = useState<string | null>(null);
  const [newProfileDraft, setNewProfileDraft] = useState<RelayProfile | null>(null);
  const [thirdPartyImportOpen, setThirdPartyImportOpen] = useState(false);
  const detailProfile = newProfileDraft || (detailProfileId
    ? normalized.relayProfiles.find((profile) => profile.id === detailProfileId) || null
    : null);
  const isNewProfile = !!newProfileDraft;

  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedTestProgress, setSpeedTestProgress] = useState<{ completed: number; total: number } | null>(null);
  const [speedMatrixSummary, setSpeedMatrixSummary] = useState<SpeedMatrixSummary | null>(null);

  const runSpeedTest = async () => {
    if (speedTesting) return;
    setSpeedTesting(true);
    setSpeedTestProgress({ completed: 0, total: normalized.relayProfiles.length });

    try {
      const summary = await runConcurrentSpeedMatrix(
        normalized.relayProfiles,
        async (candidate) => {
          const profile = normalized.relayProfiles.find((p) => p.id === candidate.id);
          if (!profile) throw new Error("Profile not found");
          const start = performance.now();
          const res = await invoke<RelayProfileTestResult>("test_relay_profile", { profile });
          const latencyMs = Math.round(performance.now() - start);
          return {
            httpStatus: res.httpStatus,
            endpoint: res.endpoint,
            errorMessage: res.httpStatus >= 400 ? res.responsePreview : undefined,
            latencyMs,
            ttftMs: res.ttftMs || Math.round(latencyMs * 0.7),
          };
        },
        {
          concurrency: 3,
          activeProfileId: normalized.activeRelayId,
          onProgress: (completed, total) => {
            setSpeedTestProgress({ completed, total });
          },
        }
      );
      setSpeedMatrixSummary(summary);
    } catch (err: unknown) {
      void actions.showMessage(t("测速失败"), stringifyError(err), "failed");
    } finally {
      setSpeedTesting(false);
      setSpeedTestProgress(null);
    }
  };

  const applyRecommendedProfile = (targetProfileId: string) => {
    const next = { ...normalized, activeRelayId: targetProfileId };
    void actions.switchRelayProfile(next, normalized.activeRelayId);
  };
  const saveRelaySettings = async (next: BackendSettings) => {
    return actions.saveSettingsValue(next, true);
  };
  const createNewAggregateProfile = () => {
    const draft = createAggregateRelayProfile(normalized);
    setDetailProfileId(null);
    setNewProfileDraft(draft);
    if (!normalizeAggregateConfig(draft.aggregate, aggregateMemberCandidates(normalized, draft.id)).members.length) {
      void actions.showMessage(
        t("添加聚合供应商"),
        t("已打开聚合供应商详情；请先添加或完善至少 1 个普通 API 供应商的 Base URL / Key，再勾选为成员。"),
        "failed",
      );
    }
  };
  const editRelayProfile = async (profileId: string) => {
    setNewProfileDraft(null);
    setDetailProfileId(
      normalized.relayProfiles.some((item) => item.id === profileId) ? profileId : null,
    );
  };
  useEffect(() => {
    if (!newProfileDraft && detailProfileId && !normalized.relayProfiles.some((profile) => profile.id === detailProfileId)) {
      setDetailProfileId(null);
    }
  }, [detailProfileId, newProfileDraft, normalized.relayProfiles]);
  useEffect(() => {
    if (!newProfileDraft && detailProfileId === normalized.activeRelayId) {
      void actions.refreshRelayFiles();
    }
  }, [detailProfileId, newProfileDraft, normalized.activeRelayId]);
  const openThirdPartyImport = () => {
    setThirdPartyImportOpen((open) => !open);
    if (!ccsProviders) void actions.refreshCcsProviders(true);
  };

  const overlays = (
    <RelayScreenOverlays
      lastSwitchRollback={lastSwitchRollback}
      pendingSwitchPreflight={pendingSwitchPreflight}
      actions={actions}
    />
  );

  if (detailProfile) {
    return (
      <>
        <RelayProfileDetail
          profile={detailProfile}
          relayFiles={!isNewProfile && detailProfile.id === normalized.activeRelayId ? relayFiles : null}
          form={normalized}
          isNew={isNewProfile}
          onBack={() => {
            setNewProfileDraft(null);
            setDetailProfileId(null);
          }}
          onFormChange={saveRelaySettings}
          onSaved={() => {
            setNewProfileDraft(null);
            setDetailProfileId(null);
          }}
          actions={actions}
          helpers={helpers}
        />
        {overlays}
      </>
    );
  }

  return (
    <>
      <Panel>
        <CardHead title={t("供应商列表")} detail={tf("{0} 个供应商配置；可拖动排序，点编辑进入详情", [normalized.relayProfiles.length])} />
        <CardContent>
          <EnvConflictNotice
            activeProfile={activeRelayProfile(normalized)}
            backupPath={envConflictBackupPath}
            envConflicts={envConflicts}
            actions={actions}
            helpers={helpers}
          />
          <label className="switch-row relay-master-switch">
            <input
              checked={normalized.relayProfilesEnabled}
              onChange={(event) => {
                const next = { ...normalized, relayProfilesEnabled: event.currentTarget.checked };
                void saveRelaySettings(next);
              }}
              type="checkbox"
            />
            <span>
              <strong>{t("启用供应商配置切换")}</strong>
              <small>{t("关闭后本工具不会在手动切换时写入 Codex 的 config.toml / auth.json；启动 Codex 时始终不会自动改这些文件。")}</small>
            </span>
            <ToggleVisual />
          </label>
          <div className="relay-add-row">
            <Button
              variant="secondary"
              onClick={() => {
                setNewProfileDraft(createRelayProfile(normalized));
                setDetailProfileId(null);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("添加供应商")}
            </Button>
            <Button
              variant="secondary"
              onClick={createNewAggregateProfile}
            >
              <Plus className="h-4 w-4" />
              {t("添加聚合供应商")}
            </Button>
            <div className="third-party-import">
              <Button
                onClick={openThirdPartyImport}
                variant="secondary"
              >
                <Download className="h-4 w-4" />
                {t("从第三方导入")}
              </Button>
              {thirdPartyImportOpen ? (
                <div className="third-party-import-menu">
                  <button
                    disabled={!ccsProviders?.providers.length}
                    onClick={() => {
                      setThirdPartyImportOpen(false);
                      void actions.importCcsProviders();
                    }}
                    type="button"
                  >
                    <strong>ccswitch</strong>
                    <span>{ccsProviderSummary(ccsProviders)}</span>
                  </button>
                  <button
                    onClick={() => void actions.refreshCcsProviders()}
                    type="button"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("刷新列表")}
                  </button>
                </div>
              ) : null}
            </div>
            <Button
              variant="outline"
              disabled={speedTesting || !normalized.relayProfiles.length}
              onClick={() => void runSpeedTest()}
            >
              {speedTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {speedTesting && speedTestProgress
                ? tf("测速中 ({0}/{1})…", [speedTestProgress.completed, speedTestProgress.total])
                : t("并发测速矩阵")}
            </Button>
          </div>
          {speedMatrixSummary ? (
            <div className="mb-4 p-4 rounded-lg border border-border/80 bg-card/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{t("多供应商并发测速矩阵")}</span>
                  <UiBadge variant="outline" className="text-xs">
                    {tf("已测 {0} / 成功 {1} / 失败 {2}", [
                      speedMatrixSummary.testedCount,
                      speedMatrixSummary.successCount,
                      speedMatrixSummary.failedCount,
                    ])}
                  </UiBadge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSpeedMatrixSummary(null)}>
                  {t("关闭")}
                </Button>
              </div>

              {speedMatrixSummary.recommendation ? (
                <div className="p-2.5 rounded bg-primary/10 border border-primary/20 text-xs flex items-center justify-between gap-3">
                  <div className="text-foreground leading-relaxed">
                    <strong>{t("决策建议：")}</strong>
                    {speedMatrixSummary.recommendation}
                  </div>
                  {speedMatrixSummary.fastestProfileId &&
                  speedMatrixSummary.fastestProfileId !== normalized.activeRelayId ? (
                    <Button
                      size="sm"
                      onClick={() => applyRecommendedProfile(speedMatrixSummary.fastestProfileId!)}
                      className="shrink-0 font-medium"
                    >
                      {tf("一键切换为主力 (「{0}」)", [speedMatrixSummary.fastestProfileName || ""])}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {speedMatrixSummary.results.map((item, idx) => (
                  <div
                    key={item.profileId}
                    className={`p-2.5 rounded border text-xs transition-colors flex flex-col justify-between ${
                      item.profileId === speedMatrixSummary.fastestProfileId
                        ? "border-primary/50 bg-primary/5"
                        : item.status !== "success"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border/60 bg-background"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold truncate text-foreground" title={item.profileName}>
                          #{idx + 1} {item.profileName}
                        </span>
                        <UiBadge
                          variant={item.status === "success" ? "secondary" : "destructive"}
                          className="font-mono text-[10px] px-1.5 py-0"
                        >
                          {item.status === "success" ? `${item.latencyMs}ms` : item.status === "timeout" ? t("超时") : t("失败")}
                        </UiBadge>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate mb-1" title={item.endpoint}>
                        {item.endpoint || "-"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {item.score > 0 ? tf("综合评分：{0} 分", [item.score]) : item.errorMessage || t("无法连接")}
                      </span>
                      {item.profileId === normalized.activeRelayId ? (
                        <UiBadge variant="outline" className="text-[10px]">
                          {t("当前主力")}
                        </UiBadge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2"
                          disabled={actions.relaySwitching || item.status !== "success"}
                          onClick={() => applyRecommendedProfile(item.profileId)}
                        >
                          {t("设为主力")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <RelayProfileList
            form={normalized}
            onEdit={(profileId) => void editRelayProfile(profileId)}
            onFormChange={saveRelaySettings}
            disabled={!normalized.relayProfilesEnabled || actions.relaySwitching}
            actions={actions}
            helpers={helpers}
          />
        </CardContent>
      </Panel>
      {overlays}
    </>
  );
});

function RelayScreenOverlays({
  lastSwitchRollback,
  pendingSwitchPreflight,
  actions,
}: {
  lastSwitchRollback: SwitchRollbackSnapshot | null;
  pendingSwitchPreflight: RelayScreenProps["pendingSwitchPreflight"];
  actions: RelayScreenActions;
}) {
  return (
    <>
      {lastSwitchRollback ? (
        <div
          className="provider-rollback-banner"
          style={{
            margin: "12px 24px 0 24px",
            padding: "10px 16px",
            background: "var(--color-bg-accent, rgba(40, 167, 69, 0.08))",
            border: "1px solid var(--color-border-accent, rgba(40, 167, 69, 0.35))",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <RotateCcw className="h-4 w-4" />
            <span>
              {tf("已切换至供应商「{0}」。如需恢复前一配置（{1}），可随时一键撤销。", [
                lastSwitchRollback.targetName,
                lastSwitchRollback.sourceName,
              ])}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="sm" onClick={() => void actions.undoProviderSwitch?.()}>
              <RotateCcw className="h-4 w-4" />
              {t("一键撤销")}
            </Button>
            <Button size="sm" variant="ghost" onClick={actions.dismissSwitchRollback}>
              {t("关闭")}
            </Button>
          </div>
        </div>
      ) : null}
      {pendingSwitchPreflight ? (
        <ProviderSwitchPreflightDialog
          preflight={pendingSwitchPreflight.preflight}
          onConfirm={() => void actions.confirmPendingSwitch()}
          onCancel={actions.dismissPendingSwitch}
        />
      ) : null}
    </>
  );
}

function EnvConflictNotice({
  activeProfile,
  backupPath,
  envConflicts,
  actions,
  helpers,
}: {
  activeProfile: EnvConflictProfile;
  backupPath: string | null;
  envConflicts: EnvConflictsResult | null;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
}) {
  const conflicts = getActionableEnvConflicts(activeProfile, envConflicts?.conflicts ?? []);
  if (!conflicts.length && !backupPath) return null;
  const names = Array.from(new Set(conflicts.map((conflict) => conflict.name))).sort();
  return (
    <div className="env-conflict-notice">
      <div className="env-conflict-icon">
        <ShieldAlert className="h-4 w-4" />
      </div>
      <div className="env-conflict-body">
        <strong>{conflicts.length ? t("检测到与当前供应商不一致的环境变量") : t("环境变量清理已完成")}</strong>
        <p>
          {conflicts.length
            ? t("仅值级不一致的核心变量需要处理；已与当前供应商一致的变量不会提示或删除。")
            : t("删除前的本地备份仍可用于恢复，不会在界面展示原始凭证。")}
        </p>
        {conflicts.length ? (
          <div className="env-conflict-tags">
            {conflicts.map((conflict) => (
              <span key={`${conflict.source}-${conflict.name}`}>
                {conflict.name}
                <small>{envConflictSourceLabel(conflict.source)}</small>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="env-conflict-actions">
        {conflicts.length ? (
          <Button onClick={() => void actions.removeEnvConflicts(names)} size="sm">
            <Trash2 className="h-4 w-4" />
            {t("删除")}
          </Button>
        ) : null}
        {backupPath ? (
          <Button onClick={() => void actions.restoreEnvConflicts()} size="sm" variant="secondary">
            <RotateCcw className="h-4 w-4" />
            {t("恢复")}
          </Button>
        ) : null}
        <Button onClick={() => void actions.refreshEnvConflicts(false)} size="sm" variant="secondary">
          <RefreshCw className="h-4 w-4" />
          {t("检测")}
        </Button>
      </div>
    </div>
  );
}

function envConflictSourceLabel(source: string): string {
  if (source === "process") return t("当前进程");
  if (source === "user") return t("用户环境");
  return source || t("环境变量");
}

function RelayProfileList({
  form,
  onFormChange,
  onEdit,
  disabled = false,
  actions,
  helpers,
}: {
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
  onEdit: (id: string) => void;
  disabled?: boolean;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
}) {
  const { reorderRelayProfiles } = helpers;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = reorderRelayProfiles(form, String(active.id), String(over.id));
    if (next !== form) onFormChange(next);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={form.relayProfiles.map((profile) => profile.id)} strategy={verticalListSortingStrategy}>
        <div className="relay-profile-list">
          {form.relayProfiles.map((profile, index) => (
            <SortableRelayProfileCard
              actions={actions}
              helpers={helpers}
              form={form}
              index={index}
              key={profile.id}
              onEdit={onEdit}
              onFormChange={onFormChange}
              disabled={disabled}
              profile={profile}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRelayProfileCard({
  form,
  profile,
  index,
  onFormChange,
  onEdit,
  disabled = false,
  actions,
  helpers,
}: {
  form: BackendSettings;
  profile: RelayProfile;
  index: number;
  onFormChange: (value: BackendSettings) => void;
  onEdit: (id: string) => void;
  disabled?: boolean;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
}) {
  const {
    duplicateRelayProfile,
    isAggregateRelayProfile,
    relayModeLabel,
    relayProfileConfigBrief,
    relayProtocolLabel,
    relaySub2ApiMultiplierLabel,
    removeRelayProfile,
    syncLegacyRelayFields,
  } = helpers;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: profile.id });
  const active = profile.id === form.activeRelayId;
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={`relay-profile-card ${active ? "active" : ""} ${isDragging ? "dragging" : ""}`}
      data-relay-profile-id={profile.id}
      key={profile.id}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEdit(profile.id);
      }}
      ref={setNodeRef}
      style={style}
      tabIndex={0}
    >
      <button
        aria-label={t("拖动排序")}
        className="relay-drag"
        title={t("拖动排序")}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="relay-index" title={profile.name || t("未命名供应商")}>
        {providerInitial(profile.name)}
      </span>
      <span className="relay-summary">
        <strong>{profile.name || t("未命名供应商")}</strong>
        <small>{relayModeLabel(profile.relayMode)} · {relayProtocolLabel(profile.protocol)} · {relayProfileConfigBrief(profile)}</small>
        {profile.sub2apiEnabled ? (
          <small className="relay-sub2api-rate">{relaySub2ApiMultiplierLabel(profile)}</small>
        ) : null}
      </span>
      <span className="relay-card-actions">
        <Button
          className={`relay-use-button ${active ? "active" : ""}`}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (disabled) return;
            const previousActiveRelayId = form.activeRelayId;
            const next = syncLegacyRelayFields({ ...form, activeRelayId: profile.id });
            void actions.switchRelayProfile(next, previousActiveRelayId);
          }}
          size="sm"
          title={disabled ? t("供应商切换不可用") : active ? t("当前正在使用") : t("设为当前")}
          variant={active ? "secondary" : "outline"}
        >
          <CheckCircle2 className="h-4 w-4" />
          {active ? t("使用中") : t("使用")}
        </Button>
        <span className="relay-card-extra">
          <Button
            disabled={isAggregateRelayProfile(profile)}
            onClick={(event) => {
              event.stopPropagation();
              if (isAggregateRelayProfile(profile)) return;
              void actions.testRelayProfile(profile);
            }}
            size="icon"
            title={isAggregateRelayProfile(profile) ? t("聚合供应商会在真实对话中轮转成员，请测试成员供应商") : t("发送 hi 测试")}
            variant="ghost"
          >
            <TestTube className="h-4 w-4" />
          </Button>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onEdit(profile.id);
            }}
            size="icon"
            title={t("编辑")}
            variant="ghost"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onFormChange(duplicateRelayProfile(form, profile.id));
            }}
            size="icon"
            title={t("复制")}
            variant="ghost"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            disabled={form.relayProfiles.length <= 1}
            onClick={(event) => {
              event.stopPropagation();
              onFormChange(removeRelayProfile(form, profile.id));
            }}
            size="icon"
            title={t("删除供应商")}
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </span>
      </span>
    </div>
  );
}

function RelayProfileDetail({
  profile,
  relayFiles,
  form,
  isNew = false,
  onBack,
  onFormChange,
  onSaved,
  actions,
  helpers,
}: {
  profile: RelayProfile;
  relayFiles: RelayFilesResult | null;
  form: BackendSettings;
  isNew?: boolean;
  onBack: () => void;
  onFormChange: (value: BackendSettings) => Promise<BackendSettings | null>;
  onSaved?: () => void;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
}) {
  const {
    addRelayProfile,
    applyRelayProfilePatchToFiles,
    codexBaseUrlFromConfig,
    deriveRelayProfileFromFiles,
    isAggregateRelayProfile,
    normalizeAggregateRelayProfile,
    normalizeSettings,
    relayModelRoutesSettingsValidation,
    relayProfileEditorStatus,
    relayProfileUsesLiveFiles,
    relaySessionProviderValidation,
    relaySettingsValidation,
    relaySettingsWithDraft,
    syncLegacyRelayFields,
    updateRelayProfile,
  } = helpers;
  const [draft, setDraft] = useState<RelayProfile>(profile);
  const [modelWindowRows, setModelWindowRows] = useState<ModelWindowRow[]>(
    modelWindowRowsFromProfile(profile.modelList, profile.modelWindows || "", profile.modelVlm, profile.modelAutoCompact),
  );
  const [doctorResult, setDoctorResult] = useState<ProviderDoctorResult | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const isActive = !isNew && profile.id === form.activeRelayId;
  const profileUsesLiveFiles = relayProfileUsesLiveFiles(profile);
  useEffect(() => {
    const useLiveFiles = isActive && profileUsesLiveFiles && relayFiles;
    const liveDraft = isAggregateRelayProfile(profile)
      ? normalizeAggregateRelayProfile(profile, form)
      : deriveRelayProfileFromFiles(
          useLiveFiles
            ? {
              ...profile,
              configContents: relayFiles.configContents,
              authContents: relayAuthForLiveDraft(profile, relayFiles.authContents),
            }
            : profile,
        );
    const storedApiKey = useLiveFiles ? profile.apiKey.trim() : "";
    const nextDraft = useLiveFiles && !isAggregateRelayProfile(liveDraft)
      ? applyRelayProfilePatchToFiles(liveDraft, { apiKey: storedApiKey })
      : liveDraft;
    setDraft(nextDraft);
    setModelWindowRows(modelWindowRowsFromProfile(nextDraft.modelList, nextDraft.modelWindows || "", nextDraft.modelVlm, nextDraft.modelAutoCompact));
  }, [profile.id, profile.modelList, profile.modelWindows, profile.modelAutoCompact, profile.modelMetadata, profile.modelVlm, profileUsesLiveFiles, isActive, isNew, relayFiles?.configContents, relayFiles?.authContents]);
  const validationSettings = relaySettingsWithDraft(form, profile.id, draft, isNew);
  const validationError = relaySessionProviderValidation(draft)
    ?? (isAggregateRelayProfile(draft)
      ? aggregateRelayProfileValidation(draft)
      : relayModelRoutesSettingsValidation(validationSettings));
  const modelRowsError = modelWindowRowsValidationMessage(modelWindowRowsValidationError(modelWindowRows));
  const draftWithModelRows = () => {
    const serializedRows = serializeModelWindowRows(modelWindowRows);
    const validSlugs = serializedRows.modelList.split("\n").map((slug) => slug.trim()).filter(Boolean);
    return {
      ...draft,
      modelList: serializedRows.modelList,
      modelWindows: serializedRows.modelWindows,
      modelAutoCompact: serializedRows.modelAutoCompact,
      modelMetadata: retainModelMetadataForSlugs(draft.modelMetadata, validSlugs),
      modelVlm: serializedRows.modelVlm,
    };
  };
  const currentModelState = draftWithModelRows();
  const persistedModelState = {
    modelList: profile.modelList || "",
    modelWindows: profile.modelWindows || "",
    modelAutoCompact: profile.modelAutoCompact || "",
    modelMetadata: profile.modelMetadata || "",
    modelVlm: profile.modelVlm || "",
  };
  const hasUnsavedModelChanges = JSON.stringify({
    modelList: currentModelState.modelList,
    modelWindows: currentModelState.modelWindows,
    modelAutoCompact: currentModelState.modelAutoCompact,
    modelMetadata: currentModelState.modelMetadata,
    modelVlm: currentModelState.modelVlm,
  }) !== JSON.stringify(persistedModelState);
  const saveDraft = async () => {
    if (savingDraft || validationError || modelRowsError) return;
    setSavingDraft(true);
    try {
      const draftWithWindows = draftWithModelRows();
      const normalizedDraft = isAggregateRelayProfile(draftWithWindows) ? normalizeAggregateRelayProfile(draftWithWindows, form) : deriveRelayProfileFromFiles(draftWithWindows);
      const next = normalizeSettings(isNew
        ? addRelayProfile(form, normalizedDraft)
        : updateRelayProfile(form, profile.id, normalizedDraft));
      const settingsValidationError = relaySettingsValidation(next);
      if (settingsValidationError) return;
      const activeLiveBaseUrl = codexBaseUrlFromConfig(
        relayFiles?.configContents ?? profile.configContents,
      );
      const requiresRestart = isActive && modelRouteSaveRequiresRestart(
        normalizeSettings(form),
        next,
        activeLiveBaseUrl,
      );
      if (requiresRestart && !window.confirm(t("首次启用单模型路由需要启动本地协议代理。保存后将立即重启 Codex，使路由安全生效。是否继续？"))) {
        return;
      }
      const savedSettings = await onFormChange(next);
      if (!savedSettings) return;
      if (requiresRestart) {
        const restarted = await actions.restart(true);
        if (!restarted) return;
        onSaved?.();
        return;
      }
      const savedProfile = savedSettings.relayProfiles.find((candidate) => candidate.id === normalizedDraft.id)
        ?? normalizedDraft;
      if (isActive && savedSettings.relayProfilesEnabled && relayProfileUsesLiveFiles(savedProfile)) {
        await actions.switchRelayProfile(savedSettings, savedSettings.activeRelayId);
      }
      onSaved?.();
    } finally {
      setSavingDraft(false);
    }
  };
  const switchDraft = () => {
    if (isNew || !form.relayProfilesEnabled || validationError || modelRowsError) return;
    const draftWithWindows = draftWithModelRows();
    const normalizedDraft = isAggregateRelayProfile(draftWithWindows) ? normalizeAggregateRelayProfile(draftWithWindows, form) : deriveRelayProfileFromFiles(draftWithWindows);
    const previousActiveRelayId = form.activeRelayId;
    const next = syncLegacyRelayFields({
      ...form,
      relayProfiles: form.relayProfiles.map((item) => (item.id === profile.id ? normalizedDraft : item)),
      activeRelayId: profile.id,
    });
    void actions.switchRelayProfile(next, previousActiveRelayId);
  };
  const runProviderDoctor = async () => {
    setDoctorOpen(true);
    setDoctorRunning(true);
    setDoctorResult(null);
    const draftWithWindows = draftWithModelRows();
    const result = await actions.diagnoseRelayProfile(deriveRelayProfileFromFiles(draftWithWindows));
    setDoctorResult(result);
    setDoctorRunning(false);
  };
  const aggregateProfile = isAggregateRelayProfile(draft);
  const showDoctor = !aggregateProfile && (draft.relayMode !== "official" || draft.officialMixApiKey);
  const detailStatus = aggregateProfile
    ? isNew
      ? t("选择已有供应商作为成员，保存后写入 settings payload")
      : t("聚合配置只引用已有供应商，不复制 Key 和配置文件")
    : relayProfileEditorStatus(draft, form, isNew);
  return (
    <div className="relay-detail-page" key={profile.id}>
      <div className="relay-detail-header">
        <div className="relay-editor-heading">
          <Button aria-label={t("返回列表")} onClick={() => {
            if (hasUnsavedModelChanges && !window.confirm(t("有未保存的模型修改，确定放弃吗？"))) return;
            onBack();
          }} size="icon" title={t("返回列表")} type="button" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="relay-editor-heading-copy">
            <strong>{draft.name || (aggregateProfile ? t("未命名聚合供应商") : t("未命名供应商"))}</strong>
            <span>{hasUnsavedModelChanges ? `${detailStatus} · ${t("有未保存修改")}` : detailStatus}</span>
          </div>
        </div>
        <div className="relay-editor-actions">
          {showDoctor ? (
            <Button disabled={doctorRunning} onClick={() => void runProviderDoctor()} type="button" variant="secondary">
              <Stethoscope className="h-4 w-4" />
              {doctorRunning ? t("诊断中") : t("诊断供应商")}
            </Button>
          ) : null}
          {aggregateProfile ? (
            <UiBadge variant="secondary">{t("聚合")}</UiBadge>
          ) : isNew ? null : (
            <Button
              disabled={!form.relayProfilesEnabled || actions.relaySwitching}
              onClick={switchDraft}
              title={!form.relayProfilesEnabled ? t("供应商配置总开关已关闭") : actions.relaySwitching ? t("供应商切换中") : undefined}
              variant={draft.id === form.activeRelayId ? "secondary" : "default"}
            >
              {actions.relaySwitching ? t("切换中") : draft.id === form.activeRelayId ? t("使用中") : t("设为当前")}
            </Button>
          )}
          <Button
            disabled={savingDraft || !!validationError || !!modelRowsError}
            onClick={() => void saveDraft()}
            title={validationError || modelRowsError || t("保存")}
            type="button"
          >
            <Save className="h-4 w-4" />
            {savingDraft ? t("保存中") : t("保存此模型")}
          </Button>
        </div>
      </div>
      <div className="relay-detail-body">
        <RelayProfileEditor
          profile={draft}
          form={form}
          isNew={isNew}
          onProfileChange={setDraft}
          actions={actions}
          helpers={helpers}
          modelWindowRows={modelWindowRows}
          setModelWindowRows={setModelWindowRows}
        />
        {isAggregateRelayProfile(draft) ? null : (
        <RelayFileEditors
          contextProfile={profile}
          profile={draft}
          form={form}
          isActive={isActive}
          profileId={profile.id}
          onFormChange={onFormChange}
          onProfileChange={setDraft}
          actions={actions}
          helpers={helpers}
        />
        )}
      </div>
      {doctorOpen ? (
        <ProviderDoctorModal
          result={doctorResult}
          running={doctorRunning}
          onClose={() => {
            if (!doctorRunning) setDoctorOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function RelayProfileEditor({
  profile,
  form,
  isNew = false,
  onProfileChange,
  actions,
  helpers,
  modelWindowRows,
  setModelWindowRows,
}: {
  profile: RelayProfile;
  form: BackendSettings;
  isNew?: boolean;
  onProfileChange: (value: RelayProfile) => void;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
  modelWindowRows: ModelWindowRow[];
  setModelWindowRows: (value: ModelWindowRow[]) => void;
}) {
  const {
    aggregateStrategyHelp,
    aggregateStrategyLabel,
    aggregateStrategyOptions,
    applyRelayProfilePatchToFiles,
    clampAggregateWeight,
    defaultRelayTestModel,
    isAggregateRelayProfile,
    normalizeAggregateConfig,
    normalizeAggregateRelayProfile,
    normalizeRelaySessionProvider,
    relayProfileModeHelp,
    relaySessionProvider,
    formatMultiplierValue,
  } = helpers;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vlmTestOpen, setVlmTestOpen] = useState(false);
  const useCommonConfig = profile.useCommonConfig !== false;
  const [metadataImportTarget, setMetadataImportTarget] = useState<{
    index: number;
    slug: string;
    originalWindow: string;
    originalAutoCompact: string;
  } | null>(null);
  const [metadataImportDocument, setMetadataImportDocument] = useState("");
  const [metadataImportOriginalDocument, setMetadataImportOriginalDocument] = useState("");
  const [metadataImportError, setMetadataImportError] = useState("");
  const [metadataImportPreview, setMetadataImportPreview] = useState<ImportedModelMetadata | null>(null);
  const modelSlugOriginsRef = useRef(modelWindowRows.map((row) => row.model.trim()));
  useEffect(() => {
    modelSlugOriginsRef.current = modelWindowRows.map((row) => row.model.trim());
  }, [profile.id, profile.modelList]);
  const importedModelMetadata = useMemo(
    () => parseModelMetadataMap(profile.modelMetadata),
    [profile.modelMetadata],
  );
  // VLM/Strip 对 Chat Completions 与 Responses 协议均可用(注入块类型已按协议适配)。
  const vlmUnsupportedProtocol = false;
  if (isAggregateRelayProfile(profile)) {
    return (
      <AggregateRelayProfileEditor
        profile={profile}
        form={form}
        onProfileChange={onProfileChange}
        helpers={helpers}
      />
    );
  }

  const showApiFields = profile.relayMode !== "official" || profile.officialMixApiKey;
  const sessionProvider = relaySessionProvider(profile);
  const canUseOpenAiSessionProvider = profile.relayMode !== "official" || profile.officialMixApiKey;
  const goalsFeatureState = codexGoalsFeatureState(
    profile.configContents,
    form.relayCommonConfigContents,
    profile.useCommonConfig,
  );
  const sub2apiBaseUrl = profile.upstreamBaseUrl.trim() || profile.baseUrl.trim();
  const canFetchSub2ApiRate = profile.sub2apiEnabled && Boolean(sub2apiBaseUrl && profile.apiKey.trim());
  const updateDraft = (patch: Partial<RelayProfile>) => {
    onProfileChange(applyRelayProfilePatchToFiles(profile, patch, { allowGenerateFiles: isNew }));
  };
  const modelRoutes = normalizeRelayModelRoutes(profile.modelRoutes);
  const modelRouteTargets = form.relayProfiles.filter(
    (candidate) => candidate.id !== profile.id && !isAggregateRelayProfile(candidate) && candidate.protocol === "responses",
  );
  const updateModelRoute = (index: number, patch: Partial<RelayModelRoute>) => {
    updateDraft({
      modelRoutes: modelRoutes.map((route, routeIndex) => (routeIndex === index ? { ...route, ...patch } : route)),
    });
  };
  const commitModelMetadata = (modelMetadata: string) => {
    updateDraft({ modelMetadata });
  };
  const updateModelWindowRow = (index: number, patch: Partial<ModelWindowRow>) => {
    setModelWindowRows(
      modelWindowRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };
  const resolvePendingModelSlugRenames = (
    rows: ModelWindowRow[],
    origins: string[],
    modelMetadata: string,
  ) => {
    const slugs = rows.map((row) => row.model.trim()).filter(Boolean);
    if (new Set(slugs).size !== slugs.length) return { modelMetadata, origins };
    const nextOrigins = rows.map((row, index) => row.model.trim() || origins[index] || "");
    return {
      modelMetadata: remapModelMetadataSlugs(
        modelMetadata,
        rows.map((row, index) => ({
          previousSlug: origins[index] || "",
          nextSlug: row.model,
        })),
      ),
      origins: nextOrigins,
    };
  };
  const commitModelSlug = (index: number) => {
    const nextSlug = modelWindowRows[index]?.model.trim() ?? "";
    if (!nextSlug) return;
    const resolved = resolvePendingModelSlugRenames(
      modelWindowRows,
      modelSlugOriginsRef.current,
      profile.modelMetadata,
    );
    modelSlugOriginsRef.current = resolved.origins;
    if (resolved.modelMetadata !== profile.modelMetadata) commitModelMetadata(resolved.modelMetadata);
  };
  const closeModelMetadataImport = () => {
    setMetadataImportTarget(null);
    setMetadataImportDocument("");
    setMetadataImportOriginalDocument("");
    setMetadataImportError("");
    setMetadataImportPreview(null);
  };
  const cancelModelMetadataImport = () => {
    if (metadataImportTarget) {
      updateModelWindowRow(metadataImportTarget.index, {
        window: metadataImportTarget.originalWindow,
        autoCompact: metadataImportTarget.originalAutoCompact,
      });
    }
    closeModelMetadataImport();
  };
  const beginModelMetadataImport = (index: number, slug: string) => {
    const existingMetadata = importedModelMetadata[slug];
    const existingDocument = existingMetadata
      ? serializeModelMetadataDocument(
          slug,
          existingMetadata,
          modelWindowRows[index]?.window ?? "",
          modelWindowRows[index]?.autoCompact ?? "",
        )
      : "";
    const existingPreview = existingDocument ? parseModelMetadataDocument(existingDocument, slug) : null;
    setMetadataImportTarget({
      index,
      slug,
      originalWindow: modelWindowRows[index]?.window ?? "",
      originalAutoCompact: modelWindowRows[index]?.autoCompact ?? "",
    });
    setMetadataImportDocument(existingDocument);
    setMetadataImportOriginalDocument(existingDocument);
    setMetadataImportError("");
    setMetadataImportPreview(existingPreview?.ok ? existingPreview.value : null);
  };
  const applyModelMetadataImport = () => {
    if (!metadataImportTarget || !metadataImportPreview) return;
    commitModelMetadata(replaceModelMetadataForSlug(
      profile.modelMetadata,
      metadataImportPreview.slug,
      metadataImportPreview.metadata,
    ));
    updateModelWindowRow(metadataImportTarget.index, {
      window: metadataImportPreview.contextWindow ?? metadataImportTarget.originalWindow,
      // 空值表示明确清除该模型的自动压缩覆盖，不应恢复导入前的旧值。
      // 模型行只展示整数百分比；预览阶段的高精度值不直接写回输入框。
      autoCompact: metadataImportPreview.autoCompactPercent ?? DEFAULT_AUTO_COMPACT_PERCENT,
    });
    closeModelMetadataImport();
  };
  const clearImportedModelMetadata = () => {
    if (!metadataImportTarget) return;
    commitModelMetadata(clearModelMetadataForSlug(profile.modelMetadata, metadataImportTarget.slug));
    closeModelMetadataImport();
  };
  const removeModelWindowRow = (index: number) => {
    const removedSlug = modelWindowRows[index]?.model.trim() || modelSlugOriginsRef.current[index] || "";
    const nextRows = modelWindowRows.filter((_, rowIndex) => rowIndex !== index);
    const nextOrigins = modelSlugOriginsRef.current.filter((_, rowIndex) => rowIndex !== index);
    const resolved = resolvePendingModelSlugRenames(nextRows, nextOrigins, profile.modelMetadata);
    modelSlugOriginsRef.current = resolved.origins;
    setModelWindowRows(nextRows.length ? nextRows : [{ model: "", window: "", autoCompact: "", imageHandling: "" }]);
    const slugStillPresent = nextRows.some((row) => row.model.trim() === removedSlug)
      || resolved.origins.includes(removedSlug);
    const nextMetadata = removedSlug && !slugStillPresent
      ? clearModelMetadataForSlug(resolved.modelMetadata, removedSlug)
      : resolved.modelMetadata;
    if (nextMetadata !== profile.modelMetadata) commitModelMetadata(nextMetadata);
    if (metadataImportTarget?.index === index) {
      closeModelMetadataImport();
    } else if (metadataImportTarget && metadataImportTarget.index > index) {
      setMetadataImportTarget({ ...metadataImportTarget, index: metadataImportTarget.index - 1 });
    }
  };
  const addModelWindowRows = (rows: ModelWindowRow[]) => {
    const merged = mergeModelWindowRows(modelWindowRows, rows);
    modelSlugOriginsRef.current = merged.map((row) => {
      const currentIndex = modelWindowRows.findIndex((current) => current.model.trim() === row.model.trim());
      return currentIndex >= 0 ? modelSlugOriginsRef.current[currentIndex] || row.model.trim() : row.model.trim();
    });
    setModelWindowRows(merged);
  };
  const appendEmptyModelRow = () => {
    modelSlugOriginsRef.current = [...modelSlugOriginsRef.current, ""];
    setModelWindowRows([...modelWindowRows, { model: "", window: "", autoCompact: "", imageHandling: "" }]);
  };
  const modelRowsError = modelWindowRowsValidationMessage(modelWindowRowsValidationError(modelWindowRows));
  const fetchSub2ApiRate = async () => {
    const result = await actions.fetchSub2ApiBilling(deriveRelayProfileFromFiles(profile));
    if (!result) return;
    updateDraft({
      sub2apiEnabled: true,
      sub2apiMultiplier: formatMultiplierValue(result.effectiveRateMultiplier),
    });
  };
  return (
    <div className="relay-profile-editor">
      {isNew ? (
        <ProviderPresetSelector
          onSelect={(patch: PresetPatch) => {
            updateDraft(patch as unknown as Partial<RelayProfile>);
          }}
        />
      ) : null}
      <div className="relay-fields">
        <Field className="relay-field-name" label={t("名称")}>
          <Input
            value={profile.name}
            onChange={(event) => updateDraft({ name: event.currentTarget.value })}
          />
        </Field>
        <Field className="relay-field-mode" label={t("接入模式")}>
          <AppSelect
            value={profile.relayMode}
            onChange={(relayMode) => {
              updateDraft(relayMode === "official" ? { relayMode, officialMixApiKey: false } : { relayMode });
            }}
            options={[
              { value: "official", label: t("官方登录") },
              { value: "pureApi", label: t("纯 API") },
            ]}
          />
        </Field>
        <Field className="relay-field-config-model" label={t("配置模型")}>
          <Input
            value={profile.model}
            onChange={(event) => updateDraft({ model: event.currentTarget.value })}
            placeholder={t("例如 deepseek-v4-pro")}
          />
          <p className="field-hint">
            {t("默认启动 Codex 时使用的模型名，请勿带后缀；上下文窗口请在下方「模型列表」中按模型单独配置。")}
          </p>
        </Field>
        <Field className="relay-field-goals" label={t("Codex 目标")}>
          <label className="inline-check">
            <input
              checked={goalsFeatureState.enabled}
              onChange={(event) =>
                updateDraft({
                  configContents: setCodexGoalsFeatureInConfig(profile.configContents, event.currentTarget.checked),
                })
              }
              type="checkbox"
            />
            <span>{t("启用目标功能")}</span>
          </label>
          {goalsFeatureState.inherited ? (
            <p className="field-hint">{t("当前继承公共配置；修改后将为该供应商保存独立设置。")}</p>
          ) : null}
        </Field>
        {profile.relayMode === "official" ? (
          <Field className="relay-field-official-usage-alert" label={t("官方登录")}>
            <label className="inline-check">
              <input
                checked={profile.hideOfficialUsageAlert}
                onChange={(event) => updateDraft({ hideOfficialUsageAlert: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>{t("关闭官方低额度提示")}</span>
            </label>
            <p className="field-hint">
              {t("关闭后仍可从 Codex 左下角账户菜单查看官方剩余额度。")}
            </p>
          </Field>
        ) : null}
        <div className="relay-advanced-toggle">
          <Button
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((current) => !current)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Settings className="h-4 w-4" />
            {t("更多选项")}
          </Button>
        </div>
        {showAdvanced ? (
          <div className="relay-advanced-fields">
            <Field className="relay-field-test-model" label={t("测试模型")}>
              <Input
                value={profile.testModel}
                onChange={(event) => updateDraft({ testModel: event.currentTarget.value })}
                placeholder={tf("留空使用默认：{0}", [form.relayTestModel || defaultRelayTestModel])}
              />
            </Field>
            <Field className="relay-field-context-window" label={t("上下文大小")}>
              <Input
                inputMode="numeric"
                value={profile.contextWindow}
                onChange={(event) => updateDraft({ contextWindow: event.currentTarget.value.replace(/[^\d]/g, "") })}
                placeholder={t("留空不改写，例如 200000")}
              />
            </Field>
            <Field className="relay-field-auto-compact" label={t("压缩上下文大小")}>
              <Input
                inputMode="numeric"
                value={profile.autoCompactLimit}
                onChange={(event) => updateDraft({ autoCompactLimit: event.currentTarget.value.replace(/[^\d]/g, "") })}
                placeholder={t("留空不改写，例如 160000")}
              />
            </Field>
          </div>
        ) : null}
        {profile.relayMode === "official" ? (
          <Field className="relay-field-official-key" label="API Key">
            <label className="inline-check">
              <input
                checked={profile.officialMixApiKey}
                onChange={(event) => updateDraft({ officialMixApiKey: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>{t("混入 API KEY")}</span>
            </label>
          </Field>
        ) : null}
        {showApiFields ? (
          <div className="relay-api-fields">
            <Field className="relay-field-base-url" label="Base URL">
              <Input
                value={profile.baseUrl}
                onChange={(event) => updateDraft({ baseUrl: event.currentTarget.value })}
                placeholder={t("填写中转服务 Base URL")}
              />
            </Field>
            <Field className="relay-field-key" label="Key">
              <Input
                type="password"
                value={profile.apiKey}
                onChange={(event) => updateDraft({ apiKey: event.currentTarget.value })}
                placeholder={t("输入中转服务的 API Key")}
              />
            </Field>
            <Field className="relay-field-protocol" label={t("上游协议")}>
              <div className="protocol-options">
                <button
                  className={`protocol-option ${profile.protocol === "responses" ? "active" : ""}`}
                  onClick={() => updateDraft({ protocol: "responses" })}
                  type="button"
                >
                  Responses API
                </button>
                <button
                  className={`protocol-option ${profile.protocol === "chatCompletions" ? "active" : ""}`}
                  onClick={() => updateDraft({ protocol: "chatCompletions" })}
                  type="button"
                >
                  Chat Completions
                </button>
              </div>
            </Field>
            <Field className="relay-field-session-provider" label={t("Codex 会话身份")}>
              <AppSelect
                value={sessionProvider}
                onChange={(value) => updateDraft({ sessionProvider: value })}
                options={[
                  { value: "custom", label: t("Custom（默认）") },
                  {
                    value: "openai",
                    label: t("OpenAI（兼容 ChatGPT Remote）"),
                    disabled: !canUseOpenAiSessionProvider || profile.protocol !== "responses",
                  },
                ]}
              />
              <p className="field-hint">
                {profile.protocol !== "responses"
                  ? t("OpenAI 会话身份需要 Responses API；Chat Completions 不支持远程压缩。")
                  : canUseOpenAiSessionProvider
                    ? t("选择 OpenAI 后，Codex Remote 会把当前会话识别为 ChatGPT 会话；中转仍使用 custom 表。")
                    : t("官方登录未混入 API 时不写入会话 provider")}
              </p>
            </Field>
            <Field className="relay-field-sub2api" label="Sub2API">
              <div className="sub2api-field">
                <label className="inline-check">
                  <input
                    checked={profile.sub2apiEnabled}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateDraft({
                        sub2apiEnabled: checked,
                        sub2apiMultiplier: checked ? profile.sub2apiMultiplier || "" : "",
                      });
                      if (checked && sub2apiBaseUrl && profile.apiKey.trim()) {
                        void fetchSub2ApiRate();
                      }
                    }}
                    type="checkbox"
                  />
                  <span>{t("尝试从sub2api获取倍率显示")}</span>
                </label>
                <Button
                  disabled={!canFetchSub2ApiRate}
                  onClick={() => void fetchSub2ApiRate()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Download className="h-4 w-4" />
                  {t("获取倍率")}
                </Button>
              </div>
              <p className="field-hint">
                {profile.sub2apiEnabled
                  ? profile.sub2apiMultiplier.trim()
                    ? tf("当前缓存倍率：{0}x", [profile.sub2apiMultiplier.trim()])
                    : t("保存前可先尝试从 /v1/sub2api/billing 获取上游倍率。")
                  : t("非 Sub2API 供应商不会请求或显示倍率。")}
              </p>
            </Field>
          </div>
        ) : null}
        {showApiFields ? (
          <section className="relay-config-section relay-field-model-list">
            <div className="relay-config-section-head">
              <div>
                <strong>{t("模型列表")}</strong>
                <span>
                  {t("每行一个模型；上下文窗口可填")} <code>1M</code>{t("、")}<code>200K</code> {t("或")} <code>1000000</code>{t("，留空表示使用 Codex 默认长度。")}
                </span>
              </div>
              <div className="relay-model-list-tools">
                <Button
                  onClick={appendEmptyModelRow}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4" />
                  {t("添加模型")}
                </Button>
                <Button
                  onClick={async () => {
                    const serializedRows = serializeModelWindowRows(modelWindowRows);
                    const models = await actions.fetchRelayProfileModels({
                      ...profile,
                      modelList: serializedRows.modelList,
                      modelWindows: serializedRows.modelWindows,
                      modelAutoCompact: serializedRows.modelAutoCompact,
                    });
                    if (models?.length) {
                      addModelWindowRows(models.map((model) => ({ model, window: "", autoCompact: "", imageHandling: "" })));
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Download className="h-4 w-4" />
                  {t("从上游获取")}
                </Button>
                <Button
                  disabled={!modelWindowRows.some((row) => row.model.trim())}
                  onClick={() => setModelWindowRows([{ model: "", window: "", autoCompact: "", imageHandling: "send-as-is" }])}
                  size="sm"
                  title={t("清空模型")}
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("清空模型")}
                </Button>
              </div>
            </div>
            <div className="relay-model-row-editor">
              <div className="relay-model-row relay-model-row-head">
                <span>{t("模型名称")}</span>
                <span>{t("上下文窗口")}</span>
                <span>{t("自动压缩")}</span>
                <span>{t("图片处理方式")}</span>
                <span>{t("模型配置")}</span>
                <span aria-hidden="true" />
              </div>
              {modelWindowRows.map((row, index) => {
                const slug = row.model.trim();
                const importing = metadataImportTarget?.index === index && metadataImportTarget.slug === slug;
                const imported = Boolean(importedModelMetadata[slug]);
                return (
                  <div className="relay-model-entry" key={index}>
                    <div className="relay-model-row">
                      <Input
                        value={row.model}
                        onChange={(event) => updateModelWindowRow(index, { model: event.currentTarget.value })}
                        onBlur={() => commitModelSlug(index)}
                        placeholder="deepseek/deepseek-v4-flash"
                      />
                      <Input
                        value={row.window}
                        onChange={(event) => {
                          const window = event.currentTarget.value;
                          updateModelWindowRow(index, { window });
                          // 导入面板尚未粘贴 JSON 时，只编辑模型行；不要把空文档同步失败显示成错误。
                          if (!importing || !metadataImportDocument.trim() || !metadataImportPreview) return;
                          const synchronized = synchronizeModelMetadataDocumentLimitsPreview(
                            metadataImportDocument,
                            slug,
                            window,
                            metadataImportPreview?.autoCompactCalculationPercent
                              ?? metadataImportPreview?.autoCompactPercent
                              ?? row.autoCompact,
                          );
                          if (!synchronized) {
                            setMetadataImportPreview(null);
                            setMetadataImportError(t("上下文窗口与自动压缩值无效，无法同步模型配置。"));
                            return;
                          }
                          setMetadataImportDocument(synchronized.document);
                          setMetadataImportPreview(synchronized.preview);
                          setMetadataImportError("");
                        }}
                        placeholder="1M"
                      />
                      <Input
                        value={row.autoCompact}
                        onChange={(event) => {
                          const autoCompact = normalizeAutoCompactEditing(
                            event.currentTarget.value,
                            row.autoCompact,
                          );
                          updateModelWindowRow(index, { autoCompact });
                          // 导入面板尚未粘贴 JSON 时，只编辑模型行；不要把空文档同步失败显示成错误。
                          if (!importing || !metadataImportDocument.trim() || !metadataImportPreview) return;
                          const synchronized = synchronizeModelMetadataDocumentLimitsPreview(
                            metadataImportDocument,
                            slug,
                            row.window,
                            autoCompact,
                          );
                          if (!synchronized) {
                            setMetadataImportPreview(null);
                            setMetadataImportError(t("上下文窗口与自动压缩值无效，无法同步模型配置。"));
                            return;
                          }
                          setMetadataImportDocument(synchronized.document);
                          setMetadataImportPreview(synchronized.preview);
                          setMetadataImportError("");
                        }}
                        onBlur={(event) => {
                          const normalized = normalizeAutoCompactPercent(event.currentTarget.value);
                          const effective = normalized || DEFAULT_AUTO_COMPACT_PERCENT;
                          if (effective !== row.autoCompact) updateModelWindowRow(index, { autoCompact: effective });
                        }}
                        placeholder="90%"
                      />
                      <AppSelect
                        className="text-xs"
                        value={row.imageHandling}
                        disabled={vlmUnsupportedProtocol}
                        onChange={(value) => updateModelWindowRow(index, { imageHandling: value })}
                        options={[
                          { value: "", label: t("纯文本模型请配置此项"), disabled: true },
                          { value: "send-as-is", label: t("原样发送图片"), title: t("多模态模型直接接收图片,不经过任何处理") },
                          { value: "strip", label: t("移除图片"), title: t("删掉图片只发文字,避免纯文本模型报错(模型看不到图)") },
                          { value: "vlm", label: t("视觉辅助分析"), title: t("图片先由视觉辅助模型(Qwen)转成文字描述,纯文本模型也能\"看图\"") },
                        ]}
                        title={vlmUnsupportedProtocol ? t("VLM 仅支持 Chat Completions 协议和聚合模式") : t("多模态模型（支持图片输入的模型）请保持 send-as-is。")}
                      />
                      <Button
                        className="relay-model-import-button"
                        aria-expanded={importing}
                        disabled={!slug}
                        onClick={() => (importing ? cancelModelMetadataImport() : beginModelMetadataImport(index, slug))}
                        size="icon"
                        title={imported ? t("查看或重新导入 models.json") : t("导入 models.json")}
                        type="button"
                        variant={importing || imported ? "secondary" : "ghost"}
                      >
                        <FileCode2 className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={t("删除模型")}
                        onClick={() => removeModelWindowRow(index)}
                        size="icon"
                        title={t("删除模型")}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {importing ? (
                      <section className="relay-model-import-workbench">
                        <Textarea
                          autoFocus
                          value={metadataImportDocument}
                          onChange={(event) => {
                            const document = event.currentTarget.value;
                            setMetadataImportDocument(document);
                            setMetadataImportError("");
                            const parsed = parseModelMetadataDocument(document, slug);
                            if (!parsed.ok) {
                              setMetadataImportPreview(null);
                              setMetadataImportError(t(parsed.error));
                              return;
                            }
                            setMetadataImportPreview(parsed.value);
                          }}
                          placeholder={t("需要补充供应商模型信息时填写；不填则使用 Codex++ 默认配置（自动压缩 90%、图片原样发送）。从供应商的 models.json 或 model.json 复制，支持多个模型。")}
                          rows={7}
                        />
                        {metadataImportError ? <div className="relay-model-metadata-import-error" role="alert">{metadataImportError}</div> : null}
                        {metadataImportPreview?.ignoredFields.length ? (
                          <div className="relay-model-metadata-import-warning" role="status">
                            {tf("以下字段由 Codex++ 计算或维护，导入不会覆盖：{0}", [metadataImportPreview.ignoredFields.join(", ")])}
                          </div>
                        ) : null}
                        <div className="relay-model-metadata-import-actions">
                          <div className="relay-model-import-copy">
                            <strong>{slug}</strong>
                          </div>
                          <div className="relay-model-metadata-import-flow">
                            <Button onClick={cancelModelMetadataImport} size="sm" type="button" variant="ghost">{t("取消")}</Button>
                            {imported ? (
                              <Button
                                className="relay-model-metadata-reset"
                                onClick={clearImportedModelMetadata}
                                size="sm"
                                title={t("清除已导入的模型字段，保留上下文窗口")}
                                type="button"
                                variant="ghost"
                              >
                                <RotateCcw className="h-4 w-4" />
                                {t("清除导入配置")}
                              </Button>
                            ) : null}
                            <Button disabled={!metadataImportPreview} onClick={applyModelMetadataImport} size="sm" type="button">
                              {t(
                                metadataImportDocument.trim() === metadataImportOriginalDocument.trim()
                                  ? "保存此模型"
                                  : "更新此模型配置",
                              )}
                            </Button>
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {modelRowsError ? <div className="relay-model-metadata-import-error" role="alert">{modelRowsError}</div> : null}
            <p className="field-hint">
              {t("自动压缩留空时沿用 Codex 默认行为；填写百分比后会按该模型的上下文窗口重新计算阈值。")}
            </p>
          </section>
        ) : null}
        {showApiFields ? (
          <section className="relay-config-section relay-field-model-routes">
            <div className="relay-config-section-head">
              <div>
                <strong>{t("单模型路由")}</strong>
                <span>{t("仅在当前供应商启用时生效；精确匹配模型名并使用目标供应商的 URL 与 Key。目标必须是 Responses API，且需要从 Codex++ 启动。")}</span>
              </div>
              <div className="relay-model-list-tools">
                <Button
                  disabled={modelRouteTargets.length === 0}
                  onClick={() => updateDraft({ modelRoutes: [...modelRoutes, { model: "", targetRelayId: "", targetModel: "" }] })}
                  size="sm"
                  title={modelRouteTargets.length === 0 ? t("请先创建一个 Responses API 目标供应商") : t("添加模型路由")}
                  type="button"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4" />
                  {t("添加模型路由")}
                </Button>
              </div>
            </div>
            <div className="relay-model-route-editor">
              {modelRoutes.length ? (
                <div className="relay-model-route-row relay-model-route-head">
                  <span>{t("匹配模型")}</span>
                  <span>{t("目标供应商")}</span>
                  <span>{t("目标模型（可选）")}</span>
                </div>
              ) : null}
              {modelRoutes.map((route, index) => (
                <div className="relay-model-route-row" key={`model-route-${index}`}>
                  <Input
                    value={route.model}
                    onChange={(event) => updateModelRoute(index, { model: event.currentTarget.value })}
                    placeholder={t("例：gpt-5.6-luna")}
                  />
                  <AppSelect
                    value={route.targetRelayId}
                    onChange={(targetRelayId) => updateModelRoute(index, { targetRelayId })}
                    options={[
                      { value: "", label: t("选择 Responses 供应商"), disabled: true },
                      ...modelRouteTargets.map((candidate) => ({ value: candidate.id, label: candidate.name || candidate.id })),
                    ]}
                  />
                  <Input
                    value={route.targetModel}
                    onChange={(event) => updateModelRoute(index, { targetModel: event.currentTarget.value })}
                    placeholder={t("留空保持原模型名")}
                  />
                  <Button
                    aria-label={t("删除模型路由")}
                    onClick={() => updateDraft({ modelRoutes: modelRoutes.filter((_, routeIndex) => routeIndex !== index) })}
                    size="icon"
                    title={t("删除模型路由")}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {showApiFields && modelWindowRows.some((row) => row.imageHandling === "vlm") ? (
          <div className="relay-vlm-section">
            <div className="relay-vlm-section-header">{t("Vision Analysis Provider")}</div>
            <Field className="relay-field-vlm-api-key" label={t("VLM API Key")}>
              <Input
                type="password"
                value={profile.vlmApiKey}
                onChange={(event) => updateDraft({ vlmApiKey: event.currentTarget.value })}
                placeholder="sk-..."
              />
            </Field>
            <Field className="relay-field-vlm-model" label={t("VLM Model")}>
              <Input
                value={profile.vlmModel}
                onChange={(event) => updateDraft({ vlmModel: event.currentTarget.value })}
                placeholder="qwen-vl-plus"
              />
            </Field>
            <Field className="relay-field-vlm-base-url" label={t("VLM Base URL")}>
              <Input
                value={profile.vlmBaseUrl}
                onChange={(event) => updateDraft({ vlmBaseUrl: event.currentTarget.value })}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </Field>
            <p className="field-hint">
              {t("若开启 VLM analysis，请确认 VLM 配置项完整且服务可用。")}
              <br />
              {t("仅在 Chat Completion 和聚合模式生效。")}
            </p>
            {modelWindowRows.some((row) => row.imageHandling === "vlm") && (!profile.vlmApiKey || !profile.vlmModel || !profile.vlmBaseUrl) ? (
              <p className="field-hint warn">{t("VLM 配置不完整：API Key、Model 和 Base URL 为必填项，否则 VLM 不会生效。")}</p>
            ) : null}
            <div className="vlm-test-entry">
              <Button
                onClick={() => setVlmTestOpen((v) => !v)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {vlmTestOpen ? t("收起测试面板") : t("测试 VLM")}
              </Button>
            </div>
            {vlmTestOpen ? <VlmTestPanel profile={profile} onClose={() => setVlmTestOpen(false)} /> : null}
          </div>
        ) : null}
        {showApiFields ? (
          <Field className="relay-field-user-agent" label="User-Agent">
            <Input
              value={profile.userAgent}
              onChange={(event) => updateDraft({ userAgent: event.currentTarget.value })}
              placeholder={t("留空使用默认值")}
            />
          </Field>
        ) : null}
      </div>
      {showApiFields && profile.protocol === "chatCompletions" ? (
        <div className="hint-line relay-protocol-hint">
          <MessageCircle className="h-4 w-4" />
          <span>{t("此上游会通过本地 127.0.0.1:57321 转成 Responses API，需要从 Codex++ 启动 Codex。")}</span>
        </div>
      ) : null}
      <div className="hint-line relay-protocol-hint">
        <ShieldCheck className="h-4 w-4" />
        <span>{relayProfileModeHelp(profile)}</span>
      </div>
    </div>
  );
}

type VlmTestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: TestVlmResult };

type TestVlmResult = {
  status: string;
  message: string;
  vlmStatus: string;
  httpCode: number | null;
  durationMs: number;
  error: string | null;
  description: string | null;
  model: string;
  rawRequest: string | null;
  rawResponse: string | null;
};

const VLM_TEST_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/// 方向 C：选图即测 + 排障增强（spec §4）。
/// 选完文件自动开跑；失败时给通俗诊断 + 复制错误 + 原始请求/响应折叠。
function VlmTestPanel({
  profile,
  onClose,
}: {
  profile: Pick<RelayProfile, "vlmApiKey" | "vlmModel" | "vlmBaseUrl">;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [state, setState] = useState<VlmTestState>({ kind: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tr = (zh: string, params?: string[]) => (params ? tf(zh, params) : t(zh));

  const runTest = async (url: string) => {
    setState({ kind: "running" });
    setLocalError(null);
    try {
      const res = await invoke<TestVlmResult>("test_vlm", {
        request: {
          apiKey: profile.vlmApiKey,
          model: profile.vlmModel,
          baseUrl: profile.vlmBaseUrl,
          imageDataUrl: url,
        },
      });
      setState({ kind: "done", result: res });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState({
        kind: "done",
        result: {
          status: "failed",
          message: msg,
          vlmStatus: "client_error",
          httpCode: null,
          durationMs: 0,
          error: msg,
          description: null,
          model: profile.vlmModel,
          rawRequest: null,
          rawResponse: null,
        },
      });
    }
  };

  // 选图即测：选完文件自动发起，无需二次点击（spec §4）。
  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError(t("请选择图片文件。"));
      return;
    }
    if (file.size > VLM_TEST_MAX_IMAGE_BYTES) {
      setLocalError(t("图片超过 10MB，请换一张较小的图片。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setLocalError(t("读取图片失败，请重新选择"));
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : null;
      if (url) {
        setDataUrl(url);
        void runTest(url);
      }
    };
    reader.readAsDataURL(file);
  };

  // 复制完整排障信息（诊断 + 原始报文，无 API Key），可直接贴 issue（spec §3）。
  const copyError = async () => {
    if (state.kind !== "done") return;
    const r = state.result;
    const text = [
      vlmTestTranslation(r.vlmStatus, r.httpCode ?? undefined, r.durationMs, tr),
      `model: ${r.model}`,
      r.httpCode != null ? `HTTP ${r.httpCode}` : null,
      r.error ? `error: ${r.error}` : null,
      r.rawRequest ? `--- request ---\n${r.rawRequest}` : null,
      r.rawResponse ? `--- response ---\n${r.rawResponse}` : null,
    ]
      .filter((x) => x !== null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setLocalError(t("复制失败，请从报文中手动复制。"));
    }
  };

  const done = state.kind === "done" ? state.result : null;
  const running = state.kind === "running";
  const formReady = !!profile.vlmApiKey && !!profile.vlmModel && !!profile.vlmBaseUrl;
  const canRun = !!dataUrl && formReady;

  return (
    <div className="vlm-test-panel">
      <div className="modal-head">
        <div>
          <h2>{t("测试 VLM")}</h2>
          <p className="modal-message">
            {t("选一张图片立即验证当前 VLM 配置（使用表单当前值，无需保存）。")}
          </p>
        </div>
        <button className="toast-close" aria-label={t("关闭窗口")} onClick={onClose} type="button">×</button>
      </div>

      <div className="vlm-test-upload">
        <input
          ref={fileInputRef}
          accept="image/*"
          onChange={(e) => {
            onFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
          type="file"
          style={{ display: "none" }}
        />
        <Button disabled={running || !formReady} onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">
          {dataUrl ? t("换图并测试") : t("选择图片并测试")}
        </Button>
        {dataUrl ? <img alt={t("图片预览")} className="vlm-test-preview" src={dataUrl} /> : null}
        {running ? (
          <p className="vlm-test-running">
            <span className="vlm-test-spinner" aria-hidden="true" />
            {t("正在调用 VLM…")}
          </p>
        ) : null}
      </div>

      {localError ? <p className="field-hint warn">{localError}</p> : null}

      {done ? (
        <div className="vlm-test-result">
          <p className="vlm-test-summary" role="status">
            {vlmTestTranslation(done.vlmStatus, done.httpCode ?? undefined, done.durationMs, tr)}
          </p>
          {done.description ? (
            <pre className="vlm-test-description">{done.description}</pre>
          ) : null}
          {done.vlmStatus !== "ok" ? (
            <button className="vlm-test-detail-toggle" onClick={() => void copyError()} type="button">
              {t("复制错误")}
            </button>
          ) : null}
          <button
            className="vlm-test-detail-toggle"
            aria-expanded={showRaw}
            onClick={() => setShowRaw((v) => !v)}
            type="button"
          >
            {showRaw ? t("隐藏原始报文") : t("显示原始报文")}
          </button>
          {showRaw ? (
            <div className="vlm-test-raw">
              <div className="label">{t("原始请求")}</div>
              <pre className="vlm-test-description">{done.rawRequest ?? "-"}</pre>
              <div className="label">{t("原始响应")}</div>
              <pre className="vlm-test-description">{done.rawResponse ?? "-"}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <Toolbar>
        {dataUrl ? (
          <Button disabled={!canRun || running} onClick={() => dataUrl && void runTest(dataUrl)} type="button">
            {t("重测")}
          </Button>
        ) : null}
        <Button onClick={onClose} type="button" variant="secondary">
          {t("收起")}
        </Button>
      </Toolbar>
    </div>
  );
}

function AggregateRelayProfileEditor({
  profile,
  form,
  onProfileChange,
  helpers,
}: {
  profile: RelayProfile;
  form: BackendSettings;
  onProfileChange: (value: RelayProfile) => void;
  helpers: RelayScreenHelpers;
}) {
  const {
    aggregateMemberCandidates,
    aggregateStrategyHelp,
    aggregateStrategyLabel,
    aggregateStrategyOptions,
    clampAggregateWeight,
    defaultRelayTestModel,
    isAggregateRelayProfile,
    normalizeAggregateConfig,
    normalizeAggregateRelayProfile,
    normalizeRelaySessionProvider,
    relayModeLabel,
    relayProfileConfigBrief,
    relayProtocolLabel,
  } = helpers;
  const candidates = aggregateMemberCandidates(form, profile.id);
  const aggregate = normalizeAggregateConfig(profile.aggregate, candidates);
  const memberIds = new Set(aggregate.members.map((member) => member.profileId));
  const sessionProvider = normalizeRelaySessionProvider(profile.sessionProvider);
  const updateAggregate = (nextAggregate: RelayAggregateConfig) => {
    onProfileChange(normalizeAggregateRelayProfile({ ...profile, aggregate: nextAggregate }, form));
  };
  const toggleMember = (profileId: string, checked: boolean) => {
    const members = checked
      ? [...aggregate.members, { profileId, weight: 1 }]
      : aggregate.members.filter((member) => member.profileId !== profileId);
    updateAggregate({ ...aggregate, members });
  };
  const updateWeight = (profileId: string, weight: number) => {
    updateAggregate({
      ...aggregate,
      members: aggregate.members.map((member) =>
        member.profileId === profileId ? { ...member, weight: clampAggregateWeight(weight) } : member,
      ),
    });
  };
  const totalWeight = aggregate.members.reduce((total, member) => total + clampAggregateWeight(member.weight), 0);

  return (
    <div className="relay-profile-editor aggregate-editor">
      <div className="relay-fields aggregate-fields">
        <Field className="relay-field-name" label={t("名称")}>
          <Input
            value={profile.name}
            onChange={(event) => onProfileChange({ ...profile, name: event.currentTarget.value })}
            placeholder={t("例如 主力聚合池")}
          />
        </Field>
        <Field className="relay-field-test-model" label={t("测试模型")}>
          <Input
            value={profile.testModel}
            onChange={(event) => onProfileChange({ ...profile, testModel: event.currentTarget.value })}
                placeholder={tf("留空使用默认：{0}", [form.relayTestModel || defaultRelayTestModel])}
          />
        </Field>
        <Field className="aggregate-strategy-field" label={t("聚合策略")}>
          <AppSelect
            value={aggregate.strategy}
            onChange={(value) => updateAggregate({ ...aggregate, strategy: value })}
            options={aggregateStrategyOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
        </Field>
        <Field className="relay-field-session-provider" label={t("Codex 会话身份")}>
          <AppSelect
            value={sessionProvider}
            onChange={(value) => onProfileChange(normalizeAggregateRelayProfile({ ...profile, sessionProvider: value }, form))}
            options={[
              { value: "custom", label: t("Custom（默认）") },
              { value: "openai", label: t("OpenAI（兼容 ChatGPT Remote）") },
            ]}
          />
          <p className="field-hint">
            {t("聚合请求仍由本地 Responses 代理轮转成员；OpenAI 身份用于让 ChatGPT Remote 识别会话。")}
          </p>
        </Field>
      </div>
      <div className="aggregate-strategy-grid">
        {aggregateStrategyOptions.map((option) => (
          <button
            className={`mode-option aggregate-strategy-option ${aggregate.strategy === option.value ? "active" : ""}`}
            key={option.value}
            onClick={() => updateAggregate({ ...aggregate, strategy: option.value })}
            type="button"
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
      <div className="aggregate-members">
        <div className="aggregate-members-head">
          <div>
            <strong>{t("成员供应商")}</strong>
            <span>{t("只能勾选已填写 Base URL / Key 的 API 供应商，聚合供应商不会作为成员。")}</span>
          </div>
          <UiBadge variant="outline">{aggregate.members.length} / {candidates.length}</UiBadge>
        </div>
        {candidates.length ? (
          <div className="aggregate-member-list">
            {candidates.map((candidate) => {
              const member = aggregate.members.find((item) => item.profileId === candidate.id);
              const checked = memberIds.has(candidate.id);
              return (
                <label className={`aggregate-member-row ${checked ? "selected" : ""}`} key={candidate.id}>
                  <input
                    checked={checked}
                    onChange={(event) => toggleMember(candidate.id, event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span className="aggregate-member-summary">
                    <strong>{candidate.name || t("未命名供应商")}</strong>
                    <small>{relayModeLabel(candidate.relayMode)} · {relayProtocolLabel(candidate.protocol)} · {relayProfileConfigBrief(candidate)}</small>
                  </span>
                  <span className="aggregate-weight-box">
                    <span>{t("权重")}</span>
                    <Input
                      disabled={!checked}
                      min={1}
                      onChange={(event) => updateWeight(candidate.id, Number.parseInt(event.currentTarget.value, 10))}
                      type="number"
                      value={String(member?.weight ?? 1)}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="empty">{t("先添加至少 1 个已填写 Base URL / Key 的 API 供应商，再创建聚合供应商。")}</div>
        )}
      </div>
      <div className="relay-grid compact aggregate-preview">
        <Metric label={t("策略")} value={aggregateStrategyLabel(aggregate.strategy)} />
        <Metric label={t("成员数量")} value={tf("{0} 个", [aggregate.members.length])} />
        <Metric label={t("总权重")} value={`${totalWeight}`} />
        <Metric label={t("序列化字段")} value="aggregate.strategy / aggregate.members" />
      </div>
      <div className="hint-line relay-protocol-hint">
        <ShieldCheck className="h-4 w-4" />
        <span>{aggregateStrategyHelp(aggregate.strategy)}</span>
      </div>
    </div>
  );
}

function SyncedTextarea({
  value,
  onValueChange,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const latestExternalValueRef = useRef(value);

  useEffect(() => {
    latestExternalValueRef.current = value;
    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <Textarea
      className={className}
      value={localValue}
      onBlur={() => {
        isFocusedRef.current = false;
        setLocalValue(latestExternalValueRef.current);
      }}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setLocalValue(next);
        onValueChange(next);
      }}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      spellCheck={false}
    />
  );
}

function RelayFileEditors({
  contextProfile,
  profile,
  form,
  isActive,
  profileId,
  onFormChange,
  onProfileChange,
  actions,
  helpers,
}: {
  contextProfile: RelayProfile;
  profile: RelayProfile;
  form: BackendSettings;
  isActive: boolean;
  profileId: string;
  onFormChange: (value: BackendSettings) => void;
  onProfileChange: (value: RelayProfile) => void;
  actions: RelayScreenActions;
  helpers: RelayScreenHelpers;
}) {
  const {
    contextEntriesForProfile,
    deriveRelayProfileFromFiles,
    effectiveRelayConfigPreview,
    joinTomlSectionsRootFirst,
    relayCombinedCommonConfig,
    splitContextConfigText,
    stripCommonConfigTextFallback,
    stripContextEntriesFromConfig,
    syncLegacyRelayFields,
  } = helpers;
  const configPreview = effectiveRelayConfigPreview(profile, form, contextProfile);
  const entries = contextEntriesForProfile(form, contextProfile);
  return (
    <div className="relay-file-grid">
      <div className="relay-file-panel">
        <div className="relay-file-head">
          <div>
            <strong>{t("config.toml 预览")}</strong>
            <span>{isActive ? t("当前供应商切换后会写入的预览；上下文开关变化会立即反映") : t("切换到此供应商时会写入的预览；上下文开关变化会立即反映")}</span>
          </div>
        </div>
        <SyncedTextarea
          className="relay-file-textarea"
          value={configPreview}
          onValueChange={(value) => {
            const withoutCommon = stripCommonConfigTextFallback(
              value,
              relayCombinedCommonConfig(form),
            );
            const configContents = stripContextEntriesFromConfig(withoutCommon, entries);
            onProfileChange(deriveRelayProfileFromFiles({
              ...profile,
              configContents,
            }));
          }}
        />
      </div>
      <div className="relay-file-panel">
        <div className="relay-file-head">
          <div>
            <strong>{t("通用配置文件")}</strong>
            <span>{t("只保留非 MCP、插件的跨供应商配置；MCP&插件在独立页面管理。")}</span>
          </div>
          <Button
            onClick={async () => {
              const extracted = await actions.extractRelayCommonConfig(profile.configContents || "");
              if (!extracted) return;
              const split = splitContextConfigText(extracted.commonConfigContents || "");
              if (!split.common.trim() && !split.context.trim()) {
                await actions.showMessage(t("通用配置文件"), t("当前供应商 config.toml 里没有可提取的通用配置。"), "failed");
                return;
              }
              const promotedProfile = {
                ...profile,
                configContents: extracted.profileConfigContents,
              };
              const next = syncLegacyRelayFields({
                ...form,
                relayCommonConfigContents: split.common,
                relayContextConfigContents: joinTomlSectionsRootFirst([form.relayContextConfigContents || "", split.context]),
                relayProfiles: form.relayProfiles.map((item) => (item.id === profileId ? promotedProfile : item)),
              });
              onFormChange(next);
              onProfileChange(promotedProfile);
              await actions.saveSettingsValue(next, false);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Download className="h-4 w-4" />
            {t("提取当前供应商配置")}
          </Button>
        </div>
        <SyncedTextarea
          className="relay-file-textarea"
          value={form.relayCommonConfigContents}
          onValueChange={(value) => onFormChange({ ...form, relayCommonConfigContents: value })}
        />
      </div>
      <div className="relay-file-panel">
        <div className="relay-file-head">
          <div>
            <strong>auth.json</strong>
            <span>{isActive
              ? profile.relayMode === "pureApi"
                ? t("当前使用中：保留此供应商的 auth 存档，避免 Codex 登录密钥覆盖供应商密钥")
                : t("当前使用中：打开时从 ~/.codex/auth.json 回填，保存后会作为此供应商 auth 存档")
              : t("切换到此供应商时会写入 ~/.codex/auth.json")}</span>
          </div>
        </div>
        <SyncedTextarea
          className="relay-file-textarea"
          value={profile.authContents}
          onValueChange={(value) => onProfileChange(deriveRelayProfileFromFiles({ ...profile, authContents: value }))}
        />
      </div>
    </div>
  );
}

function ProviderDoctorModal({
  result,
  running,
  onClose,
}: {
  result: ProviderDoctorResult | null;
  running: boolean;
  onClose: () => void;
}) {
  const steps = providerDoctorSteps(result, running);
  const doneCount = steps.filter((step) => step.state === "ok" || step.state === "warning" || step.state === "failed").length;
  const progress = Math.round((doneCount / steps.length) * 100);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card provider-doctor-modal">
        <div className="modal-head">
          <div>
            <h2>Provider Doctor</h2>
            <p>{running ? t("正在诊断供应商，请稍候。") : result?.summary ?? t("诊断已完成。")}</p>
          </div>
          <UiBadge variant={result && !isSuccessStatus(result.status) ? "outline" : "secondary"}>
            {running ? t("诊断中") : result && !isSuccessStatus(result.status) ? t("异常") : t("完成")}
          </UiBadge>
        </div>
        <div className="provider-doctor-progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="provider-doctor-step-list">
          {steps.map((step) => (
            <div className={`provider-doctor-step ${step.state}`} key={step.id}>
              <span className="provider-doctor-step-icon">
                {step.state === "running" ? (
                  <RefreshCw className="h-4 w-4" />
                ) : step.state === "ok" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step.state === "warning" ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : step.state === "failed" ? (
                  <Info className="h-4 w-4" />
                ) : (
                  <span />
                )}
              </span>
              <div>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </div>
            </div>
          ))}
        </div>
        {result?.recommendation ? <p className="provider-doctor-recommendation">{result.recommendation}</p> : null}
        <div className="modal-actions">
          <Button disabled={running} onClick={onClose} variant="secondary">
            {running ? t("诊断中") : t("关闭")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ProviderDoctorStepState = "pending" | "running" | "ok" | "warning" | "failed";

function providerDoctorSteps(
  result: ProviderDoctorResult | null,
  running: boolean,
): Array<{ id: string; title: string; detail: string; state: ProviderDoctorStepState }> {
  const base = [
    { id: "config", title: t("配置完整性"), pending: t("等待检查 Base URL / API Key。") },
    { id: "models", title: t("模型列表"), pending: t("等待检查 /v1/models。") },
    { id: "request", title: t("真实请求"), pending: t("等待发送一次测试请求。") },
    { id: "recommendation", title: t("处理建议"), pending: t("等待生成建议。") },
  ];
  if (!result) {
    return base.map((step, index) => ({
      id: step.id,
      title: step.title,
      detail: index === 0 && running ? t("正在检查配置完整性…") : step.pending,
      state: index === 0 && running ? "running" : "pending",
    }));
  }
  const checks = new Map(result.checks.map((check) => [check.id, check]));
  return base.map((step) => {
    if (step.id === "recommendation") {
      return {
        id: step.id,
        title: step.title,
        detail: result.recommendation || step.pending,
        state: result.status === "failed" ? "warning" : "ok",
      };
    }
    const check = checks.get(step.id);
    if (!check) {
      return {
        id: step.id,
        title: step.title,
        detail: step.id === "models" || step.id === "request" ? t("该步骤未执行。") : step.pending,
        state: "pending",
      };
    }
    return {
      id: step.id,
      title: check.title || step.title,
      detail: check.detail,
      state: check.status === "ok" ? "ok" : check.status === "warning" ? "warning" : "failed",
    };
  });
}

function ProviderSwitchPreflightDialog({
  preflight,
  onConfirm,
  onCancel,
}: {
  preflight: ProviderSwitchPreflight;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card provider-import-modal" style={{ maxWidth: "580px" }}>
        <div className="modal-head">
          <div>
            <h2>{t("供应商切换差异预检")}</h2>
            <p>{preflight.summary}</p>
          </div>
          <button className="toast-close" onClick={onCancel} type="button">×</button>
        </div>
        <div className="preflight-diff-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto", margin: "12px 0" }}>
          {preflight.diffs.map((diff, index) => (
            <div
              key={index}
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                background: "var(--color-bg-subtle, rgba(0,0,0,0.03))",
                border: "1px solid var(--color-border, #eee)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <strong>{diff.label}</strong>
                <span style={{ fontSize: "12px", opacity: 0.65 }}>{diff.category}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", wordBreak: "break-all" }}>
                <code style={{ background: "rgba(220, 53, 69, 0.12)", color: "var(--color-error, #dc3545)", padding: "2px 6px", borderRadius: "4px" }}>
                  {diff.oldValue}
                </code>
                <span>➔</span>
                <code style={{ background: "rgba(40, 167, 69, 0.12)", color: "var(--color-success, #28a745)", padding: "2px 6px", borderRadius: "4px" }}>
                  {diff.newValue}
                </code>
              </div>
            </div>
          ))}
        </div>
        <div className="hint-line" role="note">
          {t("安全提示：切换后配置将立即写入 config.toml 与 auth.json。系统已自动生成回滚快照，切换后可随时一键撤销。")}
        </div>
        <Toolbar>
          <Button onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" />
            {t("确认切换")}
          </Button>
          <Button onClick={onCancel} variant="secondary">{t("取消")}</Button>
        </Toolbar>
      </div>
    </div>
  );
}

export default RelayScreen;
