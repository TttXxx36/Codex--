import assert from "node:assert/strict";
import test from "node:test";

import {
  GRACEFUL_SHUTDOWN_BUDGET_MS,
  buildGracefulShutdownPlan,
  launcherRuntimeState,
  shouldRecoverStaleLauncher,
} from "./launcher-lifecycle.ts";

test("launcher runtime state converges process and CDP observations", () => {
  assert.equal(launcherRuntimeState(false, false), "absent");
  assert.equal(launcherRuntimeState(true, false), "starting");
  assert.equal(launcherRuntimeState(true, true), "ready");
  assert.equal(launcherRuntimeState(false, true), "cdp_only");
});

test("stale recovery only runs after both process and CDP observations are absent", () => {
  assert.equal(shouldRecoverStaleLauncher("absent"), true);
  assert.equal(shouldRecoverStaleLauncher("starting"), false);
  assert.equal(shouldRecoverStaleLauncher("ready"), false);
  assert.equal(shouldRecoverStaleLauncher("cdp_only"), false);
});

test("termination signals share a two-second cleanup budget and ordered phases", () => {
  const plan = buildGracefulShutdownPlan("ctrl_close");

  assert.equal(GRACEFUL_SHUTDOWN_BUDGET_MS, 2_000);
  assert.deepEqual(plan, {
    reason: "ctrl_close",
    budgetMs: 2_000,
    phases: ["unregister_cdp_hook", "request_helper_shutdown", "release_helper_port"],
    onTimeout: "force_terminate",
  });
});
