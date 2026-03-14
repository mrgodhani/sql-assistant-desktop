# Release Workflow Design — Code Signing & Notarization

**Date:** 2025-03-13  
**Project:** SQL Assist Desktop  
**Status:** Approved

## Overview

GitHub Actions workflow for releasing the Electron app on macOS with code signing and notarization. Triggered by version tags (`v*.*.*`).

## Approach

**Keychain import** — Decode base64 certificate, import into temporary keychain, run electron-builder. electron-builder uses the keychain for signing and Apple's notarization service for the DMG.

## Trigger & Job Structure

- **Trigger:** `push` on tags matching `v*.*.*`
- **Job:** Single `release` job on `macos-latest`
- **Steps:**
  1. Checkout
  2. Setup Node.js (v24)
  3. Import certificate into temporary keychain
  4. Install dependencies (`npm install`)
  5. Build with `npm run build:mac` (env vars for signing + notarization)
  6. Create GitHub Release and upload artifacts

## Certificate Import & Keychain Setup

1. Decode `MACOS_CERTIFICATE` (base64) to `certificate.p12`
2. Create temporary keychain `build.keychain` with password `actions`
3. Set as default keychain and unlock
4. Import `.p12` into keychain with `MACOS_CERTIFICATE_PWD`
5. Allow `codesign` and `productbuild` access via `security set-key-partition-list`
6. Remove `.p12` after import

**Environment:** `CERTIFICATE_BASE64`, `CERTIFICATE_PWD` from secrets.

**PATH:** Ensure `/usr/bin` is first so system `codesign` is used (avoids electron-builder issues with Homebrew).

## Build & Release

**Build:** `npm run build:mac` with env vars:
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

**Release:** `softprops/action-gh-release` with `draft: true`, `GITHUB_TOKEN`.

**Artifacts:** `dist/*.dmg`, `dist/*.zip`, `dist/*.blockmap`, `dist/*.yml`

## Error Handling & Cleanup

- Failures (cert import, build, notarization) fail the job; no release created.
- No retries.
- Ephemeral runner; no explicit keychain cleanup needed.

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `MACOS_CERTIFICATE` | Base64-encoded .p12 certificate |
| `MACOS_CERTIFICATE_PWD` | Password for the .p12 file |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
