import { Command } from 'commander';
import { promises as fs } from 'fs';
import { isAbsolute, resolve } from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';
import api from '../core/api.js';
import { ThemeManager } from '../core/theme.js';

interface CommonOptions {
  theme?: string;
}

async function resolveThemeId(options: CommonOptions): Promise<string> {
  if (options.theme) return options.theme;
  const config = await new ThemeManager(process.cwd()).getConfig();
  if (config.id) return config.id;
  throw new Error(
    'No theme found. Run inside a linked theme directory or pass --theme <id>.'
  );
}

async function readJsonFile<T = any>(path: string): Promise<T> {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const content = await fs.readFile(abs, 'utf8');
  return JSON.parse(content) as T;
}

const printPreset = (preset: any): void => {
  logger.info(`ID: ${preset.id}`);
  logger.info(`  Type: ${preset.type}`);
  if (preset.name) {
    const name =
      typeof preset.name === 'object' ? preset.name.en || preset.name : preset.name;
    logger.info(`  Name: ${name}`);
  }
  if (Array.isArray(preset.images) && preset.images.length > 0) {
    logger.info(`  Images: ${preset.images.length}`);
  }
  if (Array.isArray(preset.presets)) {
    logger.info(`  Template entries: ${preset.presets.length}`);
  }
  if (preset.created_at) {
    logger.info(
      `  Created: ${new Date(preset.created_at).toLocaleString()}\n`
    );
  }
};

const presetsCommand = new Command('presets')
  .description('Manage theme presets (collections of template settings)')
  .option('-t, --theme <id>', 'Theme ID (defaults to linked theme in cwd)');

presetsCommand
  .command('list')
  .description('List all presets for a theme')
  .option('-T, --type <type>', 'Filter by preset type')
  .option('--json', 'Output as JSON')
  .action(
    async (options: { type?: string; json?: boolean }) => {
      try {
        await auth.requireAuth();
        const themeId = await resolveThemeId(presetsCommand.opts());

        logger.loading('Fetching presets...');
        const data = await api.listPresets(themeId, {
          page_size: 100,
          ...(options.type ? { type: options.type } : {}),
        });

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        const results = data?.results ?? data ?? [];
        if (results.length === 0) {
          logger.info('No presets found.');
          return;
        }

        logger.success(`\n🎨 Found ${results.length} preset(s):\n`);
        results.forEach(printPreset);
      } catch (error) {
        logger.error('Failed to list presets:', error as Error);
        process.exit(1);
      }
    }
  );

presetsCommand
  .command('show')
  .description('Show a single preset')
  .argument('<preset-id>', 'Preset ID')
  .option('--json', 'Output as JSON')
  .action(async (presetId: string, options: { json?: boolean }) => {
    try {
      await auth.requireAuth();
      const themeId = await resolveThemeId(presetsCommand.opts());
      const preset = await api.getPreset(themeId, presetId);
      if (options.json) {
        console.log(JSON.stringify(preset, null, 2));
        return;
      }
      printPreset(preset);
      if (Array.isArray(preset.presets)) {
        for (const item of preset.presets) {
          logger.info(`  • ${item.path}`);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch preset:', error as Error);
      process.exit(1);
    }
  });

presetsCommand
  .command('create')
  .description('Create a preset from a JSON file')
  .argument(
    '<file>',
    'Path to JSON file with { type, name, images?, presets? }'
  )
  .action(async (file: string) => {
    try {
      await auth.requireAuth();
      const themeId = await resolveThemeId(presetsCommand.opts());

      const body = await readJsonFile(file);
      if (!body.type || !body.name) {
        throw new Error('Preset JSON must include "type" and "name".');
      }

      logger.loading('Creating preset...');
      const created = await api.createPreset(themeId, body);
      logger.success(`✅ Created preset ${created.id} (${created.type})`);
    } catch (error) {
      logger.error('Failed to create preset:', error as Error);
      process.exit(1);
    }
  });

presetsCommand
  .command('update')
  .description('Update a preset from a JSON file (partial body)')
  .argument('<preset-id>', 'Preset ID')
  .argument('<file>', 'Path to JSON file with patch fields')
  .action(async (presetId: string, file: string) => {
    try {
      await auth.requireAuth();
      const themeId = await resolveThemeId(presetsCommand.opts());

      const body = await readJsonFile(file);
      logger.loading('Updating preset...');
      const updated = await api.updatePreset(themeId, presetId, body);
      logger.success(`✅ Updated preset ${updated.id}`);
    } catch (error) {
      logger.error('Failed to update preset:', error as Error);
      process.exit(1);
    }
  });

presetsCommand
  .command('delete')
  .description('Delete a preset')
  .argument('<preset-id>', 'Preset ID')
  .option('-f, --force', 'Skip confirmation')
  .action(async (presetId: string, options: { force?: boolean }) => {
    try {
      await auth.requireAuth();
      const themeId = await resolveThemeId(presetsCommand.opts());

      if (!options.force) {
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete preset ${presetId}?`,
            default: false,
          },
        ]);
        if (!confirm) {
          logger.info('Cancelled.');
          return;
        }
      }

      logger.loading('Deleting preset...');
      await api.deletePreset(themeId, presetId);
      logger.success(`✅ Deleted preset ${presetId}`);
    } catch (error) {
      logger.error('Failed to delete preset:', error as Error);
      process.exit(1);
    }
  });

presetsCommand
  .command('upload-image')
  .description('Upload an image to use in a preset (returns the public URL)')
  .argument('<file>', 'Path to image file')
  .action(async (file: string) => {
    try {
      await auth.requireAuth();
      const themeId = await resolveThemeId(presetsCommand.opts());

      const abs = isAbsolute(file) ? file : resolve(process.cwd(), file);
      await fs.access(abs);

      logger.loading('Uploading image...');
      const { url } = await api.uploadPresetImage(themeId, abs);
      logger.success(`✅ Uploaded`);
      console.log(url);
    } catch (error) {
      logger.error('Failed to upload preset image:', error as Error);
      process.exit(1);
    }
  });

presetsCommand.addHelpText(
  'after',
  `
A preset is a named collection of template settings (the "starter look" of a
theme — colors, layout choices, sample content). Each theme can have multiple
presets, distinguished by "type" (one preset per type per theme).

Preset JSON shape (for create / update):
{
  "type": "default",
  "name": { "en": "Default", "ar": "افتراضي" },
  "images": ["https://.../preview.png"],
  "presets": [
    { "path": "sections/product.jinja", "settings": { ... } }
  ]
}

Examples:
  $ vitrin presets list
  $ vitrin presets list --type default
  $ vitrin presets show <preset-id>
  $ vitrin presets create ./preset.json
  $ vitrin presets update <preset-id> ./patch.json
  $ vitrin presets delete <preset-id> --force
  $ vitrin presets upload-image ./preview.png
`
);

export default presetsCommand;
