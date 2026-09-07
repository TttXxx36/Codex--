import type { ReactNode } from "react";

import { UiBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";

export type LaunchStatus = {
  status: string;
  message: string;
  started_at_ms: number;
  debug_port: number | null;
  helper_port: number | null;
  codex_app: string | null;
};

export type TaskProgress = {
  active: boolean;
  percent: number;
  message: string;
};

export function formatProgressPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return Math.min(100, Math.max(0, value)).toFixed(2);
}

export function formatTime(value: number): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

export function TaskProgressBox({
  progress,
  title,
  completedTitle = t("上次修复结果"),
}: {
  progress: TaskProgress;
  title: string;
  completedTitle?: string;
}) {
  if (!progress.active && progress.percent <= 0) return null;
  return (
    <div className="provider-sync-progress task-progress" data-active={progress.active}>
      <div className="provider-sync-progress-head">
        <strong>{progress.active ? title : completedTitle}</strong>
        <span>{formatProgressPercent(progress.percent)}%</span>
      </div>
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress.percent}
        className="provider-sync-progress-bar"
        role="progressbar"
      >
        <div className="provider-sync-progress-fill" style={{ width: String(progress.percent) + "%" }} />
      </div>
      <small>{progress.message}</small>
    </div>
  );
}

export function Panel({ children, fill = false, className = "" }: { children: ReactNode; fill?: boolean; className?: string }) {
  return (
    <Card className={("panel " + (fill ? "fill " : "") + className).trim()}>
      {children}
    </Card>
  );
}

export function CardHead({ title, detail }: { title: string; detail: string }) {
  return (
    <CardHeader className="panel-head">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{detail}</CardDescription>
    </CardHeader>
  );
}

export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={("toolbar " + className).trim()}>{children}</div>;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    found: t("已找到"),
    missing: t("缺失"),
    installed: t("已安装"),
    ok: t("正常"),
    running: t("运行中"),
    running_degraded: t("运行中（增强等待中）"),
    starting: t("启动中"),
    failed: t("失败"),
    archived: t("已归档"),
    accepted: t("已受理"),
    not_checked: t("未检查"),
    not_implemented: t("未实现"),
    disabled: t("已禁用"),
    unknown: t("未知"),
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (["found", "installed", "ok", "running", "running_degraded"].includes(status)) return "good";
  if (["failed", "missing"].includes(status)) return "bad";
  return "warn";
}

export function Badge({ status }: { status: string }) {
  return <UiBadge className={statusClass(status)} variant="secondary">{statusLabel(status)}</UiBadge>;
}

export function LatestLaunch({ status }: { status: LaunchStatus | null }) {
  if (!status) return <div className="empty">{t("暂无启动状态。")}</div>;
  return (
    <div className="metric-list">
      <Metric label={t("状态")} value={status.status} />
      <Metric label={t("消息")} value={status.message} />
      <Metric label="Debug" value={String(status.debug_port ?? "-")} />
      <Metric label="Helper" value={String(status.helper_port ?? "-")} />
      <Metric label={t("时间")} value={formatTime(status.started_at_ms)} />
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
