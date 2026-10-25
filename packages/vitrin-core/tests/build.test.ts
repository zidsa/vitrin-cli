import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BuildService,
  PackageTooLargeError,
  assertPackageSize,
} from '../src/index.js';

function write(root: string, file: string, content = 'x'): void {
  const full = join(root, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function zipEntries(zipPath: string): string[] {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .filter(line => line && !line.endsWith('/'))
    .sort();
}

describe('zipTheme: the one packaging rule', () => {
  let theme: string;

  beforeEach(() => {
    theme = mkdtempSync(join(tmpdir(), 'vitrin-core-theme-'));
  });

  afterEach(() => rmSync(theme, { recursive: true, force: true }));

  it('ships theme files and compiled assets, nothing else', async () => {
    const kept = [
      'layout.jinja',
      'header.jinja',
      'footer.jinja',
      'templates/home.jinja',
      'templates/home.json',
      'sections/hero.jinja',
      'assets/dist/theme.js',
      'assets/css/app.css',
      'locale/ar/LC_MESSAGES/messages.po',
    ];
    const dropped = [
      'node_modules/pkg/index.js',
      'assets/vendor/node_modules/x.js',
      'dist/bnfsj.zip',
      'build/out.js',
      '.git/HEAD',
      '.vitrin/dist/theme.zip',
      '.vitrin/theme.json',
      '.env',
      '.env.local',
      '.DS_Store',
      'assets/.DS_Store',
      'Thumbs.db',
      'debug.log',
      'assets/js/trace.log',
      'notes.tmp',
      'theme.zip',
    ];
    for (const file of [...kept, ...dropped]) write(theme, file);

    const outputFile = join(theme, '.vitrin', 'dist', 'out.zip');
    const zipPath = await BuildService.getInstance().zipTheme('theme', theme, {
      outputFile,
    });

    expect(zipPath).toBe(outputFile);
    expect(zipEntries(zipPath)).toEqual([...kept].sort());
  });

  it('adds caller excludes to the rule', async () => {
    write(theme, 'layout.jinja');
    write(theme, 'README.md');
    const zipPath = await BuildService.getInstance().zipTheme('theme', theme, {
      outputFile: join(theme, '.vitrin', 'out.zip'),
      exclude: ['README.md'],
    });
    expect(zipEntries(zipPath)).toEqual(['layout.jinja']);
  });
});

describe('assertPackageSize', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vitrin-core-size-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('accepts a package within max_size_mb', async () => {
    const zip = join(dir, 'a.zip');
    writeFileSync(zip, Buffer.alloc(1024));
    await expect(assertPackageSize(zip, 1)).resolves.toBeUndefined();
  });

  it('rejects a package over max_size_mb', async () => {
    const zip = join(dir, 'b.zip');
    writeFileSync(zip, Buffer.alloc(2 * 1024 * 1024));
    await expect(assertPackageSize(zip, 1)).rejects.toBeInstanceOf(
      PackageTooLargeError
    );
  });

  it.each([undefined, null, 0, -1, Number.NaN])(
    'skips the check when the limit is %s',
    async limit => {
      const zip = join(dir, 'c.zip');
      writeFileSync(zip, Buffer.alloc(2 * 1024 * 1024));
      await expect(assertPackageSize(zip, limit)).resolves.toBeUndefined();
    }
  );
});
