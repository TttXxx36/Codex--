import assert from "node:assert/strict";
import test from "node:test";

import { resolveLaunchStatus } from "./launch-status.ts";

/**
 * CDP Target representation matching Rust CdpTarget model
 */
interface MockCdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

/**
 * Filter and select injectable primary page target matching core Rust pick_page_target rules
 */
function pickPrimaryPageTarget(targets: MockCdpTarget[]): MockCdpTarget | null {
  const isInjectablePage = (t: MockCdpTarget) => {
    if (t.type !== "page") return false;
    const url = t.url.toLowerCase();
    const title = t.title.toLowerCase();
    // Exclude quick chat, avatar, and devtools overlays
    if (url.includes("avatar") || title.includes("avatar")) return false;
    if (url.includes("quick-chat") || title.includes("quick chat")) return false;
    if (url.startsWith("devtools://") || url.startsWith("chrome-extension://")) return false;
    return true;
  };

  const isPrimary = (t: MockCdpTarget) => {
    const url = t.url.toLowerCase();
    const title = t.title.toLowerCase();
    return (
      url.includes("codex") ||
      title.includes("codex") ||
      url.startsWith("app://") ||
      url.includes("localhost") ||
      url.includes("127.0.0.1")
    );
  };

  const candidates = targets.filter(isInjectablePage);
  const primary = candidates.find(isPrimary);
  return primary ?? candidates[0] ?? null;
}

/**
 * Loopback URL validator matching validate_cdp_websocket_url
 */
function validateWebSocketUrl(urlStr: string, expectedPort: number): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return false;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const isLoopback =
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "0:0:0:0:0:0:0:1";
    if (!isLoopback) return false;
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "ws:" ? 80 : 443);
    return port === expectedPort;
  } catch {
    return false;
  }
}

/**
 * Sensitive credential sanitizer matching diagnostic_log.rs
 */
function sanitizeTraceLog(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9_.-]{10,}/gi, "Bearer [REDACTED]");
}

test("Smoke 1: Target discovery selects primary Codex window and filters overlays", () => {
  const fakeElectronTargets: MockCdpTarget[] = [
    {
      id: "bg-1",
      type: "background_page",
      title: "Background Extension Worker",
      url: "chrome-extension://abc/background.html",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/bg-1",
    },
    {
      id: "overlay-1",
      type: "page",
      title: "Avatar Overlay Window",
      url: "app://-/avatar-overlay.html",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/overlay-1",
    },
    {
      id: "quick-chat-1",
      type: "page",
      title: "Codex Quick Chat",
      url: "app://-/quick-chat.html",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/quick-chat-1",
    },
    {
      id: "main-window-1",
      type: "page",
      title: "Codex - Workspace",
      url: "app://-/index.html",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/main-window-1",
    },
  ];

  const picked = pickPrimaryPageTarget(fakeElectronTargets);
  assert.ok(picked, "Must select a target");
  assert.equal(picked.id, "main-window-1");
  assert.equal(picked.title, "Codex - Workspace");

  // Validate security constraint: only loopback URLs matching expected debug port are allowed
  assert.equal(validateWebSocketUrl(picked.webSocketDebuggerUrl!, 9222), true);
  assert.equal(validateWebSocketUrl("ws://192.168.1.50:9222/devtools/page/evil", 9222), false);
  assert.equal(validateWebSocketUrl("ws://127.0.0.1:8080/devtools/page/mismatch", 9222), false);
});

test("Smoke 2: CDP injection handles resilient DOM selector fallbacks", () => {
  // Simulate 3 generations of official Electron DOM variations
  const legacyMarkup = {
    className: "sidebar-thread truncate font-medium",
    ariaLabel: null,
    href: null,
  };
  const ariaMarkup = {
    className: "custom-thread-row",
    ariaLabel: "会话详情: 项目开发规划",
    href: null,
  };
  const semanticMarkup = {
    className: "nav-item-link",
    ariaLabel: null,
    href: "/chat/session-uuid-123456",
  };

  const resolveSessionIdentity = (node: { className?: string; ariaLabel?: string | null; href?: string | null }) => {
    if (node.href && node.href.includes("/chat/")) {
      const match = node.href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
      if (match) return { id: match[1], source: "semantic-href" };
    }
    if (node.ariaLabel && node.ariaLabel.includes("会话")) {
      return { id: "session-aria-resolved", source: "aria-label" };
    }
    if (node.className && node.className.includes("sidebar-thread")) {
      return { id: "session-class-resolved", source: "legacy-class" };
    }
    return null;
  };

  assert.deepEqual(resolveSessionIdentity(legacyMarkup), {
    id: "session-class-resolved",
    source: "legacy-class",
  });
  assert.deepEqual(resolveSessionIdentity(ariaMarkup), {
    id: "session-aria-resolved",
    source: "aria-label",
  });
  assert.deepEqual(resolveSessionIdentity(semanticMarkup), {
    id: "session-uuid-123456",
    source: "semantic-href",
  });
});

test("Smoke 3: Helper restart and graceful shutdown lifecycle contracts", () => {
  // 1. Simulating loopback access rule for /helper/shutdown
  const canPerformGracefulShutdown = (clientIp: string) => {
    const isLoopback = clientIp === "127.0.0.1" || clientIp === "::1";
    return isLoopback ? { status: 200, allowed: true } : { status: 403, allowed: false };
  };

  assert.deepEqual(canPerformGracefulShutdown("127.0.0.1"), { status: 200, allowed: true });
  assert.deepEqual(canPerformGracefulShutdown("::1"), { status: 200, allowed: true });
  assert.deepEqual(canPerformGracefulShutdown("10.0.0.5"), { status: 403, allowed: false });

  // 2. Simulating launch state progression during restart
  const t0 = 1000;
  // Starting
  assert.equal(
    resolveLaunchStatus({ status: "starting", message: "Launching helper", started_at_ms: t0 }, t0),
    "pending",
  );
  // Running
  assert.equal(
    resolveLaunchStatus({ status: "running", message: "Helper listening on 57321", started_at_ms: t0 + 10 }, t0),
    "success",
  );
  // Incumbent stopped / handover
  assert.equal(
    resolveLaunchStatus({ status: "stopped", message: "Helper shutdown for restart", started_at_ms: t0 + 20 }, t0),
    "failed",
  );
  // Next generation starts
  const t1 = 2000;
  assert.equal(
    resolveLaunchStatus({ status: "running", message: "New helper ready", started_at_ms: t1 + 5 }, t1),
    "success",
  );
});

test("Smoke 4: Redacted diagnostics on error without credential leaks", () => {
  const rawBearer = [
    "Bearer",
    ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0"].join("."),
  ].join(" ");
  const projectKey = ["sk", "proj", "superSecretKey1234567890abcdef12345"].join("-");
  const liveKey = ["sk", "live", "9876543210abcdef"].join("-");
  const rawCrashLog = `
    [ERROR] Connection to upstream failed: 401 Unauthorized
    Authorization: ${rawBearer}
    API Key: ${projectKey}
    Alternative key: ${liveKey}
    Request URL: http://127.0.0.1:57321/v1/responses
  `;

  const sanitized = sanitizeTraceLog(rawCrashLog);

  assert.ok(!sanitized.includes(projectKey), "Must redact sk-proj token");
  assert.ok(!sanitized.includes(liveKey), "Must redact sk-live token");
  assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "Must redact raw Bearer JWT");
  assert.ok(sanitized.includes("Authorization: Bearer [REDACTED]"), "Must redact Bearer header");
  assert.ok(sanitized.includes("sk-***"), "Must replace token with mask");
});
