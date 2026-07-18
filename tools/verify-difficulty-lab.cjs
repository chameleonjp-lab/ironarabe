#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const labPath = path.join(repoRoot, "tools", "difficulty-lab.html");
const corePath = path.join(repoRoot, "tools", "difficulty-core.js");
const studyPath = path.join(repoRoot, "DIFFICULTY_STUDY_v1.md");

const errors = [];
function requireTrue(condition, message) {
  if (!condition) errors.push(message);
}
function count(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

for (const filePath of [labPath, corePath, studyPath]) {
  requireTrue(fs.existsSync(filePath), `missing file: ${path.relative(repoRoot, filePath)}`);
}

if (errors.length === 0) {
  const lab = fs.readFileSync(labPath, "utf8");
  const core = require(corePath);
  const study = fs.readFileSync(studyPath, "utf8");

  requireTrue(core.candidates.length === 3, "candidate count must be 3");
  requireTrue(new Set(core.candidates.map((candidate) => candidate.candidateId)).size === 3, "candidate IDs must be unique");
  requireTrue(core.candidates.some((candidate) => candidate.seed === "ironarabe-study-easy-074306"), "candidate A seed missing");
  requireTrue(core.candidates.some((candidate) => candidate.seed === "ironarabe-official-001-v1"), "candidate B seed missing");
  requireTrue(core.candidates.some((candidate) => candidate.seed === "ironarabe-study-hard-000010"), "candidate C seed missing");

  const forbidden = [
    [/(^|[^A-Za-z])fetch\s*\(/, "fetch call"],
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/WebSocket/, "WebSocket"],
    [/submit_score/, "submit_score"],
    [/supabase\.co/i, "Supabase URL"],
    [/sb_publishable_/i, "Publishable key"],
    [/ironarabe\.v2\./, "production localStorage key"],
    [/\balert\s*\(/, "alert call"],
    [/\bprompt\s*\(/, "prompt call"]
  ];
  for (const [pattern, label] of forbidden) {
    requireTrue(!pattern.test(lab), `difficulty lab contains forbidden ${label}`);
  }

  requireTrue(/sessionToken/.test(lab), "sessionToken management missing");
  requireTrue(/countdownToken/.test(lab), "countdownToken management missing");
  requireTrue(/countdownTimerIds/.test(lab), "countdown timer ID management missing");
  requireTrue(/clearCountdownTimers/.test(lab), "clearCountdownTimers missing");
  requireTrue(/cancelAnimationFrame/.test(lab), "requestAnimationFrame cancellation missing");
  requireTrue(/state\.phase/.test(lab), "phase state missing");
  requireTrue(/state\.isPlaying/.test(lab), "isPlaying guard missing");
  requireTrue(/state\.isCleared/.test(lab), "isCleared guard missing");
  requireTrue(/globalThis\.crypto/.test(lab), "safe crypto lookup missing");
  requireTrue(!/if\s*\(\s*crypto\s*&&/.test(lab), "unsafe direct crypto reference remains");
  requireTrue(/document\.execCommand\("copy"\)/.test(lab), "textarea copy fallback missing");
  requireTrue(/if\s*\(\s*!copied\s*\)/.test(lab), "execCommand false result is not rejected");
  requireTrue(/attemptCount/.test(lab), "attempt count state missing");
  requireTrue(/挑戦回数/.test(lab), "attempt count display missing");
  requireTrue(/aria-live="assertive"/.test(lab), "assertive live region missing");
  requireTrue(/aria-live="polite"/.test(lab), "polite live region missing");
  requireTrue(/button\.disabled\s*=\s*true/.test(lab), "fixed tile disabled state missing");
  requireTrue(/\.tile\{[^}]*appearance:none/.test(lab), "tile button appearance reset missing");
  requireTrue(/\.tile\.fixed:disabled\{[^}]*opacity:1/.test(lab), "fixed tile disabled opacity reset missing");
  requireTrue(/state\.results\.some\([^\n]*candidateId/.test(lab), "duplicate candidate result guard missing");
  requireTrue(/state\.results\.length\s*!==\s*3/.test(lab), "three-result summary guard missing");
  requireTrue(count(lab, /difficulty-core\.js/g) === 1, "difficulty-core.js must be loaded once");

  requireTrue(/挑戦回数/.test(study), "study document attempt-count explanation missing");
  requireTrue(/カウントダウン/.test(study), "study document countdown stabilization missing");
  requireTrue(/ブラウザ上の3候補完走/.test(study), "study document manual completion warning missing");
}

if (errors.length > 0) {
  console.error(`NG: ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK: difficulty lab static contract verified");
