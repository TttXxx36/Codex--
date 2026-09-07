import { ExternalLink } from "lucide-react";
import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CardContent } from "@/components/ui/card";
import { t, tf } from "@/i18n";
import type { Actions, OverviewResult, UpdateResult } from "../App";
import {
  CardHead,
  formatProgressPercent,
  Metric,
  Panel,
  TaskProgressBox,
  Toolbar,
  type TaskProgress,
} from "./ScreenPrimitives";

export const AboutScreen = memo(function AboutScreen({
  overview,
  update,
  updateInstallProgress,
  diagnosticsScreen,
  actions,
}: {
  overview: OverviewResult | null;
  update: UpdateResult | null;
  updateInstallProgress: TaskProgress;
  diagnosticsScreen: ReactNode;
  actions: Actions;
}) {
  return (
    <>
      <Panel>
        <CardHead title={t("关于 Codex++")} detail={t("本地 Codex 增强、管理工具和安装包维护")} />
        <CardContent>
          <div className="metric-list">
            <Metric label={t("Codex++ 版本")} value={overview?.current_version ?? update?.currentVersion ?? "-"} />
            <Metric label={t("Codex 版本")} value={overview?.codex_version ?? t("未检测到")} />
            <Metric label={t("项目地址")} value="github.com/TttXxx36/Codex--" />
          </div>
          <Toolbar>
            <Button onClick={() => void actions.openExternalUrl("https://github.com/TttXxx36/Codex--")} variant="secondary">
              <ExternalLink className="h-4 w-4" />
              {t("打开项目主页")}
            </Button>
            <Button onClick={() => void actions.openExternalUrl("https://github.com/TttXxx36/Codex--/issues")} variant="secondary">
              <ExternalLink className="h-4 w-4" />
              {t("反馈问题")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
      <Panel>
        <CardHead title={t("GitHub Release 更新")} detail={tf("当前版本 {0}", [overview?.current_version ?? update?.currentVersion ?? "-"])} />
        <CardContent>
          <div className="metric-list">
            <Metric label={t("状态")} value={update?.status ?? "not_checked"} />
            <Metric label={t("最新版本")} value={update?.latestVersion ?? t("未检查")} />
            <Metric label={t("资源")} value={update?.assetName ?? "-"} />
            <Metric label={t("进度")} value={`${formatProgressPercent(update?.progress ?? 0)}%`} />
          </div>
          <Textarea className="log-view" readOnly value={update?.releaseSummary || update?.message || t("尚未检查 GitHub Release；更新会下载并启动安装包。")} />
          <TaskProgressBox completedTitle={t("上次更新结果")} progress={updateInstallProgress} title={t("安装包更新进度")} />
          <Toolbar>
            <Button onClick={() => void actions.checkUpdate()}>{t("检查更新")}</Button>
            <Button disabled={updateInstallProgress.active} variant="secondary" onClick={() => void actions.performUpdate()}>
              {updateInstallProgress.active ? t("正在下载安装包…") : t("下载并运行安装包")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
      {diagnosticsScreen}
    </>
  );
});
export default AboutScreen;
