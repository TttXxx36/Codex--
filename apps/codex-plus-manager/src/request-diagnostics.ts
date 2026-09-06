export type ErrorCategory =
  | "auth"
  | "bad_request"
  | "rate_limit"
  | "server_error"
  | "timeout"
  | "bridge"
  | "unknown"
  | "none";

export interface RequestDiagnosticItem {
  id: string;
  timestamp: number;
  timeLabel: string;
  event: string;
  relayId?: string;
  relayName: string;
  endpoint: string;
  wireApi?: string;
  statusCode: number;
  isError: boolean;
  errorClass: ErrorCategory;
  errorClassLabel: string;
  statusDescription: string;
  remedyActionLabel: string;
  remedyTargetRoute?: "relay" | "about" | "settings";
  sanitizedDetail: Record<string, unknown>;
}

export function sanitizeText(text: string): string {
  if (!text) return "";
  let result = text;
  // Redact Bearer tokens
  result = result.replace(/Bearer\s+[A-Za-z0-9._\-\~+/]+=*/gi, "Bearer [REDACTED]");
  // Redact sk- API keys
  result = result.replace(/sk-[A-Za-z0-9_\-]{8,}/gi, "sk-[REDACTED]");
  // Redact password/token query params
  result = result.replace(/(key|token|password|secret|auth)=([^& \t\n\r"']+)/gi, "$1=[REDACTED]");
  return result;
}

export function sanitizeValue(val: unknown): unknown {
  if (typeof val === "string") {
    return sanitizeText(val);
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes("key") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("authorization")
      ) {
        sanitizedObj[k] = "[REDACTED]";
      } else {
        sanitizedObj[k] = sanitizeValue(v);
      }
    }
    return sanitizedObj;
  }
  return val;
}

export function classifyHttpError(
  statusCode: number,
  errorMessage = ""
): {
  errorClass: ErrorCategory;
  errorClassLabel: string;
  statusDescription: string;
  remedyActionLabel: string;
  remedyTargetRoute?: "relay" | "about" | "settings";
} {
  const lowerErr = errorMessage.toLowerCase();

  if (statusCode >= 200 && statusCode < 300) {
    return {
      errorClass: "none",
      errorClassLabel: "正常",
      statusDescription: "请求已成功响应",
      remedyActionLabel: "运行正常",
    };
  }

  if (statusCode === 401 || statusCode === 403 || lowerErr.includes("unauthorized") || lowerErr.includes("forbidden")) {
    return {
      errorClass: "auth",
      errorClassLabel: "鉴权失败 (401/403)",
      statusDescription: "API Key 无效、已过期或无访问该模型的权限",
      remedyActionLabel: "检查供应商 API Key 或切换节点",
      remedyTargetRoute: "relay",
    };
  }

  if (statusCode === 429 || lowerErr.includes("rate limit") || lowerErr.includes("quota")) {
    return {
      errorClass: "rate_limit",
      errorClassLabel: "频率受限 / 额度耗尽 (429)",
      statusDescription: "触发上游频率限制或账户余额不足",
      remedyActionLabel: "建议切换至备用供应商",
      remedyTargetRoute: "relay",
    };
  }

  if (
    statusCode === 408 ||
    statusCode === 504 ||
    lowerErr.includes("timeout") ||
    lowerErr.includes("timed out") ||
    lowerErr.includes("connection reset")
  ) {
    return {
      errorClass: "timeout",
      errorClassLabel: "连接超时 (Timeout)",
      statusDescription: "上游服务器响应超时或网络阻断",
      remedyActionLabel: "检查本地网络/代理设置或增加超时阈值",
      remedyTargetRoute: "settings",
    };
  }

  if (statusCode === 400 || statusCode === 422 || lowerErr.includes("bad request") || lowerErr.includes("invalid payload")) {
    return {
      errorClass: "bad_request",
      errorClassLabel: "请求参数错误 (400)",
      statusDescription: "上游模型名称不存在或请求入参不符合该协议",
      remedyActionLabel: "检查模型名称映射与协议模式 (Responses / ChatCompletions)",
      remedyTargetRoute: "relay",
    };
  }

  if (statusCode >= 500 || lowerErr.includes("internal server error") || lowerErr.includes("bad gateway")) {
    return {
      errorClass: "server_error",
      errorClassLabel: "上游服务异常 (5xx)",
      statusDescription: "供应商服务器发生内部错误或网关故障",
      remedyActionLabel: "上游暂时故障，建议稍后重试或开启聚合故障转移",
      remedyTargetRoute: "relay",
    };
  }

  if (lowerErr.includes("bridge") || lowerErr.includes("patch") || lowerErr.includes("cdp") || lowerErr.includes("inject")) {
    return {
      errorClass: "bridge",
      errorClassLabel: "注入与桥接异常",
      statusDescription: "本地 CDP 或脚本注入发生异常",
      remedyActionLabel: "重新启动 Codex++ 或执行诊断",
      remedyTargetRoute: "about",
    };
  }

  return {
    errorClass: "unknown",
    errorClassLabel: `异常错误 (${statusCode || "Err"})`,
    statusDescription: errorMessage || "发生未知网络或上游错误",
    remedyActionLabel: "复制脱敏日志以排查问题",
    remedyTargetRoute: "about",
  };
}

export function parseDiagnosticLogEntries(logText: string, maxItems = 20): RequestDiagnosticItem[] {
  if (!logText || !logText.trim()) return [];

  const lines = logText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const items: RequestDiagnosticItem[] = [];

  for (let i = lines.length - 1; i >= 0 && items.length < maxItems; i--) {
    const line = lines[i];
    if (!line.includes("protocol_proxy") && !line.includes("bridge") && !line.includes("renderer") && !line.includes("error")) {
      continue;
    }

    try {
      const parsed = JSON.parse(line);
      const event = String(parsed.event || "");
      const detail = (parsed.detail && typeof parsed.detail === "object" ? parsed.detail : {}) as Record<string, unknown>;
      const timestamp = Number(parsed.timestamp_ms || Date.now());
      const date = new Date(timestamp);
      const timeLabel = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;

      const relayName = String(detail.relayName || detail.provider || detail.relayId || "本地服务");
      const rawEndpoint = String(detail.endpoint || detail.url || "");
      const endpoint = sanitizeText(rawEndpoint);
      const statusCode = Number(detail.statusCode || detail.status || detail.http_status || 0);
      const errorMsg = String(detail.error || detail.message || "");

      const isProxyRequest = event.includes("protocol_proxy");
      const isProxyFailure = event.includes("failed") || event.includes("error") || (statusCode >= 400 && statusCode > 0);
      const isBridgeError = event.includes("bridge") && (event.includes("error") || Boolean(detail.error));

      if (!isProxyRequest && !isBridgeError && !isProxyFailure) {
        continue;
      }

      const classification = classifyHttpError(statusCode, errorMsg);
      const isError = isProxyFailure || isBridgeError || classification.errorClass !== "none";

      const sanitizedDetail = (sanitizeValue(detail) as Record<string, unknown>) || {};

      items.push({
        id: `${timestamp}-${i}-${event}`,
        timestamp,
        timeLabel,
        event,
        relayId: detail.relayId ? String(detail.relayId) : undefined,
        relayName,
        endpoint,
        wireApi: detail.wireApi ? String(detail.wireApi) : undefined,
        statusCode,
        isError,
        errorClass: classification.errorClass,
        errorClassLabel: classification.errorClassLabel,
        statusDescription: classification.statusDescription,
        remedyActionLabel: classification.remedyActionLabel,
        remedyTargetRoute: classification.remedyTargetRoute,
        sanitizedDetail,
      });
    } catch {
      // Ignore non-JSON log lines safely
    }
  }

  return items;
}

export function formatSanitizedDiagnosticReport(items: RequestDiagnosticItem[]): string {
  if (!items || items.length === 0) {
    return "【本地请求与错误诊断看板】\n暂无请求与异常记录。";
  }

  const lines: string[] = [
    `【本地请求与错误诊断看板】(最近 ${items.length} 次记录，已完全脱敏)`,
    "=================================================================",
  ];

  for (const item of items) {
    const statusTag = item.statusCode ? `[HTTP ${item.statusCode}]` : `[${item.isError ? "FAIL" : "OK"}]`;
    lines.push(`- [${item.timeLabel}] ${statusTag} ${item.relayName} -> ${item.endpoint || item.event}`);
    lines.push(`  类别: ${item.errorClassLabel} | 建议: ${item.remedyActionLabel}`);
    if (item.statusDescription) {
      lines.push(`  详情: ${item.statusDescription}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
