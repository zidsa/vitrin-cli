import { resolve, join } from 'path';
import { promises as fs } from 'fs';
import logger from './logger.js';
import { ThemeManager } from '../core/theme.js';

export interface CreateThemeOptions {
  themeName: string;
  targetDir?: string;
  skipGit?: boolean;
  onProgress?: (message: string) => void;
}

export async function createThemeFromTemplate(
  options: CreateThemeOptions
): Promise<string> {
  const { themeName, targetDir, skipGit, onProgress } = options;
  const log = onProgress || ((msg: string) => logger.info(msg));

  const resolvedPath = resolve(process.cwd(), targetDir || themeName);

  try {
    await fs.access(resolvedPath);
    throw new Error(`Directory already exists: ${resolvedPath}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const templateRepo = 'https://github.com/zidsa/soft-theme-vitrin.git';

  log('Cloning template from GitHub...');

  try {
    const { spawnSync } = await import('child_process');
    const result = spawnSync('git', ['clone', templateRepo, resolvedPath], {
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });

    if (result.error || result.status !== 0) {
      throw (
        result.error || new Error(result.stderr?.toString() || 'Clone failed')
      );
    }
  } catch (cloneError) {
    throw new Error(
      'Failed to clone template. Please check your internet connection and ensure git is installed.'
    );
  }

  try {
    const gitDir = join(resolvedPath, '.git');
    await fs.rm(gitDir, { recursive: true, force: true });
  } catch {}
  const packageJsonPath = join(resolvedPath, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  packageJson.name = themeName.toLowerCase().replace(/\s+/g, '-');
  packageJson.description = `${themeName} theme created with Vitrin CLI`;
  packageJson.version = '1.0.0';
  packageJson.author = '';
  packageJson.repository = {
    type: 'git',
    url: `git+https://github.com/your-username/${themeName.toLowerCase().replace(/\s+/g, '-')}.git`,
  };
  packageJson.bugs = {
    url: `https://github.com/your-username/${themeName.toLowerCase().replace(/\s+/g, '-')}/issues`,
  };
  packageJson.homepage = `https://github.com/your-username/${themeName.toLowerCase().replace(/\s+/g, '-')}#readme`;

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const readmeContent = `# ${themeName}

A Zid theme created with Vitrin CLI based on the Soft Theme template.

## Development

### Building the theme

\`\`\`bash
vitrin build
\`\`\`

### Preview on dev store

\`\`\`bash
vitrin preview <store-id>
\`\`\`

### Push to Zid

\`\`\`bash
vitrin push
\`\`\`

## Structure

- \`assets/\` - CSS, JavaScript, and image files
- \`components/\` - Reusable component templates
- \`sections/\` - Dynamic sections for the theme editor
- \`templates/\` - Template files for different page types
- \`layout.jinja\` - Main layout file
- \`header.jinja\` - Header template
- \`footer.jinja\` - Footer template
- \`locals/\` - Localization files (ar.json, en.json)
- \`query.json\` - Query configuration for product data

## Features

- RTL/LTR support based on language
- Responsive design
- Product filtering and search
- Shopping cart functionality
- User account pages
- Wishlist support
- Multi-language support (Arabic & English)

## Customization

### Theme Colors

The theme uses CSS variables for easy customization. Edit the \`:root\` section in \`assets/main.css\` to change colors:

\`\`\`css
:root {
  --primary-color: {{store.settings.branding.colors.primary}};
  --text-color-primary-bg: {{store.settings.branding.colors.secondary}};
}
\`\`\`

### Fonts

The theme supports custom fonts through the store settings. The default font is Changa.

## Support

For support, please contact the theme developer or visit the Vitrin CLI documentation.
`;

  await fs.writeFile(join(resolvedPath, 'README.md'), readmeContent);

  const themeManager = new ThemeManager(resolvedPath);
  await themeManager.init({
    name: themeName,
    createdAt: new Date().toISOString(),
  });

  if (!skipGit) {
    try {
      const { spawnSync: gitInitSpawn } = await import('child_process');
      const gitInitResult = gitInitSpawn('git', ['init'], {
        cwd: resolvedPath,
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      if (gitInitResult.error || gitInitResult.status !== 0) {
        throw gitInitResult.error || new Error('Git init failed');
      }

      const gitignoreContent = `node_modules/
.npm
*.zip
dist/
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo
*.log
npm-debug.log*
.env
.env.local
.env.production
.vitrin/dist/
`;

      await fs.writeFile(join(resolvedPath, '.gitignore'), gitignoreContent);

      log('Git repository initialized');
    } catch (error) {
      log(
        'Failed to initialize git repository. You can do this manually later.'
      );
    }
  }

  return resolvedPath;
}
