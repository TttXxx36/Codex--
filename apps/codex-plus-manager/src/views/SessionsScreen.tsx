import { memo, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Info, PackageOpen, RefreshCw, Save, Search, Trash2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, tf } from "@/i18n";

import { searchLocalSessions } from "../session-search";
import { AppSelect, Badge, CardHead, Field, Panel, ToggleVisual, formatProgressPercent, formatTime } from "./ScreenPrimitives";

type LocalSession = {
  id: string;
  title: string;
  cwd: string;
  modelProvider: string;
  archived: boolean;
  updatedAtMs: number | null;
  rolloutPath: string;
  dbPath: string;
};

type LocalSessionsState = {
  dbPath: string;
  sessions: LocalSession[];
  offset: number;
  limit: number;
  hasMore: boolean;
  totalCount: number;
};

type ProviderSyncProgressState = {
  active: boolean;
  percent: number;
  message: string;
};

type ProviderSyncTarget = {
  id: string;
  sources: string[];
  isCurrentProvider: boolean;
};

type ProviderSyncTargetsState = {
  targets: ProviderSyncTarget[];
};

type SessionSettings = {
  providerSyncEnabled: boolean;
};

type SessionsScreenActions = {
  refreshLocalSessions: (silent?: boolean, offset?: number) => Promise<LocalSessionsState | null>;
  importLocalSession: () => Promise<void>;
  syncProvidersNow: () => Promise<void>;
  saveSettings: () => Promise<void>;
  setProviderSyncTarget: (provider: string) => void;
  sessionShareUrl: string;
  setSessionShareUrl: (url: string) => void;
  importSessionUrl: (url?: string) => Promise<void>;
  deleteLocalSession: (session: LocalSession) => Promise<void>;
  deleteLocalSessions: (sessions: LocalSession[]) => Promise<void>;
};

export type SessionsScreenProps = {
  form: SessionSettings;
  sessions: LocalSessionsState | null;
  providerSyncProgress: ProviderSyncProgressState;
  providerSyncTargets: ProviderSyncTargetsState | null;
  selectedProviderSyncTarget: string;
  onProviderSyncEnabledChange: (enabled: boolean) => void;
  actions: SessionsScreenActions;
};

const providerSyncSourceLabels: Record<string, string> = {
  config: t("配置"),
  rollout: t("会话"),
  sqlite: t("索引"),
  manual: t("手动"),
};

function providerSyncTargetLabel(target: ProviderSyncTarget): string {
  const labels = target.sources.map((source) => providerSyncSourceLabels[source]).filter(Boolean);
  const current = target.isCurrentProvider ? [t("当前")] : [];
  return [...labels, ...current].join(" / ") || t("发现");
}

