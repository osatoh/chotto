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
- [x] Full keyboard operation
  - Every line is an editable field: `Enter` starts a new line below
  - `↑↓` move between lines, `⌘Enter` checks off, `⌘↑↓` moves the line
  - `⌘⌫` removes a line, `⌘K` switches theme, `⌘,` opens settings
- [x] Subtasks: `Tab` / `Shift+Tab` to indent
- [x] UI language: English (default) / Japanese
- [x] Rebindable keys, including the global shortcut
- [x] Themes: **flexoki-light (default)**, flexoki-dark, Dracula, Nord
- [x] Local storage (SQLite)

## Future Ideas
- [ ] `⌘K` command palette (it only cycles themes today)
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

Needs [Rust](https://rustup.rs) and Node 20+ with pnpm; Xcode command line tools
for the macOS build.

```sh
pnpm install
pnpm tauri dev                  # run the app
pnpm build                      # typecheck + build the frontend
cd src-tauri && cargo check     # check the Rust shell
```

Where things live:

- `src/lib/db.ts` — every SQL statement chotto runs
- `src/lib/keymap.ts` — actions, default bindings, chord parsing
- `src/lib/i18n.ts` — every UI string, in both languages
- `src/styles/themes.css` — a theme is a handful of CSS variables
- `src-tauri/src/lib.rs` — window behaviour, global shortcut, migrations

Global shortcut: `⌘⇧Space` toggles the popup.
In-app keys: `Enter` new line / `⌘Enter` check off / `↑↓` move between lines / `⌘↑↓` move the line / `⌫` remove an empty line / `⌘⌫` remove the line / `Tab` `⇧Tab` indent / `⌘K` theme / `⌘L` language / `⌘P` pin / `⌘,` settings / `Esc` hide.

There is no separate input box: every line is an editable field, and chotto always keeps at least one line to type on.

`⌘,` opens the settings panel, which is also where every key can be rebound:
click a row, press the key you want, and it takes effect immediately. The
bindings live in `localStorage` under `chotto.keymap`, and `⌘⇧Space` is rebound
through the Rust side so the system hears the new one.

UI language is English by default and can be switched to Japanese (`⌘L`, or the
row in the settings panel); the choice is remembered.

The database lives in the app data directory as `chotto.db`; the schema is
managed by migrations in `src-tauri/src/lib.rs`. A task carries its order as a
`REAL` position and its nesting as an `indent` depth, so reordering and
indenting never fight each other.

## Design Decisions
- Tauri over Electron: small binary, low memory — speed is the point
- Tauri over SwiftUI: themes are CSS variables (~20 lines per theme)
- Popup-first UX: the app is hidden by default; capture without context switching
- Every line is a checkbox: no headings, no rich text — this is a task list, not a notes app
- Local-first: no server, no account; data stays on the machine
- Fonts are bundled, not linked: chotto makes no network request at all

## Distribution
- Phase 1: build locally for personal use (no Apple Developer account needed)
- Phase 2: open source, build-it-yourself instructions
- Phase 3: signed & notarized build via Homebrew tap ($99/yr Apple Developer)

## License
MIT

Bundled fonts, both shipped inside the app (`src/assets/fonts/`) so chotto never
fetches them at runtime:

- [Comic Shanns Mono](https://github.com/jesusmgg/comic-shanns-mono) by Shannon
  Miwa and Jesus Gonzalez, MIT licensed — Latin
- [Klee One](https://github.com/fontworks-fonts/Klee) by Fontworks, SIL Open
  Font License 1.1 — Japanese
