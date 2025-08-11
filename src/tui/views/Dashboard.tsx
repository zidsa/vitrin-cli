import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, Newline } from 'ink';
import SelectInput from 'ink-select-input';
import { Divider } from '../components/Divider.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { View } from '../App.js';
import { ThemeManager } from '../../core/theme.js';

interface DashboardProps {
  isAuthenticated: boolean;
  currentTheme: string;
  currentThemePath: string;
  onNavigate: (view: View, extras?: any) => void;
}

interface MenuItem {
  label: string;
  value: View | 'exit';
  key: string;
  requiresAuth?: boolean;
  requiresTheme?: boolean;
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
    checkBuildStatus();
    const themeManager = new ThemeManager(currentThemePath || '.');
    themeManager.getConfig().then(config => {
      setThemeConfig(config);
    });
    const interval = setInterval(checkBuildStatus, 2000);
    return () => clearInterval(interval);
  }, [currentTheme, currentThemePath]);

  const menuItems: MenuItem[] = [
    { label: '✨ Create New Theme', value: 'new', key: '1' },
    { label: '🚀 Push to Zid', value: 'push', key: '2', requiresTheme: true },
    { label: '🔨 Build Theme', value: 'build', key: '3', requiresTheme: true },
    { label: '👁️  Preview on Store', value: 'preview', key: '4', requiresAuth: true, requiresTheme: true },
    { label: '🏪 View Dev Stores', value: 'devstores', key: '5', requiresAuth: true },
    { label: '📋 Manage Themes', value: 'themes', key: '6', requiresAuth: true },
    { label: '🔐 Authentication', value: 'login', key: '7' },
    { label: '⚙️  Settings', value: 'settings', key: '8' },
    { label: '🚪 Exit', value: 'exit', key: 'q' },
  ];

  const availableItems = menuItems.filter(item => {
    if (item.requiresAuth && !isAuthenticated) return false;
    if (item.requiresTheme && !currentTheme) return false;
    return true;
  });

  useInput((input: string) => {
    const item = menuItems.find(item => item.key === input);
    if (item) {
      handleSelect(item);
    }
  });

  const handleSelect = (item: { value: View | 'new' | 'push' | 'exit' }) => {
    if (item.value === 'exit') {
      process.exit(0);
    } else {
      onNavigate(item.value as View);
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text color="rgb(232, 131, 136)" bold>Vitrin CLI v1.0.0</Text>
        <Divider />
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {currentTheme ? (
          <>
            <Text>
              <Text color="cyan">📁 Theme:</Text> {currentTheme}
            </Text>
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
                ⚠️  Not pushed to Zid yet. Use 'Push to Zid' to upload.
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
          <Text color="yellow">
            ⚠️  No theme found. Use 'Create New Theme' to get started.
          </Text>
        )}
        
        <Text>
          <Text color="cyan">🔐 Status:</Text>{' '}
          {isAuthenticated ? (
            <Text color="green">Authenticated ✓</Text>
          ) : (
            <Text color="yellow">Not authenticated</Text>
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
          Use arrow keys to navigate • Press number/letter for quick access • q to quit
        </Text>
      </Box>
    </Box>
  );
};