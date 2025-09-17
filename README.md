# Vitrin CLI
command-line interface for Zid theme development.

![Vitrin CLI Demo](https://cdn.jsdelivr.net/npm/@zidsa/vitrin-cli/assets/demo.gif)


## Installation

```bash
npm install -g @zidsa/vitrin-cli
```

## Quick Start

```bash
# Launch the interactive TUI (recommended)
vitrin

# Or use CLI commands directly:
vitrin login        # Authenticate with Zid
vitrin new my-theme # Create a new theme
cd my-theme
vitrin push         # Push theme to Zid
```

## Commands

### Theme Management Commands

```bash
vitrin themes list [options]    # List all themes from server
vitrin themes delete <id>       # Delete a theme from server
```

**Options for themes list:**
- `-s, --search <term>` - Search themes by name

**Options for themes delete:**
- `-f, --force` - Skip confirmation

### Authentication

```bash
vitrin login
```

Authenticates with Zid Partner Dashboard. Opens browser for OAuth flow.

**Example:**
```
$ vitrin login
Opening Zid Partner Dashboard in your default browser...
Listening for authentication callback on http://localhost:4444/auth/callback

✅ Authentication successful!
Token saved to ~/.vitrin/config.json
```

### Theme Creation

```bash
vitrin new <theme-name> [options]
```

Creates a new theme by cloning the official Vitrin template from GitHub.

**Options:**
- `-t, --template <template>` - Template to use (default, minimal, advanced)
- `--no-git` - Skip git initialization

**Example:**
```
$ vitrin new my-store-theme
Cloning template from GitHub...
✅ Theme created successfully!

Next steps:
  cd my-store-theme
  vitrin push  # Push to Zid
```

### Push Theme to Zid

```bash
vitrin push [options]
```

Builds and pushes your theme to Zid servers, creating or updating the theme.

**Options:**
- `-s, --store <email>` - Dev store email to install on
- `-a, --activate` - Activate theme after installation
- `-v, --version <version>` - Version number (default: from theme.json)
- `-c, --changelog <text>` - Version changelog

**Example:**
```
$ vitrin push --store dev@example.com --activate
✅ Theme pushed successfully!
Theme ID: abc123
Version: 1.0.0
```

### Link Theme Directory

```bash
vitrin link [theme-id] [options]
```

Link or unlink current directory to a Zid theme. Useful for managing multiple themes with the same codebase.

**Options:**
- `-p, --path <path>` - Path to theme directory (default: current)
- `-f, --force` - Force link even if already linked to another theme
- `-s, --show` - Show current linked theme

**Examples:**
```
# Show current linked theme
$ vitrin link --show
📎 Currently linked to theme: theme-123

# Link to a theme
$ vitrin link theme-456
✅ Linked to theme: theme-456

# Switch to a different theme
$ vitrin link theme-789 --force
✅ Switched from theme theme-456 to theme-789

# Unlink from theme
$ vitrin link
✅ Unlinked from theme: theme-789
```

**Use Cases:**
- Work with same codebase for multiple themes
- Switch between development and production themes
- Share codebase across different stores

### Building Themes

```bash
vitrin build [path] [options]
```

Builds theme into distributable package.

**Options:**
- `-n, --name <name>` - Name for the build output
- `-o, --output <path>` - Output directory
- `-c, --compression <level>` - Compression level 0-9 (default: 9)
- `--validate` - Validate theme structure before building
- `-e, --exclude <patterns...>` - Exclude patterns

**Example:**
```
$ vitrin build
Validating theme structure...
✅ Theme structure is valid
Building theme package...
✅ Build complete: dist/theme.zip (2.4 MB)
```

### Preview on Dev Store

```bash
vitrin preview [store-id] [theme-path] [options]
```

Preview your theme on a dev store.

**Arguments:**
- `store-id` - Dev store ID (optional if default store is set)
- `theme-path` - Path to theme directory (default: current directory)

**Options:**
- `-t, --theme-id <id>` - Use existing theme ID
- `-n, --name <name>` - Theme name for preview
- `--build` - Build theme before previewing
- `--validate` - Validate theme structure
- `--new-theme` - Force creation of a new theme

**Example:**
```
$ vitrin preview 123 --build
📦 Preparing theme preview for store 123
Building theme...
✅ Theme built successfully
Creating theme...
✅ Theme created: 45678
Creating version...
✅ Version 1.0.0 created
Uploading theme package...
✅ Upload complete
Installing on store...

🎉 Theme ready for preview!

Theme ID: 45678
Version: 90123
Installation: 11111

💡 To activate: vitrin activate 123 11111
```

### List Resources

```bash
vitrin list                    # List both themes and stores (default)
vitrin list --themes           # List themes only
vitrin list --stores           # List dev stores only
vitrin themes list             # Alternative: list themes only
```

Lists themes and/or dev stores.

**Options:**
- `-t, --themes` - List themes only
- `-s, --stores` - List dev stores only  
- `--json` - Output as JSON

**Example:**
```
$ vitrin list --stores
Fetching dev stores...
✅ Found 2 dev stores:

ID          Name                     Email                         Domain
--------------------------------------------------------------------------------
123         Test Store 1             test1@example.com            test1.zidtest.com
456         Test Store 2             test2@example.com            test2.zidtest.com
```

### Theme Installation

```bash
vitrin install <store-id> <theme-id> <version-id>
```

Installs a specific theme version on a store.

**Example:**
```
$ vitrin install 123 45678 90123
Installing theme on store...
✅ Theme installed successfully!
Installation ID: 11111
```

### Theme Activation

```bash
vitrin activate <store-id> <installation-id>
```

Activates an installed theme on a store.

**Example:**
```
$ vitrin activate 123 11111
Activating theme...
✅ Theme activated successfully!
```

### Update Theme Version

```bash
vitrin update <theme-id> [theme-path] [options]
```

Updates an existing theme with a new version.

**Options:**
- `-v, --version <version>` - Version number
- `-c, --changelog <text>` - Version changelog
- `--skip-build` - Skip building theme package

**Example:**
```
$ vitrin update abc123 --version 2.0.0 --changelog "Added new features"
Building theme package...
✓ Theme package built
Creating version 2.0.0...
✓ Version created
Uploading theme...
✓ Upload complete
```

## Interactive TUI Mode

Launch the interactive terminal interface (recommended):

```bash
vitrin
```

### Features

✨ **Theme-Centric Workflow**
- Create new themes from GitHub template
- Push themes directly to Zid servers
- Track push history and versions
- Automatic theme detection in current directory

🚀 **Streamlined Deployment**
- Build and push in one workflow
- Automatic version management
- Install and activate on dev stores
- S3 upload progress tracking

🎨 **Theme Management**
- List server-side themes
- Update theme versions
- Manage theme metadata

🔐 **Authentication & Settings**
- OAuth login flow
- Configure API endpoints
- Persistent settings management

📦 **Store Operations**
- List and manage dev stores
- Preview themes on stores
- One-click activation

## Configuration

### Environment Variables

- `VITRIN_API_URL` - API endpoint (default: https://api.zid.sa)
- `VITRIN_PARTNER_URL` - Partner dashboard URL (default: https://partner.zid.sa)
- `LOG_LEVEL` - Logging level (debug, info, error)

### Debug Mode

Run with detailed logging for troubleshooting:

```bash
LOG_LEVEL=debug vitrin preview 123
```

## File Structure

Expected theme structure:

```
my-theme/
├── assets/
│   ├── styles.css
│   ├── scripts.js
│   └── images/
├── templates/
│   ├── home.jinja
│   ├── product.jinja
│   └── cart.jinja
├── locals/
│   ├── en.json
│   └── ar.json
├── package.json
└── theme.json
```

## Authentication

Authentication tokens are stored in `~/.vitrin/config.json`.

To logout:
```bash
vitrin logout
```

## Troubleshooting

### Authentication Issues

```bash
# Check authentication status
vitrin themes list
# or
vitrin list --themes

# If you see "Authentication required", login again
vitrin login
```

### Build Failures

```bash
# Validate theme structure
vitrin build --validate

# Check for common issues
- Missing required directories (assets, templates)
- Invalid package.json
- .DS_Store files (automatically cleaned)
```

### Preview Errors

```bash
# Run with debug logging
LOG_LEVEL=debug vitrin preview 123

# Common issues:
- Expired authentication token - run `vitrin login`
- Invalid store ID - check with `vitrin list --stores`
- Theme already exists - will auto-generate unique name
```

## Support

Report issues at: https://github.com/zidsa/vitrin-cli/issues