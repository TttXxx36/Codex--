import { Save } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t, tf } from "@/i18n";
import {
  SETTINGS_STEPWISE_SECTION_ID,
  clampNumber,
  codexExtraArgsToInput,
  inputToCodexExtraArgs,
} from "../App";
import type { Actions, BackendSettings, SettingsResult, Theme } from "../App";
import { AppSelect, CardHead, Field, Panel, Toolbar } from "./ScreenPrimitives";

export const SettingsScreen = memo(function SettingsScreen({
  dirty,
  settings,
  theme,
  form,
  onFormChange,
  actions,
}: {
  dirty: boolean;
  settings: SettingsResult | null;
  theme: Theme;
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
  actions: Actions;
}) {
  return (
    <div className="settings-page">
      <Panel>
        <CardHead title={t("基础设置")} detail={settings?.settings_path ?? ""} />
        <CardContent className="settings-content">
          <div className="theme-row">
            <div>
              <strong>{t("界面主题")}</strong>
              <span>{t("当前为")}{theme === "dark" ? t("深色") : t("浅色")}{t("模式。")}</span>
            </div>
            <Button variant="secondary" onClick={actions.toggleTheme}>{t("切换主题")}</Button>
          </div>
          <Field className="settings-test-model-field" label={t("供应商测试模型")}>
            <Input
              value={form.relayTestModel}
              onChange={(event) => onFormChange({ ...form, relayTestModel: event.currentTarget.value })}
              placeholder={t("例如 gpt-5.4-mini")}
            />
          </Field>
          <div className="settings-block stepwise-settings-block" id={SETTINGS_STEPWISE_SECTION_ID}>
            <div className="section-title">Stepwise</div>
            <div className="stepwise-settings-section">{t("连接")}</div>
            <div className="form-row">
              <Field label="Base URL">
                <Input
                  value={form.codexAppStepwiseBaseUrl}
                  onChange={(event) => onFormChange({ ...form, codexAppStepwiseBaseUrl: event.currentTarget.value })}
                  placeholder="https://api.example.com/v1"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={form.codexAppStepwiseModel}
                  onChange={(event) => onFormChange({ ...form, codexAppStepwiseModel: event.currentTarget.value })}
                  placeholder={t("例如 gpt-5.4-mini")}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t("协议")}>
                <AppSelect
                  value={form.codexAppStepwiseProtocol}
                  onChange={(value) => onFormChange({ ...form, codexAppStepwiseProtocol: value })}
                  options={[
                    { value: "auto", label: t("自动兼容") },
                    { value: "chat_completions", label: "Chat Completions" },
                    { value: "responses", label: "Responses API" },
                    { value: "anthropic_messages", label: "Anthropic Messages" },
                  ]}
                />
              </Field>
              <Field label={t("模式")}>
                <AppSelect
                  value={form.codexAppStepwiseGenerationMode}
                  onChange={(value) => onFormChange({ ...form, codexAppStepwiseGenerationMode: value })}
                  options={[
                    { value: "auto", label: t("自动生成") },
                    { value: "manual", label: t("手动刷新") },
                  ]}
                />
              </Field>
            </div>
            <Field label="API Key">
              <Input
                type="password"
                value={form.codexAppStepwiseApiKey}
                onChange={(event) => onFormChange({ ...form, codexAppStepwiseApiKey: event.currentTarget.value })}
              />
            </Field>
            <details className="stepwise-advanced">
              <summary>{t("高级参数")}</summary>
              <div className="form-row">
                <Field label={t("API Key 环境变量")}>
                  <Input
                    value={form.codexAppStepwiseApiKeyEnv}
                    onChange={(event) => onFormChange({ ...form, codexAppStepwiseApiKeyEnv: event.currentTarget.value })}
                  />
                </Field>
                <Field label={t("最多建议数")}>
                  <Input
                    max={6}
                    min={0}
                    type="number"
                    value={form.codexAppStepwiseMaxItems}
                    onChange={(event) =>
                      onFormChange({ ...form, codexAppStepwiseMaxItems: clampNumber(Number(event.currentTarget.value), 0, 6) })
                    }
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label={t("超时毫秒")}>
                  <Input
                    min={1000}
                    type="number"
                    value={form.codexAppStepwiseTimeoutMs}
                    onChange={(event) =>
                      onFormChange({ ...form, codexAppStepwiseTimeoutMs: clampNumber(Number(event.currentTarget.value), 1000, 60000) })
                    }
                  />
                </Field>
                <Field label={t("最大输入字符")}>
                  <Input
                    min={1000}
                    type="number"
                    value={form.codexAppStepwiseMaxInputChars}
                    onChange={(event) =>
                      onFormChange({ ...form, codexAppStepwiseMaxInputChars: clampNumber(Number(event.currentTarget.value), 1000, 24000) })
                    }
                  />
                </Field>
              </div>
              <Field label={t("最大输出 tokens")}>
                <Input
                  min={100}
                  type="number"
                  value={form.codexAppStepwiseMaxOutputTokens}
                  onChange={(event) =>
                    onFormChange({ ...form, codexAppStepwiseMaxOutputTokens: clampNumber(Number(event.currentTarget.value), 100, 4000) })
                  }
                />
              </Field>
            </details>
            <div className="toolbar stepwise-settings-actions">
              <Button variant="secondary" onClick={() => void actions.testStepwiseSettings(form)}>{t("测试连接")}</Button>
            </div>
          </div>
          <div className="settings-block">
            <label className="check-row">
              <input
                checked={form.codexAppImageOverlayEnabled}
                onChange={(event) =>
                  onFormChange({ ...form, codexAppImageOverlayEnabled: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>{t("启用 Codex 图片覆盖层")}</span>
            </label>
            <div className="form-row">
              <Field label={t("覆盖图片")}>
                <Input
                  value={form.codexAppImageOverlayPath}
                  onChange={(event) => onFormChange({ ...form, codexAppImageOverlayPath: event.currentTarget.value })}
                  placeholder={t("选择 png / jpg / webp / gif / bmp")}
                />
              </Field>
              <Toolbar>
                <Button variant="secondary" onClick={() => void actions.chooseImageOverlayPath()}>
                  {t("选择图片")}
                </Button>
              </Toolbar>
            </div>
            <Field label={tf("透明度 {0}%", [form.codexAppImageOverlayOpacity])}>
              <Input
                min={1}
                max={100}
                type="range"
                value={form.codexAppImageOverlayOpacity}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    codexAppImageOverlayOpacity: clampNumber(Number(event.currentTarget.value), 1, 100),
                  })
                }
              />
            </Field>
            <Field label={t("背景适配方式")}>
              <AppSelect
                value={form.codexAppImageOverlayFitMode}
                onChange={(value) =>
                  onFormChange({
                    ...form,
                    codexAppImageOverlayFitMode: value,
                  })
                }
                options={[
                  { value: "fill", label: t("填充") },
                  { value: "fit", label: t("适应") },
                  { value: "stretch", label: t("拉伸") },
                  { value: "tile", label: t("平铺") },
                  { value: "center", label: t("居中") },
                ]}
              />
            </Field>
          </div>
          <Toolbar>
            <Button variant="secondary" onClick={() => void actions.resetImageOverlaySettings()}>
              {t("重置背景")}
            </Button>
          </Toolbar>
        </CardContent>
      </Panel>
      <Panel>
        <CardHead title={t("Codex 启动参数")} detail={t("启动 Codex App 时追加到默认 CDP 参数后。留空则保持默认启动行为。")} />
        <CardContent className="settings-content">
          <Field label={t("额外参数")}>
            <Textarea
              className="launch-args-input"
              placeholder="--force_high_performance_gpu"
              spellCheck={false}
              value={codexExtraArgsToInput(form.codexExtraArgs)}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  codexExtraArgs: inputToCodexExtraArgs(event.currentTarget.value),
                })
              }
            />
          </Field>
          <p className="field-hint">{t("每行一个参数，例如 --force_high_performance_gpu。不需要填写 open 或 --args。")}</p>
        </CardContent>
      </Panel>
      {dirty ? (
        <div className="settings-save-bar">
          <span>{t("设置有修改时，保存后才会写入本地配置。")}</span>
          <Button onClick={() => void actions.saveSettings()}>
            <Save className="h-4 w-4" />
            {t("保存设置")}
          </Button>
        </div>
      ) : null}
    </div>
  );
});
export default SettingsScreen;
