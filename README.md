# chotto

A tiny, keyboard-first task app for macOS.
"Chotto" (ちょっと) means "a little bit" in Japanese — capture tasks in a moment, from anywhere.

## Why
- Been managing tasks in Apple Notes, but:
  - No global shortcut to capture instantly
  - Reordering lines is painful
  - Toolbar full of features I don't need
  - Can't change themes
- Existing task apps are slow to capture into (open app → find input → type)
- I want the fastest capture on Mac: select text → one shortcut → done

## Core Features (MVP)
- [x] Popup window via global shortcut (Spotlight/Raycast-style)
  - No title bar, no traffic lights — just the list
  - Esc or focus loss to hide; pin to keep always-on-top
- [x] Every line is a task with a checkbox
- [ ] Instant capture: select text anywhere → shortcut → becomes a task
- [ ] AI parsing: extract title / due / tags from captured text
- [ ] Full keyboard operation
  - `↑↓` move, `Space`/`Enter` toggle check, `⌘↑↓` reorder
  - The last line is the input: type → `Enter` to add
  - `⌘K` command palette / theme switch, `⌘⌫` delete, `⌘,` settings
- [x] UI language: English (default) / Japanese
- [x] Themes: **flexoki-light (default)**, flexoki-dark, Dracula, Nord
- [x] Local storage (SQLite)

## Future Ideas
- [ ] Subtasks (`Tab` / `Shift+Tab` to indent)
- [ ] Voice capture
- [ ] Completed-task handling options (strike / sink / fade out)
- [ ] Homebrew tap distribution (requires Apple Developer signing)
- [ ] Auto-update (Tauri updater)

## Tech Stack
- Tauri 2 (Rust shell, minimal Rust code)
- React + TypeScript
- SQLite (local, via `tauri-plugin-sql`)
- Claude API (task parsing)

## Development
```sh
pnpm install
pnpm tauri dev    # run the app
pnpm build        # typecheck + build the frontend
```

Global shortcut: `⌘⇧Space` toggles the popup.
In-app keys: `↑↓` select / `Enter` add or toggle / `⌘↑↓` reorder / `⌘⌫` delete / `⌘K` theme / `⌘L` language / `⌘P` pin / `⌘,` settings / `Esc` hide.

`⌘,` opens the settings panel, which is also where the full shortcut list lives.

UI language is English by default and can be switched to Japanese (`⌘L`, or the footer button); the choice is remembered. Strings live in `src/lib/i18n.ts`.

The database lives in the app data directory as `chotto.db`; the schema is managed by migrations in `src-tauri/src/lib.rs`.

## Design Decisions
- Tauri over Electron: small binary, low memory — speed is the point
- Tauri over SwiftUI: themes are CSS variables (~20 lines per theme)
- Popup-first UX: the app is hidden by default; capture without context switching
- Every line is a checkbox: no headings, no rich text — this is a task list, not a notes app
- Local-first: no server, no account; data stays on the machine

## Distribution
- Phase 1: build locally for personal use (no Apple Developer account needed)
- Phase 2: open source, build-it-yourself instructions
- Phase 3: signed & notarized build via Homebrew tap ($99/yr Apple Developer)

## License
MIT
