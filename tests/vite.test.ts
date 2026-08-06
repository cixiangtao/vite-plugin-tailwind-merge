import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build, type PluginOption, type Rollup } from "vite";
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

const buildModule = async (source: string, plugins: PluginOption[] = []) => {
  const directory = await mkdtemp(join(process.cwd(), ".tmp-vite-"));
  temporaryDirectories.push(directory);
  const entry = join(directory, "entry.tsx");
  await writeFile(entry, source);

  const output = await build({
    configFile: false,
    logLevel: "silent",
    oxc: {
      jsx: {
        development: false,
        pragma: "React.createElement",
        runtime: "classic",
      },
    },
    plugins,
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

  return getChunkCode(output);
};

const importBuiltModule = (code: string, identifier: string) =>
  import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${identifier}`);

describe("Vite adapter", () => {
  it("merges JSX classes before Vite transforms the module", async () => {
    const code = await buildModule(
      'export const element = <div className="flex grid px-2 px-4">content</div>;',
      [viteTailwindMerge()],
    );
    expect(code).toContain('className: "grid px-4"');
    expect(code).not.toContain("flex grid");
  });

  it("preserves runtime semantics while merging every explicit and spread class value", async () => {
    const source = `
const events = [];
let receivedThis;
let receivedArgument;

function resolveClassName(state) {
  receivedThis = this;
  receivedArgument = state;
  return \`\${this.prefix} flex grid\`;
}
resolveClassName.kind = "resolver";

const spreadProps = {};
Object.defineProperty(spreadProps, "className", {
  configurable: false,
  enumerable: true,
  get() {
    events.push("spread");
    return "flex grid";
  },
});
Object.freeze(spreadProps);

const later = () => {
  events.push("later");
  return "done";
};

const firstSpread = { className: "flex grid" };
const lastSpread = { className: "px-2 px-4" };
const React = { createElement: (_type, props) => props };

export const spreadElement = <div {...spreadProps} dataLater={later()} />;
export const firstCallbackElement = <div className={resolveClassName} />;
export const secondCallbackElement = <div className={resolveClassName} />;
export const rewrappedCallbackElement = <div className={firstCallbackElement.className} />;
export const spreadCallbackElement = <div {...{ className: resolveClassName }} />;
export const multipleSpreadElement = <div {...firstSpread} dataMiddle="value" {...lastSpread} />;
export const explicitThenSpreadElement = <div className="flex grid" {...lastSpread} />;
export const spreadThenExplicitElement = <div {...lastSpread} className="flex grid" />;
export const falseElement = <div className={false} />;
export const undefinedElement = <div className={undefined} />;
export const arrayElement = <div className={["flex", "grid"]} />;
export const callbackResult = firstCallbackElement.className.call(
  { prefix: "custom" },
  { active: true },
);
export const callbackIdentity =
  firstCallbackElement.className === secondCallbackElement.className;
export const callbackKind = firstCallbackElement.className.kind;
export const callbackThisPrefix = receivedThis.prefix;
export const callbackArgumentActive = receivedArgument.active;
export { events };
`;
    const [baselineCode, transformedCode] = await Promise.all([
      buildModule(source),
      buildModule(source, [viteTailwindMerge()]),
    ]);
    const [baseline, transformed] = await Promise.all([
      importBuiltModule(baselineCode, "baseline"),
      importBuiltModule(transformedCode, "transformed"),
    ]);

    expect(transformed.events).toEqual(baseline.events);
    expect(transformed.spreadElement.className).toBe("grid");
    expect(transformed.spreadElement.dataLater).toBe("done");
    expect(transformed.multipleSpreadElement.className).toBe("px-4");
    expect(transformed.explicitThenSpreadElement.className).toBe("px-4");
    expect(transformed.spreadThenExplicitElement.className).toBe("grid");
    expect(transformed.falseElement.className).toBe(false);
    expect(transformed.undefinedElement.className).toBeUndefined();
    expect(transformed.arrayElement.className).toBe("grid");
    expect(transformed.callbackResult).toBe("custom grid");
    expect(transformed.spreadCallbackElement.className.call({ prefix: "spread" }, {})).toBe(
      "spread grid",
    );
    expect(transformed.callbackIdentity).toBe(true);
    expect(transformed.rewrappedCallbackElement.className).toBe(
      transformed.firstCallbackElement.className,
    );
    expect(transformed.callbackKind).toBe("resolver");
    expect(transformed.callbackThisPrefix).toBe("custom");
    expect(transformed.callbackArgumentActive).toBe(true);
  });

  it("applies a custom attribute set to explicit values and JSX spreads", async () => {
    const code = await buildModule(
      `
const React = { createElement: (_type, props) => props };
const classes = "flex grid";
const props = { class: "px-2 px-4", className: "block flex" };

export const explicitElement = <div class={classes} />;
export const spreadElement = <div {...props} />;
`,
      [viteTailwindMerge({ attributes: ["class"] })],
    );
    const transformed = await importBuiltModule(code, "custom-attribute");

    expect(transformed.explicitElement.class).toBe("grid");
    expect(transformed.spreadElement.class).toBe("px-4");
    expect(transformed.spreadElement.className).toBe("block flex");
  });
});
