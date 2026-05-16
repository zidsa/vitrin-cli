import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import BigText from 'ink-big-text';
import Spinner from 'ink-spinner';
import { Dashboard } from './views/Dashboard.js';
import { ThemeManagerView } from './views/ThemeManagerView.js';
import { BuildView } from './views/BuildView.js';
import { PreviewWizard } from './views/PreviewWizard.js';
import { SettingsView } from './views/SettingsView.js';
import { NewThemeView } from './views/NewThemeView.js';
import PushView from './views/PushView.js';
import { ActivateView } from './views/ActivateView.js';
import { LinkView } from './views/LinkView.js';
import { SwitchThemeView } from './views/SwitchThemeView.js';
import { VersionsView } from './views/VersionsView.js';
import { TranslationsView } from './views/TranslationsView.js';
import { AuthStatusView } from './views/AuthStatusView.js';
import { ReportIssuesView } from './views/ReportIssuesView.js';
import { ThemeEditorView } from './views/ThemeEditorView.js';
import auth from '../core/auth.js';
import { ThemeManager } from '../core/theme.js';
import { getVersion } from '../utils/getVersion.js';

export type View =
  | 'splash'
  | 'dashboard'
  | 'themes'
  | 'build'
  | 'preview'
  | 'settings'
  | 'new'
  | 'push'
  | 'activate'
  | 'link'
  | 'switch'
  | 'versions'
  | 'translations'
  | 'auth'
  | 'report-issues'
  | 'theme-editor';

interface AppState {
  currentView: View;
  isAuthenticated: boolean;
  loading: boolean;
  currentTheme: string;
  currentThemePath: string;
  selectedStore?: any;
  versionsTheme?: { id: string; name: string } | undefined;
}

