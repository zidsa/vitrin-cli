import { Command } from 'commander';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import FormData from 'form-data';
import { ThemeManager } from '../core/theme.js';
import api from '../core/api.js';
import auth from '../core/auth.js';
import logger from '../utils/logger.js';
import type { Theme, ThemeVersion } from '../types/index.js';

interface PushOptions {
  store?: string;
  activate?: boolean;
  version?: string;
  changelog?: string;
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
      minimum_api_version: '1.0.0',
      changelog: { en: 'Theme update', ar: 'Theme update' },
    };
  }

  return {
    name: { en: 'Theme', ar: 'Theme' },
    description: { en: 'Theme', ar: 'Theme' },
    version: '1.0.0',
    slug: `theme-${Date.now()}`,
    minimum_api_version: '1.0.0',
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
      zlib: { level: 9 }
    });

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      
      archive.pipe(output);
      
      archive.glob('**/*', {
        cwd: themePath,
        ignore: [
          '*.git*',
          '**/node_modules/**',
          '**/.vitrin/**',
          '*.zip'
        ]
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

    spinner.start('Creating theme version...');
    let version = options.version || themeJson.version || '1.0.0';
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      version = `${version}.0.0`
        .replace(/[^\d.]/g, '')
        .split('.')
        .slice(0, 3)
        .join('.');
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        version = '1.0.0';
      }
    }
    const changelog = options.changelog ||
      themeJson.changelog || {
        en: 'Initial release',
        ar: 'الإصدار الأولي',
      };

    const versionResponse = await api.createThemeVersion(theme.id, {
      version,
      minimum_api_version: themeJson.minimum_api_version || '1.0.0',
      changelog:
        typeof changelog === 'string'
          ? { en: changelog, ar: changelog }
          : changelog,
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
        s => s.email === options.store
      );

      if (!targetStore) {
        throw new Error(`Store with email ${options.store} not found`);
      }

      const installation = await api.installTheme(
        String(targetStore.id),
        theme.id,
        versionData.id
      );
      spinner.succeed(`Theme installed on store ${options.store}`);

      if (options.activate) {
        spinner.start('Activating theme...');
        try {
          await api.activateTheme(String(targetStore.id), installation.id);
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
  .option('-s, --store <email>', 'Dev store email to install on')
  .option('-a, --activate', 'Activate theme after installation')
  .option(
    '-v, --version <version>',
    'Version number (default: from theme.json)'
  )
  .option('-c, --changelog <text>', 'Version changelog')
  .action(async (options: PushOptions) => {
    try {
      await pushTheme(options);
    } catch (error) {
      logger.error('Push failed:', error as Error);
      process.exit(1);
    }
  });

export default pushCommand;
