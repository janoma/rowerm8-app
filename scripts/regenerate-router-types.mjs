// Regenerate the expo-router typed-routes declaration file used by tsc.
//
// Expo's metro plugin normally writes this file when the dev server runs;
// running tsc/CI without the dev server leaves the file stale. This script
// uses expo-router's own helpers to compute the same output and write it,
// so non-server workflows (typecheck, lint, builds) stay in sync after we
// add or rename routes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "app");
const outFile = path.join(repoRoot, ".expo", "types", "router.d.ts");

// Use a `require` proxy so we can pull in CommonJS modules from this ESM file.
const require = (await import("node:module")).createRequire(import.meta.url);
const {
  default: requireContext,
} = require("expo-router/build/testing-library/require-context-ponyfill.js");
const {
  getTypedRoutesDeclarationFile,
} = require("expo-router/build/typed-routes/generate.js");

if (!fs.existsSync(appDir)) {
  console.error(
    "[regenerate-router-types] app/ directory not found at",
    appDir,
  );
  process.exit(1);
}

const ctx = requireContext(appDir, true, /\.[tj]sx?$/);
const declaration = getTypedRoutesDeclarationFile(ctx);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, declaration, "utf8");
console.log(
  "[regenerate-router-types] wrote",
  path.relative(repoRoot, outFile),
);
