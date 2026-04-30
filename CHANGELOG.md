# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-30

This release reshapes Vitrin around theme **memory**, **versioning**, and
**safe pushes**. Created themes are tracked from day one, push refuses to
upload the wrong folder, the Growth Theme template's Tailwind/Vite assets
are now compiled before zipping, and a new Versions view exposes the full
version lifecycle (status, changelog, bumps) directly in the TUI.

### Added

**New commands**
- `vitrin status` — view or change a theme version status. Implements the
  full backend state machine, filters admin-only transitions
  (`in_review` / `approved` / `rejected`) to what partners can actually
  trigger, and clearly reports `in_review` / `deprecated` versions as
  locked.
- `vitrin download` — pull the published `.zip` artifact for a theme
  version via `GET /v2/themes/{id}/versions/{id}/download/`. Defaults to
  the linked theme's latest version. Supports `-o <path>` for custom
  output and `-f` to overwrite.
- `vitrin presets` command group — `list`, `show`, `create`, `update`,
  `delete`, `upload-image` for theme presets. CRUD bodies load from JSON
  files; image uploads return the public URL.

**New flags**
- `vitrin push --new-version` (`-n`) — cut a brand new version instead of
  updating the latest one in place. Sends `keep_using_latest` to
  `POST /v2/themes/{id}/versions/`.
- `vitrin push --bump <patch|minor|major>` — pairs with `--new-version` to
  auto-compute the next version from the latest one on the server.
- `vitrin push --changelog-ar <text>` — Arabic changelog alongside the
  English one; the API receives both as `{ en, ar }`.
- `vitrin new --from-existing <path>` — register a directory you already
  have as a Vitrin theme without cloning the template. Writes
  `.vitrin/theme.json` and a global-registry entry in place, no copying.

**Versions & changelogs (TUI)**
- New 📚 *Versions & Changelogs* view, reachable from the dashboard (when
  a theme is linked) and from *Manage Themes* via `[V]` on a row.
- Per-version detail panel showing status, version id, created-at, and
  full English / Arabic changelogs.
- `[E]` edits the changelog (en required, ar optional) via a new
  `PATCH /v2/themes/{id}/versions/{vid}/` endpoint.
- `[S]` opens a status picker filtered by the same partner-allowed
  transition table that `vitrin status` uses; `in_review` / `deprecated`
  versions surface a clear locked message.

**Theme metadata editing (en + ar)**
- *Manage Themes* `[E]` now cycles through `name.en`, `name.ar`,
  `description.en`, `description.ar`. Arabic fields are optional and
  dropped from the payload when blank, so a translation can be cleared by
  leaving the field empty.

**Push wizard, restructured for intentional version creation**
- Default highlights *Update latest version* (the right choice for
  template patches, copy / translation tweaks, and bugfixes).
