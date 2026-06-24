# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vesper is a Tauri 2 desktop app (React 19 + TypeScript frontend, minimal Rust backend) for LLM-driven roleplay. Users create characters ("records" / "dossiers"), then chat with them across multiple sessions. Almost all logic lives in the frontend; Rust is used only for native filesystem access (special dirs + saving exported transcripts).

The UI is in **Brazilian Portuguese** and uses an "Editorial Noir" / tech-brutalist aesthetic (monospace labels, uppercase `SCREAMING_SNAKE` captions, accent color `#d1ff26`). System prompts sent to the LLM are also written in Portuguese.

## Commands

```bash
npm install              # install deps (also runs cargo fetch implicitly on first tauri run)
npm run tauri dev        # run the full desktop app (Vite + Rust) — primary dev command
npm run tauri build      # build native installer for current platform
npm run dev              # Vite frontend only (port 1420), no Tauri shell — APIs like window controls / save_text_file won't work
npm run build            # type-check (tsc) + Vite production build of frontend only
```

There is no test runner, linter, or formatter configured. `npm run build` (which runs `tsc`) is the only static check.

## Architecture

### State & persistence (no backend database)
All app data lives in the browser storage of the WebView2/WKWebView runtime — there is no server or SQLite. Two mechanisms:

- **IndexedDB** (`VesperDB` → `characters` store): the character list. Managed entirely in `src/App.tsx` via `initDB`/`saveCharsToDB`/`getCharsFromDB`. Note `saveCharsToDB` clears and rewrites the whole store on every save.
- **localStorage**, keyed by convention:
  - `vesper-settings` — API keys + selected model (`Settings`)
  - `vesper-sessions-${characterId}` — array of `Session` for a character
  - `vesper-msgs-${sessionId}` — array of `Message` for a session

`App.tsx` is the single source of truth and owns character/session CRUD. `Chat.tsx` owns the messages of the *currently open* session and persists them on change. Because storage is WebView-profile-scoped, data does not transfer between machines and is invisible to the Rust side.

### Component map
- `src/App.tsx` — root: title bar (custom window chrome, `decorations: false`), sidebar nav, gallery of characters (`GalleryView`/`DossierCard`), and the view switch (`gallery` | `chat` | `settings`). Holds all character + session state and the design-token object `T`.
- `src/views/Chat.tsx` — the core feature. LLM calls, prompt assembly, message rendering/editing, sessions panel, scenario, director mode, export. See below.
- `src/views/Config.tsx` — settings (API keys, model pick) + About tab. Reads app version from `package.json`.
- `src/components/CharacterModal.tsx` — create/edit a character. Holds `DEFAULT_RP_PROMPT` (the Portuguese uncensored-RP system prompt template). Images are read as base64 data URLs via `FileReader` and stored inline in the character object.
- `src/components/SaveDialog.tsx` — picks a directory (via `get_special_dirs`) and filename for transcript export.
- `src/types/index.ts` — `Character`, `Settings`, `Message`, `Session`. The data contract for the whole app.

### LLM integration (all in `Chat.tsx`)
- `callAPI` POSTs directly from the webview to OpenAI (`api.openai.com`) or DeepSeek (`api.deepseek.com`) — chosen by whether `settings.selectedModel` starts with `gpt`. The matching key from settings is used. Both endpoints must stay whitelisted in the CSP `connect-src` (see `tauri.conf.json`).
- `buildSystemPrompt` assembles the system message from: character identity + `description` + `systemPrompt`, mandatory markdown-formatting rules, a response-length guide (driven by the `responseLength` slider, also passed as `max_tokens`), the session `scenario`, and any `importedContext`.
- **Sessions & memory**: each character has ≥1 session. "Importing context" generates an AI summary of a *past* session (`handleImportContext`) and injects it as `importedContext` into the current session's system prompt — this is how continuity across sessions works.
- **Director mode** (`sendDirectorMsg`): messages with `role: "director"` are stored in history but converted to `system` messages (`[INSTRUÇÃO DO DIRETOR]: …`) when sent to the API — out-of-character instructions to steer the scene. Toggled with the wand button or the `Control` key in the input.
- **Roles**: `Message.role` is `user | assistant | system | director`. When building API context, `director` → `system`; everything else passes through. Retry/edit/delete operate on the local message array and re-call the API as needed.

### Rust backend (`src-tauri/src/lib.rs`)
Three `#[tauri::command]`s: `greet` (unused stub), `get_special_dirs` (downloads/desktop/documents paths), and `save_text_file` (writes a sanitized filename into a chosen dir). Adding a new command requires registering it in the `invoke_handler!` macro and, if it touches a new capability, updating `src-tauri/capabilities/default.json`.

## Conventions & gotchas
- **Styling is inline `style={{}}` objects**, not Tailwind utility classes for the most part. Each file re-declares its own local `T` design-token object (they're near-identical but not shared) — keep colors consistent with the existing palette. Tailwind v4 is wired up (`@tailwindcss/vite`) and used for a few utility classes (`hover:scale-110`, etc.).
- New UI strings should be Portuguese to match the rest of the app.
- The custom title bar means window controls go through `@tauri-apps/api/window` (`getCurrentWindow()`), and draggable regions use `data-tauri-drag-region`. Platform (mac vs win/linux) is sniffed from the user agent to flip control order.
- Bumping the app version means editing **three** files: `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` (the About tab reads from `package.json`).
- The default RP prompt is intentionally an uncensored adult-roleplay template; this is the product's purpose, not an oversight.
