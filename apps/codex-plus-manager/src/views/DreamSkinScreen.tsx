import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Camera,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  Github,
  ImagePlus,
  Info,
  MoreHorizontal,
  PackageOpen,
  Palette,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Store,
  Trash2,
} from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";

import { UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, tf } from "@/i18n";
import {
  dreamSkinCompanionDataUrlLimit,
  dreamSkinCompanionMimeTypes,
  dreamSkinMacPreviewUrl,
  dreamSkinWindowsPreviewUrl,
  isWindowsPlatform,
} from "../App";
import type { Actions, BackendSettings, PendingDreamSkinRestart } from "../App";
import {
  defaultDreamSkinColors,
  defaultDreamSkinTheme,
  type DreamSkinCheck,
  type DreamSkinColors,
  type DreamSkinCommunityResult,
  type DreamSkinCommunityTheme,
  type DreamSkinMarketResult,
  type DreamSkinMarketTheme,
  type DreamSkinRuntimeResult,
  type DreamSkinThemeConfig,
  type DreamSkinThemeDraft,
  type DreamSkinThemeLibrary,
  type DreamSkinThemeSummary,
  type DreamSkinVerificationResult,
} from "../dream-skin";
import { AppSelect, Badge, CardHead, Field, Panel, Toolbar, ToggleVisual } from "./ScreenPrimitives";

