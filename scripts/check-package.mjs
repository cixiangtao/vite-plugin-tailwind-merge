import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "vite-plugin-tailwind-merge-pack-"));
const requiredReadmeFragments = [
  "# vite-plugin-tailwind-merge",
  "Automatically resolve Tailwind CSS class conflicts",
  "在 Vite 转换阶段",
  "tailwind-merge@^2.6",
  "tailwind-merge@^3",
  "https://github.com/cixiangtao/vite-plugin-tailwind-merge#installation",
  "https://github.com/cixiangtao/vite-plugin-tailwind-merge/blob/main/.github/README.zh-CN.md#安装",
];
const forbiddenReadmeFragments = [
  "npm `latest` is currently",
  "unreleased `main`",
  "not included in npm",
  "npm `latest` 目前仍为",
  "尚未发布的 `main`",
  "尚未包含在 npm",
];

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
  const sourceReadme = await readFile(join(projectRoot, "README.md"), "utf8");
  if (packedReadme !== sourceReadme) {
    throw new Error("Packed npm README and source README are inconsistent");
  }

  for (const fragment of requiredReadmeFragments) {
    if (!sourceReadme.includes(fragment)) {
      throw new Error(`Root npm README is missing required content: ${fragment}`);
    }
  }

  for (const fragment of forbiddenReadmeFragments) {
    if (sourceReadme.includes(fragment)) {
      throw new Error(`Root npm README contains stale release-state content: ${fragment}`);
    }
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
