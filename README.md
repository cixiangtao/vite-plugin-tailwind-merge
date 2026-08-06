# vite-plugin-tailwind-merge

Automatically resolve conflicting Tailwind CSS classes before framework transforms.

```tsx
// input
<div className="flex grid px-2 px-4" />

// output
<div className="grid px-4" />
```

Static class strings are merged at build time with zero runtime cost. Supported dynamic class
compositions are wrapped in `twMerge()` automatically.

## Install

```sh
pnpm add tailwind-merge
pnpm add -D vite-plugin-tailwind-merge
```

## Vite

```ts
import tailwindMerge from "vite-plugin-tailwind-merge";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindMerge()],
});
```

## Framework support

The plugin transforms JavaScript, TypeScript, JSX, and TSX before framework plugins run. Native
framework template formats require dedicated parsers and are tracked separately.

| Framework or syntax | Status                                  | Current scope                          |
| ------------------- | --------------------------------------- | -------------------------------------- |
| React JSX/TSX       | Supported; Vite 8 verified              | `className`                            |
| Preact JSX/TSX      | Syntax-compatible; verification planned | `className`, or configured `class`     |
| Solid JSX/TSX       | Syntax-compatible; verification planned | Configure the `class` attribute        |
| Qwik JSX/TSX        | Syntax-compatible; verification planned | Configure the `class` attribute        |
| Vue JSX/TSX         | Syntax-compatible; verification planned | Configure the `class` attribute        |
| Vue SFC templates   | Planned                                 | Requires the Vue SFC/compiler AST      |
| Svelte components   | Planned                                 | Requires the Svelte compiler AST       |
| Astro components    | Planned                                 | Requires the Astro compiler AST        |
| MDX                 | Under consideration                     | Requires an MDX-aware parser           |
| Angular templates   | Not planned                             | Outside the current Vite JSX/TSX scope |

JSX frameworks that use `class` can opt in without waiting for dedicated framework integration:

```ts
tailwindMerge({
  attributes: ["class", "className"],
});
```

## Dynamic class names

```tsx
// input
<div className={clsx("flex", active && "grid", className)} />;

// output
import { twMerge as __viteTailwindMerge } from "tailwind-merge";

<div className={__viteTailwindMerge(clsx("flex", active && "grid", className))} />;
```

Simple expressions such as `className={styles.root}` are left untouched. Dynamic wrapping can be
disabled:

```ts
tailwindMerge({ dynamic: "skip" });
```

## Options

```ts
tailwindMerge({
  attributes: ["className"],
  functions: ["clsx", "classnames", "cn"],
  mergeFunctions: ["twMerge"],
  dynamic: "wrap",
  include: /\.[jt]sx$/,
  exclude: /node_modules/,
});
```

Pass a custom merge function when using an extended Tailwind Merge configuration:

```ts
import { extendTailwindMerge } from "tailwind-merge";
import tailwindMerge from "vite-plugin-tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      display: ["my-grid"],
    },
  },
});

export default defineConfig({
  plugins: [tailwindMerge({ merge })],
});
```

The `merge` option runs at build time and therefore applies to static class strings only. For
dynamic expressions with an extended configuration, call your configured merge function directly;
the plugin will leave existing merge calls untouched.

## 中文说明

这个插件在框架编译之前分析 JSX/TSX：静态 `className` 会直接在构建期合并；由
`clsx`、`classnames` 或 `cn` 产生的动态组合会自动包裹 `twMerge()`。CSS Modules 这类简单表达式
默认保持不变。

插件使用 `oxc-parser` 解析 JSX/TSX AST，再通过 `magic-string` 生成转换结果和 Source Map。

当前已验证 Vite 8 下的 React JSX/TSX 语法转换。Preact、Solid、Qwik 和 Vue JSX/TSX 在语法层面
兼容，后续会补充框架集成测试；Vue SFC、Svelte 和 Astro 的原生模板支持列入计划，需要分别接入
对应的模板编译器。

## License

MIT
