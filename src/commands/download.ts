import { Command } from 'commander';
import { promises as fs, createWriteStream } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import axios from 'axios';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';
import api from '../core/api.js';
import { ThemeManager } from '../core/theme.js';

interface DownloadOptions {
  theme?: string;
  version?: string;
  output?: string;
  force?: boolean;
}

async function resolveThemeId(options: DownloadOptions): Promise<string> {
  if (options.theme) return options.theme;
  const config = await new ThemeManager(process.cwd()).getConfig();
  if (config.id) return config.id;
  throw new Error(
    'No theme found. Run inside a linked theme directory or pass --theme <id>.'
  );
}

async function resolveVersion(
  themeId: string,
  options: DownloadOptions
): Promise<{ id: string; version: string }> {
  if (options.version) {
    const v = await api.getThemeVersion(themeId, options.version);
    return { id: v.id, version: v.version };
  }
  const list = await api.listThemeVersions(themeId, { page_size: 1 });
  const latest = list?.results?.[0];
  if (!latest) {
    throw new Error(`Theme ${themeId} has no versions to download.`);
  }
  return { id: latest.id, version: latest.version };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

const downloadCommand = new Command('download')
  .description('Download the artifact (.zip) for a theme version')
  .option('-t, --theme <id>', 'Theme ID (defaults to linked theme in cwd)')
  .option('-v, --version <id>', 'Version ID (defaults to latest version)')
  .option(
    '-o, --output <path>',
    'Output file path (default: ./<version-id>.zip)'
  )
  .option('-f, --force', 'Overwrite output file if it exists')
  .action(async (options: DownloadOptions) => {
    try {
      await auth.requireAuth();

      const themeId = await resolveThemeId(options);
      const version = await resolveVersion(themeId, options);

      const outputPath = options.output
        ? isAbsolute(options.output)
          ? options.output
          : resolve(process.cwd(), options.output)
        : join(process.cwd(), `${version.id}.zip`);

      if (!options.force && (await pathExists(outputPath))) {
        throw new Error(
          `File already exists: ${outputPath}. Use --force to overwrite.`
        );
      }

      logger.loading('Requesting download URL...');
      const { url } = await api.downloadThemeVersionArtifact(
        themeId,
        version.id
      );

      await fs.mkdir(dirname(outputPath), { recursive: true });

      logger.loading(`Downloading version ${version.version}...`);
      const response = await axios.get(url, {
        responseType: 'stream',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      await new Promise<void>((resolve, reject) => {
        const stream = response.data.pipe(createWriteStream(outputPath));
        stream.on('finish', () => resolve());
        stream.on('error', reject);
        response.data.on('error', reject);
      });

      const stat = await fs.stat(outputPath);
      logger.success(
        `✅ Saved ${(stat.size / 1024 / 1024).toFixed(2)} MB to ${outputPath}`
      );
    } catch (error) {
      logger.error('Download failed:', error as Error);
      process.exit(1);
    }
  });

downloadCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin download                              # latest version of linked theme
  $ vitrin download -v <version-id>              # specific version
  $ vitrin download -t <theme-id> -v <ver-id>    # specific theme + version
  $ vitrin download -o ./backups/theme.zip       # custom output path
  $ vitrin download --force                      # overwrite existing file
`
);

export default downloadCommand;
