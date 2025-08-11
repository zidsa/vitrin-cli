import { Command } from 'commander';
import { resolve, basename } from 'path';
import logger from '../utils/logger.js';
import { ThemeManager } from '../core/theme.js';
import auth from '../core/auth.js';
import apiService from '../core/api.js';
import inquirer from 'inquirer';

const initCommand = new Command('init')
  .description('Initialize a Vitrin theme in current directory')
  .argument('[path]', 'Directory to initialize', '.')
  .option('-n, --name <name>', 'Theme name')
  .option('--link <theme-id>', 'Link to existing theme by ID')
  .action(async (path: string, options) => {
    try {
      const resolvedPath = resolve(path);
      const themeName = options.name || basename(resolvedPath);

      logger.loading('Initializing theme...');
      const themeManager = new ThemeManager(resolvedPath);
      await themeManager.init({ name: themeName });

      if (options.link) {
        await auth.requireAuth();
        await themeManager.updateThemeId(options.link);
        logger.success(`✅ Theme linked to: ${options.link}`);
      } else {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Would you like to:',
            choices: [
              { name: 'Push to Zid now', value: 'push' },
              { name: 'Skip for now (local development only)', value: 'skip' },
            ],
          },
        ]);

        if (answer.action === 'push') {
          logger.info('Run "vitrin push" to upload your theme to Zid');
        }
      }

      logger.info('\n📚 Theme initialized successfully!');
      logger.info('\nNext steps:');
      logger.info('  1. Build your theme: vitrin build');
      logger.info('  2. Push to Zid: vitrin push');
    } catch (error) {
      logger.error('Initialization failed:', error as Error);
      process.exit(1);
    }
  });

initCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin init                    Initialize theme interactively
  $ vitrin init --link abc123      Initialize and link to existing theme
  $ vitrin init my-theme --name "My Theme"

This command creates a .vitrin/theme.json file that tracks:
  - Theme name and metadata
  - Linked Zid theme ID (if any)
  - Push history
`
);

export default initCommand;
