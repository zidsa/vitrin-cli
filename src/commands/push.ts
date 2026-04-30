import { Command } from 'commander';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import FormData from 'form-data';
import inquirer from 'inquirer';
import { ThemeManager } from '../core/theme.js';
import api from '../core/api.js';
import auth from '../core/auth.js';
import logger from '../utils/logger.js';
import buildService from '../utils/build.js';
import {
  findDiscouragedTemplates,
  removeDiscouragedTemplates,
} from '../utils/themeValidation.js';
import {
  bumpSemVer,
  formatSemVer,
  isValidSemVer,
  parseSemVer,
  type BumpKind,
} from '../utils/version.js';
import type { Theme, ThemeVersion } from '../types/index.js';

interface PushOptions {
  store?: string;
  activate?: boolean;
  version?: string;
  changelog?: string;
  changelogAr?: string;
  newVersion?: boolean;
  bump?: string;
}

async function readThemeConfig(themePath: string): Promise<any> {
  const themeJsonPath = join(themePath, 'theme.json');
  const packageJsonPath = join(themePath, 'package.json');

  if (existsSync(themeJsonPath)) {
    const content = await fs.readFile(themeJsonPath, 'utf8');
    return JSON.parse(content);
  }

  if (existsSync(packageJsonPath)) {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content);
    return {
      name: { en: pkg.name || 'Theme', ar: pkg.name || 'Theme' },
      description: {
        en: pkg.description || 'Theme',
        ar: pkg.description || 'Theme',
      },
      version: pkg.version || '1.0.0',
      slug:
        pkg.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
        `theme-${Date.now()}`,
      changelog: { en: 'Theme update', ar: 'Theme update' },
    };
  }

  return {
    name: { en: 'Theme', ar: 'Theme' },
    description: { en: 'Theme', ar: 'Theme' },
    version: '1.0.0',
    slug: `theme-${Date.now()}`,
    changelog: { en: 'Initial release', ar: 'Initial release' },
  };
}

