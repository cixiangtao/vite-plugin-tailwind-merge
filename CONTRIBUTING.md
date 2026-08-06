# Contributing

English | [简体中文](./CONTRIBUTING.zh-CN.md)

Thanks for helping improve `vite-plugin-tailwind-merge`.

## Development setup

Requirements:

- Node.js `^22.18.0 || >=24.11.0` for the repository build toolchain
- pnpm `10.34.5`

The published plugin itself supports Node.js `^20.19.0 || >=22.12.0`; the newer development
requirement comes from the current `tsdown` release.

```sh
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs formatting, linting, type checking, tests, the package build, ESM/CommonJS smoke
tests, a Vite build check, and real npm tarball inspection.

## Documentation languages

English is the primary maintenance language. Simplified Chinese documents mirror the same public
behavior and support boundaries.

- Update both `.github/README.md` and `.github/README.zh-CN.md` when behavior, options,
  installation, compatibility, or explicit boundaries change.
- Keep the root `README.md` compact because npm publishes it. Update it when installation or
  release-status guidance changes.
- Update the matching `*.zh-CN.md` community document when changing contribution, security, or
  conduct policy.

## Pull requests

- Keep each pull request focused on one behavior or maintenance concern.
- Add or update tests for behavior changes.
- Update public documentation when an API or support boundary changes.
- Ensure `pnpm check` passes before opening the pull request.

Use GitHub issues for reproducible bugs and focused feature proposals. Report security problems
privately according to [SECURITY.md](./SECURITY.md).
