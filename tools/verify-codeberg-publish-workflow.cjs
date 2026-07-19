#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "publish-codeberg-pages.yml");
const docPath = path.join(root, "PUBLICATION_VERIFICATION_v1.md");
const setupPath = path.join(root, "CODEBERG_PUBLISH_SETUP_v1.md");
const releasePath = path.join(root, "RELEASE_READINESS_v1.md");
const errors = [];

function read(file, label) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${label}: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}
function requireTrue(condition, message) {
  if (!condition) errors.push(message);
}
function requireIncludes(text, value, label) {
  requireTrue(text.includes(value), `${label} must include ${JSON.stringify(value)}`);
}

const workflow = read(workflowPath, "publish workflow");
const doc = read(docPath, "publication verification document");
const setup = read(setupPath, "Codeberg setup document");
const release = read(releasePath, "release readiness document");

const triggerBlock = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("permissions:"));
requireIncludes(triggerBlock, "workflow_dispatch:", "workflow trigger");
requireTrue(!/^\s{2}(push|pull_request|schedule):/m.test(triggerBlock), "workflow must not have automatic triggers");
requireIncludes(workflow, "default: true", "workflow");
requireIncludes(workflow, 'confirmation }}" == "VERIFY"', "workflow");
requireIncludes(workflow, 'confirmation }}" == "PUBLISH"', "workflow");
requireIncludes(workflow, "ref: pages", "workflow");
requireIncludes(workflow, "git push --dry-run", "workflow");
requireIncludes(workflow, "--force-with-lease", "workflow");
requireIncludes(workflow, "Verify Codeberg pages branch SHA", "workflow");
requireIncludes(workflow, "Wait for public Codeberg Pages version", "workflow");
requireIncludes(workflow, "PUBLIC_RELEASE_URL", "workflow");
requireIncludes(workflow, "PUBLIC_VERIFY_ATTEMPTS: '18'", "workflow");
requireIncludes(workflow, "PUBLIC_VERIFY_INTERVAL_SECONDS: '20'", "workflow");
requireIncludes(workflow, "Cache-Control: no-cache", "workflow");
requireIncludes(workflow, "GITHUB_RUN_ID", "workflow");
requireIncludes(workflow, "source_index_blob", "workflow");
requireIncludes(workflow, "<title>イロナラベ</title>", "workflow");
requireIncludes(workflow, "GITHUB_STEP_SUMMARY", "workflow");
requireIncludes(workflow, "if: ${{ always() }}", "workflow");
requireTrue(!workflow.includes("supabase.co"), "workflow must not call Supabase");
requireTrue(!/update\s+public\.games/i.test(workflow), "workflow must not update public.games");
const tokenLines = workflow.split(/\r?\n/).filter((line) => /^\s+CODEBERG_TOKEN:/.test(line));
requireTrue(tokenLines.length > 0, "workflow must reference CODEBERG_TOKEN as a secret");
for (const line of tokenLines) {
  requireTrue(line.includes("${{ secrets.CODEBERG_TOKEN }}"), "CODEBERG_TOKEN must only come from GitHub Actions Secrets");
}

for (const text of [doc, setup, release]) {
  requireIncludes(text, "https://chameleonjp.codeberg.page/ironarabe/", "release documentation");
  requireIncludes(text, "is_active", "release documentation");
}
requireIncludes(doc, "最大18回", "publication verification document");
requireIncludes(doc, "最大約6分", "publication verification document");
requireIncludes(doc, "Step Summary", "publication verification document");
requireIncludes(doc, "iPhone 17 Pro", "publication verification document");
requireIncludes(doc, "Supabaseを有効化しない", "publication verification document");

if (errors.length) {
  console.error(`NG: ${errors.length} Codeberg publish workflow issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: Codeberg publish workflow contract verified");
