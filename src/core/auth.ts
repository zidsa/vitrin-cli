import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import open from 'open';
import logger from '../utils/logger.js';

const CONFIG_DIR = join(homedir(), '.vitrin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export class AuthManager {
  private static instance: AuthManager;
  private cachedToken: string | null = null;

  private constructor() {}

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  async ensureConfigDir(): Promise<void> {
    try {
      await fs.access(CONFIG_DIR);
    } catch {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
    }
  }

  async getToken(): Promise<string | null> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    try {
      await this.ensureConfigDir();
      const configData = await fs.readFile(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);

      if (config.access_token) {
        this.cachedToken = config.access_token;
        logger.debug(`Token loaded from ${CONFIG_FILE}`);
        return this.cachedToken;
      }
    } catch (error) {
      logger.debug(`No existing token found at ${CONFIG_FILE}`);
    }

    return null;
  }

  async setToken(token: string): Promise<boolean> {
    try {
      await this.ensureConfigDir();

      const config = { access_token: token };
      await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));

      this.cachedToken = token;
      logger.debug(`Token saved to ${CONFIG_FILE}`);
      return true;
    } catch (error) {
      logger.error('Failed to save token', error as Error);
      return false;
    }
  }

  async clearToken(): Promise<void> {
    try {
      await fs.unlink(CONFIG_FILE);
      this.cachedToken = null;
    } catch (error) {
      logger.debug('No config file to clear');
    }
  }

  async login(port: number = 4444): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Starting authentication process...');

      const partnerBaseUrl =
        process.env.VITRIN_PARTNER_URL || 'https://partner.zid.sa';
      const authUrl = `${partnerBaseUrl}/cli/authorized`;
      logger.info('Opening Zid Partner Dashboard in your default browser...');

      open(authUrl).catch(() => {
        logger.warn('Failed to open browser automatically. Please visit:');
        logger.info(authUrl);
      });

      const app = express();

      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.use(
        cors({
          origin: true,
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'x-partner-token'],
          preflightContinue: false,
          optionsSuccessStatus: 204,
        })
      );

      const server = app.listen(port, () => {
        logger.info(
          `Listening for authentication callback on http://localhost:${port}/auth/callback`
        );
      });

      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 600000);

      app.options('/auth/callback', (_req: any, res: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-partner-token'
        );
        res.sendStatus(204);
      });

      app.get('/auth/callback', async (req: any, res: any) => {
        clearTimeout(timeout);
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Credentials', 'true');

        const authToken = req.query.token;

        if (authToken && typeof authToken === 'string') {
          const success = await this.setToken(authToken);

          if (success) {
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #28a745;">✓ Authentication Successful!</h1>
                  <p>You can now close this window and return to your terminal.</p>
                </body>
              </html>
            `);
            logger.success('Authentication successful!');
            server.close();
            resolve();
          } else {
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #dc3545;">✗ Authentication Failed</h1>
                  <p>Failed to save authentication token. Please try again.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('Failed to save token'));
          }
        } else {
          res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">✗ Authentication Failed</h1>
                <p>Invalid or missing authentication token.</p>
              </body>
            </html>
          `);
          logger.error('Authentication failed - invalid token');
          server.close();
          reject(new Error('Invalid authentication token'));
        }
      });

      app.post('/auth/callback', async (req: any, res: any) => {
        clearTimeout(timeout);
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Credentials', 'true');

        const authToken = req.body?.token || req.query.token;

        if (authToken && typeof authToken === 'string') {
          const success = await this.setToken(authToken);

          if (success) {
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #28a745;">✓ Authentication Successful!</h1>
                  <p>You can now close this window and return to your terminal.</p>
                </body>
              </html>
            `);
            logger.success('Authentication successful!');
            server.close();
            resolve();
          } else {
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #dc3545;">✗ Authentication Failed</h1>
                  <p>Failed to save authentication token. Please try again.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('Failed to save token'));
          }
        } else {
          res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">✗ Authentication Failed</h1>
                <p>Invalid or missing authentication token.</p>
              </body>
            </html>
          `);
          logger.error('Authentication failed - invalid token');
          server.close();
          reject(new Error('Invalid authentication token'));
        }
      });

      server.on('error', (error: Error) => {
        clearTimeout(timeout);
        logger.error('Server error during authentication', error);
        reject(error);
      });
    });
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  async validateToken(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    try {
      const axios = (await import('axios')).default;
      const baseURL = process.env.VITRIN_API_URL || 'https://api.zid.sa';

      const response = await axios.get(`${baseURL}/v1/market/partner`, {
        headers: {
          'x-partner-token': token,
          'Content-Type': 'application/json',
          'User-Agent': 'vitrin-cli/1.0.0',
          'accept-language': 'en',
        },
        timeout: 5000,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        logger.debug('Token validation failed - token expired or invalid');
        await this.clearToken();
        return false;
      }
      return true;
    }
  }

  async requireAuth(): Promise<string> {
    const token = await this.getToken();

    if (!token) {
      logger.error('No authentication token found.');
      logger.info('Starting authentication process...');

      try {
        await this.login();
        const newToken = await this.getToken();
        if (newToken) {
          return newToken;
        }
      } catch (error) {
        logger.error('Authentication failed:', error as Error);
      }

      throw new Error(
        'Authentication required. Run "vitrin login" to authenticate.'
      );
    }

    return token;
  }

  async logout(): Promise<void> {
    await this.clearToken();
    logger.info('Successfully logged out');
  }

  async getAuthInfo(): Promise<{ token: string | null }> {
    const token = await this.getToken();
    return { token };
  }

  async refreshToken(): Promise<string | null> {
    this.cachedToken = null;
    return await this.getToken();
  }
}

export default AuthManager.getInstance();
