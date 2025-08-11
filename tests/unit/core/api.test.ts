import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';
import { ApiService } from '../../../src/core/api';
import { mockApiResponse, createMockTheme, createMockVersion } from '../../setup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiService', () => {
  let apiService: ApiService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: {
        baseURL: 'https://testing-api.zid.sa',
        headers: {},
      },
    };

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
    apiService = new ApiService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default URL when no environment variable is set', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://testing-api.zid.sa',
        })
      );
    });

    it('should use environment variable when set', () => {
      process.env.VITRIN_API_URL = 'https://custom-api.zid.sa';
      new ApiService();
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom-api.zid.sa',
        })
      );
      delete process.env.VITRIN_API_URL;
    });
  });

  describe('getThemes', () => {
    it('should fetch themes successfully', async () => {
      const mockThemes = {
        count: 2,
        results: [createMockTheme(), createMockTheme()],
      };

      mockAxiosInstance.get.mockResolvedValue(mockApiResponse(mockThemes));

      const result = await apiService.getThemes();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/themes/');
      expect(result).toEqual(mockThemes);
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(apiService.getThemes()).rejects.toThrow('Network error');
    });
  });

  describe('createTheme', () => {
    it('should create a theme successfully', async () => {
      const themeData = {
        name: { en: 'New Theme' },
        description: { en: 'Theme description' },
        slug: 'new-theme',
      };

      const mockTheme = createMockTheme();
      mockAxiosInstance.post.mockResolvedValue(mockApiResponse(mockTheme));

      const result = await apiService.createTheme(themeData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v2/themes/', themeData);
      expect(result).toEqual(mockTheme);
    });
  });

  describe('createThemeVersion', () => {
    it('should create a theme version successfully', async () => {
      const themeId = 'theme-123';
      const versionData = {
        version: '1.0.0',
        minimum_api_version: '1.0',
        changelog: { en: 'Initial version' },
      };

      const mockVersion = createMockVersion();
      mockAxiosInstance.post.mockResolvedValue(mockApiResponse(mockVersion));

      const result = await apiService.createThemeVersion(themeId, versionData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/v2/themes/${themeId}/versions/`,
        versionData
      );
      expect(result).toEqual(mockVersion);
    });
  });

  describe('installTheme', () => {
    it('should install a theme on a store', async () => {
      const storeId = '123';
      const themeId = 'theme-456';
      const versionId = 'version-789';

      const mockInstallation = { id: 'install-123', status: 'installed' };
      mockAxiosInstance.post.mockResolvedValue(mockApiResponse(mockInstallation));

      const result = await apiService.installTheme(storeId, themeId, versionId);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v2/stores/themes/install/',
        { theme_id: themeId, version_id: versionId },
        { headers: { 'store-id': storeId } }
      );
      expect(result).toEqual(mockInstallation);
    });
  });
});