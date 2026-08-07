# vite-plugin-tailwind-merge

[English](./README.md) | 简体中文

英文文档是主要维护来源；本页完整对应相同的公开行为与支持边界。

[![CI](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml/badge.svg)](https://github.com/cixiangtao/vite-plugin-tailwind-merge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-tailwind-merge.svg)](https://www.npmjs.com/package/vite-plugin-tailwind-merge)

在 Vite 中自动为兼容 React 语义的 JSX/TSX 应用 `tailwind-merge`，无需为每个 `className`
手动包裹 `twMerge()`。

静态类名字符串在 Vite 转换阶段直接消解；动态类名值、函数型类名属性和 JSX 展开属性默认由
运行时兜底，从而在不依赖辅助函数名称启发式判断的情况下覆盖支持范围内的类名来源。

这项契约有明确边界：通过过滤器的 JSX/TSX 模块、已配置的类名属性和合法 class value。插件
不会生成 CSS、对类名做哈希，也不提供样式隔离。

```tsx
// 输入
<div className="flex grid px-2 px-4" />

// 输出
<div className="grid px-4" />
```

## 为什么需要这个插件

类名可以通过字面量、变量、CSS Modules、组合函数、回调和展开属性进入 JSX。如果要求每一条路径
都记得手动调用 `twMerge()`，冲突消解就会变成一条可能被遗漏的约定。

这个插件把判断统一放到 Vite 的 JSX 转换边界：

- 静态类名字符串在生成应用代码之前完成合并；
- 动态的已配置属性进入运行时类名值适配器；
- 每个 JSX 展开属性都会进入运行时属性适配器，因为其中可能包含已配置的类名属性；
- 表达式写法和辅助函数名称不会决定支持范围内的路径能否被覆盖。

## 安装

> [!IMPORTANT]
> 必须在实际执行 Vite 构建的应用 package 中直接安装 `tailwind-merge`。它既是必要的 peer
> dependency（对等依赖），也会在默认动态覆盖模式下被生成的应用代码导入。本插件不会将它打包进自身。

请根据应用的 Tailwind CSS 版本选择对应的 `tailwind-merge` 主版本：

| Tailwind CSS | `tailwind-merge` | 状态 |
| ------------ | ---------------- | ---- |
| 3.0–3.4      | `^2.6.0`         | 支持 |
| 4.0–4.3      | `^3.0.0`         | 支持 |

插件不会读取或编译 Tailwind CSS。合并引擎的兼容性来自应用直接安装的 `tailwind-merge`；主版本
选错时，构建可能不会报错，但冲突消解结果可能不正确。

### Tailwind CSS 4

pnpm：

```sh
pnpm add tailwind-merge@^3
pnpm add -D vite-plugin-tailwind-merge
```

npm：

```sh
npm install tailwind-merge@^3
npm install --save-dev vite-plugin-tailwind-merge
```

### Tailwind CSS 3

pnpm：

```sh
pnpm add tailwind-merge@^2.6
pnpm add -D vite-plugin-tailwind-merge
```

npm：

```sh
npm install tailwind-merge@^2.6
npm install --save-dev vite-plugin-tailwind-merge
```

安全的默认做法是把 `tailwind-merge` 放在应用的 `dependencies`，把本插件放在
`devDependencies`。明确使用 `dynamic: "skip"` 的项目只会在 Vite 执行插件时需要合并引擎，
但默认模式会在应用侧生成导入。

在 pnpm workspace 中，应把两个包都安装到具体应用 workspace，而不只是仓库根目录：

```sh
# Tailwind CSS 4 示例
pnpm --filter <app-package> add tailwind-merge@^3
pnpm --filter <app-package> add -D vite-plugin-tailwind-merge
```

如果 Vite 报告 `Cannot resolve "tailwind-merge"`，请先确认实际应用的 `package.json` 中直接声明了
正确主版本的依赖。

## 快速开始

```ts
import tailwindMerge from "vite-plugin-tailwind-merge";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindMerge()],
});
```

支持范围内无需导入 JSX 辅助函数，也无需手动调用合并函数：

```tsx
<div className="flex grid" />
<div className={classes} />
<div className={styles.root} />
<div className={cx("flex", classes)} />
<div {...props} />
```

插件通过 `enforce: "pre"` 提前运行，此时匹配代码仍保持 JSX/TSX 结构。

## JSX 覆盖契约

默认使用 `dynamic: "wrap"` 时，一条路径需要同时满足以下条件才属于覆盖范围：

1. Vite 文件通过插件的 `include` 和 `exclude` 过滤器。
2. 插件运行时，类名来源仍以 JSX 属性或 JSX 展开属性存在。
3. 显式属性名包含在 `attributes` 中（默认是 `className`），或者来源是可能包含这些属性的 JSX
   展开属性。
4. 运行时值是 `tailwind-merge` 支持的 class value，或返回这类值的同步函数。

静态折叠支持字符串字面量、表达式中的字符串字面量、无插值模板字符串，以及两侧都能折叠为
字符串的 `+` 表达式。

| JSX 输入                                    | 结果                   | 合并阶段 |
| ------------------------------------------- | ---------------------- | -------- |
| `className="flex grid"`                     | 合并                   | 构建期   |
| `className={"flex " + "grid"}`              | 合并                   | 构建期   |
| `className={classes}`                       | 字符串或数组时合并     | 运行时   |
| `className={styles.root}`                   | 字符串或数组时合并     | 运行时   |
| `className={cx("flex", classes)}`           | 字符串或数组时合并     | 运行时   |
| `className={getClassName(props)}`           | 字符串或数组时合并     | 运行时   |
| `className={active ? "flex" : "grid"}`      | 字符串或数组时合并     | 运行时   |
| `className={({ isActive }) => "flex grid"}` | 合并函数返回值         | 运行时   |
| `className={["flex", "grid"]}`              | 合并                   | 运行时   |
| `className={false}`                         | 原样保留               | 运行时   |
| `<div {...props} />`                        | 合并其中的 `className` | 运行时   |
| `<div {...getProps()} />`                   | 合并其中的 `className` | 运行时   |
| `<div {...a} className={value} {...b} />`   | 保留源码覆盖顺序       | 两者     |
| `<div className />`                         | 构建错误               | —        |
| `React.createElement("div", { className })` | 不转换                 | —        |
| Vue/Svelte/Astro 原生模板                   | 不转换                 | —        |

不支持的运行时值会原样保留，而不会被猜测处理。`<div className />` 这类无效的已配置属性会直接导致
转换失败，不会悄悄绕过契约。

### 函数型类名属性

返回受支持 class value 的同步函数会通过 `Proxy` 包裹。调用时的 `this`、参数和属性访问都会被
保留；同一个源函数在同一转换模块中会获得稳定的包装器。

包装器与原函数并非引用相等，异步函数也不属于支持的 class value 契约。

### JSX 展开属性

默认模式下，每个 JSX 展开属性都会被包裹，即使运行时对象最终并不包含已配置的类名属性。适配器
会延迟读取属性，因此 getter 和带副作用的展开表达式仍保持正常的求值时机。多个展开属性和显式
属性会保留原有源码顺序与覆盖语义。

只有正常 JSX 展开降级过程会枚举的属性才会参与最终结果。

## 运行时行为

动态值的包裹不依赖表达式名称或写法：

```tsx
// 输入
<div className={classes} />
<div className={styles.root} />
<div className={cx("flex", "grid")} />

// 概念输出
<div className={mergeClassValue(classes)} />
<div className={mergeClassValue(styles.root)} />
<div className={mergeClassValue(cx("flex", "grid"))} />
```

展开属性会获得相同的已配置属性处理：

```tsx
// 输入
<div {...props} />

// 概念输出
<div {...mergeConfiguredClassProps(props)} />
```

只包含静态已配置属性且没有 JSX 展开属性的转换模块，不会加入应用侧合并导入或运行时辅助代码。
包含动态已配置属性或展开属性的模块，会导入配置的运行时合并函数，并注入使用 `Proxy`、
`WeakMap` 和 `Reflect` 的辅助代码。

如果项目接受仅覆盖静态值，可以关闭运行时包裹：

```ts
tailwindMerge({ dynamic: "skip" });
```

`dynamic: "skip"` 会保留构建期静态折叠，但不改动动态属性和 JSX 展开属性。

## 选项

```ts
tailwindMerge({
  attributes: ["className"],
  dynamic: "wrap",
  include: /\.[jt]sx$/,
  exclude: /node_modules/,
});
```

| 选项             | 默认值                                                | 行为                                                             |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `attributes`     | `["className"]`                                       | 替换已配置 JSX 属性集合；`[]` 会同时关闭显式属性与展开属性处理。 |
| `dynamic`        | `"wrap"`                                              | `"wrap"` 添加运行时适配器；`"skip"` 将插件限制为静态折叠。       |
| `include`        | `.[cm]?[jt]sx?` 模块                                  | 替换默认 include 过滤器。                                        |
| `exclude`        | `node_modules` 和 `.d.ts`                             | 替换默认 exclude 过滤器；请自行保留仍然需要的排除项。            |
| `merge`          | `tailwind-merge` 的 `twMerge`                         | 静态字符串使用的构建期合并函数。                                 |
| `runtimeMerge`   | `{ module: "tailwind-merge", exportName: "twMerge" }` | 转换后应用模块使用的导入。                                       |
| `functions`      | 已弃用                                                | 仅保留类型兼容，不再影响覆盖范围。                               |
| `mergeFunctions` | 已弃用                                                | 仅保留类型兼容，不再影响覆盖范围。                               |

`include` 和 `exclude` 使用 Vite/Rollup 过滤模式。提供任一选项都会替换对应默认值，而不是在其上
追加。尤其需要注意：自定义 `exclude` 可能会让 `node_modules` 重新进入转换范围。

## 自定义 Tailwind Merge 配置

静态与运行时合并应使用相同的自定义规则。先从应用模块导出配置后的合并函数：

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

在构建期直接使用这个函数，并告诉转换后的应用模块应从哪里导入它：

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

需要运行时覆盖时，必须同时配置 `merge` 和 `runtimeMerge`。插件只会检查两者是否同时存在，应用
需要自行确保它们采用相同的冲突规则。默认导出请使用 `exportName: "default"`。

## 公开 API

包会导出：

- 默认 Vite 插件，以及命名导出 `tailwindMerge`；
- 用于直接转换源码的 `transformTailwindClasses`；
- 公开的选项和结果类型；
- ESM 和 CommonJS 构建产物、类型声明和 Source Map。

## 兼容性

| 范围                    | 支持或已验证版本                                  |
| ----------------------- | ------------------------------------------------- |
| Node.js                 | `^20.19.0 \|\| >=22.12.0`                         |
| Vite peer dependency    | `>=5.0.0`                                         |
| Vite CI 矩阵            | 主版本 5、6、7、8                                 |
| Tailwind CSS 3 合并引擎 | `tailwind-merge` `^2.6.0`；CI 验证 2.6.1          |
| Tailwind CSS 4 合并引擎 | `tailwind-merge` `^3.0.0`；当前开发环境使用 3.6.0 |

开放式 Vite peer 范围允许未来的 Vite 主版本，但仓库当前仅通过构建矩阵验证 Vite 5–8。

### 框架与语法状态

当前实现通过 OXC 解析 JavaScript/TypeScript 模块，并应用兼容 React 语义的 JSX 展开规则。仅仅
能够解析语法，并不等于完成了框架集成验证。

| 框架或语法                | 状态                       | 当前边界                                                                 |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| 兼容 React 语义的 JSX/TSX | 支持契约                   | 已验证 Vite 5–8 构建转换；尚未分别集成验证 React 插件、HMR、SSR 和 RSC。 |
| Preact JSX/TSX            | 语法兼容；运行时语义未验证 | `className`，或配置后的 `class`。                                        |
| Solid JSX/TSX             | 语法兼容；运行时语义未验证 | 框架响应式和展开行为尚未验证。                                           |
| Qwik JSX/TSX              | 语法兼容；运行时语义未验证 | 可恢复执行（resumability）行为尚未验证。                                 |
| Vue JSX/TSX               | 语法兼容；运行时语义未验证 | 对象式 `class` 不属于支持的值契约。                                      |
| Vue SFC 模板              | 不支持                     | 需要 Vue 编译器适配器。                                                  |
| Svelte 组件               | 不支持                     | 需要 Svelte 编译器适配器。                                               |
| Astro 组件                | 不支持                     | 需要 Astro 编译器适配器。                                                |
| MDX                       | 不支持                     | 默认过滤器和解析路径不能直接接受原始 MDX。                               |
| Angular 模板              | 不支持                     | 不属于当前 Vite JSX/TSX 范围。                                           |

使用 `class` 的 JSX 语法可以替换已配置属性集合：

```ts
tailwindMerge({
  attributes: ["class", "className"],
});
```

## 明确边界

- 插件只合并类名值；不会生成 CSS、读取 Tailwind 配置、对类名做哈希，也不提供样式隔离。
- 仅当 JSX 属性和 JSX 展开属性仍保留在源码中时才会转换。插件不会处理
  `React.createElement`、`jsx`/`_jsx`、`h`、`slotProps` 这类嵌套对象协议，也不会处理框架原生
  模板。
- Vue 对象式类名值，以及框架特有的响应式或可恢复执行（resumable）展开语义，都不属于支持契约。
- 被 Vite 过滤器排除的文件不会转换；匹配文件出现 OXC 解析错误时会导致构建失败。
- 默认模式会包裹每一个展开属性，因为其中可能存在已配置的类名属性。动态属性和展开属性会增加
  应用代码，并要求现代运行环境支持 `Proxy`、`WeakMap` 和 `Reflect`。
- 包裹后的函数会保留调用行为，但与原函数并非引用相等。
- 降低运行时辅助代码成本属于未来优化；性能不会决定支持契约内的路径是否被覆盖。

## 故障排查

### Vite 无法解析 `tailwind-merge`

请把它直接安装到实际应用 workspace，并选择匹配 Tailwind CSS 的主版本。不要依赖仓库根目录安装
或包管理器自动补全 peer dependency。

### 自定义工具类合并错误

插件不会读取 `tailwind.config.*` 或 CSS 主题定义。请配置 `extendTailwindMerge`，并提供相互匹配
的 `merge` 与 `runtimeMerge` 选项。

### 某个类名来源没有变化

请先检查 JSX 覆盖契约：文件过滤器、转换顺序、已配置属性名、值形态，以及插件运行时源码是否
仍为 JSX。框架原生模板和已经转换成元素工厂函数的调用不在支持范围内。

## 开发与支持

```sh
corepack enable
pnpm install
pnpm check
```

维护者发版统一使用受保护的 `release/vX.Y.Z` Pull Request，并遵循
[RELEASING.md](../RELEASING.md) 中仅由 GitHub Actions 发布的流程。

- 提交 Pull Request 前请阅读[中文贡献指南](../CONTRIBUTING.zh-CN.md)。
- 可通过 [GitHub Issues](https://github.com/cixiangtao/vite-plugin-tailwind-merge/issues) 提交可复现
  的问题和边界明确的功能建议。
- 安全漏洞请通过仓库的 [Security
  页面](https://github.com/cixiangtao/vite-plugin-tailwind-merge/security)私下报告。

## 许可证

MIT
