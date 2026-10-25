import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { logger } from './logger.js';
import type {
  Partner,
  ThemesResponse,
  DevStoresResponse,
  ThemeType,
  Theme,
} from './types.js';
import type { ThemeVersionStatus } from './themeStatus.js';

export const DEFAULT_API_URL = 'https://api.zid.sa';

/**
 * Who the requests act as.
 * - `partner`: a Vitrin partner token (`x-partner-token`), as vitrin-cli uses.
 * - `manager`: a merchant's manager token for their own store
 *   (`X-Manager-Token`, `role: Manager`, `store-id`), as the merchant
 *   dashboard and the desktop app use.
 */
export type ZidCredentials =
  | { kind: 'partner'; token: string }
  | { kind: 'manager'; token: string; storeId: string };

export interface TokenProvider {
  getCredentials(): Promise<ZidCredentials | null>;
  /**
   * Called when the API answers 401. Return `'retry'` to send the request
   * once more with fresh credentials, an `Error` to throw instead of the
   * default one, or nothing for the default error.
   */
  onUnauthorized?(detail: string | null): Promise<'retry' | Error | void>;
}

export interface ApiServiceOptions {
  tokenProvider: TokenProvider;
  /** Read on every request, so a host can change it at runtime. */
  baseURL?: () => string;
  userAgent?: string;
  /** Log request and response dumps, with credentials redacted. */
  debug?: () => boolean;
}

const SECRET_HEADERS = new Set([
  'authorization',
  'x-partner-token',
  'x-manager-token',
  'access-token',
]);

/** Copy of `headers` safe to print: credential values are masked. */
export function redactHeaders(headers: unknown): Record<string, unknown> {
  const plain =
    headers && typeof (headers as any).toJSON === 'function'
      ? (headers as any).toJSON()
      : { ...(headers as Record<string, unknown>) };
  for (const key of Object.keys(plain)) {
    if (SECRET_HEADERS.has(key.toLowerCase())) plain[key] = '[redacted]';
  }
  return plain;
}

// Axios hands interceptors an AxiosHeaders (case-insensitive) object.
function hasHeader(headers: any, name: string): boolean {
  return typeof headers?.has === 'function'
    ? headers.has(name)
    : Boolean(headers?.[name]);
}

function deleteHeader(headers: any, name: string): void {
  if (typeof headers?.delete === 'function') headers.delete(name);
  else if (headers) delete headers[name];
}

export function authHeaders(
  credentials: ZidCredentials,
  url: string | undefined
): Record<string, string> {
  if (credentials.kind === 'manager') {
    return {
      'X-Manager-Token': credentials.token,
      role: 'Manager',
      'store-id': credentials.storeId,
    };
  }
  const headers: Record<string, string> = {
    'x-partner-token': credentials.token,
  };
  if (url?.includes('/v2/')) {
    headers['Authorization'] = `Bearer ${credentials.token}`;
  }
  return headers;
}

export function extractErrorMessage(data: any): string | null {
  if (!data) return null;

  if (typeof data === 'string') {
    return data;
  }

  if (data.message) {
    if (typeof data.message === 'string') {
      return data.message;
    }
    if (data.message.description) {
      return data.message.description;
    }
  }

  if (data.detail) {
    return data.detail;
  }

  if (data.error) {
    if (typeof data.error === 'string') {
      return data.error;
    }
    if (data.error.message) {
      return data.error.message;
    }
  }

  if (data.errors) {
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0];
    }
    if (typeof data.errors === 'object') {
      const firstError = Object.values(data.errors)[0];
      if (Array.isArray(firstError) && firstError.length > 0) {
        return firstError[0];
      }
      return String(firstError);
    }
  }

  if (data.non_field_errors) {
    if (
      Array.isArray(data.non_field_errors) &&
      data.non_field_errors.length > 0
    ) {
      return data.non_field_errors[0];
    }
  }

  const keys = Object.keys(data);
  for (const key of keys) {
    if (key !== 'status' && key !== 'statusCode' && data[key]) {
      if (typeof data[key] === 'string') {
        return data[key];
      }
      if (
        Array.isArray(data[key]) &&
        data[key].length > 0 &&
        typeof data[key][0] === 'string'
      ) {
        return data[key][0];
      }
    }
  }

  return null;
}

