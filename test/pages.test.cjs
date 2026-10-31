"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFile, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const runAsync = promisify(execFile);
const repository = path.resolve(__dirname, "..");
const builder = path.join(repository, "tools/prepare-github-pages.cjs");
const verifier = path.join(repository, "tools/verify-github-pages.cjs");
const legacyVerifier = path.join(repository, "tools/verify-codeberg-publish-workflow.cjs");
const sha = "0123456789abcdef0123456789abcdef01234567";
const runtimeFiles = ["index.html", "js/language-options.js", "js/translations.js", "js/i18n.js", "js/sound-effects.js", "js/stage-pack.js", "js/guest-plays.js"];
// Plain CLI subprocesses must not inherit node:test's child IPC protocol.
const toolEnvironment = { ...process.env };
delete toolEnvironment.NODE_TEST_CONTEXT;

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ironarabe-pages-test-"));
  const source = path.join(directory, "source");
  const output = path.join(directory, "site");
  fs.mkdirSync(path.join(source, "js"), { recursive: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const scripts = runtimeFiles.slice(1).map((file) => `<script src="./${file}"></script>`).join("\n");
  fs.writeFileSync(path.join(source, "index.html"), `<!doctype html><html><head><title>イロナラベ</title></head><body>${scripts}<script>
  const GAME_SLUG='ironarabe', CHALLENGE_ID='ironarabe-official-001', BOARD_VERSION=2, CLIENT_VERSION='ironarabe-web-1.4.1-stagepack001-v2';
  const SHUFFLE_SEED='ironarabe-official-001-v1';
  </script></body></html>`);
  for (const file of runtimeFiles.slice(1)) fs.writeFileSync(path.join(source, file), `/* fixture ${file} */\n`);
  return { directory, source, output };
}

function run(file, args, cwd) {
  return spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", env: toolEnvironment });
}

function build(f, extra = []) {
  return run(builder, ["--source", f.source, "--output", f.output, "--sha", sha, ...extra], f.source);
}

function checkBuild(f) {
  const result = build(f);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(fs.readFileSync(path.join(f.output, "release.json"), "utf8"));
}

function filesIn(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = prefix + entry.name;
    return entry.isDirectory() ? filesIn(path.join(directory, entry.name), file + "/") : [file];
  }).sort();
}

test("Pages build excludes repository, tools, historical releases and private files", (t) => {
  const f = fixture(t);
  for (const file of ["README.md", ".env", ".git/config", "tools/difficulty-lab.html", "release/private.json", "js/debug.js"]) {
    fs.mkdirSync(path.dirname(path.join(f.source, file)), { recursive: true });
    fs.writeFileSync(path.join(f.source, file), "must not be public");
  }
  checkBuild(f);
  assert.deepEqual(filesIn(f.output), ["index.html", "js/guest-plays.js", "js/i18n.js", "js/language-options.js", "js/sound-effects.js", "js/stage-pack.js", "js/translations.js", "release.json"]);
  for (const file of runtimeFiles) assert.deepEqual(fs.readFileSync(path.join(f.output, file)), fs.readFileSync(path.join(f.source, file)));
});

test("release metadata identifies the UI release without changing ranking compatibility", (t) => {
  const f = fixture(t);
  const release = checkBuild(f);
  assert.equal(release.build_sha, sha);
  assert.equal(release.source_sha, sha);
  assert.equal(release.ui_release, "ironarabe-web-1.6.2-x-share");
  assert.equal(release.client_version, "ironarabe-web-1.4.1-stagepack001-v2");
  assert.equal(release.game_slug, "ironarabe");
  assert.equal(release.challenge_id, "ironarabe-official-001");
  assert.equal(release.board_version, 2);
  assert.equal(release.shuffle_seed, "ironarabe-official-001-v1");
  assert.deepEqual(Object.keys(release.integrity).sort(), runtimeFiles.slice().sort());
  for (const file of runtimeFiles) {
    const expected = "sha256-" + crypto.createHash("sha256").update(fs.readFileSync(path.join(f.source, file))).digest("base64");
    assert.equal(release.integrity[file], expected);
  }
});

test("build refuses missing runtime dependencies and preserves a previous valid artifact", (t) => {
  const f = fixture(t);
  checkBuild(f);
  const previous = fs.readFileSync(path.join(f.output, "release.json"), "utf8");
  fs.unlinkSync(path.join(f.source, "js/i18n.js"));
  const result = build(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing.*js\/i18n\.js/i);
  assert.equal(fs.readFileSync(path.join(f.output, "release.json"), "utf8"), previous);
});

