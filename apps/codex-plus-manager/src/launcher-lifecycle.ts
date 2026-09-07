export type LauncherRuntimeState = "absent" | "starting" | "ready" | "cdp_only";

export type LauncherShutdownReason =
  | "ctrl_c"
  | "ctrl_break"
  | "ctrl_close"
  | "ctrl_logoff"
  | "ctrl_shutdown"
  | "sigint"
  | "sigterm";

export const GRACEFUL_SHUTDOWN_BUDGET_MS = 2_000;

export function launcherRuntimeState(
  processAlive: boolean,
  cdpAvailable: boolean,
): LauncherRuntimeState {
  if (processAlive && cdpAvailable) return "ready";
  if (processAlive) return "starting";
  if (cdpAvailable) return "cdp_only";
  return "absent";
}

export function shouldRecoverStaleLauncher(state: LauncherRuntimeState): boolean {
  return state === "absent";
}

export function buildGracefulShutdownPlan(reason: LauncherShutdownReason) {
  return {
    reason,
    budgetMs: GRACEFUL_SHUTDOWN_BUDGET_MS,
    phases: ["unregister_cdp_hook", "request_helper_shutdown", "release_helper_port"] as const,
    onTimeout: "force_terminate" as const,
  };
}
