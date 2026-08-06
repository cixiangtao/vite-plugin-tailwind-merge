import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build, type Rollup } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import viteTailwindMerge from "../src/index";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const getChunkCode = (output: Rollup.RollupOutput | Rollup.RollupOutput[]) =>
  (Array.isArray(output) ? output : [output])
    .flatMap(({ output: files }) => files)
    .filter((file): file is Rollup.OutputChunk => file.type === "chunk")
    .map(({ code }) => code)
    .join("\n");

describe("Vite adapter", () => {
  it("merges JSX classes before Vite transforms the module", async () => {
    const directory = await mkdtemp(join(process.cwd(), ".tmp-vite-"));
    temporaryDirectories.push(directory);
    const entry = join(directory, "entry.tsx");
    await writeFile(
      entry,
      'export const element = <div className="flex grid px-2 px-4">content</div>;',
    );

    const output = await build({
      configFile: false,
      logLevel: "silent",
      plugins: [viteTailwindMerge()],
      build: {
        minify: false,
        write: false,
        rolldownOptions: {
          external: [/^react(?:\/|$)/u],
        },
        lib: {
          entry,
          formats: ["es"],
        },
      },
    });

    if (!Array.isArray(output) && !("output" in output)) {
      throw new TypeError("Expected Vite to return build output");
    }

    const code = getChunkCode(output);
    expect(code).toContain('className: "grid px-4"');
    expect(code).not.toContain("flex grid");
  });
});
