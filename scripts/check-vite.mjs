import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build } from "vite";

import tailwindMerge from "../dist/index.js";

const directory = await mkdtemp(join(tmpdir(), "vite-plugin-tailwind-merge-"));

try {
  const entry = join(directory, "entry.tsx");
  await writeFile(
    entry,
    `export const StaticElement = () => (
  <div className="flex grid px-2 px-4">content</div>
);

export const DynamicElement = ({ className, props }) => (
  <>
    <div className={className}>dynamic</div>
    <div {...props}>spread</div>
  </>
);`,
  );

  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [tailwindMerge()],
    build: {
      minify: false,
      write: false,
      rollupOptions: {
        external: [/^react(?:\/|$)/u, /^tailwind-merge$/u],
      },
      lib: {
        entry,
        formats: ["es"],
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  const code = outputs
    .flatMap(({ output }) => output)
    .filter(({ type }) => type === "chunk")
    .map(({ code: chunkCode }) => chunkCode)
    .join("\n");

  if (
    !code.includes('className: "grid px-4"') ||
    code.includes("flex grid") ||
    !code.includes("Proxy") ||
    !code.includes("WeakMap")
  ) {
    throw new Error("Vite build did not contain complete static and runtime class coverage");
  }
} finally {
  await rm(directory, { force: true, recursive: true });
}
