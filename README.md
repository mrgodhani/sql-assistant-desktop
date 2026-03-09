# SQL Assist

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Turn natural language into SQL.** Connect to your database, ask questions in plain English, and get accurate queries powered by AI. Execute, visualize, and export—all from a native desktop app.

## Why SQL Assist?

- **No SQL expertise required** — Describe what you need, get working queries
- **Your schema, your data** — AI sees your tables and relationships for accurate results
- **Works offline** — Use local Ollama or connect to OpenAI, Anthropic, Google, OpenRouter
- **One app for everything** — Query, chart, and export without leaving your workflow

## Features

| Feature | Description |
|--------|-------------|
| **Multi-database** | PostgreSQL, MySQL, SQLite, SQL Server |
| **AI providers** | OpenAI, Anthropic, Google, OpenRouter, or local Ollama |
| **Schema-aware** | AI receives your schema for context-accurate queries |
| **Results** | Sortable, filterable tables with virtual scrolling |
| **Charts** | Bar, line, pie, scatter, area—from any result set |
| **Export** | Excel, CSV, and Report (headers, footers, logo, chart) |
| **Conversations** | Chat history saved locally |

## Quick Start

```bash
git clone https://github.com/meetgodhani/sql-assist-desktop.git
cd sql-assist-desktop
npm install
npm run dev
```

## Prerequisites

- **Node.js** 18 or later
- **npm** or **pnpm**

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

Platform-specific builds:

| Platform | Command |
|----------|---------|
| macOS (universal + notarized) | `npm run build:mac` |
| Windows | `npm run build:win` |
| Linux | `npm run build:linux` |

### macOS Build (Universal + Notarized)

Produces a universal DMG (Intel + Apple Silicon) and notarizes it for distribution.

**Prerequisites:**
- Xcode Command Line Tools: `xcode-select --install`
- Apple Developer account
- App-specific password: [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords

**Setup:**
1. Copy `.env.example` to `.env`
2. Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (Team ID from [developer.apple.com](https://developer.apple.com/account))
3. Run `npm run build:mac`

Output: `dist/sql-assist-desktop-1.0.0.dmg`

On first launch from outside Applications (e.g., Downloads), the app will prompt to move to Applications.

## Testing

```bash
npm run test
```

## Project Structure

```
src/
├── main/      # Electron main process (services, IPC, database)
├── preload/   # Preload scripts (contextBridge APIs)
├── renderer/  # Vue 3 frontend (components, stores, views)
└── shared/    # Shared types and constants
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, code style, and how to submit a pull request.

## License

[MIT](LICENSE) © meetgodhani
