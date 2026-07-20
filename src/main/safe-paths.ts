import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolves a relative path under a parent boundary directory, where both args
 * are expressed relative to the user's home directory. Returns the absolute
 * resolved path. Throws if the resolved path escapes the boundary even after
 * symlinks are resolved.
 *
 * Realpaths the home dir, the boundary itself (mkdir'd first so the call
 * always succeeds), and the deepest existing ancestor of the target. The
 * target leaf doesn't need to exist — any not-yet-existing suffix is stitched
 * back on so callers can pre-compose paths for files they're about to write.
 *
 * Use this anywhere the API or an agent tool composes a filesystem path from
 * DB-stored or user-supplied data and then performs a write/rename/unlink. A
 * symlink planted anywhere on the path is caught here before fs follows it.
 */
export function safePathInside(boundaryRel: string, targetRel: string): string {
  const realHome = fs.realpathSync(os.homedir());
  const rawBoundary = path.resolve(realHome, boundaryRel);
  fs.mkdirSync(rawBoundary, { recursive: true });
  const realBoundary = fs.realpathSync(rawBoundary);

  const rawTarget = path.resolve(realHome, targetRel);

  let realTarget: string;
  try {
    realTarget = fs.realpathSync(rawTarget);
  } catch {
    let dir = path.dirname(rawTarget);
    let suffix = path.basename(rawTarget);
    while (!fs.existsSync(dir)) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      suffix = path.join(path.basename(dir), suffix);
      dir = parent;
    }
    try {
      realTarget = path.join(fs.realpathSync(dir), suffix);
    } catch {
      realTarget = rawTarget;
    }
  }

  if (
    realTarget !== realBoundary &&
    !realTarget.startsWith(realBoundary + path.sep)
  ) {
    throw new Error(`Path escapes ${boundaryRel}.`);
  }
  return realTarget;
}
