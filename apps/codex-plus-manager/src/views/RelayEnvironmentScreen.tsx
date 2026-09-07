import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { t, tf } from "@/i18n";
import type { Actions, RelayEnvironmentResult } from "../App";
import { Badge, CardHead, Panel, Toolbar } from "./ScreenPrimitives";

export const RelayEnvironmentScreen = memo(function RelayEnvironmentScreen({ result, actions }: { result: RelayEnvironmentResult | null; actions: Actions }) {
  const proxyVariables = result?.proxyEnvironment.variables ?? [];
  const proxyVariableLabels = proxyVariables.map((item) => {
    const source = item.source === "user" ? t("用户环境") : item.source === "system" ? t("系统环境") : t("进程环境");
    return tf("{0}（{1}）", [item.name, source]);
  });
  const checks = [
    {
      id: "clash-verge-tun",
      title: t("Clash Verge Rev TUN 模式"),
      passed: result ? !result.clashVergeTun.enabled : false,
      detail: result
        ? result.clashVergeTun.enabled
          ? tf("检测到 TUN 模式已开启，请在 Clash Verge Rev 中关闭。配置：{0}", [result.clashVergeTun.configPath || t("未记录路径")])
          : result.clashVergeTun.configPath
            ? tf("TUN 模式已关闭。配置：{0}", [result.clashVergeTun.configPath])
            : t("未发现 Clash Verge Rev 配置，按未开启处理。")
        : t("等待检测。"),
    },
    {
      id: "proxy-environment",
      title: t("系统代理环境变量"),
      passed: result ? proxyVariables.length === 0 : false,
      detail: result
        ? proxyVariables.length
          ? tf("检测到代理环境变量：{0}。请清理后重新启动 Codex++。", [proxyVariableLabels.join(t("、"))])
          : t("未检测到 HTTP_PROXY、HTTPS_PROXY、ALL_PROXY、NO_PROXY 或 FTP_PROXY。")
        : t("等待检测。"),
    },
    {
      id: "codex-dotenv",
      title: t("Codex .env 文件"),
      passed: result ? !result.codexEnvFile.exists : false,
      detail: result
        ? result.codexEnvFile.exists
          ? tf("检测到可能干扰供应商配置的 .env 文件：{0}", [result.codexEnvFile.path])
          : tf("未发现 .env 文件：{0}", [result.codexEnvFile.path])
        : t("等待检测。"),
    },
  ];
  const allPassed = Boolean(result) && checks.every((check) => check.passed);

  return (
    <Panel>
      <CardHead
        title={t("中转站环境配置检测")}
        detail={result ? (allPassed ? t("三项检测全部通过") : t("检测到需要处理的环境问题")) : t("正在读取本机环境")}
      />
      <CardContent>
        <div className="relay-environment-checks">
          {checks.map((check) => (
            <div className={`relay-environment-check ${result ? (check.passed ? "ok" : "failed") : "pending"}`} key={check.id}>
              <div className="relay-environment-check-icon">
                {result ? (check.passed ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />) : <RefreshCw className="h-5 w-5" />}
              </div>
              <div className="relay-environment-check-copy">
                <strong>{check.title}</strong>
                <span>{check.detail}</span>
              </div>
              <Badge status={result ? (check.passed ? "ok" : "failed") : "not_checked"} />
            </div>
          ))}
        </div>
        <Toolbar>
          <Button onClick={() => void actions.refreshRelayEnvironment()}>
            <RefreshCw className="h-4 w-4" />
            {t("重新检测")}
          </Button>
        </Toolbar>
      </CardContent>
    </Panel>
  );
});
export default RelayEnvironmentScreen;
