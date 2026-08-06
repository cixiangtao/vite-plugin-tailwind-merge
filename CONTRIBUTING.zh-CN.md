# 参与贡献

[English](./CONTRIBUTING.md) | 简体中文

英文文档是主要维护来源；本页完整对应相同的贡献要求。

感谢你帮助改进 `vite-plugin-tailwind-merge`。

## 开发环境

要求：

- 仓库开发工具链使用 Node.js `^22.18.0 || >=24.11.0`
- pnpm `10.34.5`

已发布插件本身支持 Node.js `^20.19.0 || >=22.12.0`；仓库开发环境要求更高，是因为当前
`tsdown` 版本需要更新的 Node.js。

```sh
corepack enable
pnpm install
pnpm check
```

`pnpm check` 会依次执行格式、lint、类型检查、测试、包构建、ESM/CommonJS 冒烟检查、Vite
构建检查，以及真实 npm tarball 检查。

## 文档语言

英文是主要维护语言，简体中文文档应完整对应相同的公开行为和支持边界。

- 行为、选项、安装方式、兼容性或明确边界发生变化时，同时更新 `.github/README.md` 和
  `.github/README.zh-CN.md`。
- 根目录 `README.md` 会发布到 npm，因此必须保持紧凑；安装或版本状态说明变化时同步更新。
- 贡献、安全或行为准则发生变化时，同步更新对应的 `*.zh-CN.md` 社区文档。

## Pull Request

- 每个 Pull Request 只处理一种行为变化或维护事项。
- 行为发生变化时新增或更新测试。
- API 或支持边界变化时更新公开文档。
- 提交 Pull Request 前确保 `pnpm check` 通过。

可通过 GitHub Issues 提交可复现的问题或边界明确的功能建议。安全问题请按照
[SECURITY.zh-CN.md](./SECURITY.zh-CN.md) 私下报告。
