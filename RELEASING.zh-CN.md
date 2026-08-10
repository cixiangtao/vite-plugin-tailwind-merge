# 发布 vite-plugin-tailwind-merge

[English](RELEASING.md) | 简体中文

GitHub Actions 是 npm 与 GitHub Release 的唯一发布者，Release Please 自动维护发版 PR。

普通改动通过受保护的 `main`、PR、质量与兼容性检查进入。Release Please 从 `release-please--branches--main--...` 维护唯一发版 PR，并根据 Conventional Commit 或 squash merge 标题生成建议的 SemVer 版本与 `CHANGELOG.md`。维护者检查受限差异、版本、Changelog 与 CI 后合并；`.github/workflows/release.yml` 会重新验证准确的合并 PR，只构建和打包一次，创建 `vX.Y.Z`，通过 npm trusted publishing 发布，并创建匹配的 GitHub Release。

发布后独立核对 Action、tag 目标、GitHub Release、npm 版本与 dist-tags，以及公开包的干净安装。稳定版更新 npm `latest`；预发布版使用明确的预发布标识作为 dist-tag，并在 GitHub 标记为 prerelease。不要在本地升版、创建 tag 或发布。

仓库通过 `RELEASE_APP_CLIENT_ID` 与 `RELEASE_APP_PRIVATE_KEY` 使用已安装且具有 Contents、Issues、Pull requests 读写权限的 GitHub App。部分交付成功时，先检查所有公开交付面，再重试同一个已合并 PR 的工作流；不得改用本地 `npm publish` 或手工 tag。
