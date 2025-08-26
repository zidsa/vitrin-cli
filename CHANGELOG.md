# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-08-26

### Added
- CHANGELOG.md for tracking version changes
- Assets folder now included in npm package for README demo image

### Fixed
- Fixed "Create New Theme" UI text overlap in TUI mode
- Fixed theme installation error on push command (404 error)
- Updated README with correct command usage documentation
- README demo image now uses jsDelivr CDN for npm package compatibility

### Changed
- Push command now uses correct API endpoint for theme installation
- Updated all command examples in README to match actual CLI usage

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