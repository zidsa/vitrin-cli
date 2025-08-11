import { Command } from 'commander';
import logger from '../utils/logger.js';

const uiCommand = new Command('ui')
  .description('Launch interactive TUI mode')
  .action(async () => {
    try {
      const { startTUI } = await import('../tui/index.js');
      const { waitUntilExit } = startTUI();
      await waitUntilExit();
    } catch (error) {
      logger.error('Failed to start TUI:', error as Error);
      logger.info('Falling back to command-line mode');
      logger.info('Run "vitrin --help" for available commands');
      process.exit(1);
    }
  });

uiCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin ui              Launch interactive TUI
  $ vitrin                 Same as 'vitrin ui' (launches TUI by default)

Note:
  The TUI provides a modern, interactive interface for all Vitrin CLI features.
  You can still use traditional command-line mode with specific commands.
`
);

export default uiCommand;