export const App: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    currentView: 'splash',
    isAuthenticated: false,
    loading: true,
    currentTheme: '',
    currentThemePath: '',
  });

  useEffect(() => {
    const initialize = async () => {
      const authenticated = await auth.isAuthenticated();
      
      let themeName = '';
      let themePath = '';

      try {
        const { promises: fs } = await import('fs');
        const { resolve, basename } = await import('path');

        const cwd = process.cwd();

        const linkedRoot = await ThemeManager.findLinkedRoot(cwd);
        let linkedConfig: any = null;
        if (linkedRoot) {
          try {
            const linkedManager = new ThemeManager(linkedRoot);
            const config = await linkedManager.getConfig();
            if (config?.id) {
              linkedConfig = config;
              if (config.path !== linkedRoot) {
                await linkedManager.updateConfig({ path: linkedRoot });
              }
            }
          } catch {
          }
        }

        let hasLayout = false;
        const layoutCandidate = resolve(linkedRoot ?? cwd, 'layout.jinja');
        try {
          await fs.access(layoutCandidate);
          hasLayout = true;
        } catch {
        }

        if (hasLayout || linkedConfig) {
          themePath = linkedRoot ?? cwd;
          themeName = 'Current Theme';

          try {
            const themeJsonPath = resolve(themePath, 'theme.json');
            const themeJson = JSON.parse(await fs.readFile(themeJsonPath, 'utf-8'));
            if (themeJson.name) {
              themeName = typeof themeJson.name === 'object' ? themeJson.name.en : themeJson.name;
            }
          } catch {
            if (linkedConfig?.name) {
              themeName = typeof linkedConfig.name === 'object' ? linkedConfig.name.en : linkedConfig.name;
            } else if (linkedConfig?.slug) {
              themeName = linkedConfig.slug;
            } else {
              try {
                const packageJsonPath = resolve(themePath, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                themeName = packageJson.name || basename(themePath);
              } catch {
                themeName = basename(themePath);
              }
            }
          }
        }
      } catch {
      }
      
      setState(prev => ({
        ...prev,
        isAuthenticated: authenticated,
        currentTheme: themeName,
        currentThemePath: themePath,
        loading: false,
        currentView: 'dashboard',
      }));
    };

    setTimeout(() => {
      void initialize();
    }, 2000);
  }, []);

  useInput((input: string, key: any) => {
    if (input === 'q' && state.currentView !== 'splash') {
      if (state.currentView === 'dashboard') {
        exit();
      } else {
        setState(prev => ({ ...prev, currentView: 'dashboard' }));
      }
    }

    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const navigateTo = (view: View, extras?: Partial<AppState>) => {
    setState(prev => ({
      ...prev,
      currentView: view,
      ...extras,
    }));
  };

  if (state.currentView === 'splash') {
    return (
      <Box flexDirection="column" alignItems="center" paddingTop={2}>
        <Box>
          <BigText text="VITRIN" font="block" />
        </Box>
        <Box marginTop={1}>
          <Text color="rgb(232, 131, 136)" bold>Zid Themeing System</Text>
        </Box>
        <Box>
          <Text color="gray">v{getVersion()}</Text>
        </Box>
        <Box marginTop={2}>
          <Text color="gray">
            <Spinner type="dots" /> Getting Ready To Make You Smile...
          </Text>
        </Box>
      </Box>
    );
  }

  const renderView = () => {
    switch (state.currentView) {
      case 'dashboard':
        return (
          <Dashboard
            isAuthenticated={state.isAuthenticated}
            currentTheme={state.currentTheme}
            currentThemePath={state.currentThemePath}
            onNavigate={navigateTo}
          />
        );
      case 'push':
        return (
          <PushView
            onComplete={() => navigateTo('dashboard')}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'themes':
        return (
          <ThemeManagerView
            onBack={() => navigateTo('dashboard')}
            onOpenVersions={(theme: any) => {
              const name =
                typeof theme.name === 'object' && theme.name !== null
                  ? theme.name.en
                  : theme.name;
              setState(prev => ({
                ...prev,
                versionsTheme: { id: theme.id, name: name || theme.id },
                currentView: 'versions',
              }));
            }}
          />
        );
      case 'versions': {
        const versionsTheme =
          state.versionsTheme ??
          (state.currentTheme && state.currentThemePath
            ? { id: '', name: state.currentTheme }
            : null);
        if (!versionsTheme || !versionsTheme.id) {
          return (
            <Box flexDirection="column" paddingX={2} paddingY={1}>
              <Text color="yellow">
                No theme selected for versions view.
              </Text>
              <Text dimColor>
                Use 'Manage Themes' → [V] on a row to open versions.
              </Text>
            </Box>
          );
        }
        return (
          <VersionsView
            themeId={versionsTheme.id}
            themeName={versionsTheme.name}
            onBack={() =>
              setState(prev => ({
                ...prev,
                versionsTheme: undefined,
                currentView: 'themes',
              }))
            }
          />
        );
      }
      case 'build':
        return (
          <BuildView
            themePath={state.currentThemePath}
            themeName={state.currentTheme}
            onComplete={() => navigateTo('dashboard')}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'preview':
        return (
          <PreviewWizard
            themePath={state.currentThemePath}
            themeName={state.currentTheme}
            preselectedStore={state.selectedStore}
            onComplete={() => navigateTo('dashboard')}
            onBack={() => {
              setState(prev => ({ ...prev, selectedStore: undefined }));
              navigateTo('dashboard');
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView
            onSave={() => navigateTo('dashboard')}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'new':
        return (
          <NewThemeView
            onComplete={(themeName, themePath) => {
              if (themeName && themePath) {
                setState(prev => ({
                  ...prev,
                  currentTheme: themeName,
                  currentThemePath: themePath,
                  currentView: 'dashboard',
                }));
              } else {
                navigateTo('dashboard');
              }
            }}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'activate':
        return (
          <ActivateView
            themePath={state.currentThemePath}
            themeName={state.currentTheme}
            onComplete={() => navigateTo('dashboard')}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'translations':
        return (
          <TranslationsView
            themePath={state.currentThemePath}
            onComplete={() => navigateTo('dashboard')}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'auth':
        return (
          <AuthStatusView
            onBack={async () => {
              const authenticated = await auth.isAuthenticated();
              setState(prev => ({ ...prev, isAuthenticated: authenticated, currentView: 'dashboard' }));
            }}
            onLogout={() => {
              setState(prev => ({ ...prev, isAuthenticated: false, currentView: 'dashboard' }));
            }}
          />
        );
      case 'report-issues':
        return <ReportIssuesView onBack={() => navigateTo('dashboard')} />;
      case 'theme-editor':
        return (
          <ThemeEditorView
            themePath={state.currentThemePath}
            themeName={state.currentTheme}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'link':
        return (
          <LinkView
            themePath={state.currentThemePath}
            onComplete={(themeName, themePath) => {
              if (themeName && themePath) {
                setState(prev => ({
                  ...prev,
                  currentTheme: themeName,
                  currentThemePath: themePath,
                  currentView: 'dashboard',
                }));
              } else {
                navigateTo('dashboard');
              }
            }}
            onBack={() => navigateTo('dashboard')}
          />
        );
      case 'switch':
        return (
          <SwitchThemeView
            currentThemePath={state.currentThemePath}
            onSwitch={(themeName, themePath) => {
              setState(prev => ({
                ...prev,
                currentTheme: themeName,
                currentThemePath: themePath,
                currentView: 'dashboard',
              }));
            }}
            onBack={() => navigateTo('dashboard')}
          />
        );
      default:
        return <Text>Unknown view</Text>;
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {renderView()}
    </Box>
  );
};