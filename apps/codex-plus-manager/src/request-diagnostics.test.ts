import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyHttpError,
  formatSanitizedDiagnosticReport,
  parseDiagnosticLogEntries,
  sanitizeText,
  sanitizeValue,
} from "./request-diagnostics.ts";

test("classifyHttpError categorizes status codes and errors correctly", () => {
  assert.equal(classifyHttpError(200).errorClass, "none");
  assert.equal(classifyHttpError(401).errorClass, "auth");
  assert.equal(classifyHttpError(403).errorClass, "auth");
  assert.equal(classifyHttpError(429).errorClass, "rate_limit");
  assert.equal(classifyHttpError(400).errorClass, "bad_request");
  assert.equal(classifyHttpError(422).errorClass, "bad_request");
  assert.equal(classifyHttpError(500).errorClass, "server_error");
  assert.equal(classifyHttpError(502).errorClass, "server_error");
  assert.equal(classifyHttpError(504).errorClass, "timeout");
  for (const statusCode of [301, 302, 307, 308]) {
    const redirect = classifyHttpError(statusCode);
    assert.equal(redirect.errorClass, "redirect");
    assert.equal(redirect.statusDescription, "供应商接口已重定向，请检查配置的目标 URL");
    assert.equal(redirect.remedyTargetRoute, "relay");
  }
  assert.equal(classifyHttpError(0, "connection timed out").errorClass, "timeout");
  assert.equal(classifyHttpError(0, "cdp bridge injection failed").errorClass, "bridge");
});

test("sanitizeText completely redacts keys, Bearer tokens and query secrets", () => {
  const secret1 = ["sk", "proj", "abc1234567890defghijklmn"].join("-");
  const secret2 = ["Bearer", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"].join(" ");
  const rawUrl = "https://api.example.com/v1/chat?token=secret123&key=myapikey";

  const sanitized = sanitizeText(`Request with ${secret1} and Authorization: ${secret2} at ${rawUrl}`);

  assert.ok(!sanitized.includes(secret1));
  assert.ok(!sanitized.includes(secret2));
  assert.ok(!sanitized.includes("secret123"));
  assert.ok(!sanitized.includes("myapikey"));
  assert.ok(sanitized.includes("[REDACTED]"));
});

test("sanitizeText redacts every mixed-case Bearer token and query credential", () => {
  const input =
    'bearer abc-123 ... Bearer def-456 ... BeArEr ghi-789?x=1 api-key=secret-one&Token=secret-two&KEY=secret-three';

  const sanitized = sanitizeText(input);

  assert.ok(!sanitized.includes("abc-123"));
  assert.ok(!sanitized.includes("def-456"));
  assert.ok(!sanitized.includes("ghi-789?x=1"));
  assert.ok(!sanitized.includes("secret-one"));
  assert.ok(!sanitized.includes("secret-two"));
  assert.ok(!sanitized.includes("secret-three"));
  assert.equal((sanitized.match(/Bearer \[REDACTED\]/g) || []).length, 3);
});

test("unknown diagnostic descriptions never echo raw credentials", () => {
  const rawKey = ["sk", "proj", "raw", "secret", "1234567890"].join("-");
  const rawBearer = ["bearer", "raw-bearer-token-123"].join(" ");
  const rawMessage = `network failed for ${rawKey} with ${rawBearer}`;
  const classification = classifyHttpError(0, rawMessage);
  const serverClassification = classifyHttpError(500, rawMessage);

  assert.equal(classification.errorClass, "unknown");
  assert.ok(!classification.statusDescription.includes(rawKey));
  assert.ok(!classification.statusDescription.includes("raw-bearer-token-123"));
  assert.notEqual(classification.statusDescription, rawMessage);
  assert.equal(serverClassification.errorClass, "server_error");
  assert.ok(!serverClassification.statusDescription.includes("raw-bearer-token-123"));
});

test("sanitizeValue recursively strips sensitive fields in objects and arrays", () => {
  const payload = {
    apiKey: ["sk", "live", "secret", "key", "12345678"].join("-"),
    authorization: ["Bearer", "secret-token"].join(" "),
    normalField: "hello world",
    nested: {
      userToken: "token-abc-xyz",
      subItems: ["safe", ["Bearer", "secret-array-token"].join(" ")],
    },
  };

  const sanitized = sanitizeValue(payload) as any;
  assert.equal(sanitized.apiKey, "[REDACTED]");
  assert.equal(sanitized.authorization, "[REDACTED]");
  assert.equal(sanitized.normalField, "hello world");
  assert.equal(sanitized.nested.userToken, "[REDACTED]");
  assert.equal(sanitized.nested.subItems[0], "safe");
  assert.equal(sanitized.nested.subItems[1], "Bearer [REDACTED]");
});

test("parseDiagnosticLogEntries parses protocol proxy events and limits to 20 items", () => {
  const lines: string[] = [];

  // Generate 30 mock log entries
  for (let i = 1; i <= 30; i++) {
    const statusCode = i % 5 === 0 ? 429 : i % 3 === 0 ? 401 : 200;
    lines.push(
      JSON.stringify({
        timestamp_ms: 1700000000000 + i * 1000,
        pid: 1234,
        event: "protocol_proxy.upstream_response",
        detail: {
          relayName: `Provider-${i}`,
          endpoint: `https://api.provider-${i}.com/v1/responses?key=secret-key-${i}`,
          statusCode,
          apiKey: ["sk", "provider", String(i), "1234567890"].join("-"),
        },
      })
    );
  }

  // Also include an invalid line and non-event line
  lines.push("Plain text log line without json");
  lines.push(JSON.stringify({ event: "unrelated.event", detail: {} }));

  const logText = lines.join("\n");
  const items = parseDiagnosticLogEntries(logText, 20);

  // Assert max 20 items
  assert.equal(items.length, 20);

  // Assert sorted latest first (higher timestamp first)
  assert.ok(items[0].timestamp >= items[1].timestamp);

  // Assert all items are sanitized
  for (const item of items) {
    assert.ok(!JSON.stringify(item).includes("secret-key-"));
    assert.ok(!JSON.stringify(item).includes("sk-provider-"));
  }

  // Assert report formatting works cleanly
  const report = formatSanitizedDiagnosticReport(items);
  assert.ok(report.includes("本地请求与错误诊断看板"));
  assert.ok(report.includes("[HTTP"));
  assert.ok(!report.includes("secret-key-"));
});

test("parsed unknown network errors keep raw credentials out of the panel and report", () => {
  const rawKey = ["sk", "proj", "raw", "secret", "1234567890"].join("-");
  const rawBearer = ["bearer", "raw-bearer-token-123"].join(" ");
  const rawMessage = `socket failed: ${rawKey} ${rawBearer}`;
  const logText = JSON.stringify({
    timestamp_ms: 1700000000000,
    event: "protocol_proxy.request_error",
    detail: {
      relayName: "Provider",
      endpoint: "https://api.example.test/v1/responses?api-key=raw-query-secret",
      statusCode: 0,
      error: rawMessage,
    },
  });

  const items = parseDiagnosticLogEntries(logText);
  assert.equal(items.length, 1);
  const serialized = JSON.stringify(items[0]);
  const report = formatSanitizedDiagnosticReport(items);

  assert.ok(!serialized.includes("raw-secret-1234567890"));
  assert.ok(!serialized.includes("raw-bearer-token-123"));
  assert.ok(!report.includes("raw-query-secret"));
  assert.ok(!report.includes(rawMessage));
});
