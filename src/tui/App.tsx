import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useFocus } from 'ink';
import BigText from 'ink-big-text';
import Spinner from 'ink-spinner';
import { Dashboard } from './views/Dashboard.js';
import { ThemeManagerView } from './views/ThemeManagerView.js';
import { BuildView } from './views/BuildView.js';
import { PreviewWizard } from './views/PreviewWizard.js';
import { SettingsView } from './views/SettingsView.js';
import { LoginView } from './views/LoginView.js';
import { AuthStatusView } from './views/AuthStatusView.js';
import { NewThemeView } from './views/NewThemeView.js';
import { DevStoresView } from './views/DevStoresView.js';
import PushView from './views/PushView.js';
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
  | 'login'
  | 'authstatus'
  | 'new'
  | 'devstores'
  | 'push';

interface AppState {
  currentView: View;
  isAuthenticated: boolean;
  loading: boolean;
  currentTheme: string;
  currentThemePath: string;
  selectedStore?: any;
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
        const { resolve } = await import('path');
        
        const cwd = process.cwd();
        const packageJsonPath = resolve(cwd, 'package.json');
        
        try {
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          const assetsPath = resolve(cwd, 'assets');
          const templatesPath = resolve(cwd, 'templates');
          
          try {
            await fs.access(assetsPath);
            await fs.access(templatesPath);
            themeName = packageJson.name || 'Current Theme';
            themePath = cwd;
          } catch {
          }
        } catch {
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
          />
        );
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
      case 'login':
        return (
          <AuthStatusView
            onBack={() => navigateTo('dashboard')}
            onLogout={() => {
              setState(prev => ({
                ...prev,
                isAuthenticated: false,
                currentView: 'dashboard',
              }));
            }}
          />
        );
      case 'authstatus':
        return (
          <AuthStatusView
            onBack={() => navigateTo('dashboard')}
            onLogout={() => {
              setState(prev => ({
                ...prev,
                isAuthenticated: false,
                currentView: 'dashboard',
              }));
            }}
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
      case 'devstores':
        return (
          <DevStoresView
            onSelectStore={(store) => {
              setState(prev => ({
                ...prev,
                selectedStore: store,
                currentView: 'preview'
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