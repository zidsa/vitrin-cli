import { Command } from 'commander';
import { resolve, join } from 'path';
import { promises as fs } from 'fs';
import logger from '../utils/logger.js';

async function copyDirectory(
  src: string,
  dest: string,
  themeName: string
): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === '.git' ||
        entry.name === 'node_modules' ||
        entry.name === 'dist'
      ) {
        continue;
      }

      await fs.mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath, themeName);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const newCommand = new Command('new')
  .description('Create a new theme')
  .argument('<theme-name>', 'Name of the new theme')
  .option('-d, --directory <dir>', 'Target directory for the new theme')
  .option(
    '-t, --template <template>',
    'Template to use (basic, minimal, advanced)',
    'basic'
  )
  .option('--no-git', 'Skip git initialization')
  .action(async (themeName: string, options) => {
    try {
      const targetDir = options.directory || themeName;
      const resolvedPath = resolve(process.cwd(), targetDir);

      logger.info(`Creating new theme: ${themeName}`);
      logger.info(`Target directory: ${resolvedPath}`);

      try {
        await fs.access(resolvedPath);
        logger.error(`Directory already exists: ${resolvedPath}`);
        process.exit(1);
      } catch {}

      await fs.mkdir(resolvedPath, { recursive: true });

      const templatePath = resolve(
        __dirname,
        '../../test-themes/soft-theme-vitrin-2'
      );

      logger.loading('Copying template files...');

      await copyDirectory(templatePath, resolvedPath, themeName);

      const packageJsonPath = join(resolvedPath, 'package.json');
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );
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
vitrin preview your-store@email.com
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

## Templates

The theme includes templates for:

- Home page (\`home.jinja\`)
- Product pages (\`product.jinja\`)
- Category pages (\`category.jinja\`)
- Cart (\`cart.jinja\`)
- Account pages (profile, orders, addresses, wishlist)
- Search results (\`search.jinja\`)
- Blog pages
- And more...

## Support

For support, please contact the theme developer or visit the Vitrin CLI documentation.
`;

      await fs.writeFile(join(resolvedPath, 'README.md'), readmeContent);

      if (!options.noGit) {
        try {
          const { spawn } = require('child_process');
          await new Promise<void>((resolve, reject) => {
            const git = spawn('git', ['init'], { cwd: resolvedPath });
            git.on('close', (code: number) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Git init failed with code ${code}`));
              }
            });
          });

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
`;

          await fs.writeFile(
            join(resolvedPath, '.gitignore'),
            gitignoreContent
          );

          logger.success('Git repository initialized');
        } catch (error) {
          logger.warn(
            'Failed to initialize git repository. You can do this manually later.'
          );
        }
      }

      logger.success(`Theme "${themeName}" created successfully!`);
      logger.info(`\nNext steps:`);
      logger.info(`  cd ${targetDir}`);
      logger.info(`  vitrin build`);
      logger.info(`  vitrin preview your-store@email.com`);
    } catch (error) {
      logger.error('Failed to create theme:', error as Error);
      process.exit(1);
    }
  });

newCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin new my-theme                Create a new theme called "my-theme"
  $ vitrin new my-theme --directory ./themes/my-theme  Create in specific directory
  $ vitrin new my-theme --template minimal             Use minimal template
  $ vitrin new my-theme --no-git                      Skip git initialization

Templates:
  basic    - Basic theme with common features (default)
  minimal  - Minimal theme structure
  advanced - Advanced theme with more features
`
);

export default newCommand;
