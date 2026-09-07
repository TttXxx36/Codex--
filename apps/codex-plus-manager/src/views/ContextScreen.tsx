import { Download, Edit3, Plus, Save, Trash2 } from "lucide-react";
import { memo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t, tf } from "@/i18n";
import {
  contextEntriesByKind,
  contextEntriesWithLiveEntries,
  contextKindLabel,
  contextKindOptions,
  isSuccessStatus,
  normalizeSettings,
  setContextEntryEnabled,
} from "../App";
import type {
  Actions,
  BackendSettings,
  CodexContextEntries,
  CodexContextEntry,
  ContextKind,
  McpImportPreviewResult,
  RelayFilesResult,
} from "../App";
import { AppSelect, CardHead, Field, Panel, Toolbar } from "./ScreenPrimitives";

export const ContextScreen = memo(function ContextScreen({
  form,
  liveEntries,
  relayFiles,
  onFormChange,
  actions,
}: {
  form: BackendSettings;
  liveEntries: CodexContextEntries | null;
  relayFiles: RelayFilesResult | null;
  onFormChange: (value: BackendSettings) => void;
  actions: Actions;
}) {
  return (
    <Panel fill>
      <CardHead title={t("Codex MCP&插件")} detail={t("独立管理 Codex 的 MCP 服务器与插件；切换任意供应商都会带上。")} />
      <CardContent>
        <RelayContextManager
          form={normalizeSettings(form)}
          liveEntries={liveEntries}
          relayFiles={relayFiles}
          onFormChange={onFormChange}
          actions={actions}
        />
      </CardContent>
    </Panel>
  );
});

