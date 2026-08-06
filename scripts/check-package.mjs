import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "vite-plugin-tailwind-merge-pack-"));
const expectedReadme = `# vite-plugin-tailwind-merge

## [View the full documentation →](https://github.com/cixiangtao/vite-plugin-tailwind-merge)
`;

try {
  // npm can skip the prepack hook that runs this check; pnpm pack cannot disable it.
  await execFileAsync(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", temporaryDirectory],
    { cwd: projectRoot },
  );

  const archiveName = (await readdir(temporaryDirectory)).find((entry) => entry.endsWith(".tgz"));
  if (!archiveName) throw new Error("npm pack did not create a package archive");

  const archivePath = join(temporaryDirectory, archiveName);
  const { stdout: fileListOutput } = await execFileAsync("tar", ["-tzf", archivePath]);
  const packageFiles = new Set(fileListOutput.trim().split("\n"));
  const requiredFiles = [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/index.cjs",
    "package/dist/index.d.cts",
    "package/dist/index.d.ts",
    "package/dist/index.js",
  ];

  for (const requiredFile of requiredFiles) {
    if (!packageFiles.has(requiredFile)) {
      throw new Error(`Package archive is missing ${requiredFile}`);
    }
  }

  if ([...packageFiles].some((file) => file.startsWith("package/.github/"))) {
    throw new Error("Package archive must not contain repository documentation from .github");
  }

  const { stdout: packedReadme } = await execFileAsync("tar", [
    "-xOf",
    archivePath,
    "package/README.md",
  ]);
  if (packedReadme !== expectedReadme) {
    throw new Error("Package archive does not contain the expected minimal npm README");
  }

  const sourceReadme = await readFile(join(projectRoot, "README.md"), "utf8");
  if (sourceReadme !== expectedReadme) {
    throw new Error("Root README and packed npm README are inconsistent");
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
