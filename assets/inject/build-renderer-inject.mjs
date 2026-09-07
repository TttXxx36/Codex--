import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RENDERER_INJECT_MODULES } from "./src/module-order.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = join(scriptDirectory, "src");
const outputPath = join(scriptDirectory, "renderer-inject.js");
const checkOnly = process.argv.includes("--check");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

async function readSourceModule(modulePath) {
  const absolutePath = resolve(sourceDirectory, modulePath);
  const source = await readFile(absolutePath, "utf8");
  if (source.includes("\r\n")) {
    throw new Error(`Renderer source module must use LF line endings: ${modulePath}`);
  }
  if (source.charCodeAt(0) === 0xfeff) {
    throw new Error(`Renderer source module must not contain a BOM: ${modulePath}`);
  }
  return source;
}

async function renderBundle() {
  const modules = await Promise.all(RENDERER_INJECT_MODULES.map(({ path }) => readSourceModule(path)));
  const bundle = modules.join("\n");
  const normalizedBundle = bundle.endsWith("\n") ? bundle : `${bundle}\n`;
  if (!normalizedBundle.startsWith("(() => {\n") || !normalizedBundle.includes("\n})();\n")) {
    throw new Error("Renderer bundle lost its IIFE wrapper");
  }
  if (/^\s*(?:import|export)\s/m.test(normalizedBundle)) {
    throw new Error("Renderer bundle must not contain runtime ESM statements");
  }
  return normalizedBundle;
}

async function main() {
  const bundle = await renderBundle();
  const existing = await readFile(outputPath, "utf8").catch(() => null);
  if (checkOnly) {
    if (existing !== bundle) {
      throw new Error(
        `renderer-inject.js is stale (expected ${sha256(bundle)}, found ${existing ? sha256(existing) : "missing"})`,
      );
    }
    console.log(`renderer-inject.js is up to date (${byteLength(bundle)} bytes, sha256 ${sha256(bundle)})`);
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, bundle, "utf8");
  await rename(temporaryPath, outputPath);
  console.log(`built renderer-inject.js (${byteLength(bundle)} bytes, sha256 ${sha256(bundle)})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
