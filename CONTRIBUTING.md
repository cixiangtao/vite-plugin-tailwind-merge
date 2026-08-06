# Contributing

Thanks for helping improve `vite-plugin-tailwind-merge`.

## Development setup

Requirements:

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

```sh
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs formatting, linting, type checking, tests, the package build, ESM/CommonJS smoke
tests, and an npm package dry run.

## Pull requests

- Keep each pull request focused on one behavior or maintenance concern.
- Add or update tests for behavior changes.
- Update public documentation when an API or support boundary changes.
- Ensure `pnpm check` passes before opening the pull request.

Use GitHub issues for reproducible bugs and focused feature proposals. Report security problems
privately according to [SECURITY.md](./SECURITY.md).
