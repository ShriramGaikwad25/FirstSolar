// Packages the standalone build into a folder + tar.gz that runs on a server without internet / npm.
// Usage: npm run package:offline   ->  deploy/ispm/  and  deploy/ispm-<buildId>.tar.gz
import { cpSync, existsSync, readFileSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const standalone = ".next/standalone";
if (!existsSync(join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

const outDir = join("deploy", "ispm");
rmSync("deploy", { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Server + traced node_modules, then the assets Next leaves out of the standalone folder.
cpSync(standalone, outDir, { recursive: true });
cpSync(".next/static", join(outDir, ".next", "static"), { recursive: true });
cpSync("public", join(outDir, "public"), { recursive: true });

// Native binaries would tie the bundle to the build machine's OS; fail loudly if any were traced in.
const natives = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".node")) natives.push(p);
  }
};
walk(join(outDir, "node_modules"));
if (natives.length) {
  console.error("Native modules found (OS-specific, may not run on Linux):\n" + natives.join("\n"));
  process.exit(1);
}

const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
const archive = `ispm-${buildId}.tar.gz`;
execFileSync("tar", ["-czf", archive, "ispm"], { cwd: "deploy", stdio: "inherit" });
console.log(`Packaged deploy/ispm and deploy/${archive}`);
