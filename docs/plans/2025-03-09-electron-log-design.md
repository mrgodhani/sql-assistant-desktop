# electron-log Integration Design

**Date:** 2025-03-09

## Summary

Add structured logging with electron-log for both development debugging and production support. Full migration of existing console calls across main, preload, and renderer. Settings UI for opening log folder and copying recent logs.

## Requirements (Validated)

- **Purpose:** Dev debugging + production diagnostics for support
- **Scope:** Full migration of ~30+ console calls
- **User access:** Yes — open log folder + copy recent logs in Settings

## Architecture

### 1. Package & Initialization

- Add `electron-log` dependency
- Call `log.initialize()` from `electron-log/main` at top of `src/main/index.ts` (before other imports that may log)
- Default transports: console + file
- Log locations: `~/Library/Logs/sql-assist-desktop/main.log` (macOS), `~/.config/sql-assist-desktop/logs/main.log` (Linux), `%APPDATA%/sql-assist-desktop/logs/main.log` (Windows)

### 2. Logger Usage by Process

| Process | Import |
|---------|--------|
| Main | `electron-log/main` |
| Preload | `electron-log/preload` or `electron-log/renderer` |
| Renderer | `electron-log/renderer` |

### 3. Log Level Mapping

- `console.log` → `log.info`
- `console.error` → `log.error`
- `console.warn` → `log.warn`

### 4. IPC for Log Access

- `getLogPath()` → main log file path
- `getRecentLogs(lines?: number)` → last N lines (default 500)
- `openLogFolder()` → open parent folder via shell

### 5. Settings UI

- New `LogsSettings.vue` (or `SupportSettings.vue`) with:
  - "Open log folder" button
  - "Copy recent logs" button + clipboard + feedback
- Add as third section in SettingsView below ThemeSettings and ProviderSettings

## Migration Scope

| File | Changes |
|------|---------|
| `src/main/index.ts` | log.initialize(), replace 5 console calls |
| `src/main/services/database.service.ts` | Replace 2 console.error |
| `src/main/services/schema.service.ts` | Replace 1 console.error |
| `src/main/services/settings.service.ts` | Replace 1 console.log |
| `src/main/services/encryption.service.ts` | Replace 1 console.warn |
| `src/main/ipc/connections.ipc.ts` | Replace 1 console.error |
| `src/preload/index.ts` | Replace 1 console.error |
| `src/renderer/src/main.ts` | Replace 2 console.error |
| `src/renderer/src/stores/useConnectionStore.ts` | Replace 8 console.error |
| `src/renderer/src/stores/useSettingsStore.ts` | Replace 7 console.error |

## Error Handling

- `getRecentLogs` failure → return empty string or error message; renderer shows "Unable to read logs"
- `openLogFolder` failure → show error dialog
- Logger init failure → optional fallback to console (low priority)