async function pushTheme(options: PushOptions): Promise<void> {
  const spinner = {
    start: (msg: string) => {
      console.log(msg);
    },
    succeed: (msg: string) => {
      console.log('✅', msg);
    },
    fail: (msg: string) => {
      console.log('❌', msg);
    },
    warn: (msg: string) => {
      console.log('⚠️', msg);
    },
  };

  try {
    const token = await auth.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please run "vitrin login" first.');
    }

    const themePath = process.cwd();

    spinner.start('Validating theme directory...');
    const validation =
      await buildService.validateThemeStructureDetailed(themePath);
    if (!validation.valid) {
      spinner.fail(
        `Missing ${validation.missing.join(', ')} in ${validation.resolvedPath}`
      );
      throw new Error(
        `Refusing to push: ${validation.resolvedPath} is missing required ` +
          `theme files (${validation.missing.join(', ')}). cd into the ` +
          `actual theme folder and try again.`
      );
    }
    spinner.succeed('Theme directory looks valid');

    const discouraged = await findDiscouragedTemplates(themePath);
    if (discouraged.length > 0) {
      spinner.warn(
        'Discouraged templates found — Zid manages these with platform defaults:'
      );
      for (const template of discouraged) {
        console.log(`   • ${template}`);
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
            { name: 'Cancel push', value: 'cancel' },
          ],
        },
      ]);

      if (action === 'cancel') {
        logger.info('Push cancelled.');
        return;
      }
      if (action === 'remove') {
        await removeDiscouragedTemplates(themePath, discouraged);
        spinner.succeed('Removed discouraged templates');
      }
    }

    spinner.start('Compiling theme assets...');
    const assetResult = await buildService.runAssetBuild(themePath, line =>
      console.log(`  ${line}`)
    );
    if (!assetResult.ran) {
      spinner.warn(`Asset build skipped: ${assetResult.reason}`);
    } else {
      spinner.succeed(`Assets built with ${assetResult.installer}`);
    }

    const themeManager = new ThemeManager(themePath);
    const themeConfig = await themeManager.getConfig();

    spinner.start('Reading theme configuration...');
    const themeJson = await readThemeConfig(themePath);
    spinner.succeed('Theme configuration loaded');

    spinner.start('Building theme package...');
    const distDir = join(themePath, '.vitrin', 'dist');
    await fs.mkdir(distDir, { recursive: true });
    const packagePath = join(distDir, 'theme.zip');

    const archiver = (await import('archiver')).default;
    const { createWriteStream } = await import('fs');
    const output = createWriteStream(packagePath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      archive.glob('**/*', {
        cwd: themePath,
        ignore: ['*.git*', '**/node_modules/**', '**/.vitrin/**', '*.zip'],
      });

      archive.finalize();
    });

    spinner.succeed('Theme package built successfully');

    let theme: Theme | undefined;
    let isNewTheme = false;

    if (themeConfig.id) {
      spinner.start('Fetching existing theme from server...');
      try {
        theme = await api.getTheme(themeConfig.id);
        spinner.succeed(`Found existing theme: ${theme!.name.en}`);
      } catch (error) {
        spinner.warn('Theme not found on server, will create new theme');
        isNewTheme = true;
      }
    } else {
      isNewTheme = true;
    }

    if (isNewTheme) {
      spinner.start('Creating new theme on Zid server...');
      theme = await api.createTheme({
        name: themeJson.name || { en: 'New Theme', ar: 'موضوع جديد' },
        description: themeJson.description || {
          en: 'A new theme',
          ar: 'موضوع جديد',
        },
        slug: themeJson.slug || `theme-${Date.now()}`,
      });
      await themeManager.updateThemeId(theme!.id, theme!.slug);
      spinner.succeed(`Created new theme: ${theme!.name.en}`);
    }

    if (!theme) {
      throw new Error('Theme not found or created');
    }

    spinner.start('Resolving target version...');
    let version: string;

    if (options.version) {
      if (!isValidSemVer(options.version)) {
        throw new Error(
          `--version must be X.Y.Z (got "${options.version}")`
        );
      }
      version = options.version;
    } else if (options.bump) {
      if (!options.newVersion) {
        throw new Error('--bump requires --new-version');
      }
      const allowed: BumpKind[] = ['patch', 'minor', 'major'];
      if (!allowed.includes(options.bump as BumpKind)) {
        throw new Error(
          `--bump must be one of ${allowed.join(', ')} (got "${options.bump}")`
        );
      }
      const versionsList = await api.listThemeVersions(theme.id, {
        page_size: 1,
      });
      const latest = versionsList?.results?.[0]?.version;
      const base = parseSemVer(latest) ?? { major: 1, minor: 0, patch: 0 };
      version = formatSemVer(bumpSemVer(base, options.bump as BumpKind));
      spinner.succeed(`Bumping ${options.bump}: ${latest ?? '(none)'} → ${version}`);
      spinner.start('Creating theme version...');
    } else {
      version = themeJson.version || '1.0.0';
      if (!isValidSemVer(version)) {
        version = '1.0.0';
      }
    }

    const fallbackChangelog =
      themeJson.changelog && typeof themeJson.changelog === 'object'
        ? themeJson.changelog
        : { en: 'Updated theme' };

    const changelog: { en: string; ar?: string } = {
      en:
        options.changelog ||
        (typeof themeJson.changelog === 'string'
          ? themeJson.changelog
          : fallbackChangelog.en) ||
        'Updated theme',
    };
    if (options.changelogAr) {
      changelog.ar = options.changelogAr;
    } else if (
      typeof themeJson.changelog === 'object' &&
      themeJson.changelog?.ar
    ) {
      changelog.ar = themeJson.changelog.ar;
    }

    const versionResponse = await api.createThemeVersion(theme.id, {
      version,
      changelog,
      keep_using_latest: !options.newVersion,
    });

    const versionData = versionResponse.theme_version || versionResponse;
    const uploadData = {
      upload_url: versionResponse.upload_url,
      upload_fields: versionResponse.upload_fields,
      key: versionResponse.key,
      max_size_mb: versionResponse.max_size_mb,
    };

    spinner.succeed(`Created version ${versionData.version}`);

    spinner.start('Uploading theme package to S3...');
    const fileBuffer = await fs.readFile(packagePath);
    const form = new FormData();

    if (uploadData.upload_fields.key) {
      form.append('key', uploadData.upload_fields.key);
    }
    if (uploadData.upload_fields.AWSAccessKeyId) {
      form.append('AWSAccessKeyId', uploadData.upload_fields.AWSAccessKeyId);
    }
    if (uploadData.upload_fields.policy) {
      form.append('policy', uploadData.upload_fields.policy);
    }
    if (uploadData.upload_fields.signature) {
      form.append('signature', uploadData.upload_fields.signature);
    }

    form.append('Content-Type', 'application/zip');

    form.append('file', fileBuffer, {
      filename: 'theme.zip',
      contentType: 'application/zip',
    });

    const axios = (await import('axios')).default;
    const s3Response = await axios.post(uploadData.upload_url, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (s3Response.status >= 400) {
      throw new Error(`Failed to upload to S3: ${s3Response.status}`);
    }

    spinner.start('Finalizing...');
    try {
      await api.notifyArtifactUpload(
        theme.id,
        versionData.id,
        {
          key: uploadData.upload_fields.key,
        }
      );
      spinner.succeed('✅ Upload complete');

    } catch (error) {
      throw new Error('Failed to finalize:', error as Error);
    }

    spinner.succeed('Theme package uploaded successfully');

    await themeManager.recordPush({
      themeId: theme.id,
      versionId: versionData.id,
      version: versionData.version,
      pushedAt: new Date().toISOString(),
      ...(options.store && { store: options.store }),
    });

    if (options.store) {
      spinner.start(`Installing theme on store ${options.store}...`);
      const storesResponse = await api.getDevStores();
      const targetStore = storesResponse.stores.find(
        s => s.store_id === options.store
      );

      if (!targetStore) {
        throw new Error(`Store with ID ${options.store} not found`);
      }

      const installation = await api.installTheme(
        options.store,
        theme.id,
        versionData.id
      );
      spinner.succeed(`Theme installed on store ${options.store}`);

      if (options.activate) {
        spinner.start('Activating theme...');
        try {
          await api.activateTheme(options.store, installation.id);
          spinner.succeed('Theme activated successfully');
        } catch (error) {
          spinner.warn('Failed to activate theme');
        }
      }
    }

    console.log(chalk.green('\n✅ Theme pushed successfully!'));
    console.log(chalk.dim(`Theme ID: ${theme.id}`));
    console.log(chalk.dim(`Version: ${versionData.version}`));
  } catch (error) {
    spinner.fail('Push failed');
    logger.error('Push error:', error as Error);
    throw error;
  }
}