- *Create a new version* now requires an explicit confirmation step
  ("a new version is permanent — existing stores stay on their current
  version until they explicitly update") before continuing.
- New bump picker (patch / minor / major / custom) with the next version
  number computed from the latest one on the server. Custom versions are
  validated as `X.Y.Z` and required to be strictly greater than the
  current latest.
- Changelog captured in two steps: English (required) → Arabic (optional).
- Review screen recaps strategy, deployment target, and changelogs before
  the push runs.

**Local theme memory & global registry**
- `ThemeManager.init()`, `recordPush()`, `updateThemeId()`, and
  `updateConfig()` now persist the theme's absolute path and mirror every
  change into a global registry at `~/.vitrin/themes.json`. Themes are
  tracked from the moment they are created — no need to push first.
- New static helpers: `listGlobalThemes()`, `pruneGlobalThemes()`,
  `removeGlobalTheme()`, `findGlobalThemeByName()`.

**TUI flows for memory & navigation**
- *Create New Theme* is now a two-step wizard:
  1. Pick *Clone Growth Theme template* or *Use existing local directory*.
  2. Provide name (and path for the existing-directory flow).
  The Growth Theme repo URL (<https://github.com/zidsa/growth-theme>) is
  disclosed up front so contributors know what they're cloning.
- New 🔀 *Switch Theme* view lists every registered theme, marks linked
  (🔗) vs. local-only (·) entries, and `chdir`s the current session into
  the chosen one. Dashboard surfaces a "(N registered)" badge so the
  registry is visible at a glance.
- *Link Theme* flow now asks where to link a chosen API theme: the
  current directory, any directory in the global registry, or a custom
  path you type in (validated to exist).
- Dashboard entry for `vitrin translations` (🌐) — extracts `_("…")`
  strings from `.jinja` templates and writes/updates `locale/messages.pot`
  plus per-language `.po`/`.mo` catalogs.
- Dashboard now shows the linked theme's absolute path beneath its name,
  and when no theme is found in cwd, hints at the count of registered
  themes available via *Switch Theme*.

**Asset compilation pipeline**
- `BuildService.runAssetBuild()` runs before zipping. Detects the theme's
  package manager (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise
  npm), runs `<installer> install` if `node_modules` is missing, then
  `<installer> run build`. Streams stdout/stderr line-by-line into the
  BuildView/PushView UI. The Growth Theme's Tailwind + Vite outputs
  (`assets/styles.css`, `assets/dist/*.js`) now end up in the upload
  instead of just sources. Themes with no `build` script in
  `package.json` skip the step transparently.

**Validation & safety**
- New `validateThemeStructureDetailed()` returns
  `{ valid, resolvedPath, missing }`. The TUI build error now says exactly
  which directory was checked and what was missing, with a hint to use
  *Switch Theme* if the files live elsewhere.
- Push (TUI + CLI) refuses to upload a directory that has no
  `layout.jinja`, closing the silent "stale `.vitrin/theme.json` made me
  upload the CLI repo as a theme" failure mode.

**API client**
- `updateThemeVersion()` (`PATCH /v2/themes/{id}/versions/{vid}/`) for
  editing changelog and other mutable version fields.
- `listThemeVersions`, `getThemeVersion`, `downloadThemeVersionArtifact`.
- `listPresets`, `getPreset`, `createPreset`, `updatePreset`,
  `deletePreset`, `uploadPresetImage`.
- `updateThemeVersionStatus` widened to accept the full status enum.

**Internals**
- New `src/utils/version.ts` semver helper: `parseSemVer`, `formatSemVer`,
  `bumpSemVer`, `nextVersions`, `isValidSemVer`. Shared between the CLI
  `--bump` flag and the TUI bump picker.
- New `src/core/themeStatus.ts` — status enum, partner-allowed transition
  table, and `getPartnerAllowedTransitions()` helper.

### Changed
- `createThemeFromTemplate` no longer overwrites the cloned template's
  `README.md`. Vitrin-specific instructions are written to a new
  `VITRIN.md` alongside the template's own README.
- Unlinking now keeps the local `path` in `.vitrin/theme.json` and the
  global registry, so the directory can be re-linked later without
  re-discovering it.
- `ThemeManager` constructor coerces empty/missing path to
  `process.cwd()` with `||` (was `??`), so an empty-string path no longer
  writes a `.vitrin/theme.json` to `$HOME` when the TUI starts outside a
  theme directory.
- README expanded with the partner-allowed status transition table, the
  asset-build pipeline, the new versions/registry sections, and guidance
  on when to update the latest version vs. cut a new one.

### Removed
- `minimum_api_version` is gone everywhere — interfaces, API request
  bodies, theme.json fallbacks, the `vitrin update --minimum-api` CLI
  flag, and the "Minimum API" line in the Versions detail panel. The
  field was no longer used by the backend.

### Fixed
- Build step in the TUI reports the actual directory it validated and
  the missing files instead of the opaque `Invalid theme structure`.
- Push will no longer happily zip and upload a non-theme directory just
  because a stale `.vitrin/theme.json` claims a linked theme id.

### Migration notes
- If you were relying on the package-lock.json that lived in earlier
  development drops, this branch is pnpm-only (`pnpm-lock.yaml` and
  `packageManager: pnpm@9.15.0` in `package.json`).
- A new directory layout for Vitrin's local state:
  - `<theme>/.vitrin/theme.json` — local theme link/push state
  - `~/.vitrin/themes.json` — global registry (NEW)
  - `~/.vitrin/config.json` — auth + saved env vars (unchanged)
- The Growth Theme template is now expected to expose an `npm run build`
  script that produces `assets/styles.css` and `assets/dist/*.js`. Themes
  that don't ship a `build` script keep working — the step is skipped.

## [1.1.6] - 2025-10-22
### Added
- `vitrin translations` command to extract, update, and compile theme
  translation catalogs.
- New default theme template.

## [1.1.5] - 2025-10-20
### Added
- Fix: always pass x-partner-token header

## [1.1.4] - 2025-10-10
### Fixed
- Fixed auth auto-logout issue on 403 errors

## [1.1.3] - 2025-10-10
### Fixed
- Fixed build output on build command to use theme directory, preview commands continue to use system temp directory

## [1.1.2] - 2025-09-29
### Added
- Support for uploading drafted theme settings via CLI

### Fixed
- Code formatting improvements across all TypeScript files
- Prettier formatting applied consistently throughout the project

## [1.1.1] - 2025-09-29
no changes

## [1.1.0] - 2025-09-18
### Added
- Refresh preview in TUI mode with 'R' key
- `vitrin link` command for theme linking management
- Link/Unlink Theme option in TUI dashboard
- Activate Theme with installation tracking
- Archive themes with 'A' key when deletion blocked
- Direct keyboard shortcuts in Manage Themes (E/D/A)

### Changed
- `--store` option now uses store ID instead of email
- Dev stores API uses `store_id` field instead of pivot table `id`
- Theme zips created in temp directory
- Activate auto-installs when needed
- Unified navigation (Esc/q to go back)
- Direct keyboard actions in Manage Themes
- Smart error handling suggesting archive when delete fails
- Error screen now shows context-aware navigation options

### Fixed
- Replaced deprecated `substr` with `substring`
- Removed unused imports
- Fixed pivot table ID confusion
- Fixed CORS for auth callback
- Added POST support to auth callback
- Fixed navigation losing selected theme when going back from error screen

### Removed
- `vitrin install` command (use preview/activate)
- `vitrin init` command (use `vitrin link`)

## [1.0.6] - 2025-09-15
### Added
- Auto-open preview URLs in default browser after deployment
- Ink Link component for proper clickable URLs in TUI mode

### Fixed
- Fixed preview URL wrapping issue in terminals causing broken links when Command+Click
- Improved URL display in both TUI and CLI modes to prevent line wrapping

### Changed
- Theme validation now only requires `layout.jinja` file instead of both `package.json` and `layout.jinja`

## [1.0.5] - 2025-09-08
### Fixed
- Fixed archiving on Windows machines
- Improved error handling across the application
- Improved authentication flow by requiring it at startup

## [1.0.4] - 2025-08-26

### Added
- CHANGELOG.md for tracking version changes
- Assets folder now included in npm package for README demo image
- Version check utility to notify users of available updates
- Dynamic version display in TUI from package.json
- Unified theme creation logic in shared utility to prevent breaking changes

### Fixed
- Fixed "Create New Theme" UI text overlap in TUI mode
- Fixed theme installation error on push command (404 error)
- Fixed `vitrin new` command ESM module error (__dirname not defined)
- Fixed "Press any key to continue" in PushView - now responds to any key press
- Updated README with correct command usage documentation
- README demo image now uses jsDelivr CDN for npm package compatibility
- Fixed `vitrin list` documentation to reflect correct behavior

### Changed
- Push command now uses correct API endpoint for theme installation
- Updated all command examples in README to match actual CLI usage
- TUI now shows actual version from package.json instead of hardcoded value
- Theme creation logic centralized in createTheme.ts utility

### Removed
- Removed all unnecessary code comments throughout the project
- Removed deprecated `installThemeOnStore` API method
- Removed obsolete API endpoint `/v1/market/dev-stores/install`

## [1.0.2] - 2025-08-24

### Fixed
- Theme push and installation workflows

## [1.0.1] - 2025-08-24

### Fixed
- Minor bug fixes

## [1.0.0] - 2025-08-24

### Added
- Initial release
- Interactive TUI (Terminal User Interface) mode
- OAuth authentication with Zid Partner Dashboard
- Theme creation from GitHub template
- Theme build and validation
- Theme push to Zid servers with S3 upload
- Theme preview on dev stores
- Theme installation and activation
- Dev store management
- Theme listing and search
- Comprehensive CLI commands
- Debug logging support