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

  private extractErrorMessage(data: any): string | null {
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
      if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        return data.non_field_errors[0];
      }
    }
    
    const keys = Object.keys(data);
    for (const key of keys) {
      if (key !== 'status' && key !== 'statusCode' && data[key]) {
        if (typeof data[key] === 'string') {
          return data[key];
        }
        if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'string') {
          return data[key][0];
        }
      }
    }
    
    return null;
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async config => {
        try {
          config.baseURL = this.getBaseURL();

          const token = await auth.getToken();
          if (token) {
            // v1 endpoints use x-partner-token, v2 endpoints use Bearer token
            if (config.url?.includes('/v1/')) {
              config.headers['x-partner-token'] = token;
            } else {
              config.headers['Authorization'] = `Bearer ${token}`;
            }
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
          
          const errorDetail = this.extractErrorMessage(error.response?.data);
          await auth.clearToken();
          
          logger.warn('Your session has expired or is invalid.');
          
          const isInteractive = process.stdout.isTTY && !process.env.CI;
          if (isInteractive) {
            logger.info('Would you like to authenticate now? Starting login process...');
            
            try {
              await auth.login();
              logger.success('Re-authentication successful! Retrying your request...');
              
              const originalRequest = error.config;
              const newToken = await auth.getToken();
              if (newToken && originalRequest) {
                // v1 endpoints use x-partner-token, v2 endpoints use Bearer token
                if (originalRequest.url?.includes('/v1/')) {
                  originalRequest.headers['x-partner-token'] = newToken;
                } else {
                  originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                }
                return this.client.request(originalRequest);
              }
            } catch (loginError) {
              logger.error('Re-authentication failed. Please run "vitrin login" manually.');
            }
          }
          
          if (errorDetail && errorDetail.toLowerCase().includes('email')) {
            throw new Error(`Authentication failed: ${errorDetail}`);
          } else if (errorDetail) {
            throw new Error(
              `Authentication failed: ${errorDetail}. Please run "vitrin login" to re-authenticate.`
            );
          } else {
            throw new Error(
              'Authentication expired. Please run "vitrin login" to re-authenticate.'
            );
          }
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
            throw new Error(`Server error (${status}). Please try again later.`);
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

  async updateThemeVersionStatus(
    themeId: string,
    versionId: string,
    status: 'draft' | 'pending_review' | 'published' | 'archived'
  ): Promise<any> {
    try {
      const response = await this.client.post(
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
