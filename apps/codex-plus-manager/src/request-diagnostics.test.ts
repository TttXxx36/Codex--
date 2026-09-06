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
  assert.equal(classifyHttpError(0, "connection timed out").errorClass, "timeout");
  assert.equal(classifyHttpError(0, "cdp bridge injection failed").errorClass, "bridge");
});

test("sanitizeText completely redacts keys, Bearer tokens and query secrets", () => {
  const secret1 = "sk-proj-abc1234567890defghijklmn";
  const secret2 = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const rawUrl = "https://api.example.com/v1/chat?token=secret123&key=myapikey";

  const sanitized = sanitizeText(`Request with ${secret1} and Authorization: ${secret2} at ${rawUrl}`);

  assert.ok(!sanitized.includes(secret1));
  assert.ok(!sanitized.includes(secret2));
  assert.ok(!sanitized.includes("secret123"));
  assert.ok(!sanitized.includes("myapikey"));
  assert.ok(sanitized.includes("[REDACTED]"));
});

test("sanitizeValue recursively strips sensitive fields in objects and arrays", () => {
  const payload = {
    apiKey: "sk-live-secret-key-12345678",
    authorization: "Bearer secret-token",
    normalField: "hello world",
    nested: {
      userToken: "token-abc-xyz",
      subItems: ["safe", "Bearer secret-array-token"],
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
          apiKey: `sk-provider-${i}-1234567890`,
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