export class ApiService {
  private client: AxiosInstance;

  constructor(private readonly options: ApiServiceOptions) {
    this.client = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': options.userAgent ?? 'vitrin-core',
        'accept-language': 'en',
      },
    });

    this.setupInterceptors();
  }

  private getBaseURL(): string {
    return this.options.baseURL?.() || DEFAULT_API_URL;
  }

  private isDebug(): boolean {
    return this.options.debug?.() ?? false;
  }

  private extractErrorMessage(data: any): string | null {
    return extractErrorMessage(data);
  }

  private async applyCredentials(config: {
    url?: string | undefined;
    headers: any;
  }): Promise<void> {
    const credentials = await this.options.tokenProvider.getCredentials();
    if (!credentials) {
      logger.debug(`No credentials for request to: ${config.url}`);
      return;
    }
    for (const [name, value] of Object.entries(
      authHeaders(credentials, config.url)
    )) {
      // A per-request header (e.g. a store-id for another store) wins.
      if (!hasHeader(config.headers, name)) config.headers[name] = value;
    }
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async config => {
        config.baseURL = this.getBaseURL();
        try {
          await this.applyCredentials(config);
        } catch (error) {
          logger.debug('Error getting credentials');
        }

        if (this.isDebug()) {
          console.error('[DEBUG API REQUEST]', {
            url: (config.baseURL || '') + (config.url || ''),
            method: config.method,
            headers: redactHeaders(config.headers),
            params: config.params,
          });
        }
        return config;
      },
      error => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      response => {
        if (this.isDebug()) {
          console.error('[DEBUG API RESPONSE SUCCESS]', {
            url: response.config.url,
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      async error => {
        const status = error.response?.status;

        if (this.isDebug()) {
          console.error('[DEBUG API RESPONSE ERROR]', {
            url: error.config?.url,
            method: error.config?.method,
            status: status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
        }

        if (status === 401) {
          logger.debug(
            `API returned 401. Response: ${JSON.stringify(error.response?.data)}`
          );

          const errorDetail = this.extractErrorMessage(error.response?.data);
          const originalRequest = error.config;
          // One retry at most: a second 401 is final.
          const decision = originalRequest?._vitrinRetried
            ? undefined
            : await this.options.tokenProvider.onUnauthorized?.(errorDetail);

          if (decision === 'retry' && originalRequest) {
            originalRequest._vitrinRetried = true;
            for (const name of [
              'x-partner-token',
              'Authorization',
              'X-Manager-Token',
            ]) {
              deleteHeader(originalRequest.headers, name);
            }
            return this.client.request(originalRequest);
          }
          if (decision instanceof Error) throw decision;

          throw new Error(
            errorDetail
              ? `Authentication failed: ${errorDetail}`
              : 'Authentication failed or expired.'
          );
        }

        if (status === 403) {
          logger.debug(
            `API returned 403. Response: ${JSON.stringify(error.response?.data)}`
          );

          const errorDetail = this.extractErrorMessage(error.response?.data);
          if (errorDetail) {
            throw new Error(`Access denied: ${errorDetail}`);
          } else {
            throw new Error(
              'Access denied. Check your permissions for this resource.'
            );
          }
        }

        if (status >= 500) {
          const errorDetail = this.extractErrorMessage(error.response?.data);
          if (errorDetail) {
            throw new Error(`Server error (${status}): ${errorDetail}`);
          } else {
            throw new Error(
              `Server error (${status}). Please try again later.`
            );
          }
        }

        if (status >= 400) {
          const errorDetail = this.extractErrorMessage(error.response?.data);
          if (errorDetail) {
            throw new Error(errorDetail);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async getPartnerData(): Promise<Partner> {
    try {
      const response = await this.client.get<any>('/v1/market/partner');

      if (response.data.status === 'object' && response.data.payload) {
        return response.data.payload;
      }

      throw new Error(
        response.data.message?.description || 'Failed to fetch partner data'
      );
    } catch (error) {
      logger.error('Failed to fetch partner data', error as Error);
      throw error;
    }
  }

  async getThemes(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    type?: ThemeType | undefined;
  }): Promise<ThemesResponse> {
    try {
      const response = await this.client.get('/v2/themes/', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch themes', error as Error);
      throw error;
    }
  }

  /** Themes of every type; the API lists one type per request (default "theme"). */
  async getAllThemes(): Promise<Theme[]> {
    const responses = await Promise.all([
      this.getThemes({ page_size: 100 }),
      this.getThemes({ page_size: 100, type: 'product_landing_page' }),
    ]);
    return responses.flatMap(response => response.results ?? []);
  }

  async getTheme(themeId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/themes/${themeId}/`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch theme', error as Error);
      throw error;
    }
  }

  async deleteTheme(themeId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/themes/${themeId}/`);
    } catch (error) {
      logger.error('Failed to delete theme', error as Error);
      throw error;
    }
  }

  async updateTheme(
    themeId: string,
    data: {
      name?: { en: string; ar?: string };
      description?: { en: string; ar?: string };
    }
  ): Promise<any> {
    try {
      const response = await this.client.patch(`/v2/themes/${themeId}/`, data);
      return response.data;
    } catch (error) {
      logger.error('Failed to update theme', error as Error);
      throw error;
    }
  }

  async getDevStores(): Promise<DevStoresResponse> {
    try {
      const response = await this.client.get<any>('/v1/market/dev-stores');

      if (response.data.status === 'object' && response.data.payload) {
        return {
          stores: response.data.payload,
          total: response.data.payload.length,
        };
      }

      throw new Error(
        response.data.message?.description || 'Failed to fetch dev stores'
      );
    } catch (error: any) {
      logger.error('Failed to fetch dev stores', error as Error);
      throw error;
    }
  }

  async createTheme(data: {
    name: { en: string; ar?: string };
    description: { en: string; ar?: string };
    slug: string;
    type?: ThemeType | undefined;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/themes/', data);
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to create theme: ${errorMessage}`);
        throw new Error(`Failed to create theme: ${errorMessage}`);
      }
      logger.error('Failed to create theme', error as Error);
      throw error;
    }
  }

  async createThemeVersion(
    themeId: string,
    data: {
      version: string;
      changelog: { en: string; ar?: string };
      keep_using_latest?: boolean;
    }
  ): Promise<any> {
    try {
      logger.debug(`Creating theme version for theme ${themeId}`);
      logger.debug(`Version data: ${JSON.stringify(data)}`);

      const response = await this.client.post(
        `/v2/themes/${themeId}/versions/`,
        data
      );

      logger.debug(`Version response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to create theme version: ${errorMessage}`);
        throw new Error(`Failed to create theme version: ${errorMessage}`);
      }
      logger.error('Failed to create theme version', error as Error);
      throw error;
    }
  }

  async uploadThemeArtifact(
    uploadUrl: string,
    uploadFields: Record<string, string>,
    themePath: string
  ): Promise<void> {
    try {
      const form = new FormData();
      form.append('key', uploadFields.key || '');
      form.append('AWSAccessKeyId', uploadFields.AWSAccessKeyId || '');
      form.append('policy', uploadFields.policy || '');
      form.append('signature', uploadFields.signature || '');
      form.append('Content-Type', 'application/zip');
      form.append('file', createReadStream(themePath));

      const response = await axios.post(uploadUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (![200, 201, 204].includes(response.status)) {
        throw new Error(`S3 upload failed with status ${response.status}`);
      }

      logger.success('Theme uploaded to S3 successfully');
    } catch (error: any) {
      const errorMsg = error.response?.data
        ? `S3 upload failed: ${JSON.stringify(error.response.data)}`
        : `Upload failed: ${error.message}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async notifyArtifactUpload(
    themeId: string,
    versionId: string,
    data: {
      key: string;
    }
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/v2/themes/${themeId}/versions/${versionId}/artifacts/`,
        data
      );
      return response.data;
    } catch (error: any) {
      logger.error(
        'Failed to notify artifact upload:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async updateThemeVersion(
    themeId: string,
    versionId: string,
    data: {
      changelog?: { en?: string; ar?: string };
    }
  ): Promise<any> {
    try {
      const response = await this.client.patch(
        `/v2/themes/${themeId}/versions/${versionId}/`,
        data
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to update theme version: ${errorMessage}`);
        throw new Error(`Failed to update theme version: ${errorMessage}`);
      }
      logger.error('Failed to update theme version', error as Error);
      throw error;
    }
  }

  async updateThemeVersionStatus(
    themeId: string,
    versionId: string,
    status: ThemeVersionStatus
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/v2/themes/${themeId}/versions/${versionId}/status/`,
        { status }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to update theme version status: ${errorMessage}`);
        throw new Error(
          `Failed to update theme version status: ${errorMessage}`
        );
      }
      logger.error('Failed to update theme version status', error as Error);
      throw error;
    }
  }

  async listThemeVersions(
    themeId: string,
    params?: { page?: number; page_size?: number }
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/v2/themes/${themeId}/versions/`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to list theme versions', error as Error);
      throw error;
    }
  }

  async getThemeVersion(themeId: string, versionId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v2/themes/${themeId}/versions/${versionId}/`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch theme version', error as Error);
      throw error;
    }
  }

  async downloadThemeVersionArtifact(
    themeId: string,
    versionId: string
  ): Promise<{ url: string }> {
    try {
      const response = await this.client.get(
        `/v2/themes/${themeId}/versions/${versionId}/download/`
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to get artifact download URL: ${errorMessage}`);
        throw new Error(`Failed to get artifact download URL: ${errorMessage}`);
      }
      logger.error('Failed to get artifact download URL', error as Error);
      throw error;
    }
  }

  async listPresets(
    themeId: string,
    params?: { page?: number; page_size?: number; type?: string }
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/v2/themes/${themeId}/presets/`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to list theme presets', error as Error);
      throw error;
    }
  }

  async getPreset(themeId: string, presetId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v2/themes/${themeId}/presets/${presetId}/`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch theme preset', error as Error);
      throw error;
    }
  }

  async createPreset(
    themeId: string,
    data: {
      type: string;
      name: { en: string; ar?: string };
      images?: string[];
      presets?: Array<{ path: string; settings: Record<string, any> }>;
    }
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/v2/themes/${themeId}/presets/`,
        data
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to create preset: ${errorMessage}`);
        throw new Error(`Failed to create preset: ${errorMessage}`);
      }
      logger.error('Failed to create preset', error as Error);
      throw error;
    }
  }

  async updatePreset(
    themeId: string,
    presetId: string,
    data: {
      type?: string;
      name?: { en: string; ar?: string };
      images?: string[];
      presets?: Array<{ path: string; settings: Record<string, any> }>;
    }
  ): Promise<any> {
    try {
      const response = await this.client.patch(
        `/v2/themes/${themeId}/presets/${presetId}/`,
        data
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to update preset: ${errorMessage}`);
        throw new Error(`Failed to update preset: ${errorMessage}`);
      }
      logger.error('Failed to update preset', error as Error);
      throw error;
    }
  }

  async deletePreset(themeId: string, presetId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/themes/${themeId}/presets/${presetId}/`);
    } catch (error) {
      logger.error('Failed to delete preset', error as Error);
      throw error;
    }
  }

  async uploadPresetImage(
    themeId: string,
    filePath: string
  ): Promise<{ url: string }> {
    try {
      const form = new FormData();
      form.append('file', createReadStream(filePath), {
        filename: basename(filePath),
      });
      const response = await this.client.post(
        `/v2/themes/${themeId}/presets/images/`,
        form,
        {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to upload preset image: ${errorMessage}`);
        throw new Error(`Failed to upload preset image: ${errorMessage}`);
      }
      logger.error('Failed to upload preset image', error as Error);
      throw error;
    }
  }

  async installTheme(
    storeId: string,
    themeId: string,
    versionId: string
  ): Promise<any> {
    try {
      const response = await this.client.post(
        '/v2/stores/themes/install/',
        {
          theme_id: themeId,
          version_id: versionId,
        },
        {
          headers: {
            'store-id': storeId,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to install theme: ${errorMessage}`);
        throw new Error(`Failed to install theme: ${errorMessage}`);
      }
      logger.error('Failed to install theme', error as Error);
      throw error;
    }
  }

  async setDraftSettings(
    storeId: string,
    installationId: string,
    data: { path: string; settings: any }[]
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/v2/stores/themes/${installationId}/templates/bulk-settings/`,
        data,
        {
          headers: {
            'store-id': storeId,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to set drafted settings: ${errorMessage}`);
        throw new Error(`Failed to set drafted settings: ${errorMessage}`);
      }
      logger.error('Failed to set drafted settings', error as Error);
      throw error;
    }
  }

  async getStoreTheme(storeId: string, installationId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v2/stores/themes/${installationId}/`,
        { headers: { 'store-id': storeId } }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      throw errorMessage ? new Error(errorMessage) : error;
    }
  }

  async activateTheme(storeId: string, installationId: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/v2/stores/themes/${installationId}/activate/`,
        {},
        {
          headers: {
            'store-id': storeId,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      if (errorMessage) {
        logger.error(`Failed to activate theme: ${errorMessage}`);
        throw new Error(`Failed to activate theme: ${errorMessage}`);
      }
      logger.error('Failed to activate theme', error as Error);
      throw error;
    }
  }

  async getPreviewUrl(
    storeId: string,
    storeThemeId: string | null = null
  ): Promise<{ url: string }> {
    try {
      const response = await this.client.get(`/v2/stores/preview/`, {
        params: {
          store_theme_id: storeThemeId || 'null',
        },
        headers: {
          'store-id': storeId,
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get preview URL', error as Error);
      throw error;
    }
  }

  async getProductLandingPagePreviewUrl(
    storeId: string,
    storeThemeId: string
  ): Promise<{ url: string }> {
    try {
      const response = await this.client.post(
        `/v2/stores/themes/${storeThemeId}/product-landing-page-preview/`,
        {},
        { headers: { 'store-id': storeId } }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      throw errorMessage ? new Error(errorMessage) : error;
    }
  }

  // Merchant custom themes (manager credentials). The merchant dashboard's
  // "Upload new theme" uses these; they need the store's `sdk_theme` plan
  // feature. An upload is published and installed (not activated) at once,
  // and a re-upload overwrites the same version.

  async createCustomTheme(data: {
    name: string;
    zipPath: string;
    description?: string;
    type?: ThemeType;
  }): Promise<any> {
    const form = new FormData();
    form.append('name', data.name);
    if (data.description) form.append('description', data.description);
    if (data.type) form.append('type', data.type);
    form.append('file', createReadStream(data.zipPath), {
      filename: basename(data.zipPath),
      contentType: 'application/zip',
    });
    try {
      const response = await this.client.post('/v2/themes/custom/', form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      throw errorMessage
        ? new Error(`Failed to create custom theme: ${errorMessage}`)
        : error;
    }
  }

  async updateCustomTheme(
    themeId: string,
    data: { zipPath?: string; name?: string; description?: string }
  ): Promise<any> {
    const form = new FormData();
    if (data.name) form.append('name', data.name);
    if (data.description) form.append('description', data.description);
    if (data.zipPath) {
      form.append('file', createReadStream(data.zipPath), {
        filename: basename(data.zipPath),
        contentType: 'application/zip',
      });
    }
    try {
      const response = await this.client.post(
        `/v2/themes/${themeId}/custom/`,
        form,
        {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = this.extractErrorMessage(error.response?.data);
      throw errorMessage
        ? new Error(`Failed to update custom theme: ${errorMessage}`)
        : error;
    }
  }

  /** Presigned URL of a Zid theme's or the store's own custom theme's package. */
  async getThemeDownloadUrl(themeId: string): Promise<{ url: string }> {
    const response = await this.client.get(`/v2/themes/${themeId}/download/`);
    return response.data;
  }

  async request<T = any>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
}
