# Contributing to SQL Assist Desktop

Thanks for your interest in contributing! This document covers how to get started.

## How to Contribute

1. **Fork** the repository on GitHub
2. **Clone** your fork and create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes, following the code style below
4. Run tests and lint
5. **Commit** with clear messages (e.g. `feat: add X`, `fix: resolve Y`)
6. **Push** to your fork and open a **Pull Request** against `main`

## Development Setup

```bash
npm install
npm run dev
```

This starts the Electron app in development mode with hot reload.

## Running Tests

```bash
npm run test
```

For watch mode during development:

```bash
npm run test:watch
```

## Code Style

- **ESLint**: Run `npm run lint` before committing
- **Prettier**: Run `npm run format` to format code

We use ESLint and Prettier for consistent style. Please ensure both pass before submitting a PR.

## Building

```bash
npm run build
```

Platform-specific builds:

- **macOS**: `npm run build:mac` (produces universal DMG, requires Apple credentials for notarization)
- **Windows**: `npm run build:win` (when configured)
- **Linux**: `npm run build:linux` (when configured)

## macOS Notarization

Building for macOS with notarization requires Apple Developer credentials. See the [README](README.md#building-for-macos-universal--notarized) for setup instructions (`.env.example`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

## Project Structure

- `src/main/` — Electron main process (services, IPC handlers, database)
- `src/preload/` — Preload scripts exposing secure APIs via contextBridge
- `src/renderer/` — Vue 3 frontend (components, stores, views)
- `src/shared/` — Shared types and constants
