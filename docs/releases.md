# Frontend releases

The frontend and API are separate repositories with independent versions. Use patch releases for backward-compatible fixes, minor releases for new features, and explicitly document breaking changes. Never invent dates or tags for historical package versions that were not released.

## Prepare and validate

1. Create a release branch from current `main`, retaining the intended changes.
2. Set `package.json` to the new version. Add a dated `CHANGELOG.md` entry with user-visible changes, migration/configuration requirements and compatibility notes. Keep `[Unreleased]` for future work.
3. Run the checks in [development](development.md#automated-checks), including `pnpm install --frozen-lockfile`. Validate notes with `node scripts/release-notes.mjs vX.Y.Z`.
4. Open a PR containing the changes, tests, version and changelog. Record browser checks and untested integrations honestly. Wait for CI and inspect the Vercel preview before merging. Respect required reviews and branch protections.

The CI workflow uses Node.js 24, the pnpm version declared in `package.json`, and immutable action SHAs. It runs on PRs, pushes to `main`, manual dispatches, and as a reusable workflow for releases. It requires no production credentials and builds with the API disabled.

## Tag and publish

After merging, fetch `main` and wait for its CI to pass. Record the exact commit and its Vercel deployment. Tag that commit, rather than an unrelated local working tree:

```sh
git fetch origin main --tags
git tag -a vX.Y.Z <validated-main-commit> -m "Wida Frontend vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag starts the Release workflow. It reruns CI on the tagged commit, checks that it belongs to `main`, requires the tag to match `package.json`, and extracts only that version's dated changelog section. Only the publication job receives `contents: write`; it creates the GitHub Release with the existing tag. No personal access token is needed.

If validation fails, fix it through a PR before publishing a new tag. Do not move a published tag. If publication fails transiently without creating a release, rerun the failed job after inspecting its logs; check for an existing release before retrying.

## Deploy and verify

Vercel's Git integration may deploy when `main` is updated, before the tag is pushed. A GitHub Release is not itself proof of deployment. Match the production deployment's Git SHA to the released commit and follow the [deployment checks](deployment.md#verify-the-deployment). Do not create a second deployment unnecessarily or assume a preview URL is production.

For rollback, retain the previous successful production deployment URL and SHA. Restore that deployment through the configured host, verify the same production routes, and document the rollback. Ship a new patch version for subsequent fixes rather than reusing a release tag. Coordinate with the API only when a release changes its contract or configuration.
