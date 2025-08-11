import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import AuthManager from '../../../src/core/auth';

jest.mock('open');

describe('AuthManager', () => {
  const testConfigDir = join(homedir(), '.vitrin-test');
  const testConfigPath = join(testConfigDir, 'config.json');
  let authManager: AuthManager;

  beforeEach(() => {
    mkdirSync(testConfigDir, { recursive: true });
    
    authManager = new AuthManager();
    authManager['configPath'] = testConfigPath;
  });

  afterEach(() => {
    rmSync(testConfigDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('getToken', () => {
    it('should return null when no token exists', async () => {
      const token = await authManager.getToken();
      expect(token).toBeNull();
    });

    it('should return token when it exists', async () => {
      const mockToken = 'test-token-123';
      writeFileSync(testConfigPath, JSON.stringify({ 
        accessToken: mockToken,
        tokenType: 'Bearer'
      }));

      const token = await authManager.getToken();
      expect(token).toBe(mockToken);
    });
  });

  describe('saveToken', () => {
    it('should save token to config file', async () => {
      const tokenData = {
        access_token: 'new-token-456',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      await authManager.saveToken(tokenData);

      const config = JSON.parse(readFileSync(testConfigPath, 'utf-8'));
      expect(config.accessToken).toBe('new-token-456');
      expect(config.tokenType).toBe('Bearer');
    });
  });

  describe('clearToken', () => {
    it('should remove token from config', async () => {
      writeFileSync(testConfigPath, JSON.stringify({ 
        accessToken: 'token-to-clear',
        tokenType: 'Bearer'
      }));

      await authManager.clearToken();

      const config = JSON.parse(readFileSync(testConfigPath, 'utf-8'));
      expect(config.accessToken).toBeUndefined();
    });
  });

  describe('requireAuth', () => {
    it('should throw error when no token exists', async () => {
      await expect(authManager.requireAuth()).rejects.toThrow(
        'Authentication required. Run "vitrin login" first.'
      );
    });

    it('should not throw when token exists', async () => {
      writeFileSync(testConfigPath, JSON.stringify({ 
        accessToken: 'valid-token',
        tokenType: 'Bearer'
      }));

      await expect(authManager.requireAuth()).resolves.not.toThrow();
    });
  });

  describe('parseOAuthCallback', () => {
    it('should extract token from valid callback URL', () => {
      const url = 'http://localhost:4444/auth/callback?code=abc123&state=xyz';
      const result = authManager['parseOAuthCallback'](url);
      
      expect(result.code).toBe('abc123');
      expect(result.state).toBe('xyz');
    });

    it('should handle error in callback URL', () => {
      const url = 'http://localhost:4444/auth/callback?error=access_denied';
      const result = authManager['parseOAuthCallback'](url);
      
      expect(result.error).toBe('access_denied');
    });
  });
});