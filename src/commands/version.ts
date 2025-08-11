import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';

const versionCommand = new Command('version')
  .description('Show version information')
  .option('--json', 'Output as JSON')
  .action(async options => {
    try {
      const packagePath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

      const versionInfo = {
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        author: packageJson.author,
        homepage: packageJson.homepage || 'https://github.com/zidsa/vitrin-cli',
        license: packageJson.license,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      if (options.json) {
        console.log(JSON.stringify(versionInfo, null, 2));
      } else {
        console.log(`${packageJson.name} v${packageJson.version}`);
        console.log(`${packageJson.description}`);
        console.log('');
        console.log('Environment:');
        console.log(`  Node.js: ${process.version}`);
        console.log(`  Platform: ${process.platform}`);
        console.log(`  Architecture: ${process.arch}`);
        console.log('');
        console.log(
          'Author:',
          typeof packageJson.author === 'string'
            ? packageJson.author
            : packageJson.author.name
        );
        console.log('License:', packageJson.license);
        console.log('Homepage:', versionInfo.homepage);
      }
    } catch (error) {
      logger.error('Failed to get version information:', error as Error);
      process.exit(1);
    }
  });

export default versionCommand;
