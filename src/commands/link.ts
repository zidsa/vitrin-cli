import { Command } from 'commander';
import { resolve } from 'path';
import logger from '../utils/logger.js';
import { ThemeManager } from '../core/theme.js';
import auth from '../core/auth.js';
import apiService from '../core/api.js';

const linkCommand = new Command('link')
  .description('Link or unlink current directory to a Zid theme')
  .argument('[theme-id]', 'Theme ID to link (leave empty to unlink)')
  .option('-p, --path <path>', 'Path to theme directory', '.')
  .option('-f, --force', 'Force link even if already linked to another theme')
  .option('-s, --show', 'Show current linked theme')
  .action(async (themeId: string | undefined, options) => {
    try {
      const resolvedPath = resolve(options.path);
      const themeManager = new ThemeManager(resolvedPath);
      const currentConfig = await themeManager.getConfig();

      if (options.show) {
        if (currentConfig.id) {
          logger.info(`📎 Currently linked to theme: ${currentConfig.id}`);
          if (currentConfig.slug) {
            logger.info(`   Slug: ${currentConfig.slug}`);
          }
          if (currentConfig.name) {
            logger.info(`   Name: ${currentConfig.name}`);
          }
        } else {
          logger.info('🔗 This directory is not linked to any theme');
        }
        return;
      }

      if (!themeId) {
        if (currentConfig.id) {
          await themeManager.updateThemeId('', '');
          logger.success(`✅ Unlinked from theme: ${currentConfig.id}`);
          logger.info('💡 This directory can now be linked to any theme');
        } else {
          logger.info('This directory is not linked to any theme');
        }
        return;
      }

      if (currentConfig.id && currentConfig.id !== themeId && !options.force) {
        logger.error(`❌ Already linked to theme: ${currentConfig.id}`);
        logger.info('Use --force to override or run without theme-id to unlink first');
        process.exit(1);
      }

      try {
        await auth.requireAuth();
        logger.loading('Verifying theme...');

        const themes = await apiService.getThemes({ page_size: 100 });
        const theme = themes.results?.find((t: any) => t.id === themeId);

        if (!theme) {
          logger.error(`❌ Theme with ID "${themeId}" not found`);
          logger.info('Make sure the theme ID is correct and you have access to it');
          process.exit(1);
        }

        const themeName = typeof theme.name === 'object' ? theme.name.en : theme.name;
        await themeManager.updateThemeId(themeId, theme.slug);

        if (currentConfig.id && currentConfig.id !== themeId) {
          logger.success(`✅ Switched from theme ${currentConfig.id} to ${themeId}`);
        } else {
          logger.success(`✅ Linked to theme: ${themeId}`);
        }

        logger.info(`📦 Theme: ${themeName}`);
        logger.info(`🔗 Slug: ${theme.slug}`);
        logger.info('\n💡 You can now use push/preview commands with this theme');

      } catch (error: any) {
        if (error.message?.includes('Authentication required')) {
          logger.warn('⚠️  Linking without verification (not authenticated)');
          await themeManager.updateThemeId(themeId);
          logger.success(`✅ Linked to theme: ${themeId}`);
          logger.info('💡 Theme will be verified when you push or preview');
        } else {
          throw error;
        }
      }

    } catch (error) {
      logger.error('Link operation failed:', error as Error);
      process.exit(1);
    }
  });

linkCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin link                     Show current linked theme
  $ vitrin link --show              Show current linked theme
  $ vitrin link theme-123           Link to theme with ID "theme-123"
  $ vitrin link theme-456 --force   Force link to new theme
  $ vitrin link                     Unlink from current theme

Use Cases:
  - Work with same codebase for multiple themes
  - Switch between development and production themes
  - Share codebase across different stores

Note: Theme linking is stored in .vitrin/theme.json
`
);

export default linkCommand;