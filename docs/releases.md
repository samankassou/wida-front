# Frontend releases

The frontend and API are separate repositories with independent versions. Use patch releases for backward-compatible fixes, minor releases for new features, and explicitly document breaking changes. Never invent dates or tags for historical package versions that were not released.

## Automated release preparation

[Release Please](https://github.com/googleapis/release-please-action) prepares a release PR after changes reach `main`. It updates `package.json`, `.release-please-manifest.json` and `CHANGELOG.md`. The manifest starts at the published version `0.1.1`; do not reset it or manually bump the package version for ordinary changes.

Use Conventional Commit titles and squash-merge feature/fix PRs so those titles become commits on `main`:

- `feat(documents): add document deletion` adds an Added entry and increments the minor version (for example, `0.1.1` to `0.2.0`).
- `fix(preview): keep the original visible` adds a Fixed entry and increments the patch version.
- `feat!:` or a `BREAKING CHANGE:` footer identifies breaking changes. During `0.x`, these increment the minor version; once stable, they increment the major version.
- `docs:`, `chore:`, `ci:`, `refactor:`, `test:` and `style:` changes are hidden from user-facing notes by default and do not independently request a release.

The workflow uses the repository's built-in `GITHUB_TOKEN`, without a personal token. In GitHub repository **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create and approve pull requests. Organization policy must also permit this. The workflow does not approve or merge PRs.

Bot-created PRs do not automatically trigger `pull_request` workflows when using `GITHUB_TOKEN`. The preparation workflow explicitly dispatches the existing CI workflow on the generated release branch. Its checks run with read-only repository permissions. If a dispatch fails, rerun **CI** from Actions against that release branch and verify the run's commit matches the latest PR commit.

## Review and validate

1. Merge normal feature/fix PRs with Conventional Commit titles. Release Please creates or updates the release PR; **Actions → Release Please → Run workflow** on `main` can retry preparation.
2. Review the proposed version and generated changelog. Add migration, API compatibility and configuration details to that version's section. Move any relevant manually written `[Unreleased]` notes into it, deduplicate generated entries, and leave unrelated future work under `[Unreleased]`. Automatic generation does not understand deployment dependencies.
3. Finish editorial changes after the last feature merge: a subsequent bot update can regenerate the notes. Run the checks in [development](development.md#automated-checks), including `pnpm install --frozen-lockfile`. Validate notes with `node scripts/release-notes.mjs vX.Y.Z`.
4. Wait for CI on the latest release PR commit and inspect the Vercel preview. Record browser checks and untested integrations honestly, then merge the release PR when ready. Respect required reviews and branch protections.

Release Please is configured with `skip-github-release: true`: it prepares PRs but does not create tags, publish GitHub Releases, or merge changes. Tag publication remains a separate step below. A merged release PR keeps `autorelease: pending` until publication, preventing another release PR from opening prematurely.

The CI workflow uses Node.js 24, the pnpm version declared in `package.json`, and immutable action SHAs. It runs on PRs, pushes to `main`, manual dispatches, and as a reusable workflow for releases. It requires no production credentials and builds with the API disabled.

## Tag and publish

After merging, fetch `main` and wait for its CI to pass. Record the exact commit and its Vercel deployment. Tag the release PR’s exact merge commit after its CI passes, rather than a later or unrelated commit:

```sh
git fetch origin main --tags
git tag -a vX.Y.Z <validated-main-commit> -m "Wida Frontend vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag starts the Release workflow. It reruns CI on the tagged commit, checks that it belongs to `main`, requires the tag to match `package.json`, and extracts only that version's dated changelog section. The publication job creates the GitHub Release with the existing tag, then removes `autorelease: pending` from the merged release PR matching that exact commit. This lets Release Please prepare the next release on a later push or manual run. No personal access token is needed.

If validation fails, fix it through a PR before publishing a new tag. Do not move a published tag. If publication or PR-label cleanup fails transiently, inspect the logs and rerun the failed job. An existing release is reused, allowing label cleanup to retry without publishing twice.

## Deploy and verify

Vercel's Git integration may deploy when `main` is updated, before the tag is pushed. A GitHub Release is not itself proof of deployment. Match the production deployment's Git SHA to the released commit and follow the [deployment checks](deployment.md#verify-the-deployment). Do not create a second deployment unnecessarily or assume a preview URL is production.

For rollback, retain the previous successful production deployment URL and SHA. Restore that deployment through the configured host, verify the same production routes, and document the rollback. Ship a new patch version for subsequent fixes rather than reusing a release tag. Coordinate with the API only when a release changes its contract or configuration.
