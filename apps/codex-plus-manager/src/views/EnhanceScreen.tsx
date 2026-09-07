import { Info, Save, ShieldCheck, Wrench } from "lucide-react";
import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { t, tf } from "@/i18n";
import { isWindowsPlatform } from "../App";
import type {
  Actions,
  BackendSettings,
  LaunchMode,
  RemotePluginMarketplaceResult,
} from "../App";
import {
  AppSelect,
  CardHead,
  Field,
  Panel,
  TaskProgressBox,
  ToggleVisual,
  type TaskProgress,
} from "./ScreenPrimitives";

export const EnhanceScreen = memo(function EnhanceScreen({
  dirty,
  form,
  pluginMarketplaceProgress,
  remotePluginMarketplace,
  remotePluginMarketplaceProgress,
  onFormChange,
  actions,
}: {
  dirty: boolean;
  form: BackendSettings;
  pluginMarketplaceProgress: TaskProgress;
  remotePluginMarketplace: RemotePluginMarketplaceResult | null;
  remotePluginMarketplaceProgress: TaskProgress;
  onFormChange: (value: BackendSettings) => void;
  actions: Actions;
}) {
  const setEnhanceFlag = (key: keyof BackendSettings, value: boolean) => onFormChange({ ...form, [key]: value });
  const setPersistedEnhanceFlag = (key: keyof BackendSettings, value: boolean) => {
    const next = { ...form, [key]: value };
    onFormChange(next);
    void actions.saveSettingsValue(next, true);
  };
  const masterEnabled = form.enhancementsEnabled;
  const patchMode = form.launchMode === "patch";
  const remoteMarketplaceStatus = remotePluginMarketplace?.marketplaceRoot
    ? remotePluginMarketplace.configRegistered
      ? t("已注册")
      : t("已缓存未注册")
    : t("未发现缓存");
  const remoteMarketplaceSummary = remotePluginMarketplace?.marketplaceRoot
    ? tf("已缓存 {0} 个插件 / {1} 个技能。", [
        String(remotePluginMarketplace.pluginCount),
        String(remotePluginMarketplace.skillCount),
      ])
    : t("未发现本地缓存；点击按钮会从 Codex++ 内置快照释放并注册，无需官方账号预缓存。");
  return (
    <>
      <Panel className="enhance-panel">
        <CardHead title={t("Codex增强")} detail={t("会话删除、导出和用户脚本等界面能力")} />
        <CardContent className="enhance-content">
          <div className="enhance-control-deck">
            <section className="enhance-control-section">
              <div className="enhance-control-heading">
                <strong>{t("基础设置")}</strong>
              </div>
              <div className="enhance-control-list">
                <label className="switch-row compact">
                  <input
                    checked={form.enhancementsEnabled}
                    onChange={(event) => onFormChange({ ...form, enhancementsEnabled: event.currentTarget.checked })}
                    type="checkbox"
                  />
                  <span>
                    <strong>{t("启用 Codex增强")}</strong>
                    <small>{t("关闭后会停用删除、导出、插件相关和菜单位置增强。")}</small>
                  </span>
                  <ToggleVisual />
                </label>
              </div>
            </section>
            <section className="enhance-control-section enhance-mode-section">
              <div className="enhance-control-heading">
                <strong>{t("Codex增强模式")}</strong>
              </div>
              <ModeSelector launchMode={form.launchMode} actions={actions} />
              {form.launchMode === "relay" ? (
                <div className="hint-line enhance-mode-hint">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{t("当前为兼容增强模式，插件市场解锁不会启用；其他页面功能仍可用。")}</span>
                </div>
              ) : null}
            </section>
          </div>
          <div className="enhance-feature-groups">
            <FeatureGroup title={t("插件与模型")} detail={t("管理插件市场、模型列表和服务档位相关增强。")}>
              <FeatureToggle title={t("插件市场解锁")} detail={t("API Key 模式下扩展插件市场请求，尽量显示完整插件列表；官方/混合模式通常不需要。")} checked={form.codexAppPluginMarketplaceUnlock} disabled={!masterEnabled || !patchMode} onChange={(value) => setEnhanceFlag("codexAppPluginMarketplaceUnlock", value)} />
              <FeatureToggle title={t("模型白名单解锁")} detail={t("从环境变量和 config.toml 的 /v1/models 拉取模型并补进模型列表。")} checked={form.codexAppModelWhitelistUnlock} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppModelWhitelistUnlock", value)} />
              <FeatureToggle title={t("Fast 按钮")} detail={t("显示服务模式切换按钮；Fast 仅支持 gpt-5.4 / gpt-5.5，其他模型按 Standard 发送。")} checked={form.codexAppServiceTierControls} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppServiceTierControls", value)} />
              <div className="feature-action-row">
                <div>
                  <strong>{t("官方远端插件缓存")}</strong>
                  <small>{t("使用 Codex++ 内置快照补齐远端插件，API 模式也可显示和安装 Product Design 插件。")}</small>
                  <small>{remoteMarketplaceSummary}</small>
                </div>
                <Badge status={remotePluginMarketplace?.configRegistered ? "ok" : "not_checked"} />
                <Button
                  disabled={remotePluginMarketplaceProgress.active}
                  onClick={() => void actions.repairRemotePluginMarketplace()}
                  variant="secondary"
                >
                  {remotePluginMarketplaceProgress.active ? t("正在处理…") : t("释放并注册内置缓存")}
                </Button>
                <Button
                  disabled={remotePluginMarketplaceProgress.active}
                  onClick={() => void actions.refreshRemotePluginMarketplace()}
                  variant="outline"
                >
                  {t("刷新")}
                </Button>
                <span className="feature-action-status">{remoteMarketplaceStatus}</span>
              </div>
            </FeatureGroup>
            <FeatureGroup title={t("对话与输入")} detail={t("调整会话管理、输入行为和对话阅读体验。")}>
              <FeatureToggle title={t("会话删除")} detail={t("在会话列表悬停显示删除按钮，并支持撤销。")} checked={form.codexAppSessionDelete} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppSessionDelete", value)} />
              <FeatureToggle title={t("Markdown 导出")} detail={t("在会话列表显示导出按钮，导出带时间戳的 Markdown。")} checked={form.codexAppMarkdownExport} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppMarkdownExport", value)} />
              <FeatureToggle title={t("粘贴修复")} detail={t("从 Word 等富文本粘贴到 Codex composer 时只保留纯文本，避免被识别为图片/文件附件。需重启 Codex 才生效。")} checked={form.codexAppPasteFix} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppPasteFix", value)} />
              <FeatureToggle title={t("会话 ID 标识")} detail={t("在侧边栏会话标题前显示短 ID 和 UUIDv7 创建时间，方便定位历史会话。")} checked={form.codexAppThreadIdBadge} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppThreadIdBadge", value)} />
              <FeatureToggle title={t("对话居中宽度")} detail={t("把主对话和输入框限制到固定最大宽度，适合大屏阅读。")} checked={form.codexAppConversationView} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppConversationView", value)} />
              <FeatureToggle title={t("切换对话保留位置")} detail={t("切换 thread 时恢复上一次浏览位置。")} checked={form.codexAppThreadScrollRestore} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppThreadScrollRestore", value)} />
            </FeatureGroup>
            <FeatureGroup title={t("悬浮球")} detail={t("控制下一步建议与回答大纲。")}>
              <FeatureToggle title="Stepwise" detail={t("根据当前回答生成下一步建议。")} checked={form.codexAppStepwiseEnabled} disabled={!masterEnabled} onChange={(value) => setPersistedEnhanceFlag("codexAppStepwiseEnabled", value)} />
              <FeatureToggle title={t("回答大纲")} detail={t("整理当前回答的结构。")} checked={form.codexAppAnswerOutlineEnabled} disabled={!masterEnabled} onChange={(value) => setPersistedEnhanceFlag("codexAppAnswerOutlineEnabled", value)} />
            </FeatureGroup>
            <FeatureGroup title={t("界面与启动")} detail={t("控制语言、启动速度和 Codex 原生界面调整。")}>
              {isWindowsPlatform ? <FeatureToggle title={t("桌宠跟随真实鼠标")} detail={t("仅支持 V2 桌宠；不会修改宠物文件。将 V2 的 Computer Use 光标朝向动作映射到真实鼠标，V1 开启后安全不生效；拖拽、原生悬停或 Computer Use 活跃时自动让步。")} checked={form.codexAppPetRealMouseLook} disabled={!masterEnabled} onChange={(value) => setPersistedEnhanceFlag("codexAppPetRealMouseLook", value)} /> : null}
              <FeatureToggle title={t("强制中文界面")} detail={t("强制启用 Codex App 内置 zh-CN 语言包，避免 Statsig/VPN 不通时回退英文。需重启 Codex 才能完整生效。")} checked={form.codexAppForceChineseLocale} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppForceChineseLocale", value)} />
              <FeatureToggle title={t("快速启动")} detail={t("默认关闭；无 VPN 时可开启，让 Statsig 初始化快速失败，减少启动时长。需重启 Codex 才生效。")} checked={form.codexAppFastStartup} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppFastStartup", value)} />
              <FeatureToggle title={t("原生菜单汉化")} detail={t("启动时通过本地主进程调试端口汉化 Codex 原生菜单；不修改安装包。需重启 Codex 才生效。")} checked={form.codexAppNativeMenuLocalization} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppNativeMenuLocalization", value)} />
            </FeatureGroup>
            <FeatureGroup title={t("远程项目")} detail={t("连接 Zed Remote 和 upstream worktree 辅助能力。")}>
              <FeatureToggle title="Zed Remote open" detail={t("远程 SSH 文件引用可直接用 Zed Remote Development 打开。")} checked={form.codexAppZedRemoteOpen} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppZedRemoteOpen", value)} />
              <FeatureToggle title={t("Zed 项目记录")} detail={t("维护 Codex++ 自己的远程项目最近列表。")} checked={form.zedRemoteProjectRegistryEnabled} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("zedRemoteProjectRegistryEnabled", value)} />
              <FeatureToggle title={t("同步 Zed settings")} detail={t("高级选项，默认关闭；当前实现不主动改写 Zed settings。")} checked={form.zedRemoteSyncToZedSettings} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("zedRemoteSyncToZedSettings", value)} />
              <FeatureToggle title="Upstream worktree" detail={t("从最新 upstream 分支创建 Git worktree。")} checked={form.codexAppUpstreamWorktreeCreate} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppUpstreamWorktreeCreate", value)} />
              <div className="feature-select-row">
                <Field label={t("Zed 默认打开策略")}>
                  <AppSelect
                    disabled={!masterEnabled}
                    onChange={(value) => onFormChange({ ...form, zedRemoteOpenStrategy: value })}
                    options={[
                      { value: "addToFocusedWorkspace", label: t("加入当前工作区") },
                      { value: "reuseWindow", label: t("复用窗口") },
                      { value: "newWindow", label: t("新窗口") },
                      { value: "default", label: t("Zed 默认行为") },
                    ]}
                    value={form.zedRemoteOpenStrategy}
                  />
                </Field>
              </div>
            </FeatureGroup>
          </div>
          <div className="enhance-utility-row">
            <div>
              <Wrench className="h-4 w-4" />
              <span>{t("新机器没有本地插件市场时，可从 openai/plugins 初始化到当前 CODEX_HOME。")}</span>
            </div>
            <Button disabled={pluginMarketplaceProgress.active} variant="secondary" onClick={() => void actions.repairPluginMarketplace()}>
              {pluginMarketplaceProgress.active ? t("正在修复…") : t("修复插件市场")}
            </Button>
          </div>
          <TaskProgressBox progress={pluginMarketplaceProgress} title={t("插件市场修复进度")} />
          <TaskProgressBox progress={remotePluginMarketplaceProgress} title={t("官方远端插件缓存进度")} />
          <div className="hint-line enhance-footer-hint">
            <Info className="h-4 w-4" />
            <span>{t("如果使用官方模式或官方混入 API 模式，通常不需要开启插件市场解锁。")}</span>
          </div>
          {dirty ? (
            <div className="enhance-save-bar">
              <span>{t("Codex增强")}</span>
              <Button onClick={() => void actions.saveSettings()}>
                <Save className="h-4 w-4" />
                {t("保存增强设置")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Panel>
    </>
  );
});

function ModeSelector({ launchMode, actions }: { launchMode: LaunchMode; actions: Actions }) {
  return (
    <div className="mode-grid">
      <button
        className={`mode-option ${launchMode === "relay" ? "active" : ""}`}
        onClick={() => void actions.setLaunchMode("relay")}
        type="button"
      >
        <strong>{t("兼容增强")}</strong>
        <span>{t("适合官方登录或官方混入 API Key；保留会话删除、导出和用户脚本，关闭插件市场相关增强。")}</span>
      </button>
      <button
        className={`mode-option ${launchMode === "patch" ? "active" : ""}`}
        onClick={() => void actions.setLaunchMode("patch")}
        type="button"
      >
        <strong>{t("完整增强")}</strong>
        <span>{t("适合纯 API；启用插件市场、会话删除导出等全部页面能力。")}</span>
      </button>
    </div>
  );
}

function FeatureGroup({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="feature-group">
      <div className="feature-group-head">
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <div className="feature-switch-grid">{children}</div>
    </section>
  );
}

function FeatureToggle({
  title,
  detail,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`feature-toggle ${disabled ? "disabled" : ""}`}>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ToggleVisual />
    </label>
  );
export default EnhanceScreen;
