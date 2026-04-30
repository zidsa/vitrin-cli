import { createWriteStream, promises as fs, existsSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import archiver from 'archiver';
import logger from './logger.js';
import type { BuildOptions } from '../types/index.js';

export type AssetBuildProgress = (line: string) => void;

export interface AssetBuildResult {
  ran: boolean;
  reason?: string;
  installer?: 'pnpm' | 'yarn' | 'npm';
  buildScript?: string;
}

export class BuildService {
  private static instance: BuildService;

  private constructor() {}

  static getInstance(): BuildService {
    if (!BuildService.instance) {
      BuildService.instance = new BuildService();
    }
    return BuildService.instance;
  }

  async zipTheme(
    buildName: string,
    buildPath: string,
    options: BuildOptions = {}
  ): Promise<string> {
    const resolvedPath = resolve(buildPath);
    const outputDir =
      options.output || (options.useTemp !== false ? tmpdir() : process.cwd());
    const outputPath = join(outputDir, `${buildName}-${Date.now()}.zip`);

    await fs.mkdir(dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: options.compression || 9 },
      });

      output.on('close', () => {
        logger.success(`Theme built successfully: ${outputPath}`);
        logger.info(
          `Archive size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`
        );
        resolve(outputPath);
      });

      archive.on('error', err => {
        logger.error('Build failed', err);
        reject(err);
      });

      archive.pipe(output);

      const defaultExcludes = [
        'node_modules/**',
        '.git/**',
        '.DS_Store',
        'Thumbs.db',
        '*.log',
        '*.tmp',
        'dist/**',
        'build/**',
        '.env*',
        '*.zip',
      ];

      const excludes = [...defaultExcludes, ...(options.exclude || [])];

      archive.glob('**/*', {
        cwd: resolvedPath,
        ignore: excludes,
        dot: false,
      });

      archive.finalize();
    });
  }

  private detectInstaller(themePath: string): 'pnpm' | 'yarn' | 'npm' {
    if (existsSync(join(themePath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(themePath, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }

  private runChildProcess(
    cmd: string,
    args: string[],
    cwd: string,
    onProgress?: AssetBuildProgress
  ): Promise<void> {
    return new Promise((resolveP, rejectP) => {
      const child = spawn(cmd, args, {
        cwd,
        shell: process.platform === 'win32',
        env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
      });

      const onLine = (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim() && onProgress) onProgress(line);
        }
      };

      child.stdout?.on('data', onLine);
      child.stderr?.on('data', onLine);

      child.on('error', err => rejectP(err));
      child.on('close', code => {
        if (code === 0) resolveP();
        else rejectP(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      });
    });
  }

  async runAssetBuild(
    themePath: string,
    onProgress?: AssetBuildProgress
  ): Promise<AssetBuildResult> {
    const resolvedPath = resolve(themePath || process.cwd());
    const packageJsonPath = join(resolvedPath, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return { ran: false, reason: 'no package.json' };
    }

    let pkg: any;
    try {
      pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    } catch (err) {
      return { ran: false, reason: 'invalid package.json' };
    }

    const buildScript: string | undefined = pkg.scripts?.build;
    if (!buildScript) {
      return { ran: false, reason: 'no build script in package.json' };
    }

    const installer = this.detectInstaller(resolvedPath);
    const nodeModulesPath = join(resolvedPath, 'node_modules');

    if (!existsSync(nodeModulesPath)) {
      onProgress?.(`Installing dependencies with ${installer}...`);
      await this.runChildProcess(installer, ['install'], resolvedPath, onProgress);
    } else {
      onProgress?.('Dependencies already installed');
    }

    onProgress?.(`Running "${installer} run build"...`);
    await this.runChildProcess(installer, ['run', 'build'], resolvedPath, onProgress);
    onProgress?.('Asset build complete');

    return { ran: true, installer, buildScript };
  }

  async validateThemeStructure(themePath: string): Promise<boolean> {
    const result = await this.validateThemeStructureDetailed(themePath);
    return result.valid;
  }

  async validateThemeStructureDetailed(
    themePath: string
  ): Promise<{ valid: boolean; resolvedPath: string; missing: string[] }> {
    const resolvedPath = resolve(themePath || process.cwd());

    try {
      await fs.access(resolvedPath);
    } catch {
      logger.error(`Theme path does not exist: ${resolvedPath}`);
      return { valid: false, resolvedPath, missing: ['<directory>'] };
    }

    const requiredFiles = ['layout.jinja'];
    const missing: string[] = [];

    for (const file of requiredFiles) {
      try {
        await fs.access(join(resolvedPath, file));
      } catch {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      logger.error(
        `Missing required files in ${resolvedPath}: ${missing.join(', ')}`
      );
      return { valid: false, resolvedPath, missing };
    }

    return { valid: true, resolvedPath, missing: [] };
  }

  async removeDSStore(dirPath: string): Promise<void> {
    const resolvedPath = resolve(dirPath);

    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(resolvedPath, entry.name);

        if (entry.isDirectory()) {
          await this.removeDSStore(fullPath);
        } else if (entry.name === '.DS_Store') {
          await fs.unlink(fullPath);
          logger.debug(`Removed .DS_Store from: ${fullPath}`);
        }
      }
    } catch (error) {
      logger.debug(`Error cleaning .DS_Store files: ${error}`);
    }
  }

  async getThemeInfo(themePath: string): Promise<any> {
    const resolvedPath = resolve(themePath);
    const themeJsonPath = join(resolvedPath, 'theme.json');

    try {
      const themeJsonContent = await fs.readFile(themeJsonPath, 'utf8');
      return JSON.parse(themeJsonContent);
    } catch (error) {
      logger.warn('No theme.json found or invalid JSON');
      return {
        name: basename(resolvedPath),
        version: '1.0.0',
        description: 'Theme built with Vitrin CLI',
      };
    }
  }

  async cleanupZipFile(zipPath: string): Promise<void> {
    try {
      await fs.unlink(zipPath);
      logger.debug(`Cleaned up temporary zip file: ${zipPath}`);
    } catch (error) {
      logger.debug(`Failed to clean up zip file: ${zipPath} - ${error}`);
    }
  }

  async getDraftedSettings(
    themePath: string
  ): Promise<{ path: string; settings: any }[]> {
    const resolvedPath = resolve(themePath);

    const settingsFiles: { filePath: string; path: string }[] = [
      {
        filePath: join(resolvedPath, 'templates/home.json'),
        path: 'templates/home.jinja',
      },
      { filePath: join(resolvedPath, 'layout.json'), path: 'layout.jinja' },
      { filePath: join(resolvedPath, 'header.json'), path: 'header.jinja' },
      { filePath: join(resolvedPath, 'footer.json'), path: 'footer.jinja' },
    ];

    const results: { path: string; settings: any }[] = [];

    for (const { filePath, path } of settingsFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);
        results.push({ path: path, settings: parsed });
      } catch (error: any) {
        logger.warn(
          `Failed to load settings from "${filePath}": ${error.message}`
        );
        continue;
      }
    }

    return results;
  }
}

export default BuildService.getInstance();
