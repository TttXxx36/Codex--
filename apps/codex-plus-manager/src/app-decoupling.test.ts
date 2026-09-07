import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = path.resolve(__dirname, "App.tsx");
const appSource = fs.readFileSync(appPath, "utf-8");

test("App.tsx keeps local screens memoized and extracts OverviewScreen as a view module", () => {
  const expectedScreens = [
    "RelayScreen",
    "RelayEnvironmentScreen",
    "SessionsScreen",
    "ContextScreen",
    "WeixinConnectScreen",
    "EnhanceScreen",
    "DreamSkinScreen",
    "ZedRemoteScreen",
    "UserScriptsScreen",
    "MaintenanceScreen",
    "AboutScreen",
    "SettingsScreen",
  ];

  for (const screenName of expectedScreens) {
    const memoPattern = new RegExp("const\\s+" + screenName + "\\s*=\\s*memo\\(");
    assert.match(
      appSource,
      memoPattern,
      `Expected ${screenName} to be wrapped with React.memo for view decoupling`,
    );
  }
  assert.match(
    appSource,
    /const\s+OverviewScreen\s*=\s*lazy\(\(\)\s*=>\s*import\(["']\.\/views\/OverviewScreen["']\)\)/,
    "Expected OverviewScreen to be loaded through a top-level dynamic import",
  );

  const overviewPath = path.resolve(__dirname, "views", "OverviewScreen.tsx");
  assert.equal(fs.existsSync(overviewPath), true, "Expected OverviewScreen.tsx to exist under src/views");
  const overviewSource = fs.readFileSync(overviewPath, "utf-8");
  assert.match(overviewSource, /export\s+default\s+OverviewScreen/, "Expected the lazy view to expose a default component export");
});

test("App.tsx establishes a Suspense boundary with ScreenLoadingFallback for screen routing", () => {
  assert.match(
    appSource,
    /<Suspense fallback=\{<ScreenLoadingFallback \/>\}>/,
    "Expected screen routing section to be wrapped with <Suspense fallback={<ScreenLoadingFallback />}>",
  );

  assert.match(
    appSource,
    /function ScreenLoadingFallback\(\)/,
    "Expected ScreenLoadingFallback component to be declared",
  );
});
