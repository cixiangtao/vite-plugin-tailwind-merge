import { describe, expect, it } from "vitest";

import { transformTailwindClasses } from "../src/transform";

const transform = (source: string, options = {}) =>
  transformTailwindClasses(source, "/project/src/component.tsx", options)?.code ?? source;

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

  it("wraps supported dynamic composition calls", () => {
    const result = transform(
      'export const Example = ({ className }) => <div className={clsx("flex", className)} />;',
    );

    expect(result).toContain('import { twMerge as __viteTailwindMerge } from "tailwind-merge";');
    expect(result).toContain('className={__viteTailwindMerge(clsx("flex", className))}');
  });

  it("does not wrap an existing tailwind-merge call", () => {
    const source =
      'import { twMerge as merge } from "tailwind-merge";\nexport const Example = ({ className }) => <div className={merge("flex", className)} />;';

    expect(transform(source)).toBe(source);
  });

  it("leaves simple CSS Module expressions alone", () => {
    const source = "export const Example = () => <div className={styles.root} />;";

    expect(transform(source)).toBe(source);
  });

  it("can skip dynamic expressions", () => {
    const source =
      'export const Example = ({ className }) => <div className={cn("flex", className)} />;';

    expect(transform(source, { dynamic: "skip" })).toBe(source);
  });

  it("supports custom JSX attribute names", () => {
    const result = transform('export const Example = () => <div class="block flex" />;', {
      attributes: ["class"],
    });

    expect(result).toContain('class="flex"');
  });

  it("keeps runtime imports after module directives", () => {
    const result = transform(
      '"use client";\n\nexport const Example = ({ className }) => <div className={`flex ${className}`} />;',
    );

    expect(result.startsWith('"use client";')).toBe(true);
    expect(result.indexOf("tailwind-merge")).toBeGreaterThan(result.indexOf('"use client";'));
  });

  it("uses a custom merge implementation for static classes", () => {
    const result = transform('export const Example = () => <div className="flex grid" />;', {
      merge: (className: string) => `custom:${className}`,
    });

    expect(result).toContain('className="custom:flex grid"');
  });

  it("returns no transformation when the configured attribute is absent", () => {
    expect(
      transformTailwindClasses("export const value = 1;", "/project/src/value.ts"),
    ).toBeUndefined();
  });
});
