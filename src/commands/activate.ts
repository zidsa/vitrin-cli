import { Command } from 'commander';
import logger from '../utils/logger.js';
import apiService from '../core/api.js';
import auth from '../core/auth.js';

const activateCommand = new Command('activate')
  .description('Activate a theme installation on a store')
  .argument('<store-id>', 'ID of the store')
  .argument('<installation-id>', 'ID of the theme installation')
  .action(async (storeId: string, installationId: string) => {
    try {
      await auth.requireAuth();

      logger.loading(
        `Activating theme ${installationId} on store ${storeId}...`
      );
      try {
        await apiService.activateTheme(storeId, installationId);
        logger.success('✅ Theme activated successfully!');
        logger.info('Your theme is now live on the store.');
      } catch (error) {
        logger.error('Failed to activate theme:', error as Error);
        process.exit(1);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Authentication required')
      ) {
        logger.error('Authentication required. Please login first.');
        logger.info('Run "vitrin login" to authenticate.');
        process.exit(1);
      }
      logger.error('Activation failed:', error as Error);
      process.exit(1);
    }
  });

activateCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin activate 123 abc-def-ghi    Activate theme installation on store

Note:
  - Store ID is the ID of your development or production store
  - Installation ID is returned when you preview or install a theme
  - Only one theme can be active at a time per store
`
);

export default activateCommand;