const pushCommand = new Command('push')
  .description('Build and push theme to Zid server')
  .option('-s, --store <id>', 'Dev store ID to install on')
  .option('-a, --activate', 'Activate theme after installation')
  .option(
    '-v, --version <version>',
    'Version number (default: from theme.json)'
  )
  .option('-c, --changelog <text>', 'Version changelog (English)')
  .option('--changelog-ar <text>', 'Version changelog (Arabic)')
  .option(
    '-n, --new-version',
    'Create a new theme version instead of updating the latest one. Use when assets paths have changed and cached assets in users\' browsers would break compatibility. Omit for quick template patches and bugfixes that should ship in-place on the existing version.'
  )
  .option(
    '-b, --bump <kind>',
    'When used with --new-version, auto-bump the latest server version: patch, minor, or major (overrides --version unless --version is also given)'
  )
  .action(async (options: PushOptions) => {
    try {
      await pushTheme(options);
    } catch (error) {
      logger.error('Push failed:', error as Error);
      process.exit(1);
    }
  });

pushCommand.addHelpText(
  'after',
  `
When to use --new-version:
  Pick a strategy based on whether your change can break clients that have
  already cached assets from a previous push.

  Update the latest version (default, no flag):
    Safe for changes that don't alter asset URLs or break backward compatibility.
    - Quick template patches (.jinja text/markup tweaks)
    - Bugfixes in templates or translations
    - Copy / translation updates
    Stores already on the latest version pick up the changes immediately.

  Create a new version (--new-version):
    Required when published assets change in a way that could break users
    whose browsers still have old assets cached against new templates.
    - Asset files renamed, removed, or restructured (assets/ paths changed)
    - CSS/JS bundle re-hashing or build-output changes
    - Breaking changes to template contracts that depend on new assets
    Existing installs stay on the older version until they explicitly update,
    so cached-asset clients keep matching templates.

Examples:
  $ vitrin push                            # in-place patch on latest version
  $ vitrin push --new-version              # cut a fresh version (asset changes)
  $ vitrin push --store 123 --activate     # push and activate on a dev store
`
);

export default pushCommand;
