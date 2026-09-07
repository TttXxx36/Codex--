import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".ts", ".tsx"]);

const LEAK_PATTERNS = [
  { label: "Bearer token", pattern: /\bbearer\s+[a-z0-9_.-]{16,}/gi },
  { label: "OpenAI-style key", pattern: /\bsk-[a-z0-9_-]{20,}/gi },
  {
    label: "credential assignment",
    pattern: /\b(?:api[-_]?key|password|secret)["']?\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi,
  },
];

function collectTextFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function findCredentialLeaks(text: string): string[] {
  const matches: string[] = [];
  for (const { label, pattern } of LEAK_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      matches.push(`${label}: ${match[0]}`);
    }
  }
  return matches;
}

test("source and built artifacts contain no literal credentials", () => {
  const files = ["src", "dist"].flatMap((relativeRoot) =>
    collectTextFiles(path.join(PROJECT_ROOT, relativeRoot)),
  );
  const violations: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const leak of findCredentialLeaks(text)) {
      const relativeFile = path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
      violations.push(`${relativeFile}: ${leak}`);
    }
  }

  assert.deepEqual(violations, [], "literal credential-like values must not enter source or build artifacts");
});