function RelayContextManager({
  form,
  liveEntries,
  relayFiles,
  onFormChange,
  actions,
}: {
  form: BackendSettings;
  liveEntries: CodexContextEntries | null;
  relayFiles: RelayFilesResult | null;
  onFormChange: (value: BackendSettings) => void;
  actions: Actions;
}) {
  const entries = contextEntriesWithLiveEntries(form, liveEntries);
  const [activeKind, setActiveKind] = useState<ContextKind>("mcp");
  const [editor, setEditor] = useState<{ kind: ContextKind; entry?: CodexContextEntry } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const visibleEntries = contextEntriesByKind(entries, activeKind);
  const label = contextKindLabel(activeKind);

  const syncContextEntries = async (next: BackendSettings) => {
    const syncResult = await actions.syncLiveContextEntries(next, true);
    if (!syncResult || !isSuccessStatus(syncResult.status)) return false;
    await actions.refreshRelayFiles();
    return true;
  };

  const saveEntry = async (kind: ContextKind, id: string, tomlBody: string) => {
    const next = await actions.upsertContextEntry(form, kind, id, tomlBody);
    if (!next) return;
    onFormChange(next);
    if (!(await syncContextEntries(next))) return;
    setEditor(null);
  };

  const toggleContextEntryEnabled = async (entry: CodexContextEntry) => {
    const nextBody = setContextEntryEnabled(entry.tomlBody, !entry.enabled);
    const next = await actions.upsertContextEntry(form, entry.kind, entry.id, nextBody);
    if (!next) return;
    onFormChange(next);
    await syncContextEntries(next);
  };

  const deleteEntry = async (entry: CodexContextEntry) => {
    const next = await actions.deleteContextEntry(form, entry.kind, entry.id);
    if (!next) return;
    onFormChange(next);
    await syncContextEntries(next);
  };

  const importJson = async (json: string) => {
    const next = await actions.importMcpServersJson(form, json);
    if (!next) return;
    onFormChange(next);
    if (!(await syncContextEntries(next))) return;
    setImportOpen(false);
  };

  return (
    <div className="relay-context-panel">
      <div className="relay-context-head">
        <div>
          <strong>{t("Codex MCP&插件")}</strong>
          <span>{t("MCP 与插件作为全局配置独立管理，切换任意供应商都会合并。")}</span>
        </div>
        <div className="relay-context-head-actions">
          {activeKind === "mcp" ? (
            <Button
              onClick={() => {
                setEditor(null);
                setImportOpen(true);
              }}
              size="sm"
              variant="secondary"
            >
              <Download className="h-4 w-4" />
              {t("导入 JSON")}
            </Button>
          ) : null}
          <Button onClick={() => setEditor({ kind: activeKind })} size="sm" variant="secondary">
            <Plus className="h-4 w-4" />
            {t("新增")}{label}
          </Button>
        </div>
      </div>
      <div className="segmented">
        {contextKindOptions.map((option) => (
          <button
            className={activeKind === option.kind ? "active" : ""}
            key={option.kind}
            onClick={() => setActiveKind(option.kind)}
            type="button"
          >
            <span>{option.label}</span>
            <small>{contextEntriesByKind(entries, option.kind).length}</small>
          </button>
        ))}
      </div>
      <div className="relay-context-summary">
        {t("当前共有")} {visibleEntries.length} {t("个")}{label}{t("；这些条目独立于供应商保存，会写入所有供应商切换后的 config.toml。")}
      </div>
      <div className="relay-context-list">
        {visibleEntries.length ? (
          visibleEntries.map((entry) => (
            <div className="relay-context-row" key={`${entry.kind}-${entry.id}`}>
              <strong className="context-title">{entry.title || entry.id}</strong>
              <div className="relay-context-actions">
                <button
                  aria-checked={entry.enabled}
                  aria-label={`contextEnabledSwitch-${entry.kind}-${entry.id}`}
                  className={`context-enabled-switch ${entry.enabled ? "active" : ""}`}
                  onClick={() => void toggleContextEntryEnabled(entry)}
                  role="switch"
                  title={entry.enabled ? t("禁用此扩展项") : t("启用此扩展项")}
                  type="button"
                >
                  <span className="context-switch-track" aria-hidden="true">
                    <span className="context-switch-thumb" />
                  </span>
                </button>
                <Button onClick={() => setEditor({ kind: entry.kind, entry })} size="icon" title={t("编辑扩展项")} variant="ghost">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  className="relay-context-delete"
                  onClick={() => void deleteEntry(entry)}
                  size="icon"
                  title={t("删除扩展项")}
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">{t("暂无")}{label}{t("，可以从通用配置文件或这里新增。")}</div>
        )}
      </div>
      {importOpen ? (
        <McpJsonImporter actions={actions} onCancel={() => setImportOpen(false)} onImport={importJson} />
      ) : null}
      {editor ? (
        <ContextEntryEditor
          entry={editor.entry}
          kind={editor.kind}
          onCancel={() => setEditor(null)}
          onSave={(kind, id, tomlBody) => void saveEntry(kind, id, tomlBody)}
        />
      ) : null}
    </div>
  );
}

function McpJsonImporter({
  actions,
  onCancel,
  onImport,
}: {
  actions: Actions;
  onCancel: () => void;
  onImport: (json: string) => void;
}) {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<McpImportPreviewResult | null>(null);

  const runPreview = async () => {
    const result = await actions.previewMcpServersJson(json);
    setPreview(result && isSuccessStatus(result.status) ? result : null);
  };

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <div className="modal-card context-modal">
        <div className="modal-head">
          <div>
            <h2>{t("导入 MCP JSON")}</h2>
            <p className="modal-message">{t("支持 mcpServers / servers 包裹，也支持直接粘贴单个服务器配置。")}</p>
          </div>
          <button aria-label={t("关闭窗口")} className="toast-close" onClick={onCancel} type="button">×</button>
        </div>
        <Field label={t("MCP 配置 JSON")}>
          <Textarea
            className="context-editor-textarea"
            value={json}
            onChange={(event) => {
              setJson(event.currentTarget.value);
              setPreview(null);
            }}
            placeholder={'{\n  "mcpServers": {\n    "context7": {\n      "command": "npx",\n      "args": ["-y", "@upstash/context7-mcp"]\n    }\n  }\n}'}
            spellCheck={false}
          />
        </Field>
        {preview ? (
          <div className="relay-context-summary">
            <div>{tf("将导入 {0} 个：{1}", [preview.entries.length, preview.entries.map((item) => item.id).join("、")])}</div>
            {preview.warnings.map((warning) => <div key={warning}>{warning}</div>)}
          </div>
        ) : null}
        <Toolbar>
          <Button disabled={!json.trim()} onClick={() => void runPreview()} size="sm" variant="secondary">{t("预览")}</Button>
          <Button disabled={!preview} onClick={() => onImport(json)} size="sm">
            <Download className="h-4 w-4" />
            {t("确认导入")}
          </Button>
          <Button onClick={onCancel} size="sm" variant="secondary">{t("取消")}</Button>
        </Toolbar>
      </div>
    </div>
  );
}

function ContextEntryEditor({
  kind,
  entry,
  onCancel,
  onSave,
}: {
  kind: ContextKind;
  entry?: CodexContextEntry;
  onCancel: () => void;
  onSave: (kind: ContextKind, id: string, tomlBody: string) => void;
}) {
  const [draftKind, setDraftKind] = useState<ContextKind>(entry?.kind ?? kind);
  const [id, setId] = useState(entry?.id ?? "");
  const [tomlBody, setTomlBody] = useState(entry?.tomlBody ?? "");
  const canSave = id.trim().length > 0;

  return (
    <div className="context-editor">
      <div className="context-editor-fields">
        <Field label={t("类型")}>
          <AppSelect
            disabled={!!entry}
            value={draftKind}
            onChange={(value) => setDraftKind(value)}
            options={contextKindOptions.map((option) => ({ value: option.kind, label: option.label }))}
          />
        </Field>
        <Field label="ID">
          <Input
            disabled={!!entry}
            value={id}
            onChange={(event) => setId(event.currentTarget.value.trim())}
            placeholder={t("例如 context7")}
          />
        </Field>
      </div>
      <Field label={t("TOML 配置体")}>
        <Textarea
          className="context-editor-textarea"
          value={tomlBody}
          onChange={(event) => setTomlBody(event.currentTarget.value)}
          placeholder={t("只填写表头下面的内容，例如：\ncommand = \"npx\"\nargs = [\"-y\", \"@upstash/context7-mcp\"]")}
          spellCheck={false}
        />
      </Field>
      <Toolbar>
        <Button disabled={!canSave} onClick={() => onSave(draftKind, id.trim(), tomlBody)} size="sm">
          <Save className="h-4 w-4" />
          {t("保存扩展项")}
        </Button>
        <Button onClick={onCancel} size="sm" variant="secondary">{t("取消")}</Button>
      </Toolbar>
    </div>
  );
}
export default ContextScreen;
