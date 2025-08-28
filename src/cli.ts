#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import logger from './utils/logger.js';
import buildCommand from './commands/build.js';
import newCommand from './commands/new.js';
import loginCommand from './commands/login.js';
import listCommand from './commands/list.js';
import previewCommand from './commands/preview.js';
import updateCommand from './commands/update.js';
import versionCommand from './commands/version.js';
import activateCommand from './commands/activate.js';
import installCommand from './commands/install.js';
import uiCommand from './commands/ui.js';
import themesCommand from './commands/themes.js';
import initCommand from './commands/init.js';
import pushCommand from './commands/push.js';
import { checkForUpdates } from './utils/versionCheck.js';

const loadSavedSettings = async () => {
  try {
    const configFile = join(homedir(), '.vitrin', 'config.json');
    const data = await fs.readFile(configFile, 'utf8');
    const savedConfig = JSON.parse(data) as Record<string, string>;
    
    Object.entries(savedConfig).forEach(([key, value]) => {
      if (key.startsWith('VITRIN_') && !process.env[key]) {
        process.env[key] = String(value);
      }
    });
  } catch {
  }
};

await loadSavedSettings();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string };

const program = new Command();

program
  .name('vitrin')
  .description('Modern CLI for Zid theme development')
  .version(packageJson.version, '-v, --version', 'Show version number')
  .helpOption('-h, --help', 'Show help information')
  .configureHelp({
    sortSubcommands: true,
    showGlobalOptions: true,
  });

program
  .option('-d, --debug', 'Enable debug logging')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output');

program.exitOverride(err => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  logger.error(`Command failed: ${err.message}`);
  process.exit(1);
});

program.hook('preAction', thisCommand => {
  const options = thisCommand.opts();

  if (options.debug) {
    process.env.LOG_LEVEL = 'debug';
    logger.setLevel('debug');
  }

  if (options.quiet) {
    process.env.LOG_LEVEL = 'error';
    logger.setLevel('error');
  }

  if (options.noColor) {
    process.env.NO_COLOR = '1';
    logger.disableColors();
  }
});
program.addCommand(uiCommand);
program.addCommand(initCommand);
program.addCommand(pushCommand);
program.addCommand(buildCommand);
program.addCommand(newCommand);
program.addCommand(loginCommand);
program.addCommand(listCommand);
program.addCommand(themesCommand);
program.addCommand(previewCommand);
program.addCommand(updateCommand);
program.addCommand(versionCommand);
program.addCommand(activateCommand);
program.addCommand(installCommand);

program.on('--help', () => {
  console.log('');
  console.log('Getting Started:');
  console.log('  1. vitrin login              Authenticate with Zid');
  console.log('  2. vitrin new                Create new theme');
  console.log('  3. vitrin push               Push theme to Zid');
  console.log('');
  console.log('Development:');
  console.log('  $ vitrin build              Build theme package');
  console.log('  $ vitrin preview            Preview on dev store');
  console.log('');
  console.log('Theme Management:');
  console.log('  $ vitrin themes list        List server themes');
  console.log('  $ vitrin update <id>        Update theme version');
  console.log('  $ vitrin push               Push theme to Zid');
  console.log('');
  console.log('For command details:');
  console.log('  $ vitrin <command> --help');
});

program.on('command:*', operands => {
  logger.error(`Unknown command: ${operands[0]}`);
  logger.info('Run "vitrin --help" for available commands');
  process.exit(1);
});

async function main(): Promise<void> {
  try {
    void checkForUpdates();
    
    if (process.argv.length === 2) {
      const { startTUI } = await import('./tui/index.js');
      const { waitUntilExit } = startTUI();
      await waitUntilExit();
    } else {
      await program.parseAsync(process.argv);
    }
  } catch (error) {
    logger.error('An unexpected error occurred:', error as Error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason as Error);
  process.exit(1);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, gracefully shutting down...');
  process.exit(0);
});

void main();
