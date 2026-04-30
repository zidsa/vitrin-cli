import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import logger from './logger.js';

export const REQUIRED_THEME_FILES = [
  'layout.jinja',
  'header.jinja',
  'footer.jinja',
  'templates/home.jinja',
] as const;

export const DISCOURAGED_THEME_TEMPLATES = [
  'templates/account_profile.jinja',
  'templates/account_orders.jinja',
  'templates/account_wishlist.jinja',
  'templates/loyalty_program.jinja',
  'templates/address_form.jinja',
] as const;

export interface ThemeStructureValidation {
  valid: boolean;
  resolvedPath: string;
  missing: string[];
}

export async function validateThemeStructure(
  themePath: string
): Promise<boolean> {
  const result = await validateThemeStructureDetailed(themePath);
  return result.valid;
}

export async function validateThemeStructureDetailed(
  themePath: string
): Promise<ThemeStructureValidation> {
  const resolvedPath = resolve(themePath || process.cwd());

  try {
    await fs.access(resolvedPath);
  } catch {
    logger.error(`Theme path does not exist: ${resolvedPath}`);
    return { valid: false, resolvedPath, missing: ['<directory>'] };
  }

  const missing: string[] = [];

  for (const file of REQUIRED_THEME_FILES) {
    try {
      await fs.access(join(resolvedPath, file));
    } catch {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    logger.error(
      `Missing required files in ${resolvedPath}: ${missing.join(', ')}`
    );
    return { valid: false, resolvedPath, missing };
  }

  return { valid: true, resolvedPath, missing: [] };
}

export async function findDiscouragedTemplates(
  themePath: string
): Promise<string[]> {
  const resolvedPath = resolve(themePath || process.cwd());
  const found: string[] = [];

  for (const template of DISCOURAGED_THEME_TEMPLATES) {
    try {
      await fs.access(join(resolvedPath, template));
      found.push(template);
    } catch {
      continue;
    }
  }

  return found;
}

export async function removeDiscouragedTemplates(
  themePath: string,
  templates: readonly string[]
): Promise<void> {
  const resolvedPath = resolve(themePath || process.cwd());

  for (const template of templates) {
    const fullPath = join(resolvedPath, template);
    try {
      await fs.unlink(fullPath);
      logger.debug(`Removed discouraged template: ${fullPath}`);
    } catch (error) {
      logger.debug(`Failed to remove ${fullPath}: ${error}`);
    }
  }
}

export function appendValidatePath(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/validate';
    return parsed.toString();
  } catch {
    const [base = url, query = ''] = url.split('?');
    const cleaned = base.replace(/\/+$/, '');
    return query ? `${cleaned}/validate?${query}` : `${cleaned}/validate`;
  }
}
