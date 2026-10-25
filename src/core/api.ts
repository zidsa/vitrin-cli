import { ApiService } from './vitrinCore.js';
import auth from './auth.js';
import logger from '../utils/logger.js';

// vitrin-core's API client with the CLI's partner session: the token from
// ~/.vitrin/config.json, and an interactive re-login when it has expired.
const apiService = new ApiService({
  tokenProvider: {
    async getCredentials() {
      const token = await auth.getToken();
      return token ? { kind: 'partner', token } : null;
    },

    async onUnauthorized(errorDetail) {
      const isTokenValid = await auth.validateToken();

      if (isTokenValid) {
        return new Error(
          errorDetail
            ? `Unauthorized: ${errorDetail}`
            : 'Unauthorized access to this resource. Please check your permissions or resource ID.'
        );
      }

      await auth.clearToken();
      logger.warn('Your session has expired or is invalid.');

      const isInteractive = process.stdout.isTTY && !process.env.CI;
      if (isInteractive) {
        logger.info(
          'Would you like to authenticate now? Starting login process...'
        );

        try {
          await auth.login();
          logger.success(
            'Re-authentication successful! Retrying your request...'
          );
          return 'retry';
        } catch (loginError) {
          logger.error(
            'Re-authentication failed. Please run "vitrin login" manually.'
          );
        }
      }

      if (errorDetail && errorDetail.toLowerCase().includes('email')) {
        return new Error(`Authentication failed: ${errorDetail}`);
      } else if (errorDetail) {
        return new Error(
          `Authentication failed: ${errorDetail}. Please run "vitrin login" to re-authenticate.`
        );
      }
      return new Error(
        'Authentication expired. Please run "vitrin login" to re-authenticate.'
      );
    },
  },
  baseURL: () => process.env.VITRIN_API_URL || 'https://api.zid.sa',
  userAgent: 'vitrin-cli/1.0.0',
  debug: () => process.env.LOG_LEVEL === 'debug',
});

export { ApiService };
export default apiService;
