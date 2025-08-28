import { execSync } from 'child_process';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function checkForUpdates(): Promise<void> {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const currentVersion = JSON.parse(readFileSync(packagePath, 'utf8')).version;
    
    const latestVersion = execSync('npm view @zidsa/vitrin-cli version', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (latestVersion && latestVersion !== currentVersion) {
      console.log(chalk.yellow.bold('\n📦 Update available!'));
      console.log(chalk.yellow(`Current version: ${currentVersion}`));
      console.log(chalk.yellow(`Latest version: ${latestVersion}`));
      console.log(chalk.cyan('Run: npm update -g @zidsa/vitrin-cli\n'));
    }
  } catch {
    // Silently ignore errors (offline, npm issues, etc.)
  }
}