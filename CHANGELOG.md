# Changelog

This file records user-visible changes to the Wida frontend. The API is released independently.

## [0.2.0](https://github.com/samankassou/wida-front/compare/v0.1.1...v0.2.0) (2026-09-19)


### Added

* **release:** automate changelog preparation with Release Please ([1ca6624](https://github.com/samankassou/wida-front/commit/1ca6624d561cb3589739c53296909944c86e8717))
* **release:** automate changelog preparation with Release Please ([cf810b3](https://github.com/samankassou/wida-front/commit/cf810b313db9f9368c37ff46209ece6648769a13))


### Fixed

* release frontend v0.1.1 with review and export corrections ([18a38a5](https://github.com/samankassou/wida-front/commit/18a38a5e1214304a48e542cf004fd5331e1cbce0))

## [Unreleased]

### Maintenance

- Prepare version and changelog updates automatically through Release Please PRs, with CI checks and separate tag-based publication.

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
