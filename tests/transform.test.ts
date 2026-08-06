import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { walkAst, type AstNode } from "../src/ast";
import { transformTailwindClasses } from "../src/transform";
import type { TransformTailwindClassesOptions } from "../src/types";

const transform = (source: string, options: TransformTailwindClassesOptions = {}) =>
  transformTailwindClasses(source, "/project/src/component.tsx", options)?.code ?? source;

const getNodeName = (node: unknown) => {
  if (typeof node !== "object" || node === null || !("name" in node)) return undefined;
  return typeof node.name === "string" ? node.name : undefined;
};

describe("transformTailwindClasses", () => {
  it("merges conflicting static class names at build time", () => {
    const result = transform(
      'export const Example = () => <div className="flex grid px-2 px-4" />;',
    );

    expect(result).toContain('className="grid px-4"');
    expect(result).not.toContain("tailwind-merge");
  });

  it("merges static JSX expression strings", () => {
    const result = transform('export const Example = () => <div className={"md:flex md:grid"} />;');

    expect(result).toContain('className="md:grid"');
  });

  it("uses OXC ranges correctly after non-ASCII source text", () => {
    const result = transform(
      'const label = "中文";\nexport const Example = () => <div className="block flex">{label}</div>;',
    );

    expect(result).toContain('const label = "中文";');
    expect(result).toContain('className="flex"');
  });

  it.each([
    ["identifiers", "classes", "classes"],
    ["member expressions", "styles.root", "styles.root"],
    ["aliased composition calls", 'cx("flex", "grid")', 'cx("flex", "grid")'],
    ["arbitrary calls", "getClassName(props)", "getClassName(props)"],
    ["conditional expressions", 'active ? "flex" : "grid"', 'active ? "flex" : "grid"'],
    ["TypeScript expressions", "classes as string", "classes as string"],
  ])("wraps all dynamic class values, including %s", (_label, expression, expected) => {
    const result = transform(`export const Example = () => <div className={${expression}} />;`);

    expect(result).toContain('import { twMerge as __viteTailwindMerge } from "tailwind-merge";');
    expect(result).toContain(`className={__viteTailwindMergeValue(${expected})}`);
  });

  it("merges the return value of function-valued className props", () => {
    const result = transform(
      'export const Example = () => <NavLink className={({ isActive }) => isActive ? "flex grid" : "block flex"} />;',
    );

    expect(result).toContain(
      'className={__viteTailwindMergeValue(({ isActive }) => isActive ? "flex grid" : "block flex")}',
    );
    expect(result).toContain("new WeakMap()");
    expect(result).toContain("Reflect.apply");
  });

  it("uses a unique runtime binding instead of reusing a shadowed import", () => {
    const source =
      'import { twMerge as merge } from "tailwind-merge";\nexport const Example = ({ merge, className }) => <div className={merge("flex", className)} />;';
    const result = transform(source);

    expect(result).toContain('import { twMerge as __viteTailwindMerge } from "tailwind-merge";');
    expect(result).toContain('className={__viteTailwindMergeValue(merge("flex", className))}');
  });

  it("uses parsed identifier names when avoiding escaped binding collisions", () => {
    const result = transform(
      "const \\u005f_viteTailwindMerge = 1; export const Example = ({ value }) => <div className={value} />;",
    );

    expect(result).toContain('import { twMerge as __viteTailwindMerge1 } from "tailwind-merge";');
    expect(result).toContain("className={__viteTailwindMergeValue(value)}");
  });

  it("does not let deprecated function lists limit dynamic coverage", () => {
    const result = transform(
      'export const Example = ({ value }) => <div className={unknownAlias("flex", value)} />;',
      {
        functions: [],
        mergeFunctions: ["unknownAlias"],
      },
    );

    expect(result).toContain('className={__viteTailwindMergeValue(unknownAlias("flex", value))}');
  });

  it("can skip dynamic expressions", () => {
    const source =
      'export const Example = ({ className, props }) => <><div className="flex grid" /><div className={className} /><div {...props} /></>;';
    const result = transform(source, { dynamic: "skip" });

    expect(result).toContain('className="grid"');
    expect(result).toContain("className={className}");
    expect(result).toContain("<div {...props}");
    expect(result).not.toContain("tailwind-merge");
  });

  it("wraps every JSX spread because it can contain a configured class attribute", () => {
    const result = transform(
      'export const Example = ({ props }) => <div {...props} data-kind="example" />;',
    );

    expect(result).toContain('import { twMerge as __viteTailwindMerge } from "tailwind-merge";');
    expect(result).toContain("const __viteTailwindMergeProps =");
    expect(result).toContain("<div {...__viteTailwindMergeProps(props)}");
    expect(result).toContain('["className"]');
  });

  it("wraps side-effecting and multiple spreads exactly once", () => {
    const result = transform(
      'export const Example = ({ props }) => <div {...getProps()} id="example" {...props} />;',
    );

    expect(result).toContain("<div {...__viteTailwindMergeProps(getProps())}");
    expect(result).toContain("{...__viteTailwindMergeProps(props)}");
    expect(result.match(/getProps\(\)/gu)).toHaveLength(1);
  });

  it("supports nested JSX transformations without overlapping edits", () => {
    const result = transform(
      'export const Example = ({ props }) => <Component {...{ child: <div className="flex grid" />, ...props }} />;',
    );

    expect(result).toContain("<Component {...__viteTailwindMergeProps({ child:");
    expect(result).toContain('className="grid"');
    expect(result).toContain("...props })}");
  });

  it("supports custom JSX attribute names", () => {
    const result = transform(
      'export const Example = ({ props }) => <><div class="block flex" /><div {...props} /></>;',
      {
        attributes: ["class", "className"],
      },
    );

    expect(result).toContain('class="flex"');
    expect(result).toContain('["class","className"]');
  });

  it("keeps runtime imports after module directives", () => {
    const result = transform(
      '"use client";\n\nexport const Example = ({ className }) => <div className={`flex ${className}`} />;',
    );

    expect(result.startsWith('"use client";')).toBe(true);
    expect(result.indexOf("tailwind-merge")).toBeGreaterThan(result.indexOf('"use client";'));
  });

  it("keeps runtime imports after a hashbang", () => {
    const result = transformTailwindClasses(
      "#!/usr/bin/env node\nexport const Example = ({ className }) => <div className={className} />;",
      "/project/src/component.tsx",
    )?.code;

    expect(result?.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(result?.indexOf("tailwind-merge")).toBeGreaterThan(
      result?.indexOf("#!/usr/bin/env node") ?? 0,
    );
  });

  it("keeps a byte order mark before runtime imports", () => {
    const result = transform(
      "\uFEFFexport const Example = ({ className }) => <div className={className} />;",
    );

    expect(result.startsWith("\uFEFF\nimport")).toBe(true);
  });

  it("uses a custom merge implementation for static classes", () => {
    const result = transform('export const Example = () => <div className="flex grid" />;', {
      merge: (className: string) => `custom:${className}`,
    });

    expect(result).toContain('className="custom:flex grid"');
  });

  it("supports a custom runtime merge import for dynamic classes and spreads", () => {
    const result = transform(
      "export const Example = ({ className, props }) => <><div className={className} /><div {...props} /></>;",
      {
        merge: (className: string) => className,
        runtimeMerge: {
          module: "@/tailwind-merge",
          exportName: "merge",
        },
      },
    );

    expect(result).toContain('import { merge as __viteTailwindMerge } from "@/tailwind-merge";');
    expect(result).toContain("className={__viteTailwindMergeValue(className)}");
    expect(result).toContain("{...__viteTailwindMergeProps(props)}");
  });

  it("supports a default runtime merge export", () => {
    const result = transform("export const Example = ({ value }) => <div className={value} />;", {
      merge: (className: string) => className,
      runtimeMerge: {
        module: "@/tailwind-merge",
        exportName: "default",
      },
    });

    expect(result).toContain('import __viteTailwindMerge from "@/tailwind-merge";');
  });

  it.each([
    ["a build-time merge without a runtime import", { merge: (className: string) => className }],
    [
      "a runtime import without a build-time merge",
      { runtimeMerge: { module: "@/tailwind-merge" } },
    ],
  ])("rejects %s when runtime coverage is needed", (_label, options) => {
    expect(() =>
      transform("export const Example = ({ value }) => <div className={value} />;", options),
    ).toThrow("Custom build-time merge and runtimeMerge must be configured together");
  });

  it("rejects valueless configured class attributes", () => {
    expect(() => transform("export const Example = () => <div className />;")).toThrow(
      'Configured class attribute "className" must have a value',
    );
  });

  it("rejects empty configured class expressions during parsing", () => {
    expect(() =>
      transform("export const Example = () => <div className={/* empty */} />;"),
    ).toThrow("JSX attributes must only be assigned a non-empty 'expression'");
  });

  it("allows an empty attribute list to disable all transformations", () => {
    const source =
      'export const Example = ({ props }) => <><div className="flex grid" /><div {...props} /></>;';

    expect(transform(source, { attributes: [] })).toBe(source);
  });

  it("leaves no unwrapped dynamic class attributes or JSX spreads", () => {
    const result = transform(`
      export const Example = ({ classes, props, active }) => (
        <>
          <div className="flex grid" />
          <div className={classes} />
          <div className={styles.root} />
          <div className={cx("flex", classes)} />
          <div className={active ? "flex" : "grid"} />
          <div {...props} />
          <div {...getProps()} />
        </>
      );
    `);
    const parsed = parseSync("/project/src/result.tsx", result, {
      lang: "tsx",
      range: true,
      sourceType: "module",
    });
    const unwrapped: string[] = [];

    expect(parsed.errors).toEqual([]);
    walkAst(parsed.program as unknown as AstNode, (node) => {
      if (node.type === "JSXSpreadAttribute") {
        const argument = node.argument as AstNode | undefined;
        const callee = argument?.callee as AstNode | undefined;
        if (
          argument?.type !== "CallExpression" ||
          getNodeName(callee) !== "__viteTailwindMergeProps"
        ) {
          unwrapped.push("spread");
        }
        return;
      }

      if (node.type !== "JSXAttribute") return;
      if (getNodeName(node.name) !== "className") return;
      const container = node.value as AstNode | undefined;
      if (container?.type === "Literal") return;
      const expression = container?.expression as AstNode | undefined;
      const callee = expression?.callee as AstNode | undefined;
      if (
        expression?.type !== "CallExpression" ||
        getNodeName(callee) !== "__viteTailwindMergeValue"
      ) {
        unwrapped.push("className");
      }
    });

    expect(unwrapped).toEqual([]);
  });

  it("returns no transformation when the configured attribute is absent", () => {
    expect(
      transformTailwindClasses("export const value = 1;", "/project/src/value.ts"),
    ).toBeUndefined();
  });
});
