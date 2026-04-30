import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import * as gettextParser from 'gettext-parser';
import logger from './logger.js';

export interface TranslationsOptions {
  themePath: string;
  languages: string[];
}

const SKIP_DIRS = new Set(['node_modules', 'locale', '.git', 'dist', '.venv-i18n']);
const TRANS_RE = /(?<![A-Za-z0-9_])_\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g;

async function* walkJinja(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJinja(p);
    else if (entry.name.endsWith('.jinja')) yield p;
  }
}

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  "'": "'",
  '\\': '\\',
};

const unescape = (s: string): string =>
  s.replace(/\\(.)/g, (_, c: string) => ESCAPES[c] ?? c);

async function extractMessages(themePath: string): Promise<string[]> {
  const messages = new Set<string>();
  for await (const file of walkJinja(themePath)) {
    const text = await readFile(file, 'utf8');
    for (const m of text.matchAll(TRANS_RE)) {
      messages.add(unescape(m[2]!));
    }
  }
  return [...messages].sort();
}

const potDate = (): string => {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}+0000`;
};

interface PoEntry {
  msgid: string;
  msgstr: string[];
  comments?: Record<string, string>;
  obsolete?: boolean;
}

interface PoData {
  charset: string;
  headers: Record<string, string>;
  translations: Record<string, Record<string, PoEntry>>;
}

function buildCatalog(msgids: string[], headers: Record<string, string>): PoData {
  const ctx: Record<string, PoEntry> = { '': { msgid: '', msgstr: [''] } };
  for (const msgid of msgids) {
    ctx[msgid] = { msgid, msgstr: [''] };
  }
  return { charset: 'utf-8', headers, translations: { '': ctx } };
}

function mergeCatalog(pot: PoData, existing: PoData): PoData {
  const headers = {
    ...existing.headers,
    'POT-Creation-Date': pot.headers['POT-Creation-Date']!,
  };
  const potCtx = pot.translations[''] ?? {};
  const existingCtx = existing.translations[''] ?? {};
  const ctx: Record<string, PoEntry> = {
    '': existingCtx[''] ?? { msgid: '', msgstr: [''] },
  };
  for (const msgid of Object.keys(potCtx)) {
    if (msgid === '') continue;
    const prev = existingCtx[msgid];
    ctx[msgid] = prev ? { ...prev, msgid, obsolete: false } : potCtx[msgid]!;
  }
  return { charset: 'utf-8', headers, translations: { '': ctx } };
}

const POT_HEADERS = (): Record<string, string> => ({
  'Project-Id-Version': 'PROJECT VERSION',
  'POT-Creation-Date': potDate(),
  'MIME-Version': '1.0',
  'Content-Type': 'text/plain; charset=utf-8',
  'Content-Transfer-Encoding': '8bit',
  'Generated-By': '@zidsa/vitrin-cli',
});

export async function generateTranslations(
  options: TranslationsOptions
): Promise<void> {
  const { themePath, languages } = options;
  const localeDir = join(themePath, 'locale');
  const potPath = join(localeDir, 'messages.pot');

  await mkdir(localeDir, { recursive: true });

  logger.loading('Extracting messages…');
  const msgids = await extractMessages(themePath);
  const pot = buildCatalog(msgids, POT_HEADERS());
  await writeFile(potPath, gettextParser.po.compile(pot, { foldLength: 0 }));
  logger.info(`  ${msgids.length} unique messages → ${relative(themePath, potPath)}`);

  for (const lang of languages) {
    const poPath = join(localeDir, lang, 'LC_MESSAGES', 'messages.po');
    const moPath = join(localeDir, lang, 'LC_MESSAGES', 'messages.mo');
    await mkdir(dirname(poPath), { recursive: true });

    let existing: PoData;
    if (existsSync(poPath)) {
      existing = gettextParser.po.parse(await readFile(poPath)) as PoData;
    } else {
      existing = {
        charset: 'utf-8',
        headers: { ...POT_HEADERS(), Language: lang },
        translations: { '': {} },
      };
    }

    logger.loading(`Updating ${lang} catalog…`);
    const merged = mergeCatalog(pot, existing);
    await writeFile(poPath, gettextParser.po.compile(merged, { foldLength: 0 }));

    logger.loading(`Compiling ${lang}…`);
    await writeFile(moPath, gettextParser.mo.compile(merged));
  }
}
