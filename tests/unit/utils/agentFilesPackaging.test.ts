import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import buildService from '../../../src/utils/build';

const THEME_FILES = [
  'layout.jinja',
  'templates/index.jinja',
  'assets/app.js',
  'docs/README.md',
];

const AGENT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/AGENTS.md',
  'sections/CLAUDE.md',
  '.agents/skills/verify/SKILL.md',
  '.claude/settings.json',
  '.codex/config.toml',
  '.cursor/rules.md',
  '.hermes/notes.md',
];

const zipEntries = (zipPath: string): string[] =>
  execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .filter(entry => entry && !entry.endsWith('/'))
    .sort();

describe('theme packages leave out agent files', () => {
  let root: string;
  let themeDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vitrin-agent-files-'));
    themeDir = join(root, 'theme');
    for (const file of [...THEME_FILES, ...AGENT_FILES]) {
      mkdirSync(dirname(join(themeDir, file)), { recursive: true });
      writeFileSync(join(themeDir, file), file);
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('vitrin build packages only the theme files', async () => {
    const zipPath = await buildService.zipTheme('theme', themeDir, {
      output: root,
    });

    expect(zipEntries(zipPath)).toEqual([...THEME_FILES].sort());
  });

  it('vitrin push packages only the theme files', async () => {
    const zipPath = await buildService.zipThemeForPush(themeDir);

    expect(zipEntries(zipPath)).toEqual([...THEME_FILES].sort());
  });
});
