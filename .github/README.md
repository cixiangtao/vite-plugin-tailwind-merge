# vite-plugin-tailwind-merge

English | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml/badge.svg)](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-tailwind-merge.svg)](https://www.npmjs.com/package/vite-plugin-tailwind-merge)

Automatically apply `tailwind-merge` to React-compatible JSX/TSX in Vite—without wrapping every
`className` in `twMerge()`.

Static class strings are resolved during Vite transforms. Dynamic class values, function-valued
class props, and JSX spreads use a runtime fallback by default, covering supported class sources
without helper-name heuristics.

The contract is deliberately narrow: matching JSX/TSX modules, configured class attributes, and
valid class values. The plugin does not generate CSS, hash class names, or provide style isolation.

```tsx
// input
<div className="flex grid px-2 px-4" />

// output
<div className="grid px-4" />
```

## Why this plugin

Class names reach JSX through literals, variables, CSS Modules, composition helpers, callbacks,
and spread props. Requiring every path to remember a manual `twMerge()` call makes conflict
resolution a convention that can be skipped.

This plugin puts that decision at the Vite JSX transform boundary:

- static class strings are merged before application code is emitted;
- dynamic configured attributes receive a runtime class-value adapter;
- every JSX spread receives a runtime props adapter because it may contain a configured class
  attribute;
- expression syntax and helper function names do not decide whether a supported path is covered.

## Installation

> [!IMPORTANT]
> Install `tailwind-merge` directly in the application package that owns the Vite build. It is a
> required peer dependency and, with the default dynamic coverage, is imported by generated
> application code. This plugin intentionally does not bundle it.

Choose the `tailwind-merge` major that matches the application's Tailwind CSS version:

| Tailwind CSS | `tailwind-merge` | Status    |
| ------------ | ---------------- | --------- |
| 3.0–3.4      | `^2.6.0`         | Supported |
| 4.0–4.3      | `^3.0.0`         | Supported |

The plugin does not read or compile Tailwind CSS. Merge-engine compatibility comes from the
directly installed `tailwind-merge` package, so the wrong major can silently resolve conflicts
incorrectly.

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

The safe default is to keep `tailwind-merge` in application `dependencies` and this plugin in
`devDependencies`. A project that deliberately uses `dynamic: "skip"` needs the merge engine only
while Vite runs, but the default mode generates an application-side import.

In a pnpm workspace, install both packages into the application workspace rather than only the
workspace root:

```sh
# Tailwind CSS 4 example
pnpm --filter <app-package> add tailwind-merge@^3
pnpm --filter <app-package> add -D vite-plugin-tailwind-merge
```

If Vite reports `Cannot resolve "tailwind-merge"`, first confirm that the dependency appears in the
application package's own `package.json` with the correct major version.

## Quick start

```ts
import tailwindMerge from "vite-plugin-tailwind-merge";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindMerge()],
});
```

No JSX helper imports or manual merge calls are required for supported paths:

```tsx
<div className="flex grid" />
<div className={classes} />
<div className={styles.root} />
<div className={cx("flex", classes)} />
<div {...props} />
```

The plugin runs with `enforce: "pre"`, while matching code is still available as JSX/TSX.

## JSX coverage contract

With the default `dynamic: "wrap"`, a path is covered when all of these conditions hold:

1. The Vite file passes the plugin's `include` and `exclude` filters.
2. The class source is still represented as a JSX attribute or JSX spread when the plugin runs.
3. The explicit attribute name appears in `attributes` (`className` by default), or the source is a
   JSX spread that may contain one of those attributes.
4. The runtime value is a supported `tailwind-merge` class value or a synchronous function that
   returns one.

Static folding covers string literals, expression string literals, template literals without
expressions, and `+` expressions whose operands can both be folded to strings.

| JSX input                                   | Result                 | Merge phase |
| ------------------------------------------- | ---------------------- | ----------- |
| `className="flex grid"`                     | Merged                 | Build time  |
| `className={"flex " + "grid"}`              | Merged                 | Build time  |
| `className={classes}`                       | Merged if string/array | Runtime     |
| `className={styles.root}`                   | Merged if string/array | Runtime     |
| `className={cx("flex", classes)}`           | Merged if string/array | Runtime     |
| `className={getClassName(props)}`           | Merged if string/array | Runtime     |
| `className={active ? "flex" : "grid"}`      | Merged if string/array | Runtime     |
| `className={({ isActive }) => "flex grid"}` | Return value merged    | Runtime     |
| `className={["flex", "grid"]}`              | Merged                 | Runtime     |
| `className={false}`                         | Preserved              | Runtime     |
| `<div {...props} />`                        | `className` merged     | Runtime     |
| `<div {...getProps()} />`                   | `className` merged     | Runtime     |
| `<div {...a} className={value} {...b} />`   | Source order preserved | Both        |
| `<div className />`                         | Build error            | —           |
| `React.createElement("div", { className })` | Not transformed        | —           |
| Vue/Svelte/Astro native templates           | Not transformed        | —           |

Unsupported runtime values are preserved rather than guessed. Invalid configured attributes, such
as `<div className />`, fail the transform instead of silently bypassing the contract.

### Function-valued class props

Synchronous functions that return supported class values are wrapped with a `Proxy`. Calls retain
their `this` value, arguments, and property access. The same source function receives a stable
wrapper within one transformed module.

The wrapper is not reference-equal to the original function, and asynchronous functions are
outside the supported class-value contract.

### JSX spreads

Every JSX spread is wrapped in the default mode, even when the object turns out not to contain a
configured class attribute. The adapter reads properties lazily, so getters and side-effecting
spread expressions retain normal evaluation timing. Multiple spreads and explicit attributes keep
their original source order and override semantics.

Only the properties that normal JSX spread lowering enumerates participate in the result.

## Runtime behavior

Dynamic values are wrapped without inspecting the expression's name or syntax:

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

Spreads receive the same configured-attribute handling:

```tsx
// input
<div {...props} />

// conceptual output
<div {...mergeConfiguredClassProps(props)} />
```

A transformed module that contains only static configured attributes and no JSX spreads adds no
application-side merge import or runtime helper. A module with a dynamic configured attribute or
spread imports the configured runtime merge function and injects helpers that use `Proxy`,
`WeakMap`, and `Reflect`.

Projects that accept static-only coverage can disable runtime wrapping:

```ts
tailwindMerge({ dynamic: "skip" });
```

`dynamic: "skip"` keeps build-time static folding but leaves dynamic attributes and JSX spreads
unchanged.

## Options

```ts
tailwindMerge({
  attributes: ["className"],
  dynamic: "wrap",
  include: /\.[jt]sx$/,
  exclude: /node_modules/,
});
```

| Option           | Default                                               | Behavior                                                                                          |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `attributes`     | `["className"]`                                       | Replaces the configured JSX attribute set. `[]` disables explicit attributes and spread handling. |
| `dynamic`        | `"wrap"`                                              | `"wrap"` adds runtime adapters; `"skip"` limits the plugin to static folding.                     |
| `include`        | `.[cm]?[jt]sx?` modules                               | Replaces the default include filter.                                                              |
| `exclude`        | `node_modules` and `.d.ts`                            | Replaces the default exclude filter; preserve exclusions you still need.                          |
| `merge`          | `twMerge` from `tailwind-merge`                       | Build-time merge function for static strings.                                                     |
| `runtimeMerge`   | `{ module: "tailwind-merge", exportName: "twMerge" }` | Import used by transformed application modules.                                                   |
| `functions`      | Deprecated                                            | Retained for type compatibility; no longer affects coverage.                                      |
| `mergeFunctions` | Deprecated                                            | Retained for type compatibility; no longer affects coverage.                                      |

`include` and `exclude` are Vite/Rollup filter patterns. Supplying either option replaces its
corresponding default rather than extending it. In particular, a custom `exclude` can put
`node_modules` back into scope.

## Custom Tailwind Merge configuration

Static and runtime merging should use the same custom rules. Export a configured merge function
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

Use that function at build time and tell transformed modules where to import it at runtime:

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

When runtime coverage is needed, `merge` and `runtimeMerge` must be configured together. The
plugin verifies that both are present, but the application is responsible for ensuring they use
the same conflict rules. Set `exportName: "default"` for a default export.

## Public API

The package exports:

- the Vite plugin as both the default export and named `tailwindMerge` export;
- `transformTailwindClasses` for direct source transformation;
- public option and result types;
- ESM and CommonJS builds, declarations, and Source Maps.

## Compatibility

| Surface                     | Supported or verified range                                 |
| --------------------------- | ----------------------------------------------------------- |
| Node.js                     | `^20.19.0 \|\| >=22.12.0`                                   |
| Vite peer dependency        | `>=5.0.0`                                                   |
| Vite CI matrix              | Major versions 5, 6, 7, and 8                               |
| Tailwind CSS 3 merge engine | `tailwind-merge` `^2.6.0`; CI verifies 2.6.1                |
| Tailwind CSS 4 merge engine | `tailwind-merge` `^3.0.0`; development currently uses 3.6.0 |

The open-ended Vite peer range permits future Vite majors, but only Vite 5–8 are currently covered
by this repository's build matrix.

### Framework and syntax status

The current implementation parses JavaScript/TypeScript modules with OXC and applies
React-compatible JSX spread semantics. Syntax compatibility alone is not a framework integration
guarantee.

| Framework or syntax      | Status                                          | Current boundary                                                                                          |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| React-compatible JSX/TSX | Supported contract                              | Vite 5–8 build transform verified; React plugin, HMR, SSR, and RSC are not separately integration-tested. |
| Preact JSX/TSX           | Syntax-compatible; runtime semantics unverified | `className`, or configured `class`.                                                                       |
| Solid JSX/TSX            | Syntax-compatible; runtime semantics unverified | Framework reactivity and spread behavior are unverified.                                                  |
| Qwik JSX/TSX             | Syntax-compatible; runtime semantics unverified | Resumability behavior is unverified.                                                                      |
| Vue JSX/TSX              | Syntax-compatible; runtime semantics unverified | Object-style `class` is outside the supported value contract.                                             |
| Vue SFC templates        | Not supported                                   | Would require a Vue compiler adapter.                                                                     |
| Svelte components        | Not supported                                   | Would require a Svelte compiler adapter.                                                                  |
| Astro components         | Not supported                                   | Would require an Astro compiler adapter.                                                                  |
| MDX                      | Not supported                                   | The default filter and parser path do not accept raw MDX.                                                 |
| Angular templates        | Not supported                                   | Outside the current Vite JSX/TSX scope.                                                                   |

JSX syntaxes that use `class` can replace the configured attribute set:

```ts
tailwindMerge({
  attributes: ["class", "className"],
});
```

## Explicit boundaries

- The plugin merges class values; it does not generate CSS, read Tailwind configuration, hash
  class names, or provide style isolation.
- It transforms JSX attributes and JSX spreads only while those constructs remain in the source.
  It does not transform `React.createElement`, `jsx`/`_jsx`, `h`, nested object protocols such as
  `slotProps`, or framework-native templates.
- Vue object-style class values and framework-specific reactive or resumable spread semantics are
  outside the supported contract.
- Files excluded by the Vite filter are not transformed. OXC parse errors in matching files fail
  the build.
- Every spread is wrapped in default mode because it may contain a configured class attribute.
  Dynamic attributes and spreads add application code and require modern `Proxy`, `WeakMap`, and
  `Reflect` support.
- A wrapped function retains call behavior but is not reference-equal to its original function.
- Reducing runtime helper cost is a future optimization; performance never decides whether a path
  inside the supported contract is covered.

## Troubleshooting

### Vite cannot resolve `tailwind-merge`

Install it directly in the application workspace and use the major that matches Tailwind CSS. Do
not rely on a workspace-root install or automatic peer installation.

### Custom utilities merge incorrectly

The plugin does not read `tailwind.config.*` or CSS theme definitions. Configure
`extendTailwindMerge`, then provide matching `merge` and `runtimeMerge` options.

### A class source is unchanged

Check the JSX coverage contract first: file filters, transform order, configured attribute names,
value shape, and whether the source is still JSX when this plugin runs. Framework-native templates
and already-lowered element factory calls are intentionally out of scope.

## Development and support

```sh
corepack enable
pnpm install
pnpm check
```

Maintainer releases use a protected `release/vX.Y.Z` pull request and the
Action-only process documented in [RELEASING.md](../RELEASING.md).

- Read the [contribution guide](../CONTRIBUTING.md) before opening a pull request.
- Use [GitHub issues](https://github.com/cixiangtao/vite-plugin-tailwind-merge/issues) for
  reproducible bugs and focused feature proposals.
- Report vulnerabilities privately through the repository's
  [Security page](https://github.com/cixiangtao/vite-plugin-tailwind-merge/security).

## License

MIT
