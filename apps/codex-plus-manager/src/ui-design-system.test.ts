import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("button.tsx defines standard button variants including destructive and focus rings", () => {
  const buttonSource = fs.readFileSync(path.resolve(__dirname, "components/ui/button.tsx"), "utf8");
  assert.match(buttonSource, /default:\s*"/);
  assert.match(buttonSource, /secondary:\s*"/);
  assert.match(buttonSource, /destructive:\s*"/);
  assert.match(buttonSource, /outline:\s*"/);
  assert.match(buttonSource, /ghost:\s*"/);
  assert.match(buttonSource, /focus-visible:outline-none/);
});

test("badge.tsx defines semantic status variants", () => {
  const badgeSource = fs.readFileSync(path.resolve(__dirname, "components/ui/badge.tsx"), "utf8");
  assert.match(badgeSource, /default:\s*"/);
  assert.match(badgeSource, /secondary:\s*"/);
  assert.match(badgeSource, /outline:\s*"/);
  assert.match(badgeSource, /success:\s*"/);
  assert.match(badgeSource, /warning:\s*"/);
  assert.match(badgeSource, /destructive:\s*"/);
});

test("styles.css enforces unified design tokens, theme contrast and responsive protection", () => {
  const stylesSource = fs.readFileSync(path.resolve(__dirname, "styles.css"), "utf8");

  // 1. 验证通用按钮规范体系
  assert.match(stylesSource, /\.btn\s*\{/);
  assert.match(stylesSource, /\.btn-primary\s*\{/);
  assert.match(stylesSource, /\.btn-secondary\s*\{/);
  assert.match(stylesSource, /\.btn-danger\s*\{/);
  assert.match(stylesSource, /\.btn:focus-visible\s*\{/);

  // 2. 验证 Badge 规范体系
  assert.match(stylesSource, /\.badge-success\s*\{/);
  assert.match(stylesSource, /\.badge-warning\s*\{/);
  assert.match(stylesSource, /\.badge-danger\s*\{/);

  // 3. 验证浅色主题对比度收敛
  assert.match(stylesSource, /\.light \.text-muted-foreground\s*\{/);
  assert.match(stylesSource, /\.light \.btn-secondary\s*\{/);

  // 4. 验证文字截断与响应式排版保护
  assert.match(stylesSource, /overflow-wrap:\s*anywhere;/);
  assert.match(stylesSource, /word-break:\s*break-word;/);
});
