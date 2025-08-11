import { Command } from 'commander';
import logger from '../utils/logger.js';
import apiService from '../core/api.js';
import auth from '../core/auth.js';

const installCommand = new Command('install')
  .description('Install a theme on a store')
  .argument('<store-id>', 'ID of the store')
  .argument('<theme-id>', 'ID of the theme to install')
  .argument('<version-id>', 'ID of the theme version to install')
  .action(async (storeId: string, themeId: string, versionId: string) => {
    try {
      await auth.requireAuth();

      logger.loading('Installing theme on store...');

      const installation = await apiService.installTheme(
        storeId,
        themeId,
        versionId
      );

      logger.success('✅ Theme installed successfully');
      logger.info(`Installation ID: ${installation.id}`);
      logger.info(
        `\n💡 To activate: vitrin activate ${storeId} ${installation.id}`
      );
    } catch (error: any) {
      if (error.response?.status === 400) {
        logger.error(
          'Failed to install theme. The theme may not exist or may still be processing.'
        );
        logger.info(
          'Please ensure the theme and version IDs are correct and try again later.'
        );
      } else {
        logger.error('Failed to install theme:', error as Error);
      }
      process.exit(1);
    }
  });

installCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin install 123 theme-id version-id   Install a specific theme version on store 123

Note:
  The theme must be uploaded and processed before it can be installed.
  Use 'vitrin list' to see available themes and their IDs.
`
);

export default installCommand;
