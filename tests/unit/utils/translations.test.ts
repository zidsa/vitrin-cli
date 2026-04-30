import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateTranslations } from '../../../src/utils/translations';

const PO_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  '\\': '\\',
};

const unquotePoString = (raw: string): string =>
  raw.replace(/\\(.)/g, (_, c: string) => PO_ESCAPES[c] ?? c);

interface ParsedEntry {
  msgid: string;
  msgstr: string;
}

const parsePo = (
  path: string
): { entries: ParsedEntry[]; headers: Record<string, string> } => {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const entries: ParsedEntry[] = [];
  const headers: Record<string, string> = {};

  let mode: 'none' | 'msgid' | 'msgstr' = 'none';
  let curMsgid = '';
  let curMsgstr = '';

  const flush = (): void => {
    if (mode === 'none') return;
    if (curMsgid === '') {
      for (const headerLine of curMsgstr.split('\n')) {
        const idx = headerLine.indexOf(':');
        if (idx === -1) continue;
        const key = headerLine.slice(0, idx).trim();
        const value = headerLine.slice(idx + 1).trim();
        if (key) headers[key] = value;
      }
    } else {
      entries.push({ msgid: curMsgid, msgstr: curMsgstr });
    }
    curMsgid = '';
    curMsgstr = '';
    mode = 'none';
  };

  const stringLiteral = (s: string): string | null => {
    const m = s.match(/^"((?:\\.|[^"\\])*)"\s*$/);
    return m ? unquotePoString(m[1]!) : null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('#')) continue;

    if (line.startsWith('msgid ')) {
      flush();
      mode = 'msgid';
      curMsgid = stringLiteral(line.slice(6).trim()) ?? '';
      continue;
    }
    if (line.startsWith('msgstr ')) {
      mode = 'msgstr';
      curMsgstr = stringLiteral(line.slice(7).trim()) ?? '';
      continue;
    }
    const literal = stringLiteral(line);
    if (literal !== null) {
      if (mode === 'msgid') curMsgid += literal;
      else if (mode === 'msgstr') curMsgstr += literal;
    }
  }
  flush();
  return { entries, headers };
};

const msgidsOf = (path: string): string[] =>
  parsePo(path)
    .entries.map(e => e.msgid)
    .sort();

