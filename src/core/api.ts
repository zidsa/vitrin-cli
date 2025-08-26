import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { basename } from 'path';
import logger from '../utils/logger.js';
import auth from './auth.js';
import type {
  Partner,
  ThemesResponse,
  DevStoresResponse,
  ApiResponse,
} from '../types/index.js';

export class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vitrin-cli/1.0.0',
        'accept-language': 'en',
      },
    });

    this.setupInterceptors();
  }

  private getBaseURL(): string {
    return process.env.VITRIN_API_URL || 'https://api.zid.sa';
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async config => {
        try {
          config.baseURL = this.getBaseURL();

          const token = await auth.getToken();
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
            logger.debug(`Added auth token to request: ${config.url}`);

            if (process.env.LOG_LEVEL === 'debug') {
              console.error('[DEBUG API REQUEST]', {
                url: (config.baseURL || '') + (config.url || ''),
                method: config.method,
                headers: config.headers,
                data: config.data,
                params: config.params,
              });
            }
          } else {
            logger.debug('No auth token available');
            if (process.env.LOG_LEVEL === 'debug') {
              console.error(
                '[DEBUG] No auth token found for request to:',
                config.url
              );
            }
          }
        } catch (error) {
          logger.debug('Error getting auth token');
        }
        return config;
      },
      error => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      response => {
        if (process.env.LOG_LEVEL === 'debug') {
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

        if (process.env.LOG_LEVEL === 'debug') {
          console.error('[DEBUG API RESPONSE ERROR]', {
            url: error.config?.url,
            method: error.config?.method,
            status: status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers,
          });
        }

        if (status === 401) {
          logger.debug(
            `API returned 401. Response: ${JSON.stringify(error.response?.data)}`
          );
          await auth.clearToken();
          throw new Error(
            'Authentication expired. Please run "vitrin login" to re-authenticate.'
          );
        }

        if (status === 403) {
          logger.debug(
            `API returned 403. Response: ${JSON.stringify(error.response?.data)}`
          );
          throw new Error(
            'Access denied. Check your permissions for this resource.'
          );
        }

        if (status >= 500) {
          throw new Error(`Server error (${status}). Please try again later.`);
        }

        return Promise.reject(error);
      }
    );
  }

  async getPartnerData(): Promise<Partner> {
    try {
      const token = await auth.getToken();
      const response = await this.client.get<any>('/v1/market/partner', {
        headers: {
          'x-partner-token': token || '',
        },
      });

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
  }): Promise<ThemesResponse> {
    try {
      const response = await this.client.get('/v2/themes/', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch themes', error as Error);
      throw error;
    }
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
      const token = await auth.getToken();
      const response = await this.client.get<any>('/v1/market/dev-stores', {
        headers: {
          'x-partner-token': token || '',
        },
      });

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
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/themes/', data);
      return response.data;
    } catch (error) {
      logger.error('Failed to create theme', error as Error);
      throw error;
    }
  }

  async createThemeVersion(
    themeId: string,
    data: {
      version: string;
      minimum_api_version: string;
      changelog: { en: string; ar?: string };
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
    } catch (error) {
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

  async updateThemeVersionStatus(
    themeId: string,
    versionId: string,
    status: 'published' | 'draft'
  ): Promise<any> {
    try {
      const response = await this.client.patch(
        `/v2/themes/${themeId}/versions/${versionId}/status/`,
        { status }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to update theme version status', error as Error);
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
      const errorDetail =
        error.response?.data?.theme_id?.[0] ||
        error.response?.data ||
        error.message;
      logger.error('Failed to install theme:', errorDetail);
      throw error;
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
    } catch (error) {
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

  setBaseURL(baseURL: string): void {
    process.env.VITRIN_API_URL = baseURL;
  }

  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.client.defaults.headers, headers);
  }

  async request<T = any>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
}

const apiService = new ApiService();
export default apiService;