test("build rejects symlinked runtime files instead of following them outside the source", (t) => {
  const f = fixture(t);
  const secret = path.join(f.directory, "private.txt");
  fs.writeFileSync(secret, "private fixture");
  fs.unlinkSync(path.join(f.source, "js/i18n.js"));
  fs.symlinkSync(secret, path.join(f.source, "js/i18n.js"));
  const result = build(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink|regular file/i);
  assert.equal(fs.existsSync(f.output), false);
});

test("build rejects local scripts outside the public allowlist", (t) => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.source, "index.html"), '<script src="tools/difficulty-core.js"></script>');
  const result = build(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /script.*allowlist|unsupported.*script/i);
});

test("canonical metadata is accepted without allowing external stylesheet dependencies", (t) => {
  const f = fixture(t);
  const index = path.join(f.source, "index.html");
  fs.writeFileSync(index, fs.readFileSync(index, "utf8").replace("<head>", '<head><link rel="canonical" href="https://chameleonjp-lab.github.io/ironarabe/">'));
  checkBuild(f);
  fs.appendFileSync(index, '<link rel="stylesheet" href="https://example.invalid/theme.css">');
  const dependency = build(f);
  assert.notEqual(dependency.status, 0);
  assert.match(dependency.stderr, /resource.*allowlist|unsupported.*resource/i);
});

test("build rejects ranking-contract changes and malformed commit IDs", (t) => {
  const f = fixture(t);
  const index = path.join(f.source, "index.html");
  fs.writeFileSync(index, fs.readFileSync(index, "utf8").replace("BOARD_VERSION=2", "BOARD_VERSION=3"));
  const changedContract = build(f);
  assert.notEqual(changedContract.status, 0);
  assert.match(changedContract.stderr, /BOARD_VERSION|board.version/i);
  const invalidSha = run(builder, ["--source", f.source, "--output", f.output, "--sha", "refs/heads/pages"], f.source);
  assert.notEqual(invalidSha.status, 0);
  assert.match(invalidSha.stderr, /sha|commit/i);
});

test("build refuses to overwrite the source tree or an unrelated existing directory", (t) => {
  const f = fixture(t);
  const overwriteSource = run(builder, ["--source", f.source, "--output", f.source, "--sha", sha], f.source);
  assert.notEqual(overwriteSource.status, 0);
  assert.equal(fs.existsSync(path.join(f.source, "index.html")), true);
  fs.mkdirSync(f.output);
  fs.writeFileSync(path.join(f.output, "keep.txt"), "keep");
  const overwriteUnmanaged = build(f);
  assert.notEqual(overwriteUnmanaged.status, 0);
  assert.equal(fs.readFileSync(path.join(f.output, "keep.txt"), "utf8"), "keep");
});

test("strict production build accepts committed files and rejects dirty runtime content", (t) => {
  const f = fixture(t);
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: f.source, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet"]);
  git(["add", "index.html", "js"]);
  git(["-c", "user.name=Pages Test", "-c", "user.email=pages-test@example.invalid", "commit", "--quiet", "-m", "fixture"]);
  const commit = git(["rev-parse", "HEAD"]);
  const args = ["--source", f.source, "--output", f.output, "--sha", commit, "--require-clean"];
  const committed = run(builder, args, f.source);
  assert.equal(committed.status, 0, committed.stderr);
  fs.appendFileSync(path.join(f.source, "js/i18n.js"), "/* uncommitted */");
  const dirty = run(builder, args, f.source);
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /commit|dirty|match/i);
});

test("artifact verifier detects changed bytes, extra files and a different build SHA", (t) => {
  const f = fixture(t);
  checkBuild(f);
  const args = ["--dir", f.output, "--sha", sha];
  assert.equal(run(verifier, args, f.source).status, 0);
  fs.appendFileSync(path.join(f.output, "js/sound-effects.js"), "tampered");
  const tampered = run(verifier, args, f.source);
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /integrity|hash/i);
  checkBuild(f);
  fs.writeFileSync(path.join(f.output, "private.txt"), "must not be public");
  const extra = run(verifier, args, f.source);
  assert.notEqual(extra.status, 0);
  assert.match(extra.stderr, /allowlist|unexpected/i);
  fs.unlinkSync(path.join(f.output, "private.txt"));
  const wrongSha = run(verifier, ["--dir", f.output, "--sha", "f".repeat(40)], f.source);
  assert.notEqual(wrongSha.status, 0);
  assert.match(wrongSha.stderr, /sha|commit/i);
});