const SessionsScreen = memo(function SessionsScreen({
  form,
  sessions,
  providerSyncProgress,
  providerSyncTargets,
  selectedProviderSyncTarget,
  onProviderSyncEnabledChange,
  actions,
}: SessionsScreenProps) {
  const items = sessions?.sessions ?? [];
  const pageOffset = sessions?.offset ?? 0;
  const pageSize = sessions?.limit ?? 50;
  const currentPage = Math.floor(pageOffset / pageSize) + 1;
  const hasPreviousPage = pageOffset > 0;
  const hasNextPage = sessions?.hasMore === true;
  const activeCount = items.filter((item) => !item.archived).length;
  const archivedCount = items.length - activeCount;
  const totalCount = sessions?.totalCount ?? items.length;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const filteredItems = useMemo<LocalSession[]>(() => {
    return searchLocalSessions(items, {
      query: searchQuery,
      filterStatus: statusFilter,
    }) as LocalSession[];
  }, [items, searchQuery, statusFilter]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectedSessions = useMemo(() => filteredItems.filter((session) => selectedSessionIds.has(session.id)), [filteredItems, selectedSessionIds]);
  const selectedCount = selectedSessions.length;
  const allSelected = filteredItems.length > 0 && selectedCount === filteredItems.length;

  useEffect(() => {
    const itemIds = new Set(items.map((session) => session.id));
    setSelectedSessionIds((current) => {
      const next = new Set(Array.from(current).filter((id) => itemIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleSessionSelection = (sessionId: string, checked: boolean) => {
    setSelectedSessionIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  };

  const selectAllSessions = () => {
    setSelectionMode(true);
    setSelectedSessionIds(new Set(items.map((session) => session.id)));
  };

  const clearSelectedSessions = () => setSelectedSessionIds(new Set());

  const deleteSelectedSessions = async () => {
    if (!selectionMode) {
      setSelectionMode(true);
      return;
    }
    setBulkDeleting(true);
    try {
      await actions.deleteLocalSessions(selectedSessions);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <Panel className="sessions-overview-panel">
        <CardHead title={t("会话管理")} detail={t("读取 Codex 本地 SQLite 会话库，会删除数据库记录和对应 rollout 文件")} />
        <CardContent className="sessions-overview-content">
          <div className="session-summary-bar">
            <div>
              <span>{t("会话总数")}</span>
              <strong>{tf("{0} 个", [totalCount])}</strong>
            </div>
            <div>
              <span>{t("当前页会话")}</span>
              <strong>{tf("{0} 个", [items.length])}</strong>
            </div>
            <div>
              <span>{t("当前页未归档")}</span>
              <strong>{tf("{0} 个", [activeCount])}</strong>
            </div>
            <div>
              <span>{t("当前页已归档")}</span>
              <strong>{tf("{0} 个", [archivedCount])}</strong>
            </div>
            <div className="session-summary-path">
              <span>{t("数据库")}</span>
              <code>{sessions?.dbPath ?? "~/.codex/sqlite/*.db"}</code>
            </div>
          </div>

          <div className="session-repair-tools">
            <Field className="session-sync-target" label={t("同步目标")}>
              <AppSelect
                disabled={providerSyncProgress.active || !(providerSyncTargets?.targets ?? []).length}
                value={selectedProviderSyncTarget}
                onChange={(value) => actions.setProviderSyncTarget(value)}
                options={
                  (providerSyncTargets?.targets ?? []).length
                    ? (providerSyncTargets?.targets ?? []).map((target) => ({
                        value: target.id,
                        label: `${target.id}${t("（")}${providerSyncTargetLabel(target)}${t("）")}`,
                      }))
                    : [{ value: "", label: t("当前配置 provider"), disabled: true }]
                }
              />
            </Field>

            <label className="switch-row compact session-auto-repair">
              <input
                checked={form.providerSyncEnabled}
                onChange={(event) => onProviderSyncEnabledChange(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                <strong>{t("启动前自动修复历史会话")}</strong>
                <small>{t("启动 Codex 前整理旧对话的归属标记。")}</small>
              </span>
              <ToggleVisual />
            </label>

            <div className="session-repair-actions">
              <Button onClick={() => void actions.refreshLocalSessions()} variant="outline">
                <RefreshCw className="h-4 w-4" />
                {t("刷新会话")}
              </Button>
              <Button onClick={() => void actions.importLocalSession()} variant="outline">
                <PackageOpen className="h-4 w-4" />
                {t("导入文件")}
              </Button>
              <Button disabled={providerSyncProgress.active} onClick={() => void actions.syncProvidersNow()} variant="outline">
                <Wrench className="h-4 w-4" />
                {providerSyncProgress.active ? t("正在修复…") : t("修复历史会话")}
              </Button>
              <Button onClick={() => void actions.saveSettings()}>
                <Save className="h-4 w-4" />
                {t("保存设置")}
              </Button>
            </div>
            <div className="session-share-import">
              <Input
                aria-label={t("会话分享链接")}
                onChange={(event) => actions.setSessionShareUrl(event.currentTarget.value)}
                placeholder={t("粘贴 Codex++ 会话分享链接")}
                value={actions.sessionShareUrl}
              />
              <Button disabled={!actions.sessionShareUrl.trim()} onClick={() => void actions.importSessionUrl()} variant="outline">
                <Download className="h-4 w-4" />
                {t("导入链接")}
              </Button>
            </div>
          </div>

          {providerSyncProgress.active || providerSyncProgress.percent > 0 ? (
            <div className="provider-sync-progress session-repair-progress" data-active={providerSyncProgress.active}>
              <div className="provider-sync-progress-head">
                <strong>{providerSyncProgress.active ? t("正在修复历史会话") : t("历史会话修复进度")}</strong>
                <span>{formatProgressPercent(providerSyncProgress.percent)}%</span>
              </div>
              <div
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={providerSyncProgress.percent}
                className="provider-sync-progress-bar"
                role="progressbar"
              >
                <div className="provider-sync-progress-fill" style={{ width: `${providerSyncProgress.percent}%` }} />
              </div>
              <small>{providerSyncProgress.message}</small>
            </div>
          ) : null}

          <div className="hint-line session-delete-hint">
            <Info className="h-4 w-4" />
            <span>{t("删除会创建本地备份；如果 Codex App 正在使用该会话，建议先关闭对应会话窗口再操作。")}</span>
          </div>
        </CardContent>
      </Panel>
      <Panel className="sessions-list-panel">
        <CardHead
          title={t("本地会话")}
          detail={sessions ? tf("第 {0} 页，每页最多 {1} 条，按更新时间倒序显示", [currentPage, pageSize]) : t("点击刷新会话读取本地数据库")}
        />
        <CardContent className="session-list-content">
          {items.length ? (
            <>
              <div className="session-search-bar" style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search className="h-4 w-4" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
                  <Input
                    placeholder={t("搜索会话标题、ID、路径或模型...")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: "32px" }}
                  />
                </div>
                <div className="session-filter-group" style={{ display: "flex", gap: "4px" }}>
                  <Button
                    size="sm"
                    variant={statusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStatusFilter("all")}
                  >
                    {t("全部")}
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "active" ? "default" : "outline"}
                    onClick={() => setStatusFilter("active")}
                  >
                    {t("未归档")}
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "archived" ? "default" : "outline"}
                    onClick={() => setStatusFilter("archived")}
                  >
                    {t("已归档")}
                  </Button>
                </div>
              </div>
              <div className="session-list-toolbar">
                <span className="session-selection-summary">
                  {t("已选择")} {selectedCount} / {filteredItems.length} {t("个会话")}
                  {(searchQuery || statusFilter !== "all") ? ` (${t("共")} ${items.length} ${t("个")})` : ""}
                </span>
                <div className="session-selection-actions">
                  <Button disabled={allSelected || bulkDeleting} onClick={selectAllSessions} size="sm" variant="outline">
                    {t("全选当前列表")}
                  </Button>
                  <Button disabled={!selectedCount || bulkDeleting} onClick={clearSelectedSessions} size="sm" variant="outline">
                    {t("清空选择")}
                  </Button>
                  <Button disabled={(selectionMode && !selectedCount) || bulkDeleting} onClick={() => void deleteSelectedSessions()} size="sm" variant="outline">
                    {selectionMode ? <Trash2 className="h-4 w-4" /> : null}
                    {selectionMode ? (bulkDeleting ? t("正在删除…") : t("删除已选")) : t("多选")}
                  </Button>
                </div>
              </div>
              {filteredItems.length ? (
                <div className="session-list">
                  {filteredItems.map((session) => {
                    const selected = selectedSessionIds.has(session.id);
                    return (
                      <div className="session-row" data-selection-mode={selectionMode} data-selected={selected} key={session.id}>
                        {selectionMode ? (
                          <label className="session-select" title={t("选择会话")}>
                            <input
                              aria-label={tf("选择会话 {0}", [session.title || session.id])}
                              checked={selected}
                              onChange={(event) => toggleSessionSelection(session.id, event.currentTarget.checked)}
                              type="checkbox"
                            />
                          </label>
                        ) : null}
                        <div className="session-main">
                          <strong>{session.title || t("未命名会话")}</strong>
                          <span>{session.id}</span>
                          <small>{session.cwd || t("未记录项目路径")}</small>
                        </div>
                        <div className="session-meta">
                          <Badge status={session.archived ? "archived" : "ok"} />
                          <span>{session.modelProvider || t("provider 未记录")}</span>
                          <span>{formatTime(session.updatedAtMs ?? 0)}</span>
                        </div>
                        <Button className="session-delete-button" variant="outline" onClick={() => void actions.deleteLocalSession(session)}>
                          <Trash2 className="h-4 w-4" />
                          {t("删除")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">{t("未找到符合搜索条件的本地会话。")}</div>
              )}
              <div className="session-pagination">
                <Button
                  aria-label={t("上一页")}
                  disabled={!hasPreviousPage || bulkDeleting}
                  onClick={() => void actions.refreshLocalSessions(true, Math.max(0, pageOffset - pageSize))}
                  size="icon"
                  title={t("上一页")}
                  variant="outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>{tf("第 {0} 页", [currentPage])}</span>
                <Button
                  aria-label={t("下一页")}
                  disabled={!hasNextPage || bulkDeleting}
                  onClick={() => void actions.refreshLocalSessions(true, pageOffset + pageSize)}
                  size="icon"
                  title={t("下一页")}
                  variant="outline"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="empty">{t("未读取到本地会话，或当前 SQLite 会话库不存在。")}</div>
          )}
        </CardContent>
      </Panel>
    </>
  );
});

export default SessionsScreen;
