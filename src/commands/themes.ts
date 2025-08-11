import { Command } from 'commander';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';
import apiService from '../core/api.js';
import inquirer from 'inquirer';

const themesCommand = new Command('themes')
  .description('Manage themes on Zid server')
  .addCommand(
    new Command('list')
      .description('List all themes from server')
      .option('-s, --search <term>', 'Search themes by name')
      .action(async options => {
        try {
          await auth.requireAuth();
          logger.loading('Fetching themes from server...');
          const themes = await apiService.getThemes({
            search: options.search,
            page_size: 100,
          });

          if (!themes.results || themes.results.length === 0) {
            logger.info('No themes found.');
            return;
          }

          logger.success(`\n📦 Found ${themes.count} theme(s):\n`);
          themes.results.forEach((theme: any) => {
            logger.info(`ID: ${theme.id}`);
            logger.info(`  Name: ${theme.name?.en || theme.name}`);
            logger.info(`  Slug: ${theme.slug}`);
            if (theme.description?.en) {
              logger.info(`  Description: ${theme.description.en}`);
            }
            logger.info(
              `  Created: ${new Date(theme.created_at).toLocaleString()}\n`
            );
          });
        } catch (error) {
          logger.error('Failed to list themes:', error as Error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('Delete a theme from server')
      .argument('<theme-id>', 'Theme ID to delete')
      .option('-f, --force', 'Skip confirmation')
      .action(async (themeId: string, options) => {
        try {
          await auth.requireAuth();

          if (!options.force) {
            const answer = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure you want to delete theme ${themeId}?`,
                default: false,
              },
            ]);

            if (!answer.confirm) {
              logger.info('Deletion cancelled');
              return;
            }
          }

          logger.loading('Deleting theme...');
          await apiService.deleteTheme(themeId);
          logger.success(`✅ Theme ${themeId} deleted successfully`);
        } catch (error) {
          logger.error('Failed to delete theme:', error as Error);
          process.exit(1);
        }
      })
  );

themesCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin themes list                    List all themes
  $ vitrin themes list --search "shop"    Search themes by name
  $ vitrin themes delete 123              Delete theme from server
  $ vitrin themes delete 123 --force      Delete without confirmation
`
);

export default themesCommand;
