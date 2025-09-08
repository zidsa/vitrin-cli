#!/usr/bin/env node
import { Command } from 'commander';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';

const logoutCommand = new Command('logout')
  .description('Log out from Zid Partner account')
  .action(async () => {
    try {
      await auth.logout();
      logger.success('Successfully logged out from Zid Partner account');
    } catch (error) {
      logger.error('Failed to logout:', error as Error);
      process.exit(1);
    }
  });

export default logoutCommand;