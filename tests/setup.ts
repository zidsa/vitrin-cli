import { jest } from '@jest/globals';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

export const TEST_DIR = join(__dirname, 'fixtures');
export const TEST_THEME_DIR = join(TEST_DIR, 'test-theme');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_THEME_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error,
};

export const mockApiResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

export const createMockTheme = () => ({
  id: 'test-theme-123',
  name: { en: 'Test Theme' },
  slug: 'test-theme',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const createMockVersion = () => ({
  id: 'version-456',
  theme: 'test-theme-123',
  version: '1.0.0',
  status: 'draft',
  created_at: new Date().toISOString(),
});