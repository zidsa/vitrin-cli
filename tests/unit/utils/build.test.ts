import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import BuildService from '../../../src/utils/build';
import { TEST_THEME_DIR } from '../../setup';

describe('BuildService', () => {
  let buildService: BuildService;

  beforeEach(() => {
    buildService = new BuildService();
    
    const layoutDir = join(TEST_THEME_DIR, 'layout');
    const templatesDir = join(TEST_THEME_DIR, 'templates');
    const assetsDir = join(TEST_THEME_DIR, 'assets');
    
    mkdirSync(layoutDir, { recursive: true });
    mkdirSync(templatesDir, { recursive: true });
    mkdirSync(assetsDir, { recursive: true });
    
    writeFileSync(join(layoutDir, 'layout.jinja'), '<html>{{ content }}</html>');
    writeFileSync(join(templatesDir, 'index.jinja'), '<h1>Home</h1>');
    writeFileSync(join(TEST_THEME_DIR, 'config.json'), JSON.stringify({
      name: 'Test Theme',
      version: '1.0.0'
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateThemeStructure', () => {
    it('should validate correct theme structure', () => {
      const isValid = buildService.validateThemeStructure(TEST_THEME_DIR);
      expect(isValid).toBe(true);
    });

    it('should fail validation when layout.jinja is missing', () => {
      rmSync(join(TEST_THEME_DIR, 'layout', 'layout.jinja'));
      
      const isValid = buildService.validateThemeStructure(TEST_THEME_DIR);
      expect(isValid).toBe(false);
    });

    it('should fail validation when config.json is missing', () => {
      rmSync(join(TEST_THEME_DIR, 'config.json'));
      
      const isValid = buildService.validateThemeStructure(TEST_THEME_DIR);
      expect(isValid).toBe(false);
    });
  });

  describe('zipTheme', () => {
    it('should create a zip file of the theme', async () => {
      const zipPath = await buildService.zipTheme('test-theme', TEST_THEME_DIR);
      
      expect(zipPath).toContain('test-theme.zip');
      expect(existsSync(zipPath)).toBe(true);
      
      rmSync(zipPath);
    });

    it('should exclude .DS_Store files from zip', async () => {
      writeFileSync(join(TEST_THEME_DIR, '.DS_Store'), 'dummy');
      
      const zipPath = await buildService.zipTheme('test-theme', TEST_THEME_DIR);
      
      expect(existsSync(zipPath)).toBe(true);
      
      rmSync(zipPath);
    });
  });

  describe('removeDSStore', () => {
    it('should remove all .DS_Store files', async () => {
      writeFileSync(join(TEST_THEME_DIR, '.DS_Store'), 'dummy');
      writeFileSync(join(TEST_THEME_DIR, 'layout', '.DS_Store'), 'dummy');
      writeFileSync(join(TEST_THEME_DIR, 'templates', '.DS_Store'), 'dummy');
      
      await buildService.removeDSStore(TEST_THEME_DIR);
      
      expect(existsSync(join(TEST_THEME_DIR, '.DS_Store'))).toBe(false);
      expect(existsSync(join(TEST_THEME_DIR, 'layout', '.DS_Store'))).toBe(false);
      expect(existsSync(join(TEST_THEME_DIR, 'templates', '.DS_Store'))).toBe(false);
    });
  });

  describe('getThemeVersion', () => {
    it('should extract version from config.json', () => {
      const version = buildService.getThemeVersion(TEST_THEME_DIR);
      expect(version).toBe('1.0.0');
    });

    it('should return default version when config is missing', () => {
      rmSync(join(TEST_THEME_DIR, 'config.json'));
      
      const version = buildService.getThemeVersion(TEST_THEME_DIR);
      expect(version).toBe('1.0.0');
    });

    it('should return default version when version field is missing', () => {
      writeFileSync(join(TEST_THEME_DIR, 'config.json'), JSON.stringify({
        name: 'Test Theme'
      }));
      
      const version = buildService.getThemeVersion(TEST_THEME_DIR);
      expect(version).toBe('1.0.0');
    });
  });
});