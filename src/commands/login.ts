import { Command } from 'commander';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';

const loginCommand = new Command('login')
  .description('Authenticate with Zid Partner Dashboard')
  .option('-p, --port <port>', 'Port for callback server', '4444')
  .option('-f, --force', 'Force re-authentication even if already logged in')
  .action(async options => {
    try {
      if (!options.force) {
        const isAuthenticated = await auth.isAuthenticated();
        if (isAuthenticated) {
          logger.success('Already authenticated with Zid Partner Dashboard');
          logger.info('Use --force to re-authenticate');
          return;
        }
      }

      if (options.force) {
        logger.info('Forcing re-authentication...');
        await auth.clearToken();
      }

      const port = parseInt(options.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error('Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }

      logger.info('Authenticating with Zid Partner Dashboard...');
      await auth.login(port);

      logger.success('Successfully authenticated with Zid Partner Dashboard!');
      logger.info(
        'You can now use other vitrin commands that require authentication.'
      );
    } catch (error) {
      logger.error('Authentication failed:', error as Error);
      process.exit(1);
    }
  });

loginCommand.addHelpText(
  'after',
  `
Examples:
  $ vitrin login                    Authenticate with default port (4444)
  $ vitrin login --port 5000       Authenticate with custom port
  $ vitrin login --force           Force re-authentication

Note:
  This command will open your default browser to authenticate with the Zid Partner Dashboard.
  If the browser doesn't open automatically, you'll see a URL to visit manually.
`
);

export default loginCommand;
