import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { basename } from 'path';
import { Divider } from '../components/Divider.js';
import { ThemeManager, ThemeConfig } from '../../core/theme.js';

interface SwitchThemeViewProps {
  currentThemePath: string;
  onSwitch: (themeName: string, themePath: string) => void;
  onBack: () => void;
}

interface KnownTheme extends ThemeConfig {
  path: string;
}

export const SwitchThemeView: React.FC<SwitchThemeViewProps> = ({
  currentThemePath,
  onSwitch,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState<KnownTheme[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        await ThemeManager.pruneGlobalThemes();
        const known = await ThemeManager.listGlobalThemes();
        setThemes(known);
      } catch (err: any) {
        setError(err.message || 'Failed to load known themes');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const handleSelect = (item: { value: string }) => {
    if (item.value === '__back__') {
      onBack();
      return;
    }
    const theme = themes.find(t => t.path === item.value);
    if (!theme) {
      onBack();
      return;
    }
    try {
      process.chdir(theme.path);
    } catch (err: any) {
      setError(`Failed to switch directory: ${err.message}`);
      return;
    }

    const name =
      typeof theme.name === 'object' && theme.name !== null
        ? (theme.name as any).en
        : theme.name || basename(theme.path);
    onSwitch(name, theme.path);
  };

  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          🔀 Switch Theme
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> Loading registered themes...
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          🔀 Switch Theme
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (themes.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          🔀 Switch Theme
        </Text>
        <Divider />
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">
            No registered themes yet. Create one with "Create New Theme" to
            populate the registry.
          </Text>
          <Text dimColor>Stored at ~/.vitrin/themes.json</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  const items = themes.map(theme => {
    const name =
      typeof theme.name === 'object' && theme.name !== null
        ? (theme.name as any).en
        : theme.name || basename(theme.path);
    const linked = theme.id ? '🔗' : '·';
    const current = theme.path === currentThemePath ? ' (current)' : '';
    return {
      label: `${linked} ${name} — ${theme.path}${current}`,
      value: theme.path,
    };
  });
  items.push({ label: '⬅️  Back to Dashboard', value: '__back__' });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="cyan" bold>
        🔀 Switch Theme
      </Text>
      <Divider />
      <Box marginTop={1} flexDirection="column">
        <Text>
          Pick a registered theme. Choosing one cd's into it for this session.
        </Text>
        <Text dimColor>
          🔗 = linked to a Zid theme · · = local only (not pushed yet)
        </Text>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={handleSelect}
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
          ↑↓ Navigate • Enter to switch • Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};
