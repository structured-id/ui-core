// Verify the exact source archive in a consumer outside this checkout. This
// catches missing Vue/TS files and SDK imports that workspace tests can hide.
import { mkdtempSync, cpSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const work = mkdtempSync(join(tmpdir(), "sid-ui-package-"));
function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || "");
    throw new Error(`${command} failed with status ${result.status}`);
  }
  return result.stdout;
}

try {
  const archive = join(work, "ui-core.tgz");
  run("yarn", ["pack", "--out", archive]);
  const entries = run("tar", ["-tzf", archive], root, true).split("\n");
  if (
    entries.some((entry) =>
      /^package\/(?:dist\/|proto\/|src\/(?:generated|transport|browser-vp)\/)/.test(
        entry,
      ),
    )
  ) {
    throw new Error("Archive contains a removed implementation or build tree");
  }
  const packed = JSON.parse(
    run("tar", ["-xOzf", archive, "package/package.json"], root, true),
  );
  if (
    packed.exports["./proto"] ||
    packed.exports["./browser-vp"] ||
    packed.resolutions ||
    packed.scripts.generate ||
    !packed.dependencies["@structured-id/proto"]?.startsWith("^")
  ) {
    throw new Error(
      "Packed manifest does not consume the published SDK directly",
    );
  }
  cpSync(join(root, "ci/package-consumer"), join(work, "consumer"), {
    recursive: true,
  });
  const consumer = join(work, "consumer");
  run("npm", ["install", "--no-audit", "--no-fund", archive], consumer);
  const lock = JSON.parse(readFileSync(join(consumer, "package-lock.json")));
  const sdk = lock.packages["node_modules/@structured-id/proto"];
  if (!sdk?.resolved?.startsWith("https://registry.npmjs.org/")) {
    throw new Error(
      "Consumer resolved the SDK outside the public npm registry",
    );
  }
  run("npm", ["run", "typecheck"], consumer);
  run("npm", ["run", "build"], consumer);
  console.log("PASS: packed Vue/TS consumer builds with the published SDK");
} finally {
  rmSync(work, { recursive: true, force: true });
}
