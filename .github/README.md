# vite-plugin-tailwind-merge

[![CI](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml/badge.svg)](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-tailwind-merge.svg)](https://www.npmjs.com/package/vite-plugin-tailwind-merge)

Automatically resolve conflicting Tailwind CSS classes across React-compatible JSX and TSX.

```tsx
// input
<div className="flex grid px-2 px-4" />

// output
<div className="grid px-4" />
```

Static class strings are merged during Vite transforms with zero application runtime cost. Every
other explicit `className` value and every JSX spread receives a runtime merge adapter by default.
Expression syntax, variable names, and helper function names never decide whether coverage applies.

## Installation

> [!IMPORTANT]
> Install `tailwind-merge` directly in the application package that owns the Vite build. It is a
> required peer dependency and, with the default dynamic coverage, is also imported by generated
> application code. This plugin intentionally does not bundle it.

Choose the `tailwind-merge` major that matches the application's Tailwind CSS version:

| Tailwind CSS | `tailwind-merge` | Status    |
| ------------ | ---------------- | --------- |
| 3.0–3.4      | 2.6.x            | Supported |
| 4.0–4.3      | 3.x              | Supported |

Using the wrong major can silently produce incorrect conflict resolution. The plugin does not infer
the Tailwind CSS version: it uses the directly installed `tailwind-merge` package for both
build-time and runtime merging.

### Tailwind CSS 4

pnpm:

```sh
pnpm add tailwind-merge@^3
pnpm add -D vite-plugin-tailwind-merge
```

npm:

```sh
npm install tailwind-merge@^3
npm install --save-dev vite-plugin-tailwind-merge
```

### Tailwind CSS 3

pnpm:

```sh
pnpm add tailwind-merge@^2.6
pnpm add -D vite-plugin-tailwind-merge
```

npm:

```sh
npm install tailwind-merge@^2.6
npm install --save-dev vite-plugin-tailwind-merge
```

Do not install only `vite-plugin-tailwind-merge` or rely on automatic peer installation. Static
classes need `tailwind-merge` while Vite runs the plugin, and dynamic class values and JSX spreads
generate an application-side import from `tailwind-merge`.

In a pnpm workspace, install both packages into the application workspace rather than only the
workspace root:

```sh
# Tailwind CSS 4 example
pnpm --filter <app-package> add tailwind-merge@^3
pnpm --filter <app-package> add -D vite-plugin-tailwind-merge
```

If Vite reports `Cannot resolve "tailwind-merge"`, first confirm that it appears in that
application's own `package.json` under `dependencies`, with the correct major version.

## Vite

```ts
import tailwindMerge from "vite-plugin-tailwind-merge";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindMerge()],
});
```

No JSX helper imports or manual `twMerge()` calls are required:

```tsx
<div className="flex grid" />
<div className={classes} />
<div className={styles.root} />
<div {...props} />
```

## Coverage guarantee

With the default `dynamic: "wrap"`, every matching React-compatible JSX/TSX module follows these
rules:

1. Every configured JSX attribute, `className` by default, is merged at build time or passed through
   the runtime value adapter.
2. Every JSX spread is passed through the runtime props adapter because it may contain `className`.
3. Unsupported class value shapes are preserved rather than guessed by function or variable name.
4. Invalid valueless attributes such as `<div className />` fail the transform instead of being
   silently ignored.

The supported value contract is a `tailwind-merge` class value—strings, nested string arrays and
falsy empty values—plus synchronous functions that return those values. Function-valued class
props, such as React Router's `NavLink` resolver, keep their `this`, arguments, properties and a
stable wrapper identity within the transformed module.

| JSX input                                   | Coverage      | Merge phase |
| ------------------------------------------- | ------------- | ----------- |
| `className="flex grid"`                     | Supported     | Build time  |
| `className={"flex " + "grid"}`              | Supported     | Build time  |
| `className={classes}`                       | Supported     | Runtime     |
| `className={styles.root}`                   | Supported     | Runtime     |
| `className={cx("flex", classes)}`           | Supported     | Runtime     |
| `className={getClassName(props)}`           | Supported     | Runtime     |
| `className={active ? "flex" : "grid"}`      | Supported     | Runtime     |
| `className={({ isActive }) => "flex grid"}` | Supported     | Runtime     |
| `<div {...props} />`                        | Supported     | Runtime     |
| `<div {...getProps()} />`                   | Supported     | Runtime     |
| `<div {...a} className={value} {...b} />`   | Supported     | Both        |
| `<div className />`                         | Invalid input | Build error |
| `React.createElement("div", { className })` | Not supported | —           |
| Vue/Svelte/Astro native templates           | Not supported | —           |

Only own enumerable properties participate in JSX spreads, matching normal JSX spread behavior.
Multiple spreads and explicit attributes keep their original source order and override semantics.

## Runtime coverage

All non-static values are covered without inspecting the expression:

```tsx
// input
<div className={classes} />
<div className={styles.root} />
<div className={cx("flex", "grid")} />

// conceptual output
<div className={mergeClassValue(classes)} />
<div className={mergeClassValue(styles.root)} />
<div className={mergeClassValue(cx("flex", "grid"))} />
```

Spreads receive the same guarantee:

```tsx
// input
<div {...props} />

// conceptual output
<div {...mergeClassNameProps(props)} />
```

The spread adapter reads properties lazily so getters, side-effecting expressions and multiple
spreads preserve their evaluation order. Dynamic coverage can be explicitly disabled when a
project accepts static-only behavior and wants no application runtime import:

```ts
tailwindMerge({ dynamic: "skip" });
```

`dynamic: "skip"` intentionally opts out of the complete coverage guarantee: static strings are
still merged, while dynamic attributes and JSX spreads remain unchanged.

## Framework support

The complete coverage guarantee currently applies to React-compatible JSX/TSX semantics. Native
framework templates require dedicated parsers and are tracked separately.

| Framework or syntax | Status                                  | Current scope                          |
| ------------------- | --------------------------------------- | -------------------------------------- |
| React JSX/TSX       | Supported; Vite integration verified    | `className` and JSX spreads            |
| Preact JSX/TSX      | Syntax-compatible; verification planned | `className`, or configured `class`     |
| Solid JSX/TSX       | Syntax-compatible; verification planned | Framework reactivity not yet verified  |
| Qwik JSX/TSX        | Syntax-compatible; verification planned | Resumability not yet verified          |
| Vue JSX/TSX         | Syntax-compatible; verification planned | Object-style `class` is not supported  |
| Vue SFC templates   | Planned                                 | Requires the Vue SFC/compiler AST      |
| Svelte components   | Planned                                 | Requires the Svelte compiler AST       |
| Astro components    | Planned                                 | Requires the Astro compiler AST        |
| MDX                 | Under consideration                     | Requires an MDX-aware parser           |
| Angular templates   | Not planned                             | Outside the current Vite JSX/TSX scope |

JSX frameworks that use `class` can configure the exact attribute set:

```ts
tailwindMerge({
  attributes: ["class", "className"],
});
```

The configured array replaces the default attribute set. An empty array disables both explicit
attribute and spread transformations.

## Custom Tailwind Merge configuration

Static and runtime merging must use the same custom rules. Export the configured merge function
from an application module:

```ts
// src/tailwind-merge.ts
import { extendTailwindMerge } from "tailwind-merge";

export const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      display: ["my-grid"],
    },
  },
});
```

Then use the function directly at build time and tell transformed modules where to import it at
runtime:

```ts
// vite.config.ts
import tailwindMerge from "vite-plugin-tailwind-merge";
import { defineConfig } from "vite";

import { merge } from "./src/tailwind-merge";

export default defineConfig({
  plugins: [
    tailwindMerge({
      merge,
      runtimeMerge: {
        module: "/src/tailwind-merge.ts",
        exportName: "merge",
      },
    }),
  ],
});
```

`merge` and `runtimeMerge` must be configured together whenever runtime coverage is needed. This
prevents static and dynamic class values from silently using different conflict rules. Use
`exportName: "default"` for a default export.

## Options

```ts
tailwindMerge({
  attributes: ["className"],
  dynamic: "wrap",
  include: /\.[jt]sx$/,
  exclude: /node_modules/,
});
```

`attributes`, `include` and `exclude` replace their corresponding defaults. The legacy `functions`
and `mergeFunctions` options are deprecated and no longer affect coverage.

## Explicit boundaries

- The plugin merges class strings; it does not generate CSS, hash class names or provide style
  isolation.
- It does not read Tailwind configuration. Extended conflict rules require matching `merge` and
  `runtimeMerge` configuration.
- It transforms JSX attributes and JSX spreads, not `createElement`, `jsx`, nested object protocols
  such as `slotProps`, or framework-native templates.
- Vue object-style class values and framework-specific reactive/resumable spread semantics are not
  part of the current React-compatible guarantee.
- Files excluded by the Vite filter, including `node_modules` by default, are not transformed.
- Runtime adapters add application code for dynamic values and spreads. Reducing that cost is a
  future optimization; it never gates whether supported syntax is covered.

## 中文说明

### 安装注意

必须在实际执行 Vite 构建的应用 package 中直接安装 `tailwind-merge`，不要只安装插件，也不要
依赖包管理器自动补全 peer dependency。插件本身在构建期需要它；默认动态覆盖还会在业务产物中
生成对 `tailwind-merge` 的导入。

- Tailwind CSS 3.0–3.4：安装 `tailwind-merge@^2.6`。
- Tailwind CSS 4.0–4.3：安装 `tailwind-merge@^3`。
- `tailwind-merge` 应放在应用的 `dependencies`，插件放在 `devDependencies`。
- pnpm workspace 中应安装到具体应用 workspace，而不只是仓库根目录。

插件不会自动判断 Tailwind CSS 主版本。版本装错时构建不一定报错，但类名冲突结果可能不正确。

插件当前的完整覆盖规则是：静态 JSX 类名在构建期合并；其他显式 `className` 表达式全部进入
运行时 value adapter；所有 JSX spread 全部进入运行时 props adapter。变量、CSS Modules、函数
别名、任意函数调用和函数型 `className` 都不会再因为启发式判断而漏掉。

“完整覆盖”严格限定于通过 Vite 文件过滤器的 React-compatible JSX/TSX、合法 class value 以及
返回 class value 的同步函数。Vue/Svelte/Astro 原生模板、`createElement` 调用和 Vue 对象式
`class` 不属于当前支持范围。

插件使用 `oxc-parser` 解析 JSX/TSX AST，再通过 `magic-string` 生成转换结果和 Source Map。
Tailwind CSS 3.0–3.4 搭配 `tailwind-merge` 2.6.x；Tailwind CSS 4.0–4.3 搭配
`tailwind-merge` 3.x。

## Development and support

```sh
corepack enable
pnpm install
pnpm check
```

- Read the [contribution guide](https://github.com/cixiangtao/vite-plugin-tailwind-merge/blob/main/CONTRIBUTING.md) before opening a pull request.
- Use [GitHub issues](https://github.com/cixiangtao/vite-plugin-tailwind-merge/issues) for reproducible bugs and focused feature proposals.
- Report vulnerabilities privately through the repository's [Security page](https://github.com/cixiangtao/vite-plugin-tailwind-merge/security).

## License

MIT
