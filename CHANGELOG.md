# Changelog

This file records user-visible changes to the Wida frontend. The API is released independently.

## [Unreleased]

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
