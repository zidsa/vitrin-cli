import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import auth from '../core/auth.js';
import api from '../core/api.js';
import { ThemeManager } from '../core/theme.js';
import {
  ALLOWED_STATUS_TRANSITIONS,
  STATUS_LABELS,
  THEME_VERSION_STATUSES,
  getPartnerAllowedTransitions,
  isThemeVersionStatus,
  type ThemeVersionStatus,
} from '../core/themeStatus.js';

interface StatusOptions {
  theme?: string;
  version?: string;
  target?: string;
  yes?: boolean;
}

const dimCurrent = (s: string): string => chalk.bold(s);

async function resolveThemeId(options: StatusOptions): Promise<string> {
  if (options.theme) return options.theme;

  const config = await new ThemeManager(process.cwd()).getConfig();
  if (config.id) return config.id;

  throw new Error(
    'No theme found. Run inside a linked theme directory or pass --theme <id>.'
  );
}

async function resolveVersion(
  themeId: string,
  options: StatusOptions
): Promise<{ id: string; status: ThemeVersionStatus; version: string }> {
  if (options.version) {
    const v = await api.getThemeVersion(themeId, options.version);
    return { id: v.id, status: v.status, version: v.version };
  }

  const list = await api.listThemeVersions(themeId, { page_size: 1 });
  const latest = list?.results?.[0];
  if (!latest) {
    throw new Error(
      `Theme ${themeId} has no versions yet. Push a version first.`
    );
  }
  return { id: latest.id, status: latest.status, version: latest.version };
}

async function pickTargetStatus(
  current: ThemeVersionStatus,
  preset?: string
): Promise<ThemeVersionStatus> {
  const info = getPartnerAllowedTransitions(current);

  if (info.partnerBlocked) {
    throw new Error(info.reason ?? `No transitions allowed from ${current}.`);
  }

  if (info.allowed.length === 0) {
    throw new Error(
      `No transitions allowed from "${STATUS_LABELS[current]}" (terminal state).`
    );
  }

  if (preset) {
    if (!isThemeVersionStatus(preset)) {
      throw new Error(
        `Unknown status "${preset}". Valid: ${THEME_VERSION_STATUSES.join(', ')}.`
      );
    }
    if (!info.allowed.includes(preset)) {
      throw new Error(
        `Transition ${current} → ${preset} is not allowed for partners. Allowed: ${info.allowed.join(', ') || '(none)'}`
      );
    }
    return preset;
  }

  const { target } = await inquirer.prompt<{ target: ThemeVersionStatus }>([
    {
      type: 'list',
      name: 'target',
      message: `Current status: ${STATUS_LABELS[current]}. Move to:`,
      choices: info.allowed.map(s => ({
        name: `${STATUS_LABELS[s]} (${s})`,
        value: s,
      })),
    },
  ]);
  return target;
}

const statusCommand = new Command('status')
  .description('View or change a theme version status')
  .option('-t, --theme <id>', 'Theme ID (defaults to linked theme in cwd)')
  .option('-v, --version <id>', 'Version ID (defaults to latest version)')
  .option(
    '-s, --target <status>',
    `Target status (${THEME_VERSION_STATUSES.join('|')})`
  )
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: StatusOptions) => {
    try {
      await auth.requireAuth();

      const themeId = await resolveThemeId(options);
      const version = await resolveVersion(themeId, options);

      const info = getPartnerAllowedTransitions(version.status);

      logger.info(
        `Theme ${chalk.cyan(themeId)} · version ${chalk.cyan(version.version)} (${chalk.dim(version.id)})`
      );
      logger.info(
        `Current status: ${chalk.bold(STATUS_LABELS[version.status])} (${version.status})`
      );

      if (info.partnerBlocked) {
        logger.warn(info.reason ?? 'No transitions allowed.');
        logger.info(
          `Backend table: ${dimCurrent(version.status)} → ${(ALLOWED_STATUS_TRANSITIONS[version.status] ?? []).join(', ') || '(none)'} (admin only)`
        );
        return;
      }

      logger.info(
        `Allowed transitions: ${info.allowed.length > 0 ? info.allowed.map(s => chalk.green(s)).join(', ') : chalk.dim('(none)')}`
      );

      if (info.allowed.length === 0 && !options.target) {
        logger.info(
          `${STATUS_LABELS[version.status]} is a terminal state for partners.`
        );
        return;
      }

      const target = await pickTargetStatus(version.status, options.target);

      if (!options.yes) {
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Change status: ${STATUS_LABELS[version.status]} → ${STATUS_LABELS[target]}?`,
            default: false,
          },
        ]);
        if (!confirm) {
          logger.info('Cancelled.');
          return;
        }
      }

      logger.loading('Updating status...');
      const updated = await api.updateThemeVersionStatus(
        themeId,
        version.id,
        target
      );

      logger.success(
        `✅ Status updated: ${STATUS_LABELS[version.status]} → ${STATUS_LABELS[updated.status as ThemeVersionStatus] ?? updated.status}`
      );
    } catch (error) {
      logger.error('Status change failed:', error as Error);
      process.exit(1);
    }
  });

statusCommand.addHelpText(
  'after',
  `
Statuses:
  draft, pending_review, in_review, approved, rejected,
  published, deprecated, archived

Partner-allowed transitions (admin-only ones are filtered out):
  draft           → pending_review, archived
  pending_review  → draft
  approved        → published, archived
  rejected        → draft, archived
  published       → deprecated
  archived        → draft

Partners cannot change status when the version is in_review or deprecated.
The CLI shows the allowed targets for the current state and validates the
transition before calling the API.

Examples:
  $ vitrin status                              # interactive: shows current + allowed
  $ vitrin status --target pending_review      # submit latest draft for review
  $ vitrin status -v <version-id> -s archived  # archive a specific version
  $ vitrin status --target published --yes     # promote (when allowed) without prompt
`
);

export default statusCommand;
