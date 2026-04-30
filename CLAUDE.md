# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

This project uses **pnpm** (`pnpm-lock.yaml`, `packageManager: pnpm@9.15.0`). Use it for installs.

```bash
pnpm run build            # tsc + chmod dist/cli.js (postbuild)
pnpm run dev              # tsx src/cli.ts — run the CLI/TUI from source
pnpm run tui              # alias for dev (launches TUI when no subcommand given)
pnpm start                # node dist/cli.js (post-build run)

pnpm test                 # jest (runs `pnpm run build` first via pretest)
pnpm run test:unit        # jest tests/unit
pnpm run test:integration # jest tests/integration
pnpm run test:watch
pnpm run test:coverage
npx jest path/to/file.test.ts   # run a single test file
npx jest -t "pattern"           # run tests by name pattern

pnpm run lint             # eslint src --ext .ts,.js
pnpm run lint:fix
pnpm run format           # prettier --write src/**/*.ts
pnpm run format:check
pnpm run clean            # rm -rf dist coverage
```

Note: `vitest` is in devDependencies and there's a `vitest.config.ts`, but the actual test runner used by `pnpm test` is **Jest** (config in `jest.config.js`, ts-jest preset). Don't confuse the two.

## Architecture

This is a dual-mode CLI: every feature is reachable both as a one-shot `vitrin <command>` subcommand and as a step in the interactive **TUI** built with [Ink](https://github.com/vadimdemedes/ink) (React in the terminal). Code is structured around that split:

- `src/cli.ts` — entry point. Wires up Commander, loads `~/.vitrin/config.json` env overrides, and registers each subcommand. With no args, it falls through to launching the TUI via `src/tui/index.tsx`.
- `src/commands/*.ts` — one file per Commander subcommand (`build`, `push`, `preview`, `new`, `link`, `themes`, `presets`, `status`, `download`, `translations`, etc.). These are the headless, scriptable code paths.
- `src/tui/` — Ink app. `App.tsx` is the router; `views/` holds one component per screen (`Dashboard`, `PushView`, `PreviewWizard`, `VersionsView`, `ThemeManagerView`, `SwitchThemeView`, `LinkView`, `NewThemeView`, etc.). The TUI mirrors the CLI commands rather than wrapping them — both call into the same core/utils modules.
- `src/core/` — domain layer shared by both modes:
  - `api.ts` — axios client for the Zid Partner API (base URL `VITRIN_API_URL`, default `https://api.zid.sa`). All HTTP goes through this single service.
  - `auth.ts` — OAuth flow + token persistence.
  - `theme.ts` — `ThemeManager`. Reads/writes `<theme>/.vitrin/theme.json` (local link/push state) and mirrors every change into the global registry at `~/.vitrin/themes.json`. Static helpers (`listGlobalThemes`, `findGlobalThemeByName`, `pruneGlobalThemes`, `removeGlobalTheme`) are how the TUI's *Switch Theme* / *Link Theme* flows enumerate known themes.
  - `themeStatus.ts` — version status enum + the partner-allowed transition table (used by both `vitrin status` and the TUI's status picker).
- `src/utils/` — cross-cutting helpers:
  - `build.ts` — `BuildService`: archive creation, `.DS_Store` stripping, and `runAssetBuild()` which detects the package manager from the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise npm), runs `<pm> install` if needed, then `<pm> run build`, streaming stdout/stderr back to the caller.
  - `themeValidation.ts` — single source of truth for `REQUIRED_THEME_FILES` (`layout.jinja`, `header.jinja`, `footer.jinja`, `templates/home.jinja`), `DISCOURAGED_THEME_TEMPLATES` (account/loyalty/address pages Zid manages with platform defaults), and the `findDiscouragedTemplates` / `removeDiscouragedTemplates` / `appendValidatePath` helpers used by both `push`/`preview` CLI commands and their TUI wizards.
  - `version.ts` — semver helpers (`bumpSemVer`, `nextVersions`, `isValidSemVer`) shared by the `vitrin push --bump` flag and the TUI bump picker.
  - `createTheme.ts` — shared theme-bootstrap logic (clone-template vs. register-existing-directory). Both `vitrin new` and the TUI's *Create New Theme* wizard funnel through here so behavior stays identical.
  - `logger.ts` — winston-based logger. `LOG_LEVEL=debug` to enable verbose output.
  - `versionCheck.ts` — npm version-update notifier that runs on CLI startup.

### Local + global state

Two on-disk locations matter:

- `<theme>/.vitrin/theme.json` — local theme link/push state (id, slug, name, push history, installations, default store). Written by `ThemeManager`.
- `~/.vitrin/` — user-global state:
  - `config.json` — auth token + saved env vars. Any keys prefixed `VITRIN_` are loaded into `process.env` at CLI startup (`loadSavedSettings` in `src/cli.ts`).
  - `themes.json` — global registry of every theme ever created or linked, keyed by absolute path. Powers the *Switch Theme* dashboard entry.

When changing anything that touches a theme's identity or location (create/link/unlink/move), update both files via `ThemeManager` — never write to one without the other, or `Switch Theme` and the dashboard's "(N registered)" badge desync.

### Push & preview flow (the load-bearing paths)

Both `vitrin push` and `vitrin preview` (CLI **and** TUI) follow the same pre-flight pipeline:

1. `validateThemeStructureDetailed` — refuses to upload a directory missing any required file. The error reports the resolved path and the list of missing files; the TUI surfaces this as a build error with a hint to use *Switch Theme*. This is what closes the "stale `.vitrin/theme.json` made me upload the wrong folder" failure mode — don't weaken it.
2. `findDiscouragedTemplates` — if the theme contains templates Zid manages with platform defaults, prompt the user (`Upload anyway` / `Remove locally` / `Cancel`). The CLI uses `inquirer`; the TUI uses a dedicated `discouraged-templates` wizard step in `PushView`/`PreviewWizard`.
3. `BuildService.runAssetBuild` — runs the theme's own `npm/pnpm/yarn run build` (skipped if no `build` script), so Tailwind/Vite output ends up in the zip.
4. Zip → upload → install/preview.

If you add a new pre-flight check, add it in **both** the CLI command and the corresponding TUI view — the two paths are intentionally parallel, not delegated.

### API base URL & internal env vars

`VITRIN_API_URL` and `VITRIN_PARTNER_URL` are internal-only overrides documented in `CONFIG.md`. They're loaded from `~/.vitrin/config.json` on startup so a developer can set them once and have every invocation pick them up. Don't surface them in user-facing help.

## Release process

When cutting a version:

1. Bump `version` in `package.json`.
2. Add a section at the top of `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD` following the existing Keep-a-Changelog style (Added / Changed / Removed / Fixed / Migration notes).
3. Update the relevant sections of `README.md` if user-visible behavior changed (push/preview/build pipeline copy, file structure diagram, command flags).
4. `pnpm run build` to confirm types still pass.

The `files` field in `package.json` only ships `dist/`, `assets/`, `README.md`, `LICENSE` — anything that needs to be in the published package goes there.
