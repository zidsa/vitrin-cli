import { Command } from 'commander';
import { resolve } from 'path';
import logger from '../utils/logger.js';
import { generateTranslations } from '../utils/translations.js';

const translationsCommand = new Command('translations')
  .description('Extract, update, and compile theme translations (.po/.mo)')
  .argument('[path]', 'Path to theme directory', '.')
  .option(
    '-l, --languages <langs...>',
    'Languages to update/compile',
    ['ar']
  )
  .action(async (themePath: string, options: { languages: string[] }) => {
    try {
      const resolvedPath = resolve(themePath);
      logger.info(`Theme path: ${resolvedPath}`);

      await generateTranslations({
        themePath: resolvedPath,
        languages: options.languages,
      });

      logger.success('Translations generated successfully');
    } catch (error) {
      logger.error('Failed to generate translations:', error as Error);
      process.exit(1);
    }
  });

translationsCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin translations                       Run for current directory (lang: ar)
  $ vitrin translations ./my-theme            Run for a specific theme
  $ vitrin translations -l ar en fr           Multiple languages
`
);

export default translationsCommand;
