import { Command } from 'commander';
import logger from '../utils/logger.js';
import apiService from '../core/api.js';
import auth from '../core/auth.js';

const listCommand = new Command('list')
  .description('List your themes and dev stores')
  .option('-t, --themes', 'List themes only')
  .option('-s, --stores', 'List dev stores only')
  .option('--json', 'Output as JSON')
  .action(async options => {
    try {
      await auth.requireAuth();

      const showThemes = options.themes || (!options.stores && !options.themes);
      const showStores = options.stores || (!options.stores && !options.themes);

      if (showThemes) {
        logger.loading('Fetching themes...');
        try {
          const themesResponse = await apiService.getThemes();

          if (options.json) {
            console.log(JSON.stringify(themesResponse, null, 2));
          } else {
            logger.success(`Found ${themesResponse.count} themes:`);
            console.log('');

            if (themesResponse.results.length === 0) {
              logger.info(
                'No themes found. Create a new theme with "vitrin new <theme-name>"'
              );
            } else {
              console.log(
                'ID'.padEnd(38) +
                  'Name'.padEnd(30) +
                  'Slug'.padEnd(20) +
                  'Created'
              );
              console.log('-'.repeat(100));

              for (const theme of themesResponse.results) {
                const name =
                  theme.name?.en || theme.name?.ar || theme.name || 'Unnamed';
                const createdDate = theme.created_at
                  ? new Date(theme.created_at).toLocaleDateString()
                  : 'N/A';
                const id = (theme.id || '').toString();
                const slug = (theme.slug || '').toString();
                console.log(
                  id.padEnd(38) +
                    name.toString().padEnd(30) +
                    slug.padEnd(20) +
                    createdDate
                );
              }
            }
          }
        } catch (error) {
          logger.error('Failed to fetch themes:', error as Error);
          process.exit(1);
        }
      }

      if (showStores && showThemes) {
        console.log('\n' + '='.repeat(60) + '\n');
      }

      if (showStores) {
        logger.loading('Fetching dev stores...');
        try {
          const storesResponse = await apiService.getDevStores();

          if (options.json) {
            console.log(JSON.stringify(storesResponse, null, 2));
          } else {
            logger.success(`Found ${storesResponse.stores.length} dev stores:`);
            console.log('');

            if (storesResponse.stores.length === 0) {
              logger.info(
                'No dev stores found. Create one in the Partner Dashboard.'
              );
            } else {
              console.log(
                'ID'.padEnd(12) +
                  'Name'.padEnd(25) +
                  'Email'.padEnd(30) +
                  'Domain'
              );
              console.log('-'.repeat(80));

              for (const store of storesResponse.stores) {
                const id = (store.store_id || '').toString();
                const name = (store.name || '').toString();
                const email = (store.email || '').toString();
                const domain = (store.domain || '').toString();
                console.log(
                  id.padEnd(12) + name.padEnd(25) + email.padEnd(30) + domain
                );
              }
            }
          }
        } catch (error: any) {
          if (error?.response?.status === 404) {
            if (options.stores) {
              logger.warn('Dev stores feature is not available.');
              logger.info('Please check with your partner account settings.');
            }
          } else {
            logger.error('Failed to fetch dev stores:', error as Error);
          }
          if (!showThemes) {
            process.exit(1);
          }
        }
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
      logger.error('Command failed:', error as Error);
      process.exit(1);
    }
  });

listCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin list                     List themes (and dev stores if available)
  $ vitrin list --themes           List themes only
  $ vitrin list --stores           List dev stores only
  $ vitrin list --json             Output as JSON format
`
);

export default listCommand;
