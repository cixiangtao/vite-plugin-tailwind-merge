# Releasing vite-plugin-tailwind-merge

GitHub Actions is the only npm and GitHub Release publisher. Release Please automatically maintains
the release pull request.

## Normal flow

1. Merge ordinary changes into protected `main` through pull requests and the required quality and
   compatibility checks. Other open pull requests do not block release.
2. Release Please updates one automated release PR from a
   `release-please--branches--main--...` branch. Conventional commit or squash-merge titles
   determine the proposed SemVer version and `CHANGELOG.md` (`fix` = patch, `feat` = minor, and
   `!` or `BREAKING CHANGE` = major).
3. Review the release-only diff, proposed version, changelog, and CI, then merge that PR when ready.
4. `.github/workflows/release.yml` revalidates the exact merged PR, builds and packs once, creates
   `vX.Y.Z`, publishes through npm trusted publishing, and creates the matching GitHub Release.
5. Verify the Action, tag target, GitHub Release, npm version/dist-tags, and a fresh public-package
   install.

Stable versions move npm `latest`; supported prereleases use their explicit identifier as the npm
dist-tag and are marked prerelease on GitHub. Do not bump versions, create tags, or publish locally.

## Automation credentials and recovery

Define the Actions variable `RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY` for a
GitHub App installed on this repository with Contents, Issues, and Pull requests read/write
permissions. Its token lets required CI run unattended; PR checks created with the default
`GITHUB_TOKEN` currently wait for separate workflow approval.

If delivery partially succeeds, inspect all existing surfaces before retrying the same merged-PR
workflow. Never recover with local `npm publish` or a manual release tag.
