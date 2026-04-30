import { Command } from 'commander';
import { resolve, basename } from 'path';
import logger from '../utils/logger.js';
import buildService from '../utils/build.js';
import type { BuildOptions } from '../types/index.js';

const buildCommand = new Command('build')
  .description('Build a theme package')
  .argument('[path]', 'Path to theme directory', '.')
  .option('-n, --name <name>', 'Name for the build output')
  .option('-o, --output <path>', 'Output directory for the build')
  .option('-c, --compression <level>', 'Compression level (0-9)', '9')
  .option('-e, --exclude <patterns...>', 'Exclude patterns')
  .option('--validate', 'Validate theme structure before building')
  .action(async (themePath: string, options) => {
    try {
      const resolvedPath = resolve(themePath);
      const buildName = options.name || basename(resolvedPath);

      logger.info(`Building theme: ${buildName}`);
      logger.info(`Source path: ${resolvedPath}`);

      if (options.validate) {
        logger.loading('Validating theme structure...');
        const isValid = await buildService.validateThemeStructure(resolvedPath);
        if (!isValid) {
          logger.error('Theme validation failed');
          process.exit(1);
        }
        logger.success('Theme structure is valid');
      }

      logger.loading('Compiling theme assets...');
      const assetResult = await buildService.runAssetBuild(
        resolvedPath,
        line => logger.info(`  ${line}`)
      );
      if (!assetResult.ran) {
        logger.info(`Asset build skipped: ${assetResult.reason}`);
      } else {
        logger.success(`Assets built with ${assetResult.installer}`);
      }

      logger.loading('Cleaning .DS_Store files...');
      await buildService.removeDSStore(resolvedPath);

      const buildOptions: BuildOptions = {
        name: buildName,
        path: resolvedPath,
        output: options.output,
        compression: parseInt(options.compression),
        exclude: options.exclude,
        useTemp: false,
      };

      const outputPath = await buildService.zipTheme(
        buildName,
        resolvedPath,
        buildOptions
      );
      logger.success(`Build completed: ${outputPath}`);
    } catch (error) {
      logger.error('Build failed:', error as Error);
      process.exit(1);
    }
  });

buildCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin build                          Build current directory
  $ vitrin build ./my-theme              Build specific theme
  $ vitrin build --name my-theme         Build with custom name
  $ vitrin build --validate              Validate before building
  $ vitrin build --exclude "*.log" "tmp/*"  Exclude specific patterns
`
);

export default buildCommand;
