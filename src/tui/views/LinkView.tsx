import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Divider } from '../components/Divider.js';
import { ThemeManager } from '../../core/theme.js';
import api from '../../core/api.js';
import logger from '../../utils/logger.js';

interface LinkViewProps {
  themePath: string;
  onComplete: (themeName?: string, themePath?: string) => void;
  onBack: () => void;
}

type Step = 'menu' | 'link-input' | 'unlink-confirm' | 'loading';

interface ThemeOption {
  id: string;
  name: string;
  slug: string;
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
  const [showThemesList, setShowThemesList] = useState(false);

  useEffect(() => {
    const checkCurrentLink = async () => {
      try {
        const themeManager = new ThemeManager(themePath);
        const config = await themeManager.getConfig();

        if (config.id) {
          setCurrentThemeId(config.id);
          setCurrentThemeName(config.name || config.slug || config.id);
        }

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
        } catch {
        }

        setStep('menu');
      } catch (err: any) {
        setError(err.message || 'Failed to check current link');
        setStep('menu');
      }
    };

    void checkCurrentLink();
  }, [themePath]);

  useInput((input: string, key: any) => {
    if (input === 'q' && step !== 'loading') {
      onBack();
    }

    if (key.escape) {
      if (step === 'link-input' || step === 'unlink-confirm') {
        setStep('menu');
        setError(null);
      }
    }

    if (key.return && step === 'link-input' && !showThemesList) {
      void handleThemeIdSubmit();
    }
  });

  const handleMenuSelect = (item: { value: string }) => {
    setError(null);

    if (item.value === 'show') {
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

  const handleThemeSelect = async (item: { value: string }) => {
    await linkTheme(item.value);
  };

  const linkTheme = async (themeId: string) => {
    setLoading(true);
    setError(null);

    try {
      const themeManager = new ThemeManager(themePath);

      let themeName = themeId;
      let themeSlug = '';

      const theme = themes.find(t => t.id === themeId);
      if (theme) {
        themeName = theme.name;
        themeSlug = theme.slug;
      } else {
        try {
          const response = await api.getTheme(themeId);
          if (response) {
            themeName = typeof response.name === 'object' ? response.name.en : response.name;
            themeSlug = response.slug;
          }
        } catch {
        }
      }

      await themeManager.updateThemeId(themeId, themeSlug);

      logger.success(`✅ Linked to theme: ${themeId}`);
      if (themeName !== themeId) {
        logger.info(`📦 Theme: ${themeName}`);
      }
      if (themeSlug) {
        logger.info(`🔗 Slug: ${themeSlug}`);
      }

      setTimeout(() => {
        onComplete(themeName, themePath);
      }, 1500);
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
      }, 1500);
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

  const handleThemeIdSubmit = async () => {
    if (!themeIdInput.trim()) {
      setError('Please enter a theme ID');
      return;
    }
    await linkTheme(themeIdInput.trim());
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
    const menuItems = [];

    if (currentThemeId) {
      menuItems.push({ label: `📎 Currently linked to: ${currentThemeName}`, value: 'show' });
      menuItems.push({ label: '🔄 Link to Different Theme (Manual)', value: 'link-manual' });
      if (themes.length > 0) {
        menuItems.push({ label: '📋 Link to Different Theme (Select)', value: 'link-select' });
      }
      menuItems.push({ label: '❌ Unlink Current Theme', value: 'unlink' });
    } else {
      menuItems.push({ label: '🔗 Link to Theme (Manual Entry)', value: 'link-manual' });
      if (themes.length > 0) {
        menuItems.push({ label: '📋 Link to Theme (Select from List)', value: 'link-select' });
      }
    }

    menuItems.push({ label: '⬅️  Back to Dashboard', value: 'back' });

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🔗 Link Theme</Text>
        <Divider />

        {!currentThemeId && (
          <Box marginTop={1}>
            <Text color="yellow">⚠️  This directory is not linked to any theme</Text>
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
            <Text>Choose a theme from the list:</Text>
          </Box>

          <Box marginTop={1}>
            <SelectInput
              items={themeItems}
              onSelect={handleThemeSelect}
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
              Arrow keys to navigate • Enter to link • Esc/q to go back
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
            placeholder="e.g., theme-123"
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