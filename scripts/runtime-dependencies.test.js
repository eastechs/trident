const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  verifyRuntimeDependencies,
} = require("./check-runtime-dependencies.js");

test("runtime checks reject development-only, missing, and outside-app dependencies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trident-runtime-test-"));
  try {
    const dependency = "trident-runtime-fixture";
    fs.mkdirSync(path.join(root, "dist/main"), { recursive: true });
    fs.mkdirSync(path.join(root, "node_modules", dependency), {
      recursive: true,
    });
    const entry = path.join(root, "dist/main/index.js");
    fs.writeFileSync(
      entry,
      `require('node:fs'); require('electron'); require('${dependency}');`,
    );
    const packageFile = path.join(root, "package.json");
    const dependencyFile = path.join(
      root,
      "node_modules",
      dependency,
      "index.js",
    );
    fs.writeFileSync(dependencyFile, "module.exports = {};");
    fs.writeFileSync(
      packageFile,
      JSON.stringify({ devDependencies: { [dependency]: "1.0.0" } }),
    );
    assert.throws(
      () => verifyRuntimeDependencies(root),
      /not a declared production dependency/,
    );
    fs.writeFileSync(
      packageFile,
      JSON.stringify({ dependencies: { [dependency]: "1.0.0" } }),
    );
    assert.doesNotThrow(() => verifyRuntimeDependencies(root));
    // Use a different name to avoid Node's successful-resolution cache.
    fs.writeFileSync(entry, "require('trident-missing-runtime-fixture');");
    fs.writeFileSync(
      packageFile,
      JSON.stringify({
        dependencies: { "trident-missing-runtime-fixture": "1.0.0" },
      }),
    );
    assert.throws(() => verifyRuntimeDependencies(root), /cannot resolve/);
    fs.writeFileSync(entry, `require(${JSON.stringify(__filename)});`);
    assert.throws(
      () => verifyRuntimeDependencies(root),
      /resolves outside the app/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
