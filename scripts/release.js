const { execSync } = require("node:child_process");
const fs = require("node:fs");

function capture(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function captureOptional(cmd) {
  try {
    return capture(cmd);
  } catch {
    return null;
  }
}

function run(cmd, env) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: env ?? process.env });
}

function fail(msg) {
  console.error(`\n[release] ${msg}`);
  process.exit(1);
}

function writeReleaseNotes(version) {
  const currentTag = `v${version}`;
  const previousTag = captureOptional("git describe --tags --abbrev=0 HEAD^");
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const log = captureOptional(
    `git log ${range} --no-merges --pretty=format:%s%x09%H`,
  );
  const changes = (log ? log.split("\n") : [])
    .map((line) => {
      const separator = line.lastIndexOf("\t");
      if (separator === -1) return null;
      return {
        subject: line.slice(0, separator),
        sha: line.slice(separator + 1),
      };
    })
    .filter(
      (entry) =>
        entry && entry.subject !== version && entry.subject !== currentTag,
    );

  const notes = changes.map(
    ({ subject, sha }) =>
      `- ${subject} ([${sha.slice(0, 7)}](https://github.com/eastechs/trident/commit/${sha}))`,
  );
  if (notes.length === 0) notes.push("- Maintenance release");

  notes.push("");
  notes.push(
    previousTag
      ? `[Full changelog](https://github.com/eastechs/trident/compare/${previousTag}...${currentTag})`
      : `[Source commit](https://github.com/eastechs/trident/tree/${currentTag})`,
  );

  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync("release/release-notes.md", `${notes.join("\n")}\n`);
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
//    DRAFT release in eastechs/trident-releases (releaseType: draft). Supply
//    release metadata explicitly: the public binary repository has no source
//    history, so GitHub's generated notes otherwise link to its Initial commit.
const { version } = require("../package.json");
writeReleaseNotes(version);
run(
  `npx --no-install electron-builder --mac --publish always --config.releaseInfo.releaseName="Trident v${version}" --config.releaseInfo.releaseNotesFile="release/release-notes.md"`,
);

// 5. Push the `npm version` commit + tag to the source repo.
run("git push --follow-tags");

// 6. Drafts are invisible to the updater until published.
console.log(
  `\n[release] v${version} uploaded as a DRAFT to eastechs/trident-releases.` +
    "\n[release] Review and click 'Publish release' to go live:" +
    "\n          https://github.com/eastechs/trident-releases/releases",
);
