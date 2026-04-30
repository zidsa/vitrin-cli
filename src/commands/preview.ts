import { Command } from 'commander';
import { resolve, basename } from 'path';
import { promises as fs } from 'fs';
import open from 'open';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import apiService from '../core/api.js';
import auth from '../core/auth.js';
import buildService from '../utils/build.js';
import {
  appendValidatePath,
  findDiscouragedTemplates,
  removeDiscouragedTemplates,
} from '../utils/themeValidation.js';
import { ThemeManager } from '../core/theme.js';

const previewCommand = new Command('preview')
  .description('Preview theme on a dev store')
  .argument('[store-id]', 'ID of the dev store (uses default if set)')
  .argument('[theme-path]', 'Path to theme directory', '.')
  .option('-t, --theme-id <id>', 'ID of existing theme (skip creation)')
  .option('-n, --name <name>', 'Custom name for the theme')
  .option('-d, --description <desc>', 'Theme description')
  .option('-s, --slug <slug>', 'Theme slug (URL-friendly name)')
  .option('-v, --version <version>', 'Theme version', '1.0.0')
  .option('-b, --build', 'Build theme before previewing')
  .option('--validate', 'Validate theme structure before previewing')
  .option('--new-theme', 'Force creation of a new theme (ignore cached)')
  .action(async (storeId: string | undefined, themePath: string, options) => {
    let themeZipPath: string = '';
    let shouldCleanup = false;

    try {
      await auth.requireAuth();

      const themeManager = new ThemeManager(themePath);
      const themeConfig = await themeManager.getConfig();

      if (!storeId && themeConfig?.defaultStore) {
        storeId = themeConfig.defaultStore;
        logger.info(`📱 Using default dev store: ${themeConfig.defaultStore}`);
      }

      if (!storeId) {
        logger.error('No store ID provided and no default store set.');
        logger.info('Provide a store ID or use vitrin push --store <id>');
        process.exit(1);
      }

      const resolvedPath = resolve(themePath);
      const themeName = options.name || basename(resolvedPath);
      const themeSlug =
        options.slug || themeName.toLowerCase().replace(/\s+/g, '-');

      logger.info(`📦 Preparing theme preview for store ${storeId}`);

      if (options.validate) {
        logger.loading('Validating theme structure...');
        const isValid = await buildService.validateThemeStructure(resolvedPath);
        if (!isValid) {
          logger.error('❌ Theme validation failed');
          process.exit(1);
        }
        logger.success('✅ Theme structure is valid');
      }

      const discouraged = await findDiscouragedTemplates(resolvedPath);
      if (discouraged.length > 0) {
        logger.warn(
          '⚠️  These templates are discouraged in themes — Zid manages them ' +
            'with platform defaults:'
        );
        for (const template of discouraged) {
          logger.warn(`   • ${template}`);
        }

        const { action } = await inquirer.prompt<{
          action: 'upload' | 'remove' | 'cancel';
        }>([
          {
            type: 'list',
            name: 'action',
            message: 'How do you want to proceed?',
            choices: [
              { name: 'Upload them anyway', value: 'upload' },
              {
                name: 'Remove them locally and use platform defaults',
                value: 'remove',
              },
              { name: 'Cancel preview', value: 'cancel' },
            ],
          },
        ]);

        if (action === 'cancel') {
          logger.info('Preview cancelled.');
          process.exit(0);
        }
        if (action === 'remove') {
          await removeDiscouragedTemplates(resolvedPath, discouraged);
          logger.success('✅ Removed discouraged templates');
        }
      }

      if (options.build) {
        logger.loading('Building theme...');
        await buildService.removeDSStore(resolvedPath);
        themeZipPath = await buildService.zipTheme(themeName, resolvedPath, {
          useTemp: true,
        });
        shouldCleanup = true;
        logger.success('✅ Theme built successfully');
      } else {
        const possiblePaths = [
          resolve(process.cwd(), `${themeName}.zip`),
          resolve(resolvedPath, `${themeName}.zip`),
          resolve(resolvedPath, 'dist', `${themeName}.zip`),
        ];

        let found = false;
        for (const path of possiblePaths) {
          try {
            await fs.access(path);
            themeZipPath = path;
            found = true;
            break;
          } catch {
            continue;
          }
        }

        if (!found) {
          logger.info('Building theme package...');
          await buildService.removeDSStore(resolvedPath);
          themeZipPath = await buildService.zipTheme(themeName, resolvedPath, {
            useTemp: true,
          });
          shouldCleanup = true;
        }
      }

      let themeId = options.themeId;

      if (!themeId) {
        if (themeConfig?.id && !options.newTheme) {
          themeId = themeConfig.id;
          logger.info(`📦 Using linked theme: ${themeId}`);
        } else {
          logger.loading('Creating new theme...');
          const createData = {
            name: { en: themeName, ar: themeName },
            description: {
              en: options.description || 'Preview theme',
              ar: options.description || 'Preview theme',
            },
            slug: themeSlug,
          };
          const theme = await apiService.createTheme(createData);
          themeId = theme.id;
          await themeManager.updateThemeId(themeId, theme.slug);
          logger.success(`✅ Theme created: ${themeId}`);
        }
      } else {
        logger.info(`📦 Using specified theme: ${themeId}`);
      }

      logger.loading('Creating version...');
      let versionData;
      try {
        const versionInfo = {
          version: options.version,
          changelog: { en: 'Preview version' },
        };

        versionData = await apiService.createThemeVersion(themeId, versionInfo);
        logger.success(`✅ Version ${options.version} created`);
      } catch (error) {
        logger.error('Failed to create version:', error as Error);
        process.exit(1);
      }

      logger.loading('Uploading theme package...');
      try {
        await apiService.uploadThemeArtifact(
          versionData.upload_url,
          versionData.upload_fields,
          themeZipPath
        );
      } catch (error) {
        logger.error('Upload failed:', error as Error);
        process.exit(1);
      }

      logger.loading('Finalizing...');
      try {
        await apiService.notifyArtifactUpload(
          themeId,
          versionData.theme_version.id,
          {
            key: versionData.key,
          }
        );
        logger.success('✅ Upload complete');

        if (shouldCleanup && themeZipPath) {
          await buildService.cleanupZipFile(themeZipPath);
        }
      } catch (error) {
        if (shouldCleanup && themeZipPath) {
          await buildService.cleanupZipFile(themeZipPath);
        }
        logger.error('Failed to finalize:', error as Error);
        process.exit(1);
      }

      logger.loading('Installing on store...');
      try {
        const installation = await apiService.installTheme(
          storeId,
          themeId,
          versionData.theme_version.id
        );

        const draftedSettings =
          await buildService.getDraftedSettings(themePath);
        if (draftedSettings) {
          await apiService.setDraftSettings(
            storeId,
            installation.id,
            draftedSettings
          );
          logger.info(`Drafted settings uploaded`);
        }

        logger.success('\n🎉 Theme ready for preview!');
        logger.info(`\nTheme ID: ${themeId}`);
        logger.info(`Version: ${versionData.theme_version.id}`);
        logger.info(`Installation: ${installation.id}`);

        try {
          const previewResponse = await apiService.getPreviewUrl(
            storeId,
            installation.id || null
          );
          const previewUrl = previewResponse.url.startsWith('http')
            ? previewResponse.url
            : `https://${previewResponse.url}`;
          const validateUrl = appendValidatePath(previewUrl);
          logger.info(`\n🌐 Preview URL: ${previewUrl}`);
          logger.info(`🔍 Theme validation report: ${validateUrl}`);
          logger.info('🌐 Opening preview in browser...');

          await open(previewUrl);
        } catch (previewErr) {
          logger.debug('Could not get preview URL or open browser');
        }

        logger.info(
          `\n💡 To activate: vitrin activate ${storeId} ${installation.id}`
        );
      } catch (error: any) {
        if (error.response?.data?.theme_id) {
          logger.info('\n✅ Theme uploaded successfully!');
          logger.info(`\nTheme ID: ${themeId}`);
          logger.info(`Version: ${versionData.theme_version.id}`);
          logger.info('\n⏳ Theme is being processed. Try installing later:');
          logger.info(
            `   vitrin install ${storeId} ${themeId} ${versionData.theme_version.id}`
          );
        } else {
          logger.error('Installation failed:', error as Error);
          process.exit(1);
        }
      }
    } catch (error) {
      if (shouldCleanup && themeZipPath) {
        await buildService.cleanupZipFile(themeZipPath);
      }
      if (
        error instanceof Error &&
        error.message.includes('Authentication required')
      ) {
        logger.error('Authentication required. Please login first.');
        logger.info('Run "vitrin login" to authenticate.');
        process.exit(1);
      }
      logger.error('Preview failed:', error as Error);
      process.exit(1);
    }
  });

previewCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin preview 123                    Preview current theme
  $ vitrin preview 123 ./my-theme         Preview specific theme
  $ vitrin preview 123 --build            Force rebuild before preview
  $ vitrin preview 123 --validate         Validate theme structure
  $ vitrin preview 123 --new-theme        Force create new theme

Options:
  --theme-id <id>   Use existing theme instead of creating new
  --new-theme       Force creation of new theme (ignore cached)
  --version <ver>   Set theme version (default: 1.0.0)
  --name <name>     Custom theme name

Note: Theme IDs are cached per directory to avoid recreating themes.
`
);

export default previewCommand;
