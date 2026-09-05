const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");

function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function captureOptional(command, args) {
  try {
    return capture(command, args);
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
  const previousTag = captureOptional("git", [
    "describe",
    "--tags",
    "--abbrev=0",
    "HEAD^",
  ]);
  const previousRevision = previousTag
    ? captureOptional("git", [
        "rev-list",
        "-n",
        "1",
        `refs/tags/${previousTag}`,
      ])
    : null;
  const range = previousRevision ? `${previousRevision}..HEAD` : "HEAD";
  const log = captureOptional("git", [
    "log",
    range,
    "--no-merges",
    "--pretty=format:%s",
  ]);
  const changes = (log ? log.split("\n") : []).filter(
    (subject) => subject !== version && subject !== currentTag,
  );

  const notes = [
    `Source: [${currentTag}](https://github.com/eastechs/trident/tree/${currentTag}) · [Source archive](https://github.com/eastechs/trident/archive/refs/tags/${currentTag}.tar.gz)`,
    "",
    "Requires macOS 13 Ventura or later on Apple Silicon.",
    "",
    "## What's changed",
    "",
  ];
  if (changes.length > 0) {
    notes.push(...changes.map((subject) => `- ${subject}`));
  } else {
    notes.push("- Maintenance and reliability improvements");
  }

  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync("release/release-notes.md", `${notes.join("\n")}\n`);
}

async function githubRequest(path, options = {}) {
  const response = await fetch(
    `https://api.github.com/repos/eastechs/trident-releases${path}`,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        "User-Agent": "trident-release-script",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `GitHub release API failed (${response.status}): ${detail}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

async function updatePublicRelease(version) {
  const releases = await githubRequest("/releases?per_page=100");
  const tag = `v${version}`;
  const release = releases.find(
    (candidate) =>
      candidate.draft &&
      (candidate.tag_name === tag || candidate.tag_name === version),
  );
  if (!release) {
    throw new Error(`GitHub draft release ${tag} was not found after upload.`);
  }

  await githubRequest(`/releases/${release.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: `Trident v${version}`,
      body: fs.readFileSync("release/release-notes.md", "utf8"),
    }),
  });
}

async function main() {
  // 1. Working tree must be clean and on `main`. A release builds exactly what
  //    is committed; `npm version` (run before this script) leaves a clean tree.
  if (capture("git", ["status", "--porcelain"])) {
    fail("working tree is not clean — commit or stash before releasing.");
  }
  const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    fail(`must release from 'main' (currently on '${branch}').`);
  }

  // 2. Required env. GH_TOKEN uploads the GitHub release; APPLE_* notarize.
  const missing = [
    "GH_TOKEN",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ].filter((key) => !process.env[key]);
  if (missing.length) {
    fail(
      `missing env vars: ${missing.join(", ")}\n` +
        "  GH_TOKEN uploads the release.\n" +
        "  APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are required for notarization.",
    );
  }

  // Preflight the same API and token used to edit the draft before doing the
  // expensive build/notarization/upload work.
  await githubRequest("/releases?per_page=1");

  // 3. Build renderer + main.
  run("npm run build");

  // 4. Package, notarize (afterAllArtifactBuild hook), and upload assets to a
  //    DRAFT release in eastechs/trident-releases (releaseType: draft). Supply
  //    release metadata explicitly: the public binary repository has no source
  //    history, so GitHub's generated notes otherwise show only its Initial
  //    commit. Generate notes from source history with matching source links.
  const { version } = require("../package.json");
  writeReleaseNotes(version);
  run(
    `npx --no-install electron-builder --mac --publish always --config.mac.releaseInfo.releaseName="Trident v${version}" --config.mac.releaseInfo.releaseNotesFile="release/release-notes.md"`,
  );

  // electron-builder uses releaseInfo for updater metadata, but its GitHub
  // publisher does not apply that metadata to the GitHub release page. Update
  // the draft explicitly through the API so the public title and body contain
  // the same self-contained details before a maintainer publishes it.
  await updatePublicRelease(version);

  // 5. Push the `npm version` commit + tag to the source repo.
  run("git push --follow-tags");

  // 6. Drafts are invisible to the updater until published.
  console.log(
    `\n[release] v${version} uploaded as a DRAFT to eastechs/trident-releases.` +
      "\n[release] Review and click 'Publish release' to go live:" +
      "\n          https://github.com/eastechs/trident-releases/releases",
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
