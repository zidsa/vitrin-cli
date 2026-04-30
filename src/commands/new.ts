import { Command } from 'commander';
import logger from '../utils/logger.js';
import {
  createThemeFromTemplate,
  registerExistingTheme,
  TEMPLATE_REPO_URL,
} from '../utils/createTheme.js';

const newCommand = new Command('new')
  .description('Create a new theme (clone template or register existing dir)')
  .argument('<theme-name>', 'Name of the new theme (lowercase, hyphens)')
  .option('-d, --directory <dir>', 'Target directory for the new theme')
  .option(
    '-e, --from-existing <path>',
    'Use an existing local directory instead of cloning the template'
  )
  .option('--no-git', 'Skip git initialization (only when cloning template)')
  .action(async (themeName: string, options) => {
    try {
      if (options.fromExisting) {
        logger.info(`Registering existing theme: ${themeName}`);
        logger.info(`Source directory: ${options.fromExisting}`);

        const resolvedPath = await registerExistingTheme({
          themeName,
          existingPath: options.fromExisting,
          onProgress: msg => logger.loading(msg),
        });

        logger.success(`✅ Theme "${themeName}" registered at ${resolvedPath}`);
        logger.info(`Saved to local .vitrin/theme.json and global registry.`);
        logger.info(`\nNext steps:`);
        logger.info(`  cd ${resolvedPath}`);
        logger.info(`  vitrin push`);
        return;
      }

      const targetDir = options.directory || themeName;

      logger.info(`Creating new theme: ${themeName}`);
      logger.info(`Target directory: ${targetDir}`);
      logger.info(`Template will be cloned from: ${TEMPLATE_REPO_URL}`);

      const resolvedPath = await createThemeFromTemplate({
        themeName,
        targetDir,
        skipGit: !options.git,
        onProgress: msg => logger.loading(msg),
      });

      logger.success(`✅ Theme "${themeName}" created successfully!`);
      logger.info(`Path: ${resolvedPath}`);
      logger.info(`Saved to local .vitrin/theme.json and global registry.`);
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
  $ vitrin new my-theme                          Clone the default template
  $ vitrin new my-theme --directory ./themes/x   Clone into a specific directory
  $ vitrin new my-theme --no-git                 Clone without git initialization
  $ vitrin new my-theme --from-existing ./src    Register an existing directory

Notes:
  Cloning fetches the official template from:
    ${TEMPLATE_REPO_URL}
  An internet connection is required when using the default template.

  --from-existing skips the clone and writes a .vitrin/theme.json into the
  directory you specify so you can build/push it without restructuring.

  In both cases, the absolute path is recorded in ~/.vitrin/themes.json so the
  theme is tracked even before you push to Zid.
`
);

export default newCommand;
