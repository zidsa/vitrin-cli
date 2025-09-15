import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Link from 'ink-link';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { ProgressBar } from '../components/ProgressBar.js';
import apiService from '../../core/api.js';
import { ThemeManager } from '../../core/theme.js';
import open from 'open';

interface PreviewWizardProps {
  themePath: string;
  themeName: string;
  preselectedStore?: any;
  onComplete: () => void;
  onBack: () => void;
}

type WizardStep = 'select-store' | 'select-theme' | 'building' | 'uploading' | 'installing' | 'complete' | 'error';

interface DevStore {
  id: string | number;
  name: string;
  email: string;
  link?: string;
}

export const PreviewWizard: React.FC<PreviewWizardProps> = ({
  themePath,
  themeName,
  preselectedStore,
  onComplete,
  onBack,
}) => {
  const [step, setStep] = useState<WizardStep>('select-store');
  const [stores, setStores] = useState<DevStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<DevStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [existingThemes, setExistingThemes] = useState<any[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [showThemeSelection, setShowThemeSelection] = useState(false);

  useEffect(() => {
    if (preselectedStore) {
      setSelectedStore(preselectedStore);
      setStep('building');
      setTimeout(() => {
        void handleStoreSelect(preselectedStore);
      }, 100);
    } else {
      const fetchStores = async () => {
        try {
          const authModule = await import('../../core/auth.js');
          const isAuth = await authModule.default.isAuthenticated();
          
          if (!isAuth) {
            setError('Not authenticated. Please login first.');
            setStep('error');
            setLoading(false);
            return;
          }
          
          const response = await apiService.getDevStores();
          setStores(response.stores as DevStore[]);
          setLoading(false);
        } catch (err: any) {
          if (err.response?.status === 401) {
            setError('Authentication expired. Please login again.');
          } else if (err.response?.status === 403) {
            setError('Access denied. Check your permissions.');
          } else {
            setError('Failed to fetch dev stores');
          }
          setStep('error');
          setLoading(false);
        }
      };

      void fetchStores();
    }
  }, []);

  useInput((input, key) => {
    if (key.escape || (input === 'q' && step !== 'uploading')) {
      onBack();
    }
    if (step === 'complete' && (key.return || key.space || input)) {
      onBack();
    }
  });

  const handleStoreSelect = async (store: DevStore) => {
    setSelectedStore(store);
    
    try {
      const authModule = await import('../../core/auth.js');
      const isAuth = await authModule.default.isAuthenticated();
      
      if (!isAuth) {
        throw new Error('Not authenticated. Please login first (Press Esc and select Login)');
      }
      
      const { resolve, basename } = await import('path');
      const resolvedPath = resolve(themePath);
      const themeNameBase = themeName || basename(resolvedPath);
      
      const themeManager = new ThemeManager(resolvedPath);
      const themeConfig = await themeManager.getConfig();
      
      if (themeConfig?.id) {
        setSelectedThemeId(themeConfig.id);
        setStep('building');
        await proceedWithTheme(store, themeConfig.id, themeNameBase, resolvedPath);
      } else {
        setExistingThemes([
          { id: 'new', name: '🆕 Create New Theme', isNew: true },
          { id: 'link', name: '🔗 Link Existing Theme', isLink: true }
        ]);
        setStep('select-theme');
      }
    } catch (err: any) {
      let errorMessage = 'Failed to proceed';
      
      if (err.message?.includes('Not authenticated')) {
        errorMessage = err.message;
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. Please ensure you have permission.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setStep('error');
    }
  };

  const proceedWithTheme = async (
    store: DevStore,
    themeId: string | null,
    themeNameBase: string,
    resolvedPath: string
  ) => {
    try {
      setStatusMessage('Building theme...');
      setProgress(0);
      
      const buildService = (await import('../../utils/build.js')).default;
      
      await buildService.removeDSStore(resolvedPath);
      const themeZipPath = await buildService.zipTheme(themeNameBase, resolvedPath);
      
      setProgress(20);
      
      let finalThemeId = themeId;
      
      if (!finalThemeId) {
        setStep('uploading');
        setStatusMessage('Creating theme...');
        setProgress(25);
        
        const timestamp = Date.now();
        const themeSlug = `${themeNameBase.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;
        
        const themeData = {
          name: { en: themeNameBase },
          description: { en: `${themeNameBase} theme` },
          slug: themeSlug,
        };
        
        try {
          const theme = await apiService.createTheme(themeData);
          finalThemeId = theme.id;
          
          const themeManager = new ThemeManager(resolvedPath);
          await themeManager.updateThemeId(finalThemeId!);
        } catch (createErr: any) {
          const errorMsg = createErr.response?.data?.message || createErr.message;
          
          if (errorMsg?.includes('already exists') || errorMsg?.includes('duplicate')) {
            const uniqueSlug = `${themeSlug}-${Math.random().toString(36).substr(2, 9)}`;
            themeData.slug = uniqueSlug;
            const theme = await apiService.createTheme(themeData);
            finalThemeId = theme.id;
            
            const themeManager2 = new ThemeManager(resolvedPath);
            await themeManager2.updateThemeId(finalThemeId!);
          } else {
            throw createErr;
          }
        }
      } else {
        setStep('uploading');
        setStatusMessage('Using existing theme...');
        setProgress(25);
      }
      
      setProgress(30);
      
      setStatusMessage('Creating theme version...');
      const versionInfo = {
        version: '1.0.0',
        minimum_api_version: '1.0',
        changelog: { en: 'Preview version' },
      };
      
      const versionData = await apiService.createThemeVersion(finalThemeId!, versionInfo);
      
      setProgress(40);
      
      setStatusMessage('Uploading theme package...');
      await apiService.uploadThemeArtifact(
        versionData.upload_url,
        versionData.upload_fields,
        themeZipPath
      );
      
      setProgress(60);
      
      setStatusMessage('Finalizing upload...');
      await apiService.notifyArtifactUpload(
        finalThemeId!,
        versionData.theme_version.id,
        {
          key: versionData.key
        }
      );
      
      setProgress(70);
      
      setStep('installing');
      setStatusMessage('Installing on store...');
      setProgress(75);
      
      const storeIdStr = String(store.id);
      const installationResponse = await apiService.installTheme(
        storeIdStr,
        finalThemeId!,
        versionData.theme_version.id
      );
      
      setProgress(85);
      
      setStatusMessage('Getting preview URL...');
      
      const previewResponse = await apiService.getPreviewUrl(
        storeIdStr,
        installationResponse.id || null
      );
      const fullUrl = previewResponse.url.startsWith('http') ? previewResponse.url : `https://${previewResponse.url}`;
      setPreviewUrl(fullUrl);

      setProgress(100);
      setStatusMessage('Theme installed successfully!');
      setStep('complete');

      setTimeout(() => {
        open(fullUrl).catch(() => {
        });
      }, 500);
    } catch (err: any) {
      let errorMessage = 'Deployment failed';
      
      if (err.message?.includes('Not authenticated')) {
        errorMessage = err.message;
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. Please ensure you have permission to create themes.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setStep('error');
    }
  };

  const handleThemeSelect = async (theme: any) => {
    const { resolve, basename } = await import('path');
    const resolvedPath = resolve(themePath);
    const themeNameBase = themeName || basename(resolvedPath);

    if (theme.isNew) {
      setStep('building');
      await proceedWithTheme(selectedStore!, null, themeNameBase, resolvedPath);
    } else if (theme.isLink) {
      try {
        setLoading(true);
        const themes = await apiService.getThemes({ page_size: 100 });
        
        if (!themes.results || themes.results.length === 0) {
          setStep('building');
          await proceedWithTheme(selectedStore!, null, themeNameBase, resolvedPath);
        } else {
          setExistingThemes([
            { id: 'new', name: '🆕 Create New Theme', isNew: true },
            ...themes.results.map((t: any) => ({
              id: t.id,
              name: `${typeof t.name === 'object' ? t.name.en : t.name} (${t.id})`,
              isExisting: true
            }))
          ]);
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to fetch themes');
        setStep('error');
      }
    } else if (theme.isExisting) {
      setSelectedThemeId(theme.id);
      setStep('building');
      
      const themeManager = new ThemeManager(resolvedPath);
      await themeManager.updateThemeId(theme.id);
      
      await proceedWithTheme(selectedStore!, theme.id, themeNameBase, resolvedPath);
    }
  };


  const renderStep = () => {
    switch (step) {
      case 'select-theme':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Theme Setup</Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>
                {existingThemes.length === 2 
                  ? 'This project is not linked to a theme. What would you like to do?'
                  : 'Select a theme to use for this preview:'}
              </Text>
            </Box>
            <SelectInput
              items={existingThemes.map((theme, index) => ({
                label: theme.isNew 
                  ? theme.name 
                  : `${theme.name?.en || theme.name} (${theme.id})`,
                value: theme,
                key: `theme-${theme.id}-${index}`,
              }))}
              onSelect={(item: any) => handleThemeSelect(item.value)}
              indicatorComponent={({ isSelected }: any) => (
                <Text>{isSelected ? '● ' : '○ '}</Text>
              )}
              itemComponent={({ label, isSelected }: any) => (
                <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
              )}
            />
            <Box marginTop={1}>
              <Text dimColor>[Space] Select • [Enter] Continue • [Esc] Cancel</Text>
            </Box>
          </Box>
        );

      case 'select-store':
        if (loading) {
          return (
            <Box>
              <Spinner type="dots" />
              <Text> Loading dev stores...</Text>
            </Box>
          );
        }

        if (stores.length === 0) {
          return (
            <Box flexDirection="column">
              <Text color="yellow">No dev stores found.</Text>
              <Text>Create one in the Partner Dashboard first.</Text>
            </Box>
          );
        }

        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Step 1/4: Select Store</Text>
            </Box>
            <SelectInput
              items={stores.map((store, index) => ({
                label: `${store.name} (${store.email})`,
                value: store,
                key: `preview-store-${store.id}-${index}`,
              }))}
              onSelect={(item: any) => handleStoreSelect(item.value as DevStore)}
              indicatorComponent={({ isSelected }: any) => (
                <Text>{isSelected ? '● ' : '○ '}</Text>
              )}
              itemComponent={({ label, isSelected }: any) => (
                <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
              )}
            />
            <Box marginTop={1}>
              <Text dimColor>[Space] Select • [Enter] Continue • [Esc] Cancel</Text>
            </Box>
          </Box>
        );

      case 'building':
      case 'uploading':
      case 'installing':
        return (
          <Box flexDirection="column">
            <Text bold>📦 Deploying to {selectedStore?.name}</Text>
            <Box marginY={1}>
              <Box width={40}>
                <ProgressBar percent={progress / 100} />
              </Box>
              <Text> {Math.round(progress)}%</Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="cyan">
                <Spinner type="dots" /> {statusMessage}
              </Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Box>
                <Text color={progress >= 20 ? 'green' : 'gray'}>
                  {progress >= 20 ? '✓' : '○'} Theme built
                </Text>
              </Box>
              <Box>
                <Text color={progress >= 40 ? 'green' : 'gray'}>
                  {progress >= 40 ? '✓' : '○'} Version created
                </Text>
              </Box>
              <Box>
                <Text color={progress >= 70 ? 'green' : 'gray'}>
                  {progress >= 70 ? '✓' : '○'} Files uploaded
                </Text>
              </Box>
              <Box>
                <Text color={progress >= 85 ? 'green' : 'gray'}>
                  {progress >= 85 ? '✓' : '○'} Theme installed
                </Text>
              </Box>
              <Box>
                <Text color={progress >= 100 ? 'green' : 'gray'}>
                  {progress >= 100 ? '✓' : '○'} Theme activated
                </Text>
              </Box>
            </Box>
          </Box>
        );

      case 'complete':
        return (
          <Box flexDirection="column">
            <Text color="green" bold>✨ Preview Deployed Successfully!</Text>
            <Box marginTop={1}>
              <Text>Your theme is now live at:</Text>
            </Box>
            <Box marginTop={1}>
              <Link url={previewUrl}>
                <Text color="cyan" underline>{previewUrl}</Text>
              </Link>
            </Box>
            <Box marginTop={1}>
              <Text dimColor italic>Opening in browser...</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>[Enter/Space/Esc] Continue</Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection="column">
            <Text color="red" bold>❌ Deployment Failed</Text>
            <Box marginTop={1}>
              <Text>{error}</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>[Esc] Back</Text>
            </Box>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Deploy Preview
          </Text>
        </Box>
        {renderStep()}
      </Box>
    </Box>
  );
};