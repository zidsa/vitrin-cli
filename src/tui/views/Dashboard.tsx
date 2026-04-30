import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, Newline } from 'ink';
import SelectInput from 'ink-select-input';
import { Divider } from '../components/Divider.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { View } from '../App.js';
import { ThemeManager } from '../../core/theme.js';
import auth from '../../core/auth.js';
import { getVersion } from '../../utils/getVersion.js';

interface DashboardProps {
  isAuthenticated: boolean;
  currentTheme: string;
  currentThemePath: string;
  onNavigate: (view: View, extras?: any) => void;
}

interface MenuItem {
  label: string;
  value: View | 'activate' | 'link' | 'switch' | 'translations' | 'auth' | 'exit';
  key: string;
  requiresAuth?: boolean;
  requiresTheme?: boolean;
  requiresLinked?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isAuthenticated,
  currentTheme,
  currentThemePath,
  onNavigate,
}) => {
  const [lastBuildTime, setLastBuildTime] = useState<string>('Never');
  const [lastBuildSize, setLastBuildSize] = useState<string>('N/A');
  const [themeConfig, setThemeConfig] = useState<any>(null);
  const [authState, setAuthState] = useState<boolean>(isAuthenticated);
  const [knownThemeCount, setKnownThemeCount] = useState<number>(0);

  const checkBuildStatus = () => {
    if (currentTheme && currentThemePath) {
        const buildPath = join(process.cwd(), `${currentTheme}.zip`);
      if (existsSync(buildPath)) {
        const stats = statSync(buildPath);
        const buildTime = new Date(stats.mtime);
        const now = new Date();
        const diff = Math.floor((now.getTime() - buildTime.getTime()) / 1000 / 60);
        
        if (diff < 1) {
          setLastBuildTime('Just now');
        } else if (diff < 60) {
          setLastBuildTime(`${diff} minutes ago`);
        } else if (diff < 1440) {
          setLastBuildTime(`${Math.floor(diff / 60)} hours ago`);
        } else {
          setLastBuildTime(`${Math.floor(diff / 1440)} days ago`);
        }

        setLastBuildSize(`${(stats.size / 1024 / 1024).toFixed(1)} MB`);
      } else {
        setLastBuildTime('Never');
        setLastBuildSize('N/A');
      }
    } else {
      setLastBuildTime('Never');
      setLastBuildSize('N/A');
    }
  };

  useEffect(() => {
    setThemeConfig(null);
    checkBuildStatus();

    const refreshThemeConfig = () => {
      const themeManager = new ThemeManager(currentThemePath || '.');
      themeManager.getConfig().then(config => {
        setThemeConfig(config);
      });
    };

    refreshThemeConfig();

    const refreshAuth = () => {
      auth.isAuthenticated().then(setAuthState).catch(() => setAuthState(false));
    };
    refreshAuth();

    const refreshKnownThemes = () => {
      ThemeManager.listGlobalThemes()
        .then(list => setKnownThemeCount(list.length))
        .catch(() => setKnownThemeCount(0));
    };
    refreshKnownThemes();

    const interval = setInterval(() => {
      checkBuildStatus();
      refreshThemeConfig();
      refreshAuth();
      refreshKnownThemes();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentTheme, currentThemePath]);

  const isLinked = !!themeConfig?.id;
  const linkedThemeName =
    typeof themeConfig?.name === 'object'
      ? themeConfig.name.en
      : themeConfig?.name || currentTheme;

  const menuItems: MenuItem[] = [
    { label: '✨ Create New Theme', value: 'new', key: '1' },
    { label: '🚀 Push to Zid', value: 'push', key: '2', requiresTheme: true },
    { label: '🔨 Build Theme', value: 'build', key: '3', requiresTheme: true },
    { label: '👁️  Preview on Store', value: 'preview', key: '4', requiresAuth: true, requiresTheme: true },
    { label: '🎯 Activate Theme', value: 'activate', key: '5', requiresAuth: true, requiresTheme: true },
    { label: '🔗 Link/Unlink Theme', value: 'link', key: '6' },
    {
      label: knownThemeCount > 0
        ? `🔀 Switch Theme (${knownThemeCount} registered)`
        : '🔀 Switch Theme',
      value: 'switch' as View,
      key: 's',
    },
    {
      label: '📚 Versions & Changelogs',
      value: 'versions' as View,
      key: 'v',
      requiresAuth: true,
      requiresTheme: true,
      requiresLinked: true,
    },
    { label: '🌐 Generate Translations', value: 'translations', key: '7', requiresTheme: true },
    { label: '📋 Manage Themes', value: 'themes', key: '8', requiresAuth: true, requiresTheme: true },
    {
      label: authState ? '👤 Account / Logout' : '🔐 Login to Zid',
      value: 'auth',
      key: '0',
    },
    { label: '⚙️  Settings', value: 'settings', key: '9' },
    { label: '🚪 Exit', value: 'exit', key: 'q' },
  ];

  const availableItems = menuItems.filter(item => {
    if (item.requiresTheme && !currentTheme) return false;
    if (item.requiresAuth && !authState) return false;
    if (item.requiresLinked && !isLinked) return false;
    return true;
  });

  useInput((input: string) => {
    const item = availableItems.find(item => item.key === input);
    if (item) {
      handleSelect(item);
    }
  });

  const handleSelect = (item: { value: View | 'new' | 'push' | 'activate' | 'link' | 'switch' | 'translations' | 'auth' | 'exit' }) => {
    if (item.value === 'exit') {
      process.exit(0);
    } else if (item.value === 'versions' && themeConfig?.id) {
      onNavigate('versions' as View, {
        versionsTheme: { id: themeConfig.id, name: linkedThemeName || themeConfig.id },
      });
    } else {
      onNavigate(item.value as View);
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text color="rgb(232, 131, 136)" bold>Vitrin CLI v{getVersion()}</Text>
        <Divider />
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {currentTheme ? (
          <>
            <Text>
              <Text color="cyan">📁 Theme:</Text> {currentTheme}
            </Text>
            {currentThemePath && (
              <Text dimColor>   Path: {currentThemePath}</Text>
            )}
            {themeConfig?.id ? (
              <>
                <Text>
                  <Text color="cyan">🎨 Zid Theme ID:</Text> {themeConfig.id}
                </Text>
                {themeConfig.slug && (
                  <Text dimColor>   Slug: {themeConfig.slug}</Text>
                )}
              </>
            ) : (
              <Text color="yellow">
                ⚠️  Not pushed to Zid yet (path is tracked locally). Use 'Push to Zid' to upload.
              </Text>
            )}
            {themeConfig?.defaultStore && (
              <Text>
                <Text color="cyan">🏪 Default Store:</Text> {themeConfig.defaultStore}
              </Text>
            )}
            <Text>
              <Text color="cyan">📦 Last Build:</Text> {lastBuildTime} ({lastBuildSize})
            </Text>
            {themeConfig?.pushHistory?.length > 0 && (
              <Text dimColor>
                   Last pushed: {new Date(themeConfig.pushHistory[themeConfig.pushHistory.length - 1].pushedAt).toLocaleDateString()}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text color="yellow">
              ⚠️  No theme found in current directory.
            </Text>
            {knownThemeCount > 0 ? (
              <Text dimColor>
                {knownThemeCount} registered theme{knownThemeCount === 1 ? '' : 's'} in ~/.vitrin/themes.json — use 'Switch Theme' to open one.
              </Text>
            ) : (
              <Text dimColor>Use 'Create New Theme' to get started.</Text>
            )}
          </>
        )}
        
        <Text>
          <Text color="cyan">🔐 Status:</Text>{' '}
          {authState ? (
            <Text color="green">Authenticated ✓</Text>
          ) : (
            <Text color="red">Not authenticated (Login required)</Text>
          )}
        </Text>
      </Box>

      <Divider />

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">Choose an action:</Text>
        <Box marginTop={1}>
          <SelectInput
            items={availableItems.map((item, index) => ({
              label: item.label,
              value: item.value,
              key: `menu-${item.key}-${index}`,
            }))}
            onSelect={handleSelect as any}
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Divider />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Arrow keys to navigate • Number/letter for quick access • q to quit
        </Text>
      </Box>
    </Box>
  );
};