export const DreamSkinScreen = memo(function DreamSkinScreen({
  form,
  library,
  market,
  community,
  draft,
  dirty,
  pendingRestart,
  selectedTheme,
  status,
  verification,
  onFormChange,
  onDraftChange,
  actions,
}: {
  form: BackendSettings;
  library: DreamSkinThemeLibrary | null;
  market: DreamSkinMarketResult | null;
  community: DreamSkinCommunityResult | null;
  draft: DreamSkinThemeDraft | null;
  dirty: boolean;
  pendingRestart: PendingDreamSkinRestart | null;
  selectedTheme: string;
  status: DreamSkinRuntimeResult | null;
  verification: DreamSkinVerificationResult | null;
  onFormChange: (value: BackendSettings) => void;
  onDraftChange: (value: DreamSkinThemeDraft | null) => void;
  actions: Actions;
}) {
  const [themeView, setThemeView] = useState<"market" | "community" | "local">("community");
  const companionInputRef = useRef<HTMLInputElement>(null);
  const [companionError, setCompanionError] = useState("");
  const masterEnabled = form.enhancementsEnabled;
  const theme = draft?.config ?? defaultDreamSkinTheme();
  const themeColors = theme.colors ?? defaultDreamSkinColors();
  const customImagePath = draft?.imagePath.trim() ?? "";
  const previewUrl = customImagePath
    ? convertFileSrc(customImagePath)
    : isWindowsPlatform
      ? dreamSkinWindowsPreviewUrl
      : dreamSkinMacPreviewUrl;
  const selectedItem = library?.themes.find((item) => item.key === selectedTheme) ?? null;
  const savedThemeSelected = selectedItem?.kind === "stored";
  const updateTheme = (next: DreamSkinThemeConfig) => {
    if (draft) onDraftChange({ ...draft, config: next });
  };
  const updateThemeText = (
    key: "id" | "name" | "brandSubtitle" | "tagline" | "projectPrefix" | "projectLabel" | "statusText" | "quote",
    value: string,
  ) => updateTheme({ ...theme, [key]: value });
  const updateThemeColor = (key: keyof DreamSkinColors, value: string) => {
    updateTheme({ ...theme, colors: { ...themeColors, [key]: value } });
  };
  const themeAppearance = theme.appearance === "light" || theme.appearance === "dark"
    ? theme.appearance
    : "auto";
  const windowsAccent = typeof theme.palette?.accent === "string" ? theme.palette.accent : "";
  const updateWindowsAccent = (value: string) => {
    const palette = { ...(theme.palette ?? {}) };
    if (value.trim()) palette.accent = value;
    else delete palette.accent;
    const next: DreamSkinThemeConfig = { ...theme, palette };
    if (!Object.keys(palette).length) delete next.palette;
    updateTheme(next);
  };
  const companion = theme.companion;
  const companionDataUrl = typeof companion?.dataUrl === "string" ? companion.dataUrl : "";
  const companionEnabled = Boolean(companionDataUrl) && companion?.enabled !== false;
  const updateCompanion = (patch: Partial<NonNullable<DreamSkinThemeConfig["companion"]>>) => {
    const nextCompanion = {
      dataUrl: companionDataUrl,
      enabled: companion?.enabled ?? true,
      width: companion?.width ?? 96,
      side: companion?.side ?? "right",
      offsetX: companion?.offsetX ?? 0,
      offsetY: companion?.offsetY ?? 4,
      ...patch,
    };
    updateTheme({ ...theme, companion: nextCompanion });
  };
  const clearCompanion = () => {
    const next = { ...theme };
    delete next.companion;
    setCompanionError("");
    updateTheme(next);
  };
  const chooseCompanion = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!dreamSkinCompanionMimeTypes.has(file.type)) {
      setCompanionError(t("仅支持 PNG、JPEG、WebP 或 GIF 图片"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl || dataUrl.length > dreamSkinCompanionDataUrlLimit) {
        setCompanionError(t("图片过大，请选择 180 KB 以内的图片"));
        return;
      }
      setCompanionError("");
      updateCompanion({ dataUrl });
    };
    reader.onerror = () => setCompanionError(t("读取图片失败，请重新选择"));
    reader.readAsDataURL(file);
  };
  const stateLabel = dreamSkinStateLabel(status?.state ?? "not_running");
  const runtimeChecks = status?.checks ?? [];
  const verificationChecks = verification?.checks ?? [];

  return (
    <>
      <Panel className="dream-skin-panel dream-skin-attribution-panel">
        <CardContent className="dream-skin-attribution-content">
          <p className="dream-skin-attribution-line">
            {t("项目来源：Fei-Away/Codex-Dream-Skin · 原作者 Fei-Away · MIT License · 第三方图片需自行确认授权")}
          </p>
        </CardContent>
      </Panel>

      <Panel className="dream-skin-panel">
        <CardHead title={t("运行状态")} detail={t("配置保存在 Codex++，实时操作通过本机回环 CDP 执行")} />
        <CardContent>
          <div className="dream-skin-runtime-grid">
            <label className="switch-row compact">
              <input
                checked={form.codexAppDreamSkinEnabled}
                disabled={!masterEnabled}
                onChange={(event) => onFormChange({
                  ...form,
                  codexAppDreamSkinEnabled: event.currentTarget.checked,
                  codexAppDreamSkinPaused: false,
                })}
                type="checkbox"
              />
              <span>
                <strong>{t("启用 Codex 皮肤")}</strong>
                <small>{t("应用会保存当前图片与主题配置；恢复原始外观不会删除主题。")}</small>
              </span>
              <ToggleVisual />
            </label>
            <div className={`dream-skin-runtime-state is-${status?.state ?? "not_running"}`}>
              {dreamSkinCheckIcon(status?.state === "pass" ? "pass" : status?.state === "fail" ? "fail" : "warning")}
              <span>
                <small>{t("当前状态")}</small>
                <strong>{stateLabel}</strong>
              </span>
              <Badge status={status?.liveApplied ? "ok" : status?.paused ? "disabled" : "not_checked"} />
            </div>
          </div>
          {!masterEnabled ? (
            <div className="hint-line">
              <Info className="h-4 w-4" />
              <span>{t("请先在 Codex增强 页面开启总开关。")}</span>
            </div>
          ) : null}
          <Toolbar>
            <Button disabled={!masterEnabled || !draft} onClick={() => void actions.activateDreamSkinTheme()} title={t("保存并应用主题；需要重启时只会标记为待应用")}>
              <Play className="h-4 w-4" />
              {t("应用皮肤")}
            </Button>
            <Button variant="outline" onClick={() => void actions.restoreDreamSkin()}>
              <RotateCcw className="h-4 w-4" />
              {t("恢复 Codex 外观")}
            </Button>
            <Button size="icon" title={t("刷新状态")} variant="outline" onClick={() => void actions.refreshDreamSkinStatus()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </Toolbar>
          {pendingRestart ? (
            <div className="dream-skin-pending-state" role="status">
              <Rocket className="h-5 w-5" aria-hidden="true" />
              <div>
                <strong>{t("待应用主题")}：{pendingRestart.pendingThemeName}</strong>
                <small>
                  {t("当前运行")}：{pendingRestart.currentThemeName}。{t("配置已保存，可以继续浏览和编辑，稍后重启即可生效。")}
                </small>
              </div>
              <Button onClick={() => void actions.restart()}>
                <Rocket className="h-4 w-4" />
                {t("重启并应用")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Panel>

      <Panel className="dream-skin-panel">
        <CardHead title={t("图片与主题")} detail={t("自定义图片会被导入 Codex++ 托管目录；主题字段与目标项目 theme.json 对齐")} />
        <CardContent>
          <div aria-label={t("主题视图")} className="dream-skin-view-tabs" role="tablist">
            <button
              aria-selected={themeView === "community"}
              className={themeView === "community" ? "is-active" : ""}
              onClick={() => setThemeView("community")}
              role="tab"
              type="button"
            >
              <Github className="h-4 w-4" />
              {t("DreamSkin 社区")}
              <span>{community?.items.length ?? 0}</span>
            </button>
            <button
              aria-selected={themeView === "market"}
              className={themeView === "market" ? "is-active" : ""}
              onClick={() => setThemeView("market")}
              role="tab"
              type="button"
            >
              <Store className="h-4 w-4" />
              {t("主题市场")}
              <span>{market?.themes.length ?? 0}</span>
            </button>
            <button
              aria-selected={themeView === "local"}
              className={themeView === "local" ? "is-active" : ""}
              onClick={() => setThemeView("local")}
              role="tab"
              type="button"
            >
              <Palette className="h-4 w-4" />
              {t("我的主题")}
              <span>{library?.themes.length ?? 0}</span>
            </button>
          </div>

          {themeView === "community" ? (
            <DreamSkinCommunitySection
              community={community}
              actions={actions}
              onInstalled={() => setThemeView("local")}
            />
          ) : themeView === "market" ? (
            <section className="dream-skin-market">
              <div className="dream-skin-library-head">
                <div>
                  <strong>{t("社区主题")}</strong>
                  <small>
                    {market?.updatedAt
                      ? tf("清单更新于 {0}，安装后会保存到“我的主题”。", [market.updatedAt])
                      : t("从 CodexPlusPlus-Themes 仓库加载可安装主题。")}
                  </small>
                </div>
                <Toolbar>
                  <Button onClick={() => void actions.refreshDreamSkinMarket()} variant="secondary">
                    <RefreshCw className="h-4 w-4" />
                    {t("刷新市场")}
                  </Button>
                  <Button onClick={() => void actions.openExternalUrl(market?.repositoryUrl || "https://github.com/BigPizzaV3/CodexPlusPlus-Themes")} variant="outline">
                    <Github className="h-4 w-4" />
                    {t("投稿主题")}
                  </Button>
                </Toolbar>
              </div>
              {market?.cached || market?.warning ? (
                <div className="dream-skin-market-warning">
                  <Info className="h-4 w-4" />
                  <span>{market.warning || t("远程仓库暂不可用，当前显示本地缓存。")}</span>
                </div>
              ) : null}
              {market?.themes.length ? (
                <div className="dream-skin-market-grid">
                  {market.themes.map((item) => (
                    <DreamSkinMarketCard
                      actions={actions}
                      key={item.id}
                      onInstalled={() => setThemeView("local")}
                      theme={item}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  {market?.status === "failed" ? market.message : t("正在加载主题市场…")}
                </div>
              )}
            </section>
          ) : (
            <>
          <section className="dream-skin-theme-library">
            <div className="dream-skin-library-head">
              <div>
                <strong>{t("我的主题")}</strong>
                <small>
                  {pendingRestart
                    ? t("选择其他卡片可继续调整待应用主题；当前界面不会自动重启。")
                    : t("选择卡片只会载入草稿；需要完整切换时会保存为待应用主题。")}
                </small>
              </div>
              <Toolbar>
                <Button variant="outline" onClick={() => void actions.importDreamSkinThemePackage()}>
                  <PackageOpen className="h-4 w-4" />
                  {t("导入主题包")}
                </Button>
                <Button
                  disabled={!masterEnabled || !draft}
                  onClick={() => void actions.activateDreamSkinTheme()}
                  title={t("保存主题；需要重启时不会打断当前操作")}
                >
                  <Play className="h-4 w-4" />
                  {pendingRestart ? t("更新待应用") : t("应用主题")}
                </Button>
              </Toolbar>
            </div>
            <div className="dream-skin-theme-list">
              {(library?.themes ?? []).map((item) => {
                const cardPreview = item.previewPath
                  ? convertFileSrc(item.previewPath)
                  : isWindowsPlatform
                    ? dreamSkinWindowsPreviewUrl
                    : dreamSkinMacPreviewUrl;
                const cardDirty = item.key === selectedTheme && dirty;
                const currentRunning = pendingRestart
                  ? pendingRestart.currentThemeKey === item.key
                  : item.active;
                const pendingApplication = pendingRestart?.pendingThemeKey === item.key;
                return (
                  <article
                    className={`dream-skin-theme-card${item.key === selectedTheme ? " is-selected" : ""}${currentRunning ? " is-current" : ""}${pendingApplication ? " is-pending" : ""}`}
                    key={item.key}
                  >
                    <button
                      className="dream-skin-theme-select"
                      onClick={() => actions.selectDreamSkinTheme(item)}
                      type="button"
                    >
                      <span className="dream-skin-theme-image">
                        <img alt={item.name} loading="lazy" src={cardPreview} />
                        {currentRunning || pendingApplication ? (
                          <span className="dream-skin-theme-badges">
                            {currentRunning ? <b>{t("当前运行")}</b> : null}
                            {pendingApplication ? <b className="is-pending">{t("待应用")}</b> : null}
                          </span>
                        ) : null}
                      </span>
                      <span className="dream-skin-theme-copy">
                        <strong title={item.name}>{item.name}</strong>
                        <small>
                          {item.builtin
                            ? t("内置主题")
                            : item.kind === "activeUnsaved"
                              ? t("当前未保存主题")
                              : t("用户主题")}
                        </small>
                      </span>
                      {item.modified || cardDirty ? <em>{t("已修改")}</em> : null}
                    </button>
                    {item.kind === "stored" ? (
                      <details className="dream-skin-theme-menu">
                        <summary title={t("主题操作")}><MoreHorizontal className="h-4 w-4" /></summary>
                        <div>
                          <button onClick={() => void actions.renameDreamSkinTheme(item)} type="button">
                            <Edit3 className="h-4 w-4" />
                            {t("重命名")}
                          </button>
                          <button disabled={item.active || currentRunning} onClick={() => void actions.deleteDreamSkinTheme(item)} type="button">
                            <Trash2 className="h-4 w-4" />
                            {t("删除")}
                          </button>
                        </div>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {!library ? <p className="empty">{t("正在加载主题库…")}</p> : null}
          </section>

          <details className="dream-skin-customizer">
            <summary>
              <span className="dream-skin-customizer-title">
                <Settings className="h-4 w-4" />
                <span>
                  <strong>{t("自定义主题")}</strong>
                  <small>{t("图片、文字和配色等高级编辑项")}</small>
                </span>
              </span>
              <em className={dirty ? "is-dirty" : ""}>{dirty ? t("有未保存修改") : t("按需展开")}</em>
            </summary>
            <div className="dream-skin-customizer-content">
              <div className="dream-skin-customizer-actions">
                <Button variant="secondary" onClick={() => void actions.createDreamSkinTheme()}>
                  <ImagePlus className="h-4 w-4" />
                  {t("从图片创建")}
                </Button>
              </div>

              <div className="dream-skin-platform-note">
                <Info className="h-4 w-4" />
                <span>
                  {isWindowsPlatform
                    ? t("Windows 使用亮暗模式、图片取色和可选强调色；完整色板仅在 macOS 生效。")
                    : t("macOS 会应用主题中的图片、文字和颜色配置。")}
                </span>
              </div>

              <div className="dream-skin-companion-controls">
                <div className="dream-skin-companion-heading">
                  <div>
                    <strong>{t("输入框旁照片")}</strong>
                    <small>{t("为主题选择一张显示在 Codex 输入框旁的自定义照片")}</small>
                  </div>
                  {companionDataUrl ? (
                    <img alt={t("输入框旁照片预览")} src={companionDataUrl} />
                  ) : null}
                </div>
                <input
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={chooseCompanion}
                  ref={companionInputRef}
                  type="file"
                />
                <Toolbar>
                  <Button onClick={() => companionInputRef.current?.click()} type="button" variant="secondary">
                    <Camera className="h-4 w-4" />
                    {companionDataUrl ? t("更换照片") : t("选择照片")}
                  </Button>
                  <Button disabled={!companionDataUrl} onClick={clearCompanion} type="button" variant="outline">
                    <Trash2 className="h-4 w-4" />
                    {t("清除照片")}
                  </Button>
                </Toolbar>
                {companionError ? <small className="dream-skin-companion-error">{companionError}</small> : null}
                <div className="dream-skin-companion-fields">
                  <label className="switch-row compact">
                    <input
                      checked={companionEnabled}
                      disabled={!companionDataUrl}
                      onChange={(event) => updateCompanion({ enabled: event.currentTarget.checked })}
                      type="checkbox"
                    />
                    <span>
                      <strong>{t("显示在输入框旁")}</strong>
                      <small>{t("应用主题后显示在输入框的左侧或右侧")}</small>
                    </span>
                    <ToggleVisual />
                  </label>
                  <Field label={t("照片宽度") }>
                    <Input
                      disabled={!companionDataUrl}
                      inputMode="numeric"
                      max={160}
                      min={48}
                      type="number"
                      value={companion?.width ?? 96}
                      onChange={(event) => updateCompanion({ width: Math.max(48, Math.min(160, Number(event.currentTarget.value) || 96)) })}
                    />
                  </Field>
                  <Field label={t("显示位置") }>
                    <AppSelect
                      disabled={!companionDataUrl}
                      value={companion?.side ?? "right"}
                      onChange={(value) => updateCompanion({ side: value })}
                      options={[
                        { value: "auto", label: t("自动") },
                        { value: "left", label: t("左侧") },
                        { value: "right", label: t("右侧") },
                      ]}
                    />
                  </Field>
                  <Field label={t("水平偏移") }>
                    <Input
                      disabled={!companionDataUrl}
                      inputMode="numeric"
                      max={48}
                      min={-48}
                      type="number"
                      value={companion?.offsetX ?? 0}
                      onChange={(event) => updateCompanion({ offsetX: Math.max(-48, Math.min(48, Number(event.currentTarget.value) || 0)) })}
                    />
                  </Field>
                  <Field label={t("垂直偏移") }>
                    <Input
                      disabled={!companionDataUrl}
                      inputMode="numeric"
                      max={160}
                      min={-160}
                      type="number"
                      value={companion?.offsetY ?? 4}
                      onChange={(event) => updateCompanion({ offsetY: Math.max(-160, Math.min(160, Number(event.currentTarget.value) || 0)) })}
                    />
                  </Field>
                </div>
              </div>

              <div className="dream-skin-editor-layout">
                <div className="dream-skin-media-editor">
                  <div
                    className="dream-skin-preview"
                    style={isWindowsPlatform ? undefined : { backgroundColor: themeColors.background }}
                  >
                    <img alt={t("Dream Skin 图片预览")} src={previewUrl} />
                    <span style={isWindowsPlatform ? undefined : { backgroundColor: themeColors.panel, color: themeColors.text }}>
                      <strong>{theme.name}</strong>
                      <small style={isWindowsPlatform ? undefined : { color: themeColors.muted }}>{customImagePath ? t("自定义托管图片") : t("目标项目默认图片")}</small>
                    </span>
                  </div>
                  <Field label={t("托管图片路径")}>
                    <Input
                      readOnly
                      placeholder={t("使用目标项目默认图片")}
                      value={draft?.imagePath ?? ""}
                    />
                  </Field>
                  <Toolbar>
                    <Button variant="secondary" onClick={() => void actions.chooseDreamSkinImagePath()}>
                      <Camera className="h-4 w-4" />
                      {t("导入图片")}
                    </Button>
                    <Button
                      disabled={!customImagePath}
                      variant="outline"
                      onClick={() => void actions.resetDreamSkinImage()}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("恢复默认图片")}
                    </Button>
                  </Toolbar>
                </div>

                <div className="dream-skin-theme-fields">
                  <div className="dream-skin-text-grid">
                    <Field label={t("主题 ID")}><Input readOnly={draft?.builtin || savedThemeSelected} value={theme.id} onChange={(event) => updateThemeText("id", event.currentTarget.value)} /></Field>
                    <Field label={t("主题名称")}><Input value={theme.name} onChange={(event) => updateThemeText("name", event.currentTarget.value)} /></Field>
                    <Field label={t("品牌副标题")}><Input value={theme.brandSubtitle} onChange={(event) => updateThemeText("brandSubtitle", event.currentTarget.value)} /></Field>
                    <Field label={t("主题标语")}><Input value={theme.tagline} onChange={(event) => updateThemeText("tagline", event.currentTarget.value)} /></Field>
                    <Field label={t("项目前缀")}><Input value={theme.projectPrefix} onChange={(event) => updateThemeText("projectPrefix", event.currentTarget.value)} /></Field>
                    <Field label={t("项目按钮文字")}><Input value={theme.projectLabel} onChange={(event) => updateThemeText("projectLabel", event.currentTarget.value)} /></Field>
                    <Field label={t("状态文字")}><Input value={theme.statusText} onChange={(event) => updateThemeText("statusText", event.currentTarget.value)} /></Field>
                    <Field label={t("引用文字")}><Input value={theme.quote} onChange={(event) => updateThemeText("quote", event.currentTarget.value)} /></Field>
                  </div>
                  {isWindowsPlatform ? (
                    <div className="dream-skin-windows-theme-controls">
                      <Field label={t("外观模式")}>
                        <div aria-label={t("外观模式")} className="segmented dream-skin-appearance-options" role="group">
                          {([
                            ["auto", t("自动")],
                            ["light", t("亮色")],
                            ["dark", t("暗色")],
                          ] as const).map(([value, label]) => (
                            <button
                              aria-pressed={themeAppearance === value}
                              className={themeAppearance === value ? "active" : ""}
                              key={value}
                              onClick={() => updateTheme({ ...theme, appearance: value })}
                              type="button"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <div className="dream-skin-windows-accent">
                        <DreamSkinColorField
                          label={t("强调色")}
                          value={windowsAccent}
                          onChange={updateWindowsAccent}
                        />
                        <Button
                          disabled={!windowsAccent.trim()}
                          onClick={() => updateWindowsAccent("")}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t("跟随图片配色")}
                        </Button>
                      </div>
                      <small className="dream-skin-windows-theme-note">
                        {t("亮暗模式直接控制 Codex 外观；强调色留空时自动从主题图片提取。")}
                      </small>
                    </div>
                  ) : (
                    <div className="dream-skin-colors">
                      {dreamSkinColorFields().map(([key, label]) => (
                        <DreamSkinColorField
                          key={key}
                          label={label}
                          value={String(themeColors[key])}
                          onChange={(value) => updateThemeColor(key, value)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Toolbar>
                <Button disabled={!draft} onClick={() => void actions.saveDreamSkinTheme()}>
                  <Save className="h-4 w-4" />
                  {draft?.builtin || selectedItem?.kind === "activeUnsaved" ? t("保存为新主题") : t("保存主题")}
                </Button>
                <Button variant="outline" onClick={() => void actions.resetDreamSkinTheme()}>
                  <RotateCcw className="h-4 w-4" />
                  {isWindowsPlatform ? t("恢复 Codex 默认配色") : t("恢复 Dream Skin 默认主题")}
                </Button>
              </Toolbar>
            </div>
          </details>
            </>
          )}
        </CardContent>
      </Panel>

      <Panel className="dream-skin-panel">
        <CardHead title={t("诊断与验证")} detail={t("检查官方应用身份、CDP renderer、目标样式和页面布局")} />
        <CardContent>
          <div className="dream-skin-diagnostics-grid">
            <DreamSkinCheckList title={t("运行诊断")} checks={runtimeChecks} emptyText={t("刷新状态后显示运行诊断。")}/>
            <DreamSkinCheckList title={t("最近实机验证")} checks={verificationChecks} emptyText={t("运行实机验证后显示页面检查结果。")}/>
          </div>
          {verification ? (
            <div className="dream-skin-verification-meta">
              <span><small>{t("注入版本")}</small><code>{verification.version || t("未检测到")}</code></span>
              <span><small>{t("截图路径")}</small><code>{verification.screenshotPath || t("未保存截图")}</code></span>
            </div>
          ) : null}
          <Toolbar>
            <Button variant="secondary" onClick={() => void actions.refreshDreamSkinStatus()}>
              <RefreshCw className="h-4 w-4" />
              {t("刷新诊断")}
            </Button>
            <Button onClick={() => void actions.verifyDreamSkin()}>
              <ShieldCheck className="h-4 w-4" />
              {t("实机验证")}
            </Button>
            <Button variant="outline" onClick={() => void actions.saveDreamSkinScreenshot()}>
              <Camera className="h-4 w-4" />
              {t("保存截图")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
    </>
  );
});

function DreamSkinColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="dream-skin-color-field" label={label}>
      <span className="dream-skin-color-control">
        <input
          aria-label={label}
          type="color"
          value={dreamSkinPickerColor(value)}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
        />
        <Input value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      </span>
    </Field>
  );
}

function DreamSkinMarketCard({
  theme,
  actions,
  onInstalled,
}: {
  theme: DreamSkinMarketTheme;
  actions: Actions;
  onInstalled: () => void;
}) {
  const status = theme.updateAvailable
    ? t("可更新")
    : theme.installed
      ? theme.installedVersion
        ? tf("已安装 {0}", [theme.installedVersion])
        : t("已安装")
      : t("未安装");
  return (
    <article className="dream-skin-market-card">
      <div className="dream-skin-market-preview">
        <img
          alt={theme.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = isWindowsPlatform ? dreamSkinWindowsPreviewUrl : dreamSkinMacPreviewUrl;
          }}
          src={theme.previewUrl}
        />
        <UiBadge variant={theme.updateAvailable ? "default" : theme.installed ? "secondary" : "outline"}>{status}</UiBadge>
      </div>
      <div className="dream-skin-market-copy">
        <div className="dream-skin-market-title">
          <strong title={theme.name}>{theme.name}</strong>
          <span>v{theme.version}</span>
        </div>
        <small>{tf("作者：{0} · {1}", [theme.author, theme.license])}</small>
        <p>{theme.description || t("暂无主题说明。")}</p>
        <div className="dream-skin-market-tags">
          {theme.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>
      <div className="dream-skin-market-actions">
        <Button
          onClick={async () => {
            if (await actions.installDreamSkinMarketTheme(theme)) onInstalled();
          }}
          size="sm"
        >
          <Download className="h-4 w-4" />
          {theme.updateAvailable ? t("更新") : theme.installed ? t("重新安装") : t("安装")}
        </Button>
        <Button onClick={() => void actions.openExternalUrl(theme.sourceUrl)} size="sm" variant="outline">
          <ExternalLink className="h-4 w-4" />
          {t("来源")}
        </Button>
      </div>
    </article>
  );
}

function DreamSkinCommunitySection({
  community,
  actions,
  onInstalled,
}: {
  community: DreamSkinCommunityResult | null;
  actions: Actions;
  onInstalled: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "popular" | "name">("latest");
  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = (community?.items ?? []).filter((item) => {
      if (!normalized) return true;
      return [item.name, item.authorDisplayName, item.themeId, item.license]
        .some((value) => value.toLowerCase().includes(normalized));
    });
    return [...filtered].sort((left, right) => {
      if (sort === "popular") return right.downloadCount - left.downloadCount;
      if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
      return right.reviewedAt.localeCompare(left.reviewedAt);
    });
  }, [community?.items, query, sort]);

  return (
    <section className="dream-skin-community">
      <div className="dream-skin-library-head">
        <div>
          <strong>{t("DreamSkin 社区主题")}</strong>
          <small>
            {community?.total
              ? tf("来自 DreamSkin.cc 的已审核主题，共 {0} 套；安装前仍会在本机再次校验。", [String(community.total)])
              : t("从 DreamSkin.cc 加载已审核主题包。")}
          </small>
        </div>
        <Toolbar>
          <Button onClick={() => void actions.refreshDreamSkinCommunity()} variant="secondary">
            <RefreshCw className="h-4 w-4" />
            {t("刷新社区")}
          </Button>
          <Button onClick={() => void actions.openExternalUrl("https://dreamskin.cc/gallery")} variant="outline">
            <ExternalLink className="h-4 w-4" />
            {t("在线主题库")}
          </Button>
          <Button onClick={() => void actions.openExternalUrl("https://dreamskin.cc/studio")} variant="outline">
            <Palette className="h-4 w-4" />
            {t("在线 Studio")}
          </Button>
        </Toolbar>
      </div>
      {community?.warning ? (
        <div className="dream-skin-market-warning">
          <Info className="h-4 w-4" />
          <span>{community.warning}</span>
        </div>
      ) : null}
      <div className="dream-skin-community-controls">
        <Input
          aria-label={t("搜索社区主题")}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("搜索主题名称、作者或许可证")}
          value={query}
        />
        <AppSelect
          onChange={(value) => setSort(value as typeof sort)}
          options={[
            { value: "latest", label: t("最新审核") },
            { value: "popular", label: t("下载最多") },
            { value: "name", label: t("名称排序") },
          ]}
          title={t("社区主题排序")}
          value={sort}
        />
      </div>
      {items.length ? (
        <div className="dream-skin-community-grid">
          {items.map((item) => (
            <DreamSkinCommunityCard
              actions={actions}
              key={item.id}
              onInstalled={onInstalled}
              theme={item}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          {!community
            ? t("正在加载 DreamSkin 社区…")
            : community.status === "failed"
              ? community.message
              : query.trim()
                ? t("没有匹配的社区主题。")
                : t("DreamSkin 社区暂时没有可用主题。")}
        </div>
      )}
    </section>
  );
}

function DreamSkinCommunityCard({
  theme,
  actions,
  onInstalled,
}: {
  theme: DreamSkinCommunityTheme;
  actions: Actions;
  onInstalled: () => void;
}) {
  const status = theme.updateAvailable
    ? t("可更新")
    : theme.installed
      ? tf("已安装 {0}", [theme.installedVersion])
      : t("未安装");
  const packageSize = theme.packageBytes >= 1024 * 1024
    ? `${(theme.packageBytes / 1024 / 1024).toFixed(1)} MiB`
    : `${Math.ceil(theme.packageBytes / 1024)} KiB`;
  return (
    <article className="dream-skin-community-card">
      <div className="dream-skin-community-preview">
        <img
          alt={theme.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = isWindowsPlatform ? dreamSkinWindowsPreviewUrl : dreamSkinMacPreviewUrl;
          }}
          src={theme.previewUrl}
        />
        <UiBadge variant={theme.updateAvailable ? "default" : theme.installed ? "secondary" : "outline"}>{status}</UiBadge>
      </div>
      <div className="dream-skin-community-copy">
        <div className="dream-skin-market-title">
          <strong title={theme.name}>{theme.name}</strong>
          <span>v{theme.version}</span>
        </div>
        <small>{tf("作者：{0} · {1} · {2} 次下载", [theme.authorDisplayName, theme.license, String(theme.downloadCount)])}</small>
        <small>{tf("主题包：{0}", [packageSize])}</small>
      </div>
      <div className="dream-skin-community-actions">
        <Button
          disabled={!theme.applyCompatible}
          onClick={async () => {
            if (await actions.installDreamSkinCommunityTheme(theme)) onInstalled();
          }}
          size="sm"
          title={theme.applyCompatible ? t("下载、校验并安装主题包") : t("此主题仅支持在线预览或下载")}
        >
          <Download className="h-4 w-4" />
          {theme.updateAvailable ? t("更新") : theme.installed ? t("重新安装") : t("安装")}
        </Button>
        <Button onClick={() => void actions.openExternalUrl(`https://dreamskin.cc/preview?themeVersion=${encodeURIComponent(theme.id)}`)} size="sm" variant="outline">
          <Eye className="h-4 w-4" />
          {t("预览")}
        </Button>
      </div>
    </article>
  );
}

function DreamSkinCheckList({ title, checks, emptyText }: { title: string; checks: DreamSkinCheck[]; emptyText: string }) {
  return (
    <section className="dream-skin-check-section">
      <strong>{title}</strong>
      <div className="dream-skin-check-list">
        {checks.length ? checks.map((check) => (
          <div className={`dream-skin-check is-${check.level}`} key={`${title}-${check.id}`}>
            {dreamSkinCheckIcon(check.level)}
            <span>
              <strong>{check.label}</strong>
              <small>{check.message}</small>
            </span>
            <b>{dreamSkinCheckLevelLabel(check.level)}</b>
          </div>
        )) : <p className="empty">{emptyText}</p>}
      </div>
    </section>
  );
}

function dreamSkinColorFields(): Array<[keyof DreamSkinColors, string]> {
  return [
    ["background", t("背景色")],
    ["panel", t("面板色")],
    ["panelAlt", t("次级面板色")],
    ["accent", t("强调色")],
    ["accentAlt", t("次级强调色")],
    ["secondary", t("辅助色")],
    ["highlight", t("高亮色")],
    ["text", t("文字色")],
    ["muted", t("弱化文字色")],
    ["line", t("边线色")],
  ];
}

function dreamSkinPickerColor(value: string): string {
  const color = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);
  if (hex) {
    const digits = hex[1];
    return digits.length === 3
      ? `#${digits.split("").map((part) => `${part}${part}`).join("")}`
      : `#${digits.slice(0, 6)}`;
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(color);
  if (!rgb) return "#808080";
  const channel = (raw: string) => Math.max(0, Math.min(255, Math.round(Number(raw)))).toString(16).padStart(2, "0");
  return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
}

function dreamSkinCheckIcon(level: "pass" | "warning" | "fail") {
  if (level === "pass") return <CheckCircle2 aria-hidden="true" className="h-4 w-4" />;
  if (level === "fail") return <ShieldAlert aria-hidden="true" className="h-4 w-4" />;
  return <Info aria-hidden="true" className="h-4 w-4" />;
}

function dreamSkinCheckLevelLabel(level: "pass" | "warning" | "fail"): string {
  if (level === "pass") return t("通过");
  if (level === "fail") return t("失败");
  return t("警告");
}

function dreamSkinStateLabel(state: "pass" | "warning" | "fail" | "not_running"): string {
  if (state === "pass") return t("已应用并通过检查");
  if (state === "warning") return t("需要处理");
  if (state === "fail") return t("验证失败");
  return t("Codex 未运行或不可连接");
}
export default DreamSkinScreen;