test("public verification reads the deployed build SHA and checks every runtime hash", async (t) => {
  const f = fixture(t);
  checkBuild(f);
  const expectedRelease = path.join(f.directory, "expected-release.json");
  fs.copyFileSync(path.join(f.output, "release.json"), expectedRelease);
  const served = new Set();
  const server = http.createServer((request, response) => {
    const file = new URL(request.url, "http://localhost").pathname.replace(/^\/ironarabe\//, "") || "index.html";
    if (!runtimeFiles.includes(file) && file !== "release.json") {
      response.writeHead(404).end();
      return;
    }
    served.add(file);
    response.end(fs.readFileSync(path.join(f.output, file)));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/ironarabe/`;
  const args = ["--url", baseUrl, "--sha", sha, "--expected-release", expectedRelease, "--attempts", "1", "--interval-ms", "1"];
  const result = await runAsync(process.execPath, [verifier, ...args], { cwd: f.source, env: toolEnvironment });
  assert.match(result.stdout, /verified/i);
  assert.deepEqual([...served].sort(), ["index.html", "js/guest-plays.js", "js/i18n.js", "js/language-options.js", "js/sound-effects.js", "js/stage-pack.js", "js/translations.js", "release.json"]);
  fs.appendFileSync(path.join(f.output, "js/translations.js"), "corrupted public bytes");
  await assert.rejects(runAsync(process.execPath, [verifier, ...args], { cwd: f.source, env: toolEnvironment }), /integrity|hash/i);
  const forged = JSON.parse(fs.readFileSync(path.join(f.output, "release.json"), "utf8"));
  forged.integrity["js/translations.js"] = "sha256-" + crypto.createHash("sha256").update(fs.readFileSync(path.join(f.output, "js/translations.js"))).digest("base64");
  fs.writeFileSync(path.join(f.output, "release.json"), JSON.stringify(forged));
  await assert.rejects(runAsync(process.execPath, [verifier, ...args], { cwd: f.source, env: toolEnvironment }), /expected.*artifact|commit.*hash|integrity/i);
});

function legacyFixture(t) {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, ".github/workflows"), { recursive: true });
  for (const file of ["PUBLICATION_VERIFICATION_v1.md", "CODEBERG_PUBLISH_SETUP_v1.md", "RELEASE_READINESS_v1.md"]) {
    fs.copyFileSync(path.join(repository, file), path.join(f.source, file));
  }
  const workflow = {
    name: "Legacy Codeberg publication notice",
    on: { workflow_dispatch: {} },
    permissions: {},
    jobs: {
      notice: {
        "runs-on": "ubuntu-latest",
        "timeout-minutes": 1,
        steps: [{ name: "Explain retired publisher", run: "printf '%s\\n' 'Codeberg publishing is retired. The existing site is unchanged. Use the GitHub Pages workflow after merging into the default branch.'" }]
      }
    }
  };
  const write = () => fs.writeFileSync(path.join(f.source, ".github/workflows/publish-codeberg-pages.yml"), JSON.stringify(workflow, null, 2) + "\n");
  write();
  return { ...f, workflow, write };
}

test("legacy verifier accepts only an inert manual notice while preserving historical docs", (t) => {
  const f = legacyFixture(t);
  const result = run(legacyVerifier, [], f.source);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /retired|inert/i);
});

test("legacy verifier rejects publishing, secrets, write permissions and automatic triggers", (t) => {
  const mutations = [
    ["checkout", (workflow) => { workflow.jobs.notice.steps.push({ uses: "actions/checkout@v4" }); }],
    ["push", (workflow) => { workflow.jobs.notice.steps[0].run = "git push origin HEAD:pages"; }],
    ["secret", (workflow) => { workflow.jobs.notice.env = { TOKEN: "${{ secrets.CODEBERG_TOKEN }}" }; }],
    ["write permission", (workflow) => { workflow.permissions = { contents: "write" }; }],
    ["automatic trigger", (workflow) => { workflow.on.push = {}; }],
    ["shell substitution", (workflow) => { workflow.jobs.notice.steps[0].run = "printf '%s\\n' \"$(curl https://example.invalid/run)\""; }]
  ];
  for (const [label, mutate] of mutations) {
    const f = legacyFixture(t);
    mutate(f.workflow);
    f.write();
    const result = run(legacyVerifier, [], f.source);
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /retired|inert|notice|permission|trigger|allowed/i, label);
  }
});
