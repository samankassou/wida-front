# Changelog

This file records user-visible changes to the Wida frontend. The API is released independently.

## [0.3.0](https://github.com/samankassou/wida-front/compare/v0.2.0...v0.3.0) (2026-09-19)


### Added

* **admin:** add a dedicated administration page ([7fa4514](https://github.com/samankassou/wida-front/commit/7fa451453c93b89aa9afd628ea5f68d52e04933a))
* **admin:** replace settings modal with dedicated administration page ([61feedf](https://github.com/samankassou/wida-front/commit/61feedfeb37c4516db4a7c0cfd1f5316a7c0000d))

## [Unreleased]

## [0.2.0](https://github.com/samankassou/wida-front/compare/v0.1.1...v0.2.0) (2026-09-19)

### Added

- Delete documents from live and demo workspaces, including their invoice details and analysis history.
- Confirm deletion in a styled English/French dialog with the filename, progress feedback and inline errors. Keyboard dismissal and mobile layouts are supported.
- Prevent deletion while analysis is pending or running, and restrict live deletion to the document owner.

### Maintenance

- Prepare version and changelog updates automatically through Release Please PRs, with CI checks and separate tag-based publication.
- Handle absent release PR output without failing the workflow when no new PR is needed.

### Deployment

- Requires the companion API update providing owner-scoped `DELETE /api/documents/{id}` and removal of associated records and the stored original. Deploy the API update before the frontend.
- No database migration or new environment variables are required. Failed original-file cleanup is logged and requires operator follow-up.
- Deletion does not refund analysis credits already consumed.

## [0.1.1] - 2026-09-19

### Fixed

- Keep the original preview and processing history when reopening the document already being reviewed, including after a duplicate upload.
- Export negative invoice amounts as numeric CSV values while keeping formula-like text escaped.
- Preserve the next-document review sequence when live document details finish loading.
- Show the workspace's total document count in the sidebar rather than the number of cached records.

### Maintenance

- Add regression coverage for credit-invoice CSV exports and live detail merging.
- Add CI for installation, lint, tests, TypeScript and production builds, plus tag-based GitHub Releases using these notes.

### Deployment

- Frontend-only patch; no API changes, database migrations or new environment variables are required.
- Cloud authentication, extraction and remote storage still require the live deployment checks documented in `docs/deployment.md`.

The repository previously declared version 0.1.0 without a published GitHub Release. This changelog starts with 0.1.1; it does not reconstruct an unverified release history.
