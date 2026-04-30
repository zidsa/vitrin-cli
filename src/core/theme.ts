import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import logger from '../utils/logger.js';

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export interface ThemeConfig {
  id?: string;
  slug?: string;
  name?: string;
  version?: string;
  path?: string;
  pushHistory?: PushRecord[];
  defaultStore?: string;
  createdAt?: string;
  updatedAt?: string;
  installations?: Installation[];
}

export interface PushRecord {
  themeId: string;
  versionId: string;
  version: string;
  pushedAt: string;
  store?: string;
}

export interface Installation {
  id: string;
  store_id: string;
  store_name: string;
  installed_at: string;
  version?: string;
  activated?: boolean;
  activated_at?: string;
}

export class ThemeManager {
  private themeRoot: string;
  private configPath: string;
  private config: ThemeConfig = {};

  constructor(themePath?: string) {
    this.themeRoot = themePath || process.cwd();
    this.configPath = join(this.themeRoot, '.vitrin', 'theme.json');
  }

  async load(): Promise<ThemeConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
      return this.config;
    } catch (error) {
      logger.debug('No theme configuration found, starting fresh');
      return this.config;
    }
  }

  async save(): Promise<void> {
    try {
      const dir = dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      logger.debug('Theme configuration saved');
    } catch (error) {
      logger.error('Failed to save theme configuration:', error as Error);
      throw error;
    }
  }

  async init(config: Partial<ThemeConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...config,
      path: config.path || this.config.path || this.themeRoot,
      createdAt: this.config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pushHistory: this.config.pushHistory || [],
    };
    await this.save();
    await ThemeManager.saveGlobalTheme(this.themeRoot, this.config);
  }

  async recordPush(record: PushRecord): Promise<void> {
    await this.load();
    if (!this.config.pushHistory) {
      this.config.pushHistory = [];
    }
    this.config.pushHistory.push(record);
    this.config.updatedAt = new Date().toISOString();

    if (record.themeId && !this.config.id) {
      this.config.id = record.themeId;
    }

    if (!this.config.path) {
      this.config.path = this.themeRoot;
    }

    await this.save();
    await ThemeManager.saveGlobalTheme(this.themeRoot, this.config);
  }

  async setDefaultStore(storeEmail: string): Promise<void> {
    await this.load();
    this.config.defaultStore = storeEmail;
    this.config.updatedAt = new Date().toISOString();
    await this.save();
  }

  async getConfig(): Promise<ThemeConfig> {
    await this.load();
    return this.config;
  }

  async updateThemeId(themeId: string, slug?: string): Promise<void> {
    await this.load();
    this.config.id = themeId;
    if (slug !== undefined) {
      this.config.slug = slug;
    }
    this.config.path = this.themeRoot;
    this.config.updatedAt = new Date().toISOString();
    await this.save();
    await ThemeManager.saveGlobalTheme(this.themeRoot, this.config);
  }

  async updateConfig(updates: Partial<ThemeConfig>): Promise<void> {
    await this.load();
    this.config = {
      ...this.config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    await ThemeManager.saveGlobalTheme(this.themeRoot, this.config);
  }

  async getLastPush(): Promise<PushRecord | undefined> {
    await this.load();
    if (!this.config.pushHistory || this.config.pushHistory.length === 0) {
      return undefined;
    }
    return this.config.pushHistory[this.config.pushHistory.length - 1];
  }

  async isLinkedToServer(): Promise<boolean> {
    await this.load();
    return !!this.config.id;
  }

  static async findLinkedRoot(startPath: string): Promise<string | null> {
    let dir = startPath;
    while (true) {
      const candidate = join(dir, '.vitrin', 'theme.json');
      try {
        const data = await fs.readFile(candidate, 'utf8');
        const config = JSON.parse(data) as ThemeConfig;
        if (config.id) {
          const looksLikeTheme =
            (await fileExists(join(dir, 'layout.jinja'))) ||
            (await fileExists(join(dir, 'theme.json')));
          if (looksLikeTheme) {
            return dir;
          }
        }
      } catch {
      }
      const parent = dirname(dir);
      if (parent === dir) {
        return null;
      }
      dir = parent;
    }
  }

  static async getGlobalThemes(): Promise<Record<string, ThemeConfig>> {
    const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
    try {
      const data = await fs.readFile(globalConfigPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static async listGlobalThemes(): Promise<
    Array<ThemeConfig & { path: string }>
  > {
    const themes = await ThemeManager.getGlobalThemes();
    const out: Array<ThemeConfig & { path: string }> = [];
    for (const [path, config] of Object.entries(themes)) {
      if (await fileExists(path)) {
        out.push({ ...config, path });
      }
    }
    return out.sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  }

  static async saveGlobalTheme(
    path: string,
    config: ThemeConfig
  ): Promise<void> {
    if (!path) return;
    const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
    const globalDir = dirname(globalConfigPath);

    await fs.mkdir(globalDir, { recursive: true });

    const themes = await ThemeManager.getGlobalThemes();
    themes[path] = { ...config, path };

    await fs.writeFile(
      globalConfigPath,
      JSON.stringify(themes, null, 2),
      'utf8'
    );
  }

  static async removeGlobalTheme(path: string): Promise<void> {
    if (!path) return;
    const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
    const themes = await ThemeManager.getGlobalThemes();
    if (!(path in themes)) return;
    delete themes[path];
    await fs.writeFile(
      globalConfigPath,
      JSON.stringify(themes, null, 2),
      'utf8'
    );
  }

  static async pruneGlobalThemes(): Promise<void> {
    const themes = await ThemeManager.getGlobalThemes();
    const keep: Record<string, ThemeConfig> = {};
    for (const [path, config] of Object.entries(themes)) {
      if (await fileExists(path)) {
        keep[path] = config;
      }
    }
    if (Object.keys(keep).length !== Object.keys(themes).length) {
      const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
      await fs.writeFile(
        globalConfigPath,
        JSON.stringify(keep, null, 2),
        'utf8'
      );
    }
  }

  static async findGlobalThemeByName(
    name: string
  ): Promise<(ThemeConfig & { path: string }) | null> {
    const themes = await ThemeManager.getGlobalThemes();
    for (const [path, config] of Object.entries(themes)) {
      if (config.name === name) {
        return { ...config, path };
      }
    }
    return null;
  }
}
