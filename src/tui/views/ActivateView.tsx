import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { Divider } from '../components/Divider.js';
import { ThemeManager } from '../../core/theme.js';
import api from '../../core/api.js';
import logger from '../../utils/logger.js';

interface ActivateViewProps {
  themePath: string;
  themeName: string;
  onComplete: () => void;
  onBack: () => void;
}

interface Store {
  id: string;
  store_id: string;
  name: string;
  email?: string;
  store_link?: string;
}

interface Installation {
  id: string;
  store_id: string;
  store_name: string;
  installed_at: string;
  version?: string;
}

export const ActivateView: React.FC<ActivateViewProps> = ({
  themePath,
  themeName,
  onComplete,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'select-store' | 'installing' | 'activating' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('');

  useInput((input, key) => {
    if ((input === 'q' || key.escape) && !loading && !activating) {
      onBack();
    }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const themeManager = new ThemeManager(themePath);
        const config = await themeManager.getConfig();

        if (!config.id) {
          setError('Theme not pushed to Zid yet. Please push first.');
          setStep('error');
          return;
        }

        setThemeId(config.id);

        const savedInstallations = config.installations || [];
        setInstallations(savedInstallations);

        try {
          const response = await api.getDevStores();
          const storesList = response.stores || [];

          if (storesList.length === 0) {
            setError('No stores available. Please create a dev store first.');
            setStep('error');
            return;
          }

          setStores(storesList);
          setStep('select-store');
        } catch (err) {
          setError('Failed to load stores. Please check your connection.');
          setStep('error');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load theme data');
        setStep('error');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [themePath]);

  const installAndActivateTheme = async (store: Store) => {
    setStep('installing');
    setStatusMessage('Building theme...');

    let themeZipPath: string | null = null;

    try {
      const buildService = (await import('../../utils/build.js')).default;
      await buildService.removeDSStore(themePath);

      const themeNameBase = themeName.replace(/\s+/g, '-').toLowerCase();
      themeZipPath = await buildService.zipTheme(themeNameBase, themePath);

      setStatusMessage('Creating theme version...');

      const themeManager = new ThemeManager(themePath);
      const config = await themeManager.getConfig();

      if (!config.id) {
        throw new Error('Theme must be pushed first');
      }

      const versionInfo = {
        version: '1.0.0',
        minimum_api_version: '1.0',
        changelog: { en: 'Auto-install for activation' },
      };

      const versionData = await api.createThemeVersion(config.id, versionInfo);

      setStatusMessage('Uploading theme...');

      await api.uploadThemeArtifact(
        versionData.upload_url,
        versionData.upload_fields,
        themeZipPath
      );

      await buildService.cleanupZipFile(themeZipPath);
      themeZipPath = null;

      await api.notifyArtifactUpload(
        config.id,
        versionData.theme_version.id,
        { key: versionData.key }
      );

      setStatusMessage('Installing on store...');

      const installResponse = await api.installTheme(
        String(store.store_id),
        config.id,
        versionData.theme_version.id
      );

      const installations = config.installations || [];
      installations.push({
        id: installResponse.id,
        store_id: String(store.store_id),
        store_name: store.name,
        installed_at: new Date().toISOString(),
        version: versionData.theme_version.version,
      });

      await themeManager.updateConfig({ installations: installations.slice(-10) });

      setStatusMessage('Activating theme...');
      setStep('activating');

      await api.activateTheme(String(store.store_id), installResponse.id);

      logger.success(`✅ Theme installed and activated on ${store.name}!`);
      setTimeout(onComplete, 1500);

    } catch (err: any) {
      if (themeZipPath) {
        const buildService = (await import('../../utils/build.js')).default;
        await buildService.cleanupZipFile(themeZipPath);
      }

      logger.error(`Failed: ${err.message}`);
      setError(err.message || 'Failed to install and activate theme');
      setStep('error');
    }
  };

  const handleStoreSelect = async (item: { value: Store }) => {
    const store = item.value;
    setSelectedStore(store);

    const storeInstallations = installations.filter(inst =>
      inst.store_id === String(store.store_id)
    );

    if (storeInstallations.length === 0) {
      await installAndActivateTheme(store);
    } else {
      const latestInstallation = storeInstallations.sort((a, b) =>
        new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime()
      )[0];

      if (!latestInstallation) {
        await installAndActivateTheme(store);
        return;
      }

      setStep('activating');
      setActivating(true);

      try {
        await api.activateTheme(String(store.store_id), latestInstallation.id);

        logger.success(`✅ Theme activated on ${store.name}!`);

        const themeManager = new ThemeManager(themePath);
        const config = await themeManager.getConfig();
        const updatedInstallations = (config.installations || []).map((inst: Installation) =>
          inst.id === latestInstallation.id
            ? { ...inst, activated: true, activated_at: new Date().toISOString() }
            : inst
        );
        await themeManager.updateConfig({ installations: updatedInstallations });

        setTimeout(onComplete, 1500);
      } catch (err: any) {
        logger.error(`Failed to activate: ${err.message}`);
        setError(err.message || 'Failed to activate theme');
        setStep('error');
        setActivating(false);
      }
    }
  };

  if (step === 'loading' || loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🎯 Activate Theme</Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> Loading...
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'error') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🎯 Activate Theme</Text>
        <Divider />

        <Box marginTop={1}>
          <Text>Theme: {themeName}</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>Esc or q to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'installing') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🎯 Installing & Activating Theme</Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> {statusMessage}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Installing theme on {selectedStore?.name} for the first time...</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'activating' && activating) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🎯 Activate Theme</Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> Activating theme on {selectedStore?.name}...
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'select-store') {
    const storeItems = stores.map(store => {
      const storeInstalls = installations.filter(inst => inst.store_id === String(store.store_id));
      const latestInstall = storeInstalls.sort((a, b) =>
        new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime()
      )[0];

      return {
        label: latestInstall
          ? `${store.name} (Installed: ${new Date(latestInstall.installed_at).toLocaleDateString()})`
          : `${store.name} (Not installed - will install first)`,
        value: store,
      };
    });

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>🎯 Activate Theme</Text>
        <Divider />

        <Box marginTop={1}>
          <Text>Theme: {themeName}</Text>
        </Box>

        <Box marginTop={1}>
          <Text bold>Select store to activate theme:</Text>
        </Box>

        <Box marginTop={1}>
          <SelectInput
            items={storeItems}
            onSelect={handleStoreSelect}
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
            Arrow keys to navigate • Enter to activate • Esc/q to go back
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
};