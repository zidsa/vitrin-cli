import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import { Divider } from '../components/Divider.js';
import { ThemeManager, ThemeConfig } from '../../core/theme.js';
import api from '../../core/api.js';
import logger from '../../utils/logger.js';

interface LinkViewProps {
  themePath: string;
  onComplete: (themeName?: string, themePath?: string) => void;
  onBack: () => void;
}

type Step =
  | 'menu'
  | 'link-input'
  | 'pick-target-path'
  | 'enter-target-path'
  | 'unlink-confirm'
  | 'loading';

interface ThemeOption {
  id: string;
  name: string;
  slug: string;
}

interface KnownTheme extends ThemeConfig {
  path: string;
}

export const LinkView: React.FC<LinkViewProps> = ({
  themePath,
  onComplete,
  onBack,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  const [currentThemeName, setCurrentThemeName] = useState<string | null>(null);
  const [themeIdInput, setThemeIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [knownThemes, setKnownThemes] = useState<KnownTheme[]>([]);
  const [showThemesList, setShowThemesList] = useState(false);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);
  const [pendingThemeName, setPendingThemeName] = useState<string>('');
  const [pendingThemeSlug, setPendingThemeSlug] = useState<string>('');
  const [customPathInput, setCustomPathInput] = useState('');
  const [targetPath, setTargetPath] = useState<string>(themePath);

  useEffect(() => {
    const init = async () => {
      try {
        const themeManager = new ThemeManager(themePath || process.cwd());
        const config = await themeManager.getConfig();

        if (config.id) {
          setCurrentThemeId(config.id);
          setCurrentThemeName(config.name || config.slug || config.id);
        }

        await ThemeManager.pruneGlobalThemes();
        const known = await ThemeManager.listGlobalThemes();
        setKnownThemes(known);

        try {
          const response = await api.getThemes({ page_size: 100 });
          if (response.results) {
            const themesList = response.results.map((t: any) => ({
              id: t.id,
              name: typeof t.name === 'object' ? t.name.en : t.name,
              slug: t.slug,
            }));
            setThemes(themesList);
          }
        } catch {}

        setStep('menu');
      } catch (err: any) {
        setError(err.message || 'Failed to check current link');
        setStep('menu');
      }
    };

    void init();
  }, [themePath]);

  useInput((input: string, key: any) => {
    if (input === 'q' && step !== 'loading') {
      onBack();
    }

    if (key.escape) {
      if (
        step === 'link-input' ||
        step === 'unlink-confirm' ||
        step === 'pick-target-path' ||
        step === 'enter-target-path'
      ) {
        if (step === 'enter-target-path') {
          setStep('pick-target-path');
        } else {
          setStep('menu');
          setError(null);
          setPendingThemeId(null);
        }
      }
    }

    if (key.return && step === 'link-input' && !showThemesList) {
      void handleThemeIdSubmit();
    }

    if (key.return && step === 'enter-target-path') {
      void handleCustomPathSubmit();
    }
  });

  const handleMenuSelect = (item: { value: string }) => {
    setError(null);

    if (item.value === 'show') {
      // no-op
    } else if (item.value === 'link-manual') {
      setStep('link-input');
      setShowThemesList(false);
    } else if (item.value === 'link-select') {
      setStep('link-input');
      setShowThemesList(true);
    } else if (item.value === 'unlink') {
      if (currentThemeId) {
        setStep('unlink-confirm');
      }
    } else if (item.value === 'back') {
      onBack();
    }
  };

  const handleApiThemeSelect = async (item: { value: string }) => {
    const theme = themes.find(t => t.id === item.value);
    setPendingThemeId(item.value);
    setPendingThemeName(theme?.name || item.value);
    setPendingThemeSlug(theme?.slug || '');

    if (knownThemes.length > 0) {
      setStep('pick-target-path');
    } else {
      setTargetPath(themePath || process.cwd());
      await commitLink(item.value, theme?.name || item.value, theme?.slug || '', themePath || process.cwd());
    }
  };

  const handleManualLinkSubmit = async () => {
    if (!themeIdInput.trim()) {
      setError('Please enter a theme ID');
      return;
    }
    const themeId = themeIdInput.trim();
    setPendingThemeId(themeId);

    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      setPendingThemeName(theme.name);
      setPendingThemeSlug(theme.slug);
    } else {
      try {
        const response = await api.getTheme(themeId);
        if (response) {
          setPendingThemeName(
            typeof response.name === 'object' ? response.name.en : response.name
          );
          setPendingThemeSlug(response.slug || '');
        }
      } catch {}
    }

    if (knownThemes.length > 0) {
      setStep('pick-target-path');
    } else {
      await commitLink(
        themeId,
        themes.find(t => t.id === themeId)?.name || themeId,
        themes.find(t => t.id === themeId)?.slug || '',
        themePath || process.cwd()
      );
    }
  };

  const handleThemeIdSubmit = handleManualLinkSubmit;

  const handlePickTargetPath = async (item: { value: string }) => {
    if (!pendingThemeId) {
      setStep('menu');
      return;
    }

    if (item.value === '__custom__') {
      setCustomPathInput('');
      setStep('enter-target-path');
      return;
    }

    if (item.value === '__current__') {
      const cwdPath = themePath || process.cwd();
      await commitLink(
        pendingThemeId,
        pendingThemeName,
        pendingThemeSlug,
        cwdPath
      );
      return;
    }

    await commitLink(
      pendingThemeId,
      pendingThemeName,
      pendingThemeSlug,
      item.value
    );
  };

  const handleCustomPathSubmit = async () => {
    const trimmed = customPathInput.trim();
    if (!trimmed) {
      setError('Please enter a path');
      return;
    }
    const resolved = resolve(process.cwd(), trimmed);
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        setError('Path is not a directory');
        return;
      }
    } catch {
      setError('Directory does not exist');
      return;
    }
    setError(null);
    if (!pendingThemeId) {
      setStep('menu');
      return;
    }
    await commitLink(
      pendingThemeId,
      pendingThemeName,
      pendingThemeSlug,
      resolved
    );
  };

  const commitLink = async (
    themeId: string,
    name: string,
    slug: string,
    path: string
  ) => {
    setLoading(true);
    setError(null);
    setTargetPath(path);

    try {
      const themeManager = new ThemeManager(path);
      const existing = await themeManager.getConfig();
      if (!existing.name && name) {
        await themeManager.updateConfig({ name });
      }
      await themeManager.updateThemeId(themeId, slug);

      logger.success(`✅ Linked ${themeId} -> ${path}`);

      setTimeout(() => {
        onComplete(name || themeId, path);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to link theme');
      setLoading(false);
      setStep('menu');
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError(null);

    try {
      const themeManager = new ThemeManager(themePath);
      await themeManager.updateThemeId('', '');

      logger.success(`✅ Unlinked from theme: ${currentThemeId}`);

      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to unlink theme');
      setLoading(false);
      setStep('menu');
    }
  };

  const handleUnlinkConfirm = (item: { value: string }) => {
    if (item.value === 'yes') {
      void handleUnlink();
    } else {
      setStep('menu');
    }
  };

  if (step === 'loading' || loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🔗 Link Theme</Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> {loading ? 'Processing...' : 'Loading...'}
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'menu') {
    const menuItems: Array<{ label: string; value: string }> = [];

    if (currentThemeId) {
      menuItems.push({
        label: `📎 Currently linked to: ${currentThemeName}`,
        value: 'show',
      });
      menuItems.push({
        label: '🔄 Link to Different Theme (Manual ID)',
        value: 'link-manual',
      });
      if (themes.length > 0) {
        menuItems.push({
          label: '📋 Link to Different Theme (Select from API)',
          value: 'link-select',
        });
      }
      menuItems.push({
        label: '❌ Unlink Current Theme',
        value: 'unlink',
      });
    } else {
      menuItems.push({
        label: '🔗 Link to Theme (Manual ID)',
        value: 'link-manual',
      });
      if (themes.length > 0) {
        menuItems.push({
          label: '📋 Link to Theme (Select from API)',
          value: 'link-select',
        });
      }
    }

    menuItems.push({ label: '⬅️  Back to Dashboard', value: 'back' });

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🔗 Link Theme</Text>
        <Divider />

        {!currentThemeId && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠️  This directory is not linked to any theme
            </Text>
          </Box>
        )}

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <SelectInput
            items={menuItems}
            onSelect={handleMenuSelect}
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>

        <Box marginTop={1}>
          <Divider />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Arrow keys to navigate • Enter to select • Esc/q to go back
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'link-input') {
    if (showThemesList && themes.length > 0) {
      const themeItems = themes.map(theme => ({
        label: `${theme.name} (${theme.id})`,
        value: theme.id,
      }));

      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text color="cyan" bold>🔗 Select Theme to Link</Text>
          <Divider />

          <Box marginTop={1}>
            <Text>Choose a theme from the API list:</Text>
          </Box>

          <Box marginTop={1}>
            <SelectInput
              items={themeItems}
              onSelect={handleApiThemeSelect}
              indicatorComponent={({ isSelected }: any) => (
                <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
              )}
              itemComponent={({ label, isSelected }: any) => (
                <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
              )}
            />
          </Box>

          <Box marginTop={1}>
            <Divider />
          </Box>

          <Box marginTop={1}>
            <Text dimColor>
              Arrow keys to navigate • Enter to continue • Esc/q to go back
            </Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🔗 Link to Theme</Text>
        <Divider />

        <Box marginTop={1}>
          <Text>Enter Theme ID to link:</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="cyan">Theme ID: </Text>
          <TextInput
            value={themeIdInput}
            onChange={setThemeIdInput}
            placeholder="e.g., 78cfa32c-029e-456c-acaf-6ecdbe45c73d"
          />
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            Enter theme ID and press Enter • Esc/q to go back
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'pick-target-path') {
    const items: Array<{ label: string; value: string }> = [];
    items.push({
      label: `📍 Current directory: ${themePath || process.cwd()}`,
      value: '__current__',
    });
    for (const known of knownThemes) {
      const label = `📁 ${known.name || 'theme'} (${known.path})`;
      items.push({ label, value: known.path });
    }
    items.push({
      label: '✏️  Enter a custom path...',
      value: '__custom__',
    });

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📂 Where should "{pendingThemeName}" be linked?
        </Text>
        <Divider />

        <Box marginTop={1} flexDirection="column">
          <Text>
            Pick a local directory to associate with theme{' '}
            <Text color="yellow">{pendingThemeId}</Text>:
          </Text>
          <Text dimColor>
            (writes .vitrin/theme.json there so vitrin can build/push from it)
          </Text>
        </Box>

        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={handlePickTargetPath}
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>↑↓ Navigate • Enter to choose • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'enter-target-path') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          ✏️  Enter target directory
        </Text>
        <Divider />

        <Box marginTop={1}>
          <TextInput
            value={customPathInput}
            onChange={setCustomPathInput}
            placeholder="./my-theme or /absolute/path"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Resolved:{' '}
            <Text color="cyan">
              {customPathInput
                ? resolve(process.cwd(), customPathInput)
                : '<path>'}
            </Text>
          </Text>
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Enter to confirm • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'unlink-confirm') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🔗 Unlink Theme</Text>
        <Divider />

        <Box marginTop={1}>
          <Text color="yellow">
            ⚠️  Are you sure you want to unlink from theme "{currentThemeName}"?
          </Text>
        </Box>

        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: 'Yes, unlink this theme', value: 'yes' },
              { label: 'No, keep it linked', value: 'no' },
            ]}
            onSelect={handleUnlinkConfirm}
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Arrow keys to navigate • Enter to confirm • Esc/q to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
};
