import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = path.resolve(__dirname, "App.tsx");
const appSource = fs.readFileSync(appPath, "utf-8");


test("App.tsx extracts every routed screen as a memoized lazy view module", () => {
  const lazyScreens = [
    "OverviewScreen",
    "SessionsScreen",
    "DiagnosticsScreen",
    "RelayScreen",
    "RelayEnvironmentScreen",
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

  for (const screenName of lazyScreens) {
    const modulePath = `./views/${screenName}`;
    const lazyPattern = new RegExp(`const\\s+${screenName}\\s*=\\s*lazy\\(\\(\\)\\s*=>\\s*import\\([\"']${modulePath}[\"']\\)\\)`);
    assert.match(appSource, lazyPattern, `Expected ${screenName} to be loaded through a top-level dynamic import`);

    const screenPath = path.resolve(__dirname, "views", `${screenName}.tsx`);
    assert.equal(fs.existsSync(screenPath), true, `Expected ${screenName}.tsx to exist under src/views`);
    const screenSource = fs.readFileSync(screenPath, "utf-8");
    assert.match(screenSource, new RegExp(`export\\s+default\\s+${screenName}`), `Expected ${screenName} to expose a default component export`);
    assert.match(screenSource, new RegExp(`(?:export\\s+)?const\\s+${screenName}\\s*=\\s*memo\\(`), `Expected ${screenName} to remain memoized after extraction`);
  }

  const routedScreens: Array<[string, string]> = [
    ["overview", "OverviewScreen"],
    ["relay", "RelayScreen"],
    ["relayEnvironment", "RelayEnvironmentScreen"],
    ["sessions", "SessionsScreen"],
    ["context", "ContextScreen"],
    ["weixin", "WeixinConnectScreen"],
    ["enhance", "EnhanceScreen"],
    ["dreamSkin", "DreamSkinScreen"],
    ["zedRemote", "ZedRemoteScreen"],
    ["userScripts", "UserScriptsScreen"],
    ["maintenance", "MaintenanceScreen"],
    ["about", "AboutScreen"],
    ["settings", "SettingsScreen"],
  ];
  for (const [route, screenName] of routedScreens) {
    assert.match(
      appSource,
      new RegExp(`route\\s*===\\s*["']${route}["'][\\s\\S]*?<${screenName}`),
      `Expected the ${route} route to render the extracted lazy screen`,
    );
  }
  assert.match(appSource, /diagnosticsScreen=\{<DiagnosticsScreen/, "Expected the about route to render the extracted diagnostics screen");
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
