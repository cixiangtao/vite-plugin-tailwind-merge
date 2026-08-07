# Releasing vite-plugin-tailwind-merge

GitHub Actions is the sole npm and GitHub Release publisher. release-it only
prepares a version commit for a constrained release pull request.

## Contract

- `package.json` owns the SemVer version.
- Ordinary changes enter protected `main` through pull requests and the full
  quality/compatibility matrix. Other open pull requests do not block release.
- A release branch must be exactly `release/vX.Y.Z`; its PR may change only
  `package.json` and `pnpm-lock.yaml`.
- After that exact PR merges, `.github/workflows/release.yml` revalidates the
  merge, builds and packs without write credentials, creates `vX.Y.Z`, publishes
  with npm trusted publishing, and creates the GitHub Release.
- Stable versions move npm `latest`; supported prereleases use their explicit
  identifier as the dist-tag and are marked prerelease on GitHub.

## Prepare

1. Synchronize `main` and merge every ordinary PR intended for the version.
2. Create `release/vX.Y.Z` from that exact `main` head.
3. Run `pnpm release:check` and `pnpm release:dry <increment>`.
4. Run `pnpm release <increment>`, inspect the release-only diff, then push the
   branch and open a PR into `main`.

release-it must not tag, push, publish npm, or create a GitHub Release locally.

## Publish and recover

Merge the checked release PR, then verify the Action, tag target, GitHub Release,
npm version/dist-tags, and a fresh public-package install.

If delivery partially succeeds, inspect all existing surfaces before retrying
the same merged-PR workflow. Never recover with local `npm publish` or a manual
release tag.
