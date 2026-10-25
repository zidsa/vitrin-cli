export interface Partner {
  id: string;
  name: string;
  email: string;
  access_token?: string;
}

export type ThemeType = 'theme' | 'product_landing_page';

export interface Theme {
  id: string;
  slug: string;
  type?: ThemeType;
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
  id: string; // pivot table id (deprecated - use store_id instead)
  store_id: string; // actual store id
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
  /** Exact zip path; wins over `output`/`useTemp`. */
  outputFile?: string;
  exclude?: string[];
  compression?: number;
  useTemp?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
