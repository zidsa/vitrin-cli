# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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