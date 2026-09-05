const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire, isBuiltin } = require("node:module");
const ts = require("typescript");

function verifyRuntimeDependencies(root) {
  root = fs.realpathSync(root);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const failures = [];
  let moduleCount = 0;
  let importCount = 0;

  function checkFile(file) {
    moduleCount++;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const resolve = createRequire(file).resolve;
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ((ts.isIdentifier(node.expression) &&
          node.expression.text === "require") ||
          node.expression.kind === ts.SyntaxKind.ImportKeyword) &&
        node.arguments.length &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const specifier = node.arguments[0].text;
        if (!isBuiltin(specifier) && specifier !== "electron") {
          importCount++;
          const relative =
            specifier.startsWith(".") || path.isAbsolute(specifier);
          const dependency = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0];
          const location = path.relative(root, file);
          if (
            !relative &&
            !Object.hasOwn(manifest.dependencies ?? {}, dependency)
          ) {
            failures.push(
              `${location}: ${dependency} is not a declared production dependency`,
            );
          }
          try {
            const resolved = resolve(specifier);
            if (!resolved.startsWith(root + path.sep))
              failures.push(
                `${location}: ${specifier} resolves outside the app`,
              );
          } catch {
            failures.push(
              `${location}: cannot resolve ${specifier} from the app`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".js")) checkFile(file);
    }
  }
  walk(path.join(root, "dist/main"));
  if (moduleCount === 0)
    throw new Error("No compiled main-process modules found.");
  if (failures.length)
    throw new Error(`Runtime dependency check failed:\n${failures.join("\n")}`);
  console.log(
    `Verified ${moduleCount} main-process modules and ${importCount} runtime imports.`,
  );
}

function verifyArchive(archive) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "trident-runtime-check-"),
  );
  try {
    // Resolve against only the actual shipped files, not the development tree.
    require("@electron/asar").extractAll(archive, directory);
    verifyRuntimeDependencies(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function afterPack(context) {
  const resources =
    context.electronPlatformName === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents/Resources",
        )
      : path.join(context.appOutDir, "resources");
  verifyArchive(path.join(resources, "app.asar"));
}

module.exports = afterPack;
module.exports.verifyRuntimeDependencies = verifyRuntimeDependencies;
module.exports.verifyArchive = verifyArchive;

if (require.main === module) {
  const target = path.resolve(process.argv[2] ?? path.join(__dirname, ".."));
  if (target.endsWith(".asar")) verifyArchive(target);
  else verifyRuntimeDependencies(target);
}
