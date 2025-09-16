export interface Partner {
  id: string;
  name: string;
  email: string;
  access_token?: string;
}

export interface Theme {
  id: string;
  slug: string;
  partner: string;
  name: { en: string; ar?: string };
  description: { en: string; ar?: string };
  tags: string[];
  screenshots: string[];
  icon: string | null;
  demo_url: string | null;
  documentation_url: string | null;
  support_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThemeVersion {
  id: string;
  theme: string;
  version: string;
  minimum_api_version: string;
  changelog: { en: string; ar?: string };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ThemesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Theme[];
}

export interface ThemeVersionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ThemeVersion[];
}

export interface ThemeUploadResponse {
  theme_version: ThemeVersion;
  upload_url: string;
  upload_fields: Record<string, string>;
  key: string;
  max_size_mb: number;
}

export interface StoreTheme {
  id: string;
  store: string;
  theme: Theme;
  theme_version: ThemeVersion;
  is_active: boolean;
  installed_at: string;
  activated_at: string | null;
  settings: Record<string, any>;
}

export interface DevStore {
  id: string;
  name: string;
  email: string;
  domain: string;
  created_at: string;
}

export interface DevStoresResponse {
  stores: DevStore[];
  total: number;
}

export interface BuildOptions {
  name?: string;
  path?: string;
  output?: string;
  exclude?: string[];
  compression?: number;
  useTemp?: boolean;
}

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
  minimumApiVersion: string;
  changelog: { en: string; ar?: string };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

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
