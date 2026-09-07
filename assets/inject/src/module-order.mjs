/**
 * The renderer bundle is intentionally assembled in lexical order.
 *
 * These files are source modules for the injection runtime, not independently
 * executable browser modules: the existing renderer code relies on one shared
 * closure for private state and function declarations. Keep this order stable
 * until a later architecture pass introduces explicit dependency injection.
 */
export const RENDERER_INJECT_MODULES = [
  { path: "entry/open.js", kind: "runtime" },
  { path: "core/bootstrap.js", kind: "bootstrap" },
  { path: "core/runtime-state.js", kind: "runtime" },
  { path: "patch/service-tier.js", kind: "patch" },
  { path: "bridge/backend.js", kind: "bridge" },
  { path: "patch/marketplace.js", kind: "patch" },
  { path: "session/history-scroll.js", kind: "session" },
  { path: "session/markdown.js", kind: "session" },
  { path: "patch/model.js", kind: "patch" },
  { path: "dom/project-branch.js", kind: "dom" },
  { path: "session/actions.js", kind: "session" },
  { path: "dom/conversation.js", kind: "dom" },
  { path: "dom/zed-session-menu.js", kind: "dom" },
  { path: "core/lifecycle.js", kind: "lifecycle" },
  { path: "entry/close.js", kind: "runtime" },
  { path: "entry/separator.js", kind: "separator" },
  { path: "features/paste-fix.js", kind: "feature" },
];
