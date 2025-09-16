# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.7] - 2025-09-17
### Added
- Refresh preview functionality in TUI mode, press 'R' to re-preview theme without navigating back.
- Visual indicator showing refresh option on preview success screen.

### Changed
- Theme zip files are now created in the system's temporary directory instead of the theme directory during preview/push operations.
- Automatic cleanup of temporary zip files after upload completion or errors.

### Fixed
- Deprecated `substr` method replaced with `substring` in PreviewWizard.
- Removed unused imports in App.tsx.

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