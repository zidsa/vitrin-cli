import { resolve, join, basename } from 'path';
import { promises as fs } from 'fs';
import logger from './logger.js';
import { ThemeManager } from '../core/theme.js';

export const TEMPLATE_REPO_URL = 'https://github.com/zidsa/growth-theme';
export const TEMPLATE_REPO_GIT = `${TEMPLATE_REPO_URL}.git`;

export interface CreateThemeOptions {
  themeName: string;
  targetDir?: string;
  skipGit?: boolean;
  onProgress?: (message: string) => void;
}

export interface RegisterExistingOptions {
  themeName: string;
  existingPath: string;
  onProgress?: (message: string) => void;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function looksLikeThemeDirectory(path: string): Promise<boolean> {
  const candidates = ['layout.jinja', 'theme.json', 'package.json'];
  for (const candidate of candidates) {
    if (await pathExists(join(path, candidate))) {
      return true;
    }
  }
  return false;
}

export async function createThemeFromTemplate(
  options: CreateThemeOptions
): Promise<string> {
  const { themeName, targetDir, skipGit, onProgress } = options;
  const log = onProgress || ((msg: string) => logger.info(msg));

  const resolvedPath = resolve(process.cwd(), targetDir || themeName);

  if (await pathExists(resolvedPath)) {
    throw new Error(`Directory already exists: ${resolvedPath}`);
  }

  log(`Cloning template from ${TEMPLATE_REPO_URL}...`);

  try {
    const { spawnSync } = await import('child_process');
    const result = spawnSync(
      'git',
      ['clone', TEMPLATE_REPO_GIT, resolvedPath],
      {
        stdio: 'pipe',
        shell: process.platform === 'win32',
      }
    );

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

  const vitrinNotesContent = `# ${themeName}

A Zid theme created with Vitrin CLI based on the Growth Theme template.

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
`;

  await fs.writeFile(join(resolvedPath, 'VITRIN.md'), vitrinNotesContent);

  const themeManager = new ThemeManager(resolvedPath);
  await themeManager.init({
    name: themeName,
    path: resolvedPath,
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

export async function registerExistingTheme(
  options: RegisterExistingOptions
): Promise<string> {
  const { themeName, existingPath, onProgress } = options;
  const log = onProgress || ((msg: string) => logger.info(msg));

  const resolvedPath = resolve(process.cwd(), existingPath);

  if (!(await pathExists(resolvedPath))) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  if (!(await looksLikeThemeDirectory(resolvedPath))) {
    log(
      `⚠️  ${basename(resolvedPath)} does not contain layout.jinja, theme.json, or package.json — registering anyway.`
    );
  } else {
    log(`Found theme files in ${resolvedPath}`);
  }

  const themeManager = new ThemeManager(resolvedPath);
  const existing = await themeManager.getConfig();

  await themeManager.init({
    name: existing.name || themeName,
    path: resolvedPath,
    createdAt: existing.createdAt || new Date().toISOString(),
  });

  log(`Registered theme at ${resolvedPath}`);
  return resolvedPath;
}
