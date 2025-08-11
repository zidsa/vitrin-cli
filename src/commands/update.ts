import { Command } from 'commander';
import { resolve, basename } from 'path';
import { promises as fs } from 'fs';
import logger from '../utils/logger.js';
import apiService from '../core/api.js';
import auth from '../core/auth.js';
import buildService from '../utils/build.js';
import type { ThemeUploadResponse } from '../types/index.js';

const updateCommand = new Command('update')
  .description('Update an existing theme with a new version')
  .argument('<theme-id>', 'ID of the theme to update')
  .argument('[theme-path]', 'Path to theme directory', '.')
  .option('-v, --version <version>', 'Version number (e.g., 1.0.1)')
  .option('-c, --changelog <notes>', 'Release notes describing changes')
  .option('-l, --changelog-ar <notes>', 'Release notes in Arabic')
  .option('-m, --minimum-api <version>', 'Minimum API version required', '1.0')
  .option('-n, --name <name>', 'Custom name for the theme build')
  .option('-b, --build', 'Build theme before updating')
  .option('--validate', 'Validate theme structure before updating')
  .option('--publish', 'Publish the version after upload (default: draft)')
  .action(async (themeId: string, themePath: string, options) => {
    try {
      await auth.requireAuth();

      if (!options.version) {
        logger.error('Version number is required. Use --version flag.');
        process.exit(1);
      }

      if (!options.changelog) {
        logger.error('Changelog is required. Use --changelog flag.');
        process.exit(1);
      }

      const resolvedPath = resolve(themePath);
      const themeName = options.name || basename(resolvedPath);

      logger.info(`Updating theme: ${themeId}`);
      logger.info(`New version: ${options.version}`);
      logger.info(`Theme path: ${resolvedPath}`);

      if (options.validate) {
        logger.loading('Validating theme structure...');
        const isValid = await buildService.validateThemeStructure(resolvedPath);
        if (!isValid) {
          logger.error('Theme validation failed');
          process.exit(1);
        }
        logger.success('Theme structure is valid');
      }

      let themeZipPath: string = '';

      if (options.build) {
        logger.loading('Building theme...');
        await buildService.removeDSStore(resolvedPath);
        themeZipPath = await buildService.zipTheme(themeName, resolvedPath);
        logger.success('Theme built successfully');
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
          } catch {}
        }

        if (!found) {
          logger.warn('No built theme found. Building automatically...');
          await buildService.removeDSStore(resolvedPath);
          themeZipPath = await buildService.zipTheme(themeName, resolvedPath);
        }
      }

      logger.loading('Creating new theme version...');
      let versionData: ThemeUploadResponse;
      try {
        const changelog: { en: string; ar?: string } = {
          en: options.changelog,
        };
        if (options.changelogAr) {
          changelog.ar = options.changelogAr;
        }

        const versionInfo = {
          version: options.version,
          minimum_api_version: options.minimumApi,
          changelog,
        };

        versionData = await apiService.createThemeVersion(themeId, versionInfo);
        logger.success(`Theme version ${options.version} created`);
      } catch (error) {
        logger.error('Failed to create theme version:', error as Error);
        process.exit(1);
      }

      logger.loading('Uploading theme...');
      try {
        await apiService.uploadThemeArtifact(
          versionData.upload_url,
          versionData.upload_fields,
          themeZipPath
        );
        logger.success('Theme uploaded successfully');
      } catch (error) {
        logger.error('Failed to upload theme:', error as Error);
        process.exit(1);
      }

      logger.loading('Finalizing upload...');
      try {
        await apiService.notifyArtifactUpload(
          themeId,
          versionData.theme_version.id,
          {
            key: versionData.key,
          }
        );
        logger.success('Upload finalized');
      } catch (error) {
        logger.error('Failed to finalize upload:', error as Error);
        process.exit(1);
      }

      if (options.publish) {
        logger.loading('Publishing theme version...');
        try {
          await apiService.updateThemeVersionStatus(
            themeId,
            versionData.theme_version.id,
            'published'
          );
          logger.success('Theme version published successfully!');
        } catch (error) {
          logger.error('Failed to publish theme version:', error as Error);
          logger.warn(
            'The version remains in draft status. You can publish it later.'
          );
        }
      } else {
        logger.info('Theme version created in draft status.');
        logger.info(
          'To publish this version, use the publish command or add --publish flag.'
        );
      }

      logger.success('\nTheme updated successfully!');
      logger.info(`Theme ID: ${themeId}`);
      logger.info(`Version: ${options.version}`);
      logger.info(`Version ID: ${versionData.theme_version.id}`);
      logger.info(`Status: ${options.publish ? 'Published' : 'Draft'}`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Authentication required')
      ) {
        logger.error('Authentication required. Please login first.');
        logger.info('Run "vitrin login" to authenticate.');
        process.exit(1);
      }
      logger.error('Update failed:', error as Error);
      process.exit(1);
    }
  });

updateCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin update abc123 --version 1.0.1 --changelog "Bug fixes"
  $ vitrin update abc123 ./theme --version 2.0.0 --changelog "Major update" --publish
  $ vitrin update abc123 --build --version 1.1.0 --changelog "New features"
  $ vitrin update abc123 --validate --version 1.0.2 --changelog "Security patch"
  $ vitrin update abc123 --version 1.0.1 --changelog "Bug fixes" --changelog-ar "إصلاحات الأخطاء"

Note:
  - Version should follow semantic versioning (e.g., 1.0.0, 1.0.1, 2.0.0)
  - Changelog is required to describe what changed in this version
  - By default, versions are created as drafts. Use --publish to make them live
  - If no built theme is found, it will be built automatically
`
);

export default updateCommand;
