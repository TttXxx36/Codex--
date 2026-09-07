import { Copy, ExternalLink, RefreshCw, Save, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { t, tf } from "@/i18n";
import {
  zedRemoteHostLabel,
  zedRemoteSourceLabel,
  zedStrategyLabel,
} from "../App";
import type {
  Actions,
  BackendSettings,
  ZedOpenStrategy,
  ZedRemoteProject,
  ZedRemoteProjectsResult,
} from "../App";
import { AppSelect, CardHead, Field, formatTime, Metric, Panel, ToggleVisual, Toolbar } from "./ScreenPrimitives";

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const ZedRemoteScreen = memo(function ZedRemoteScreen({
  projects,
  form,
  onFormChange,
  actions,
}: {
  projects: ZedRemoteProjectsResult | null;
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
  actions: Actions;
}) {
  const allProjects = projects?.projects ?? [];
  const currentProjects = allProjects.filter((project) => project.isCurrent);
  const currentIds = new Set(currentProjects.map((project) => project.id));
  const recentProjects = allProjects.filter((project) => !currentIds.has(project.id) && (project.source === "recent" || project.lastOpenedAtMs));
  const recentIds = new Set(recentProjects.map((project) => project.id));
  const discoveredProjects = allProjects.filter((project) => !currentIds.has(project.id) && !recentIds.has(project.id));
  const copyUrl = async (project: ZedRemoteProject) => {
    try {
      await navigator.clipboard.writeText(project.url);
      await actions.showMessage("Zed Remote URL", t("ssh:// URL 已复制。"), "ok");
    } catch (error) {
      await actions.showMessage(t("复制失败"), stringifyError(error), "failed");
    }
  };
  return (
    <>
      <Panel>
        <CardHead title={t("Zed 远程项目")} detail={tf("{0} 个 Codex++ 可识别项目，默认策略：{1}", [allProjects.length, zedStrategyLabel(form.zedRemoteOpenStrategy)])} />
        <CardContent>
          <div className="metric-list">
            <Metric label="Current" value={String(currentProjects.length)} />
            <Metric label="Recent" value={String(recentProjects.length)} />
            <Metric label="Discovered" value={String(discoveredProjects.length)} />
          </div>
          <div className="zed-remote-settings">
            <Field label={t("默认打开策略")}>
              <AppSelect
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
            <label className="switch-row compact">
              <input
                checked={form.zedRemoteProjectRegistryEnabled}
                onChange={(event) => onFormChange({ ...form, zedRemoteProjectRegistryEnabled: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>
                <strong>{t("记录最近打开")}</strong>
                <small>{t("保存到 Codex++ state，不改写 Zed settings。")}</small>
              </span>
              <ToggleVisual />
            </label>
          </div>
          <Toolbar>
            <Button onClick={() => void actions.refreshZedRemoteProjects()}>
              <RefreshCw className="h-4 w-4" />
              {t("刷新项目")}
            </Button>
            <Button variant="secondary" onClick={() => void actions.saveSettingsValue(form, false)}>
              <Save className="h-4 w-4" />
              {t("保存策略")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
      <ZedRemoteProjectSection title="Current" projects={currentProjects} actions={actions} onCopyUrl={copyUrl} />
      <ZedRemoteProjectSection title="Recent" projects={recentProjects} actions={actions} onCopyUrl={copyUrl} />
      <ZedRemoteProjectSection title="Discovered from Codex" projects={discoveredProjects} actions={actions} onCopyUrl={copyUrl} />
    </>
  );
});

function ZedRemoteProjectSection({
  title,
  projects,
  actions,
  onCopyUrl,
}: {
  title: string;
  projects: ZedRemoteProject[];
  actions: Actions;
  onCopyUrl: (project: ZedRemoteProject) => Promise<void>;
}) {
  return (
    <Panel>
      <CardHead title={title} detail={tf("{0} 个项目", [projects.length])} />
      <CardContent>
        {projects.length ? (
          <div className="zed-remote-project-list">
            {projects.map((project) => (
              <div className="zed-remote-project-row" key={project.id}>
                <div className="zed-remote-project-main">
                  <div>
                    <strong>{project.label}</strong>
                    <span>{zedRemoteHostLabel(project)}</span>
                  </div>
                  <code>{project.path}</code>
                  <small>
                    {zedRemoteSourceLabel(project.source)}
                    {project.lastOpenedAtMs ? ` · ${formatTime(project.lastOpenedAtMs)}` : ""}
                  </small>
                </div>
                <div className="zed-remote-project-actions">
                  <Button onClick={() => void actions.openZedRemoteProject(project, "addToFocusedWorkspace")} size="sm">
                    <ExternalLink className="h-4 w-4" />
                    {t("加入当前工作区")}
                  </Button>
                  <Button onClick={() => void actions.openZedRemoteProject(project, "reuseWindow")} size="sm" variant="outline">
                    {t("复用窗口")}
                  </Button>
                  <Button onClick={() => void actions.openZedRemoteProject(project, "newWindow")} size="sm" variant="outline">
                    {t("新窗口")}
                  </Button>
                  <Button onClick={() => void onCopyUrl(project)} size="icon" title={t("复制 ssh:// URL")} variant="ghost">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {project.source === "recent" ? (
                    <Button onClick={() => void actions.forgetZedRemoteProject(project)} size="icon" title={t("移除最近记录")} variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">{t("暂无项目。")}</div>
        )}
      </CardContent>
    </Panel>
  );
}
export default ZedRemoteScreen;
