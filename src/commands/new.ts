import { Command } from 'commander';
import logger from '../utils/logger.js';
import { createThemeFromTemplate } from '../utils/createTheme.js';

const newCommand = new Command('new')
  .description('Create a new theme')
  .argument('<theme-name>', 'Name of the new theme')
  .option('-d, --directory <dir>', 'Target directory for the new theme')
  .option(
    '-t, --template <template>',
    'Template to use (default, minimal, advanced)',
    'default'
  )
  .option('--no-git', 'Skip git initialization')
  .action(async (themeName: string, options) => {
    try {
      const targetDir = options.directory || themeName;

      logger.info(`Creating new theme: ${themeName}`);
      logger.info(`Target directory: ${targetDir}`);

      const resolvedPath = await createThemeFromTemplate({
        themeName,
        targetDir,
        skipGit: !options.git,
        onProgress: msg => logger.loading(msg),
      });

      logger.success(`✅ Theme "${themeName}" created successfully!`);
      logger.info(`\nNext steps:`);
      logger.info(`  cd ${targetDir}`);
      logger.info(`  vitrin push  # Push to Zid`);
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
  $ vitrin new my-theme --no-git                      Skip git initialization

Note:
  The command clones the official Soft Theme template from GitHub.
  An internet connection is required to download the template.
`
);

export default newCommand;
