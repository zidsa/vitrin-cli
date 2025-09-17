import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import logger from '../utils/logger.js';

export interface ThemeConfig {
  id?: string;
  slug?: string;
  name?: string;
  version?: string;
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
  private configPath: string;
  private config: ThemeConfig = {};

  constructor(themePath?: string) {
    this.configPath = themePath
      ? join(themePath, '.vitrin', 'theme.json')
      : join(process.cwd(), '.vitrin', 'theme.json');
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
      createdAt: this.config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pushHistory: this.config.pushHistory || [],
    };
    await this.save();
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

    await this.save();
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
    if (slug) {
      this.config.slug = slug;
    }
    this.config.updatedAt = new Date().toISOString();
    await this.save();
  }

  async updateConfig(updates: Partial<ThemeConfig>): Promise<void> {
    await this.load();
    this.config = {
      ...this.config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
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

  static async getGlobalThemes(): Promise<Record<string, ThemeConfig>> {
    const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
    try {
      const data = await fs.readFile(globalConfigPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static async saveGlobalTheme(
    path: string,
    config: ThemeConfig
  ): Promise<void> {
    const globalConfigPath = join(homedir(), '.vitrin', 'themes.json');
    const globalDir = dirname(globalConfigPath);

    await fs.mkdir(globalDir, { recursive: true });

    const themes = await ThemeManager.getGlobalThemes();
    themes[path] = config;

    await fs.writeFile(
      globalConfigPath,
      JSON.stringify(themes, null, 2),
      'utf8'
    );
  }
}
