import { memo, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { UiBadge } from "@/components/ui/badge";
import { t, tf } from "@/i18n";

import { formatSanitizedDiagnosticReport, parseDiagnosticLogEntries } from "../request-diagnostics";
import { CardHead, Panel, Toolbar } from "./ScreenPrimitives";

type LogsState = {
  path: string;
  text: string;
  lines: number;
  truncated: boolean;
  fileSize: number;
};

type DiagnosticsState = {
  report: string;
};

type DiagnosticsScreenActions = {
  refreshLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
  copyLogs: () => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  copyDiagnostics: () => Promise<void>;
  copyDiagnosticsReport: (text: string) => Promise<void>;
  navigate: (target: "relay" | "settings") => void;
};

export type DiagnosticsScreenProps = {
  diagnostics: DiagnosticsState | null;
  logs: LogsState | null;
  actions: DiagnosticsScreenActions;
};

const DiagnosticsScreen = memo(function DiagnosticsScreen({ diagnostics, logs, actions }: DiagnosticsScreenProps) {
  return (
    <>
      <LogsPanel logs={logs} actions={actions} />
      <DiagnosticsPanel diagnostics={diagnostics} logs={logs} actions={actions} />
    </>
  );
});

function LogsPanel({ logs, actions }: { logs: LogsState | null; actions: DiagnosticsScreenActions }) {
  const lines = splitLogLines(logs?.text ?? "");
  const logDetail = logs
    ? logs.truncated
      ? tf("日志大小 {0}，仅显示末尾 {1} 行", [formatBytes(logs.fileSize), logs.lines])
      : tf("日志大小 {0}", [formatBytes(logs.fileSize)])
    : "";
  return (
    <Panel>
      <CardHead title={t("最近日志")} detail={logs?.path ?? ""} />
      <CardContent>
        {logDetail ? <p className="field-hint">{logDetail}</p> : null}
        <div className="log-lines">
          {lines.length ? (
            lines.map((line, index) => (
              <div className="log-line" key={`${index}-${line.slice(0, 12)}`}>
                <span>{index + 1}</span>
                <code>{line || " "}</code>
              </div>
            ))
          ) : (
            <div className="empty">{t("暂无日志。")}</div>
          )}
        </div>
        <Toolbar>
          <Button onClick={() => void actions.refreshLogs()}>{t("刷新")}</Button>
          <Button variant="secondary" onClick={() => void actions.clearLogs()}>
            {t("清理日志")}
          </Button>
          <Button variant="secondary" onClick={() => void actions.copyLogs()}>
            {t("复制")}
          </Button>
        </Toolbar>
      </CardContent>
    </Panel>
  );
}

function DiagnosticsPanel({
  diagnostics,
  logs,
  actions,
}: {
  diagnostics: DiagnosticsState | null;
  logs: LogsState | null;
  actions: DiagnosticsScreenActions;
}) {
  const [tab, setTab] = useState<"requests" | "report">("requests");
  const [filterErrorOnly, setFilterErrorOnly] = useState(false);

  const requestItems = useMemo(() => {
    return parseDiagnosticLogEntries(logs?.text ?? "", 20);
  }, [logs?.text]);

  const displayedItems = useMemo(() => {
    if (!filterErrorOnly) return requestItems;
    return requestItems.filter((item) => item.isError);
  }, [requestItems, filterErrorOnly]);

  const errorCount = useMemo(() => {
    return requestItems.filter((item) => item.isError).length;
  }, [requestItems]);

  const copySanitized = () => {
    const report = formatSanitizedDiagnosticReport(requestItems);
    void actions.copyDiagnosticsReport(report);
  };

  return (
    <Panel>
      <div className="flex items-center justify-between border-b pb-3 mb-3">
        <div>
          <CardTitle className="text-base font-medium">{t("请求诊断看板与系统报告")}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {t("最近 20 次请求/错误脱敏监视器与一键排查引导，100% 本地脱敏运行")}
          </CardDescription>
        </div>
        <div className="flex gap-1 bg-muted/40 p-1 rounded-md">
          <Button
            size="sm"
            variant={tab === "requests" ? "secondary" : "ghost"}
            onClick={() => setTab("requests")}
          >
            {t("请求与错误看板")}
            {errorCount > 0 ? (
              <UiBadge className="ml-1 px-1.5 py-0 text-xs" variant="destructive">
                {errorCount}
              </UiBadge>
            ) : null}
          </Button>
          <Button
            size="sm"
            variant={tab === "report" ? "secondary" : "ghost"}
            onClick={() => setTab("report")}
          >
            {t("系统诊断报告")}
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4">
        {tab === "requests" ? (
          <div>
            <div className="flex items-center justify-between pb-2 mb-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={!filterErrorOnly ? "secondary" : "outline"}
                  onClick={() => setFilterErrorOnly(false)}
                >
                  {tf("全部 ({0})", [requestItems.length])}
                </Button>
                <Button
                  size="sm"
                  variant={filterErrorOnly ? "secondary" : "outline"}
                  onClick={() => setFilterErrorOnly(true)}
                >
                  {tf("仅看异常 ({0})", [errorCount])}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copySanitized}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {t("复制脱敏诊断")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void actions.refreshLogs()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {t("刷新")}
                </Button>
              </div>
            </div>

            {displayedItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
                {t("暂无近期 API 代理请求或错误记录（离线状态下不产生网络请求）")}
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-md border text-sm transition-colors ${
                      item.isError ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <UiBadge
                          variant={item.isError ? "destructive" : "secondary"}
                          className="font-mono text-xs"
                        >
                          {item.statusCode ? `HTTP ${item.statusCode}` : item.isError ? "FAIL" : "OK"}
                        </UiBadge>
                        <span className="font-semibold text-foreground">{item.relayName}</span>
                        {item.wireApi ? (
                          <UiBadge variant="outline" className="text-xs">
                            {item.wireApi}
                          </UiBadge>
                        ) : null}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{item.timeLabel}</span>
                    </div>

                    <div className="text-xs font-mono text-muted-foreground truncate mb-1" title={item.endpoint}>
                      {item.endpoint || item.event}
                    </div>

                    <div className="flex items-start justify-between gap-2 mt-2 pt-2 border-t border-border/40">
                      <div>
                        <div className="text-xs font-medium text-foreground">{item.errorClassLabel}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.statusDescription}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.remedyTargetRoute === "relay" ? (
                          <Button size="sm" variant="outline" onClick={() => actions.navigate("relay")}>
                            {t("供应商设置")}
                          </Button>
                        ) : null}
                        {item.remedyTargetRoute === "settings" ? (
                          <Button size="sm" variant="outline" onClick={() => actions.navigate("settings")}>
                            {t("通用设置")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t("复制此条脱敏详情")}
                          onClick={() => void actions.copyDiagnosticsReport(JSON.stringify(item.sanitizedDetail, null, 2))}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <Textarea className="log-view tall" readOnly value={diagnostics?.report ?? t("尚未生成诊断报告。")} />
            <Toolbar className="mt-3">
              <Button onClick={() => void actions.refreshDiagnostics()}>{t("重新生成")}</Button>
              <Button variant="secondary" onClick={() => void actions.copyDiagnostics()}>
                {t("复制报告")}
              </Button>
            </Toolbar>
          </div>
        )}
      </CardContent>
    </Panel>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function splitLogLines(text: string) {
  return text.trimEnd().split(/\r?\n/).filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
}

export default DiagnosticsScreen;
