import { mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

declare const __dirname: string;

const here =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

export const TEST_DIR = join(here, 'fixtures');
export const TEST_THEME_DIR = join(TEST_DIR, 'test-theme');

declare const beforeAll: (fn: () => void) => void;
declare const afterAll: (fn: () => void) => void;

const noop = (): void => undefined;

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_THEME_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

global.console = {
  ...console,
  log: noop,
  info: noop,
  warn: noop,
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
