#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const verifiers = [
  "verify-production-ui.cjs",
  "verify-ranking-ui-v12.cjs",
  "verify-stage-pack-v13.cjs",
  "verify-result-only-v14.cjs",
  "verify-release-contract.cjs",
  "verify-codeberg-publish-workflow.cjs",
  "verify-difficulty-lab.cjs"
];
let failed = false;
for (const verifier of verifiers) {
  const result = spawnSync(process.execPath, [path.join("tools", verifier)], { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`NG: ${verifier}${result.error ? ": " + result.error.message : ""}`);
  }
}
process.exitCode = failed ? 1 : 0;
