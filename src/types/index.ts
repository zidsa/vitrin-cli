// Shared with the desktop app through vitrin-core.
export type {
  Partner,
  ThemeType,
  Theme,
  ThemeVersion,
  ThemesResponse,
  ThemeVersionsResponse,
  ThemeUploadResponse,
  StoreTheme,
  DevStore,
  DevStoresResponse,
  BuildOptions,
} from '@zidsa/vitrin-core';

export interface PreviewOptions {
  storeEmail: string;
  code?: string;
  themeName?: string;
}

export interface UpdateOptions {
  themeId: string;
  changeType: 'major' | 'minor' | 'patch';
  releaseNotes: string;
}

export interface CreateThemeOptions {
  name: { en: string; ar?: string };
  description: { en: string; ar?: string };
  slug: string;
}

export interface CreateThemeVersionOptions {
  themeId: string;
  version: string;
  changelog: { en: string; ar?: string };
}

export type { ApiResponse } from '@zidsa/vitrin-core';

export interface Config {
  api?: {
    baseUrl?: string;
    timeout?: number;
  };
  auth?: {
    partnerUrl?: string;
    callbackPort?: number;
  };
  build?: {
    outputDir?: string;
    compressionLevel?: number;
    excludePatterns?: string[];
  };
  preview?: {
    defaultStore?: string;
    defaultTheme?: string;
  };
}

export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  examples: string[];
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerOptions {
  level: LogLevel;
  format?: 'json' | 'simple';
  file?: string;
}