describe('generateTranslations', () => {
  let themeDir: string;

  beforeEach(() => {
    themeDir = mkdtempSync(join(tmpdir(), 'vitrin-translations-'));
  });

  afterEach(() => {
    rmSync(themeDir, { recursive: true, force: true });
  });

  const writeJinja = (relPath: string, content: string): void => {
    const full = join(themeDir, relPath);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  };

  const potPath = (): string => join(themeDir, 'locale', 'messages.pot');
  const poPath = (lang: string): string =>
    join(themeDir, 'locale', lang, 'LC_MESSAGES', 'messages.po');
  const moPath = (lang: string): string =>
    join(themeDir, 'locale', lang, 'LC_MESSAGES', 'messages.mo');

  it('writes locale/messages.pot containing every extracted msgid', async () => {
    writeJinja('layout.jinja', `<h1>{{ _("Hello world") }}</h1>`);
    writeJinja(
      'templates/product.jinja',
      `<p>{{ _('Add to cart') }} {{ _("Sold out") }}</p>`
    );

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(existsSync(potPath())).toBe(true);
    expect(msgidsOf(potPath())).toEqual([
      'Add to cart',
      'Hello world',
      'Sold out',
    ]);
  });

  it('supports both single- and double-quoted strings and unescapes them', async () => {
    writeJinja(
      'layout.jinja',
      `_("line1\\nline2") _('she said \\'hi\\'') _("quote: \\"x\\"")`
    );

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual(
      ['line1\nline2', "she said 'hi'", 'quote: "x"'].sort()
    );
  });

  it('deduplicates identical messages found in multiple files', async () => {
    writeJinja('a.jinja', `_("Save")`);
    writeJinja('b.jinja', `<span>{{ _("Save") }}</span>`);
    writeJinja('c.jinja', `_("Cancel")`);

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual(['Cancel', 'Save']);
  });

  it('skips non-.jinja files, hidden files, and excluded directories', async () => {
    writeJinja('layout.jinja', `_("Visible")`);
    writeJinja('snippets/.hidden.jinja', `_("Hidden file")`);
    writeJinja('node_modules/pkg/template.jinja', `_("From node_modules")`);
    writeJinja('locale/leftover.jinja', `_("From locale dir")`);
    writeJinja('dist/built.jinja', `_("From dist")`);
    writeJinja('.git/x.jinja', `_("From git")`);
    writeJinja('templates/page.html', `_("Not jinja")`);
    writeJinja('templates/page.txt', `_("Plain text")`);

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual(['Visible']);
  });

  it('does not match _ when it is part of an identifier', async () => {
    writeJinja(
      'layout.jinja',
      `{{ my_("Not a translation") }} {{ _("Real one") }}`
    );

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual(['Real one']);
  });

  it('creates per-language .po and .mo with empty msgstr for new entries', async () => {
    writeJinja('layout.jinja', `_("Hello")`);

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(existsSync(poPath('ar'))).toBe(true);
    expect(existsSync(moPath('ar'))).toBe(true);

    const po = parsePo(poPath('ar'));
    const hello = po.entries.find(e => e.msgid === 'Hello');
    expect(hello).toBeDefined();
    expect(hello!.msgstr).toBe('');
    expect(po.headers['Language']).toBe('ar');

    expect(statSync(moPath('ar')).size).toBeGreaterThan(0);
  });

  it('handles multiple languages in a single run', async () => {
    writeJinja('layout.jinja', `_("Greeting")`);

    await generateTranslations({
      themePath: themeDir,
      languages: ['ar', 'fr'],
    });

    for (const lang of ['ar', 'fr']) {
      expect(existsSync(poPath(lang))).toBe(true);
      expect(existsSync(moPath(lang))).toBe(true);
      expect(msgidsOf(poPath(lang))).toEqual(['Greeting']);
    }
  });

  it('preserves existing translations when re-run, drops removed msgids, and adds new ones', async () => {
    writeJinja('a.jinja', `_("Save") _("Cancel")`);
    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    const initial = readFileSync(poPath('ar'), 'utf8')
      .replace(/msgid "Save"\nmsgstr ""/, 'msgid "Save"\nmsgstr "حفظ"')
      .replace(/msgid "Cancel"\nmsgstr ""/, 'msgid "Cancel"\nmsgstr "إلغاء"');
    writeFileSync(poPath('ar'), initial);

    rmSync(join(themeDir, 'a.jinja'));
    writeJinja('a.jinja', `_("Save") _("Submit")`);
    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    const po = parsePo(poPath('ar'));
    const ids = po.entries.map(e => e.msgid).sort();
    expect(ids).toEqual(['Save', 'Submit']);
    expect(po.entries.find(e => e.msgid === 'Save')!.msgstr).toBe('حفظ');
    expect(po.entries.find(e => e.msgid === 'Submit')!.msgstr).toBe('');
    expect(po.entries.find(e => e.msgid === 'Cancel')).toBeUndefined();
  });

  it('writes a POT-Creation-Date in YYYY-MM-DD HH:MM+0000 form', async () => {
    writeJinja('a.jinja', `_("X")`);
    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    const headers = parsePo(potPath()).headers;
    expect(headers['POT-Creation-Date']).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}\+0000$/
    );
    expect(headers['Generated-By']).toBe('@zidsa/vitrin-cli');
    expect(headers['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('produces an empty catalog (just the header entry) when no jinja files exist', async () => {
    writeJinja('readme.txt', 'no translations here');

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual([]);
    expect(msgidsOf(poPath('ar'))).toEqual([]);
  });

  it('walks nested subdirectories when collecting jinja files', async () => {
    writeJinja('a.jinja', `_("Top")`);
    writeJinja('templates/x/y/z/deep.jinja', `_("Deep")`);

    await generateTranslations({ themePath: themeDir, languages: ['ar'] });

    expect(msgidsOf(potPath())).toEqual(['Deep', 'Top']);
  });
});
