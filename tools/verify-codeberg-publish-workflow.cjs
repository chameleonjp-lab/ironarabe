#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function sameKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function verifyLegacyWorkflow(text) {
  const errors = [];
  let workflow;
  try { workflow = JSON.parse(text); }
  catch { return ["Retired workflow must use the constrained JSON-compatible YAML notice format."]; }
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(sameKeys(workflow, ["name", "on", "permissions", "jobs"]), "Retired workflow must contain only its name, manual trigger, empty permissions and notice job.");
  check(typeof workflow?.name === "string", "Retired workflow needs a notice name.");
  check(sameKeys(workflow?.on, ["workflow_dispatch"]) && sameKeys(workflow.on.workflow_dispatch, []), "Retired workflow allows only an input-free manual trigger.");
  check(sameKeys(workflow?.permissions, []), "Retired workflow permissions must be empty.");
  check(sameKeys(workflow?.jobs, ["notice"]), "Retired workflow allows only the inert notice job.");
  const notice = workflow?.jobs?.notice;
  check(sameKeys(notice, ["runs-on", "timeout-minutes", "steps"]), "Inert notice job cannot add environment, actions, services or credentials.");
  check(notice?.["runs-on"] === "ubuntu-latest" && notice?.["timeout-minutes"] === 1, "Inert notice must use the bounded hosted runner.");
  check(Array.isArray(notice?.steps) && notice.steps.length === 1, "Inert notice must have exactly one printing step.");
  const step = notice?.steps?.[0];
  check(sameKeys(step, ["name", "run"]) && typeof step?.name === "string", "Retired workflow must not use checkout, Pages, composite or other actions.");
  // A single-quoted printf argument cannot execute commands, redirect files, or expand variables.
  const command = typeof step?.run === "string" ? step.run.match(/^printf '%s\\n' '([^'\r\n]*)'$/) : null;
  check(Boolean(command), "Inert notice permits only printf with one literal argument; scripts and writes are not allowed.");
  if (command) {
    check(/Codeberg/i.test(command[1]) && /retired/i.test(command[1]) && /existing site is unchanged/i.test(command[1]) && /GitHub Pages/.test(command[1]), "Retired notice must explain the replacement while preserving the existing site.");
  }
  check(!text.includes("${{"), "Retired workflow must not reference secrets, tokens or other Actions expressions.");
  return errors;
}

function main() {
  const root = process.cwd();
  const errors = [];
  function read(file) {
    try { return fs.readFileSync(path.join(root, file), "utf8"); }
    catch { errors.push(`Missing historical publication file: ${file}`); return ""; }
  }
  errors.push(...verifyLegacyWorkflow(read(".github/workflows/publish-codeberg-pages.yml")));
  const doc = read("PUBLICATION_VERIFICATION_v1.md");
  const setup = read("CODEBERG_PUBLISH_SETUP_v1.md");
  const release = read("RELEASE_READINESS_v1.md");
  for (const document of [doc, setup, release]) {
    if (!document.includes("https://chameleonjp.codeberg.page/ironarabe/") || !document.includes("is_active")) errors.push("Historical publication documentation must preserve the original URL and activation record.");
  }
  for (const value of ["最大18回", "最大約6分", "Step Summary", "iPhone 17 Pro", "Supabaseを有効化しない"]) {
    if (!doc.includes(value)) errors.push(`Historical publication verification record is missing ${value}.`);
  }
  if (errors.length) {
    fs.writeSync(2, `NG: ${errors.length} retired Codeberg workflow issue(s)\n${errors.map((error) => "- " + error).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  fs.writeSync(1, "OK: retired Codeberg publisher is an inert notice; historical publication documents preserved.\n");
}

if (require.main === module) main();
module.exports = { verifyLegacyWorkflow };
