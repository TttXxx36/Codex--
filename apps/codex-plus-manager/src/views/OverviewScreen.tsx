import { memo } from "react";
import { Bell, CheckCircle2, RefreshCw, Rocket, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { t } from "@/i18n";

import {
  Badge,
  CardHead,
  LatestLaunch,
  Panel,
  TaskProgressBox,
  Toolbar,
  type LaunchStatus,
  type TaskProgress,
} from "./ScreenPrimitives";

type PathState = {
  status: string;
  path: string | null;
};

type OverviewData = {
  codex_app: PathState;
  codex_version: string | null;
  silent_shortcut: PathState;
  management_shortcut: PathState;
  latest_launch: LaunchStatus | null;
  logs_path: string;
};

type OverviewActions = {
  checkHealth: () => Promise<void>;
  repairShortcuts: () => Promise<void>;
  repairPluginMarketplace: () => Promise<void>;
  launch: () => Promise<void>;
  goLogs: () => Promise<void>;
};

const OverviewScreen = memo(function OverviewScreen({
  overview,
  pluginMarketplaceProgress,
  actions,
}: {
  overview: OverviewData | null;
  pluginMarketplaceProgress: TaskProgress;
  actions: OverviewActions;
}) {
  const health = healthItems(overview);
  return (
    <>
      <Panel>
        <CardHead title={t("健康检查")} detail={t("概览只展示关键问题，具体配置在对应页面处理")} />
        <CardContent>
          <div className="health-grid">
            <div className={"health-item " + (overview?.codex_version ? "ok" : "needs-fix")}>
              {overview?.codex_version ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              <div>
                <strong>{t("Codex 版本")}</strong>
                <span>{overview?.codex_version ?? t("未检测到 Codex 应用版本。")}</span>
              </div>
              <Badge status={overview?.codex_version ? "ok" : "not_checked"} />
            </div>
            {health.map((item) => (
              <div className={"health-item " + (item.ok ? "ok" : "needs-fix")} key={item.title}>
                {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <Badge status={item.status} />
              </div>
            ))}
          </div>
          <Toolbar>
            <Button onClick={() => void actions.checkHealth()}>
              <RefreshCw className="h-4 w-4" />
              {t("检查")}
            </Button>
            <Button variant="secondary" onClick={() => void actions.repairShortcuts()}>
              <Wrench className="h-4 w-4" />
              {t("修复入口")}
            </Button>
            <Button disabled={pluginMarketplaceProgress.active} variant="secondary" onClick={() => void actions.repairPluginMarketplace()}>
              {pluginMarketplaceProgress.active ? t("正在修复…") : t("修复插件市场")}
            </Button>
          </Toolbar>
          <TaskProgressBox progress={pluginMarketplaceProgress} title={t("插件市场修复进度")} />
        </CardContent>
      </Panel>
      <Panel>
        <CardHead title={t("最近启动")} detail={overview?.logs_path ?? t("暂无状态文件")} />
        <CardContent>
          <LatestLaunch status={overview?.latest_launch ?? null} />
          <Toolbar>
            <Button onClick={() => void actions.launch()}>
              <Rocket className="h-4 w-4" />
              {t("启动 Codex++")}
            </Button>
            <Button variant="secondary" onClick={() => void actions.goLogs()}>
              {t("打开关于")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
    </>
  );
});

function healthItems(overview: OverviewData | null) {
  return [
    {
      title: t("Codex 应用"),
      status: overview?.codex_app.status ?? "not_checked",
      ok: overview?.codex_app.status === "found",
      detail: overview?.codex_app.path || t("尚未检查 Codex 应用路径。"),
    },
    {
      title: t("静默启动入口"),
      status: overview?.silent_shortcut.status ?? "not_checked",
      ok: overview?.silent_shortcut.status === "installed",
      detail: overview?.silent_shortcut.path || t("缺少 Codex++ 静默启动快捷方式时可在安装维护页修复。"),
    },
    {
      title: t("管理工具入口"),
      status: overview?.management_shortcut.status ?? "not_checked",
      ok: overview?.management_shortcut.status === "installed",
      detail: overview?.management_shortcut.path || t("缺少管理工具快捷方式时可在安装维护页修复。"),
    },
  ];
}

export default OverviewScreen;
