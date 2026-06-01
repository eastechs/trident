const { execSync } = require("node:child_process");

function capture(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function run(cmd, env) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: env ?? process.env });
}

function fail(msg) {
  console.error(`\n[release] ${msg}`);
  process.exit(1);
}

// 1. Working tree must be clean and on `main`. A release builds exactly what is
//    committed; `npm version` (run before this script) leaves a clean tree.
if (capture("git status --porcelain")) {
  fail("working tree is not clean — commit or stash before releasing.");
}
const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  fail(`must release from 'main' (currently on '${branch}').`);
}

// 2. Required env. GH_TOKEN uploads the GitHub release; APPLE_* notarize.
const missing = [
  "GH_TOKEN",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
].filter((k) => !process.env[k]);
if (missing.length) {
  fail(
    `missing env vars: ${missing.join(", ")}\n` +
      "  GH_TOKEN uploads the release — try:  export GH_TOKEN=$(gh auth token)\n" +
      "  APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are required for notarization.",
  );
}

// 3. Build renderer + main.
run("npm run build");

// 4. Package, notarize (afterAllArtifactBuild hook), and upload assets to a
//    DRAFT release in eastechs/trident-releases (releaseType: draft).
run("npx --no-install electron-builder --mac --publish always");

// 5. Push the `npm version` commit + tag to the source repo.
run("git push --follow-tags");

// 6. Drafts are invisible to the updater until published.
const { version } = require("../package.json");
console.log(
  `\n[release] v${version} uploaded as a DRAFT to eastechs/trident-releases.` +
    "\n[release] Review and click 'Publish release' to go live:" +
    "\n          https://github.com/eastechs/trident-releases/releases",
);
