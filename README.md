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

### Building Themes

```bash
vitrin build [theme-path]
```

Builds theme into distributable package.

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
vitrin preview [options]
```

Preview your theme on a dev store.

**Options:**
- `-s, --store <email>` - Dev store email
- `--build` - Build theme before previewing

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
vitrin list [resource]
```

Lists themes or dev stores.

**Example:**
```
$ vitrin list stores
Fetching dev stores...

Dev Stores (3):

ID: 123
Name: Test Store 1
Email: test1@example.com
URL: https://test1.zidtest.com

ID: 456
Name: Test Store 2
Email: test2@example.com
URL: https://test2.zidtest.com
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
rm ~/.vitrin/config.json
```

## Troubleshooting

### Authentication Issues

```bash
# Check authentication status
vitrin list themes

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
- Invalid store ID - check with `vitrin list stores`
- Theme already exists - will auto-generate unique name
```

## Support

Report issues at: https://github.com/zidsa/vitrin-cli/issues