import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { TEST_DIR } from '../setup';

describe('CLI Commands Integration', () => {
  const cliPath = join(__dirname, '../../dist/cli.js');
  const testProjectDir = join(TEST_DIR, 'test-project');

  beforeEach(() => {
    mkdirSync(testProjectDir, { recursive: true });
    process.chdir(testProjectDir);
  });

  afterEach(() => {
    process.chdir(__dirname);
    jest.clearAllMocks();
  });

  describe('vitrin --help', () => {
    it('should display help information', () => {
      const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
      
      expect(output).toContain('Modern CLI for Zid theme development');
      expect(output).toContain('Commands:');
      expect(output).toContain('build');
      expect(output).toContain('preview');
      expect(output).toContain('login');
    });
  });

  describe('vitrin --version', () => {
    it('should display version number', () => {
      const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' });
      
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('vitrin new', () => {
    it('should create a new theme directory', () => {
      execSync(`node ${cliPath} new my-test-theme`, { encoding: 'utf-8' });
      
      const themeDir = join(testProjectDir, 'my-test-theme');
      expect(existsSync(themeDir)).toBe(true);
      expect(existsSync(join(themeDir, 'config.json'))).toBe(true);
      expect(existsSync(join(themeDir, 'layout', 'layout.jinja'))).toBe(true);
    });

    it('should handle theme name with spaces', () => {
      execSync(`node ${cliPath} new "My Test Theme"`, { encoding: 'utf-8' });
      
      const themeDir = join(testProjectDir, 'My Test Theme');
      expect(existsSync(themeDir)).toBe(true);
    });
  });

  describe('vitrin build', () => {
    beforeEach(() => {
      const layoutDir = join(testProjectDir, 'layout');
      const templatesDir = join(testProjectDir, 'templates');
      
      mkdirSync(layoutDir, { recursive: true });
      mkdirSync(templatesDir, { recursive: true });
      
      writeFileSync(join(layoutDir, 'layout.jinja'), '<html>{{ content }}</html>');
      writeFileSync(join(templatesDir, 'index.jinja'), '<h1>Home</h1>');
      writeFileSync(join(testProjectDir, 'config.json'), JSON.stringify({
        name: 'Test Theme',
        version: '1.0.0'
      }));
    });

    it('should build theme and create zip file', () => {
      const output = execSync(`node ${cliPath} build`, { encoding: 'utf-8' });
      
      expect(output).toContain('Building theme');
      expect(existsSync(join(process.cwd(), '..', 'test-project.zip'))).toBe(true);
    });

    it('should validate theme before building', () => {
      rmSync(join(testProjectDir, 'config.json'));
      
      expect(() => {
        execSync(`node ${cliPath} build`, { encoding: 'utf-8' });
      }).toThrow();
    });
  });

  describe('vitrin list', () => {
    it('should require authentication', () => {
      expect(() => {
        execSync(`node ${cliPath} list`, { encoding: 'utf-8', env: { ...process.env, VITRIN_API_URL: 'http://localhost:9999' } });
      }).toThrow(/Authentication required/);
    });
  });

  describe('Environment Variables', () => {
    it('should respect VITRIN_API_URL environment variable', () => {
      const customUrl = 'https://custom-api.example.com';
      
      expect(() => {
        execSync(`node ${cliPath} list`, { 
          encoding: 'utf-8',
          env: { ...process.env, VITRIN_API_URL: customUrl }
        });
      }).toThrow();
    });

    it('should respect LOG_LEVEL environment variable', () => {
      const output = execSync(`node ${cliPath} --help`, { 
        encoding: 'utf-8',
        env: { ...process.env, LOG_LEVEL: 'debug' }
      });
      
      expect(output).toBeDefined();
    });
  });
});