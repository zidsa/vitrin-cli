import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { ThemeManager } from '../../core/theme.js';
import api from '../../core/api.js';
import auth from '../../core/auth.js';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import FormData from 'form-data';

interface PushViewProps {
  onComplete: () => void;
  onBack: () => void;
}

interface DevStore {
  store_id: string;
  email: string;
  name: string;
}

export default function PushView({ onComplete, onBack }: PushViewProps) {
  const [state, setState] = useState<'checking' | 'select-store' | 'pushing' | 'complete' | 'error'>('checking');
  const [stores, setStores] = useState<DevStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [changelog, setChangelog] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [enteringVersion, setEnteringVersion] = useState(false);
  const [enteringChangelog, setEnteringChangelog] = useState(false);

  useInput((input, key) => {
    if (state === 'complete' || state === 'error') {
      onBack();
      return;
    }
    
    if (key.return) {
      if (enteringVersion) {
        setEnteringVersion(false);
        setEnteringChangelog(true);
      } else if (enteringChangelog) {
        setEnteringChangelog(false);
        pushTheme();
      }
    }
    if (key.escape) {
      onBack();
    }
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await auth.getToken();
      if (!token) {
        setError('Not authenticated. Please login first.');
        setState('error');
        return;
      }
      await loadStores();
    } catch (err) {
      setError(`Authentication check failed: ${err}`);
      setState('error');
    }
  };

  const loadStores = async () => {
    try {
      setStatus('Loading dev stores...');
      const response = await api.getDevStores();
      const storeList = response.stores.map((store: any) => ({
        store_id: store.store_id,
        email: store.email,
        name: store.name
      }));
      setStores(storeList);
      setState('select-store');
    } catch (err) {
      setError(`Failed to load stores: ${err}`);
      setState('error');
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const pushTheme = async () => {
    try {
      setState('pushing');
      const themePath = process.cwd();
      const themeManager = new ThemeManager(themePath);
      const themeConfig = await themeManager.getConfig();
      
      addLog('📖 Reading theme configuration...');
      let themeJson: any;
      const themeJsonPath = join(themePath, 'theme.json');
      const packageJsonPath = join(themePath, 'package.json');
      const { basename } = await import('path');
      const themeDirName = basename(themePath);

      if (existsSync(themeJsonPath)) {
        themeJson = JSON.parse(await fs.readFile(themeJsonPath, 'utf8'));
      } else if (existsSync(packageJsonPath)) {
        const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        themeJson = {
          name: { en: pkg.name || themeDirName, ar: pkg.name || themeDirName },
          description: { en: pkg.description || 'Theme', ar: pkg.description || 'Theme' },
          version: pkg.version || '1.0.0',
          slug: pkg.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || themeDirName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          minimum_api_version: '1.0.0'
        };
      } else {
        themeJson = {
          name: { en: themeDirName, ar: themeDirName },
          description: { en: 'Theme', ar: 'Theme' },
          version: '1.0.0',
          slug: themeDirName.toLowerCase().replace(/[^a-z0-9]/g, '-') || `theme-${Date.now()}`,
          minimum_api_version: '1.0.0'
        };
      }
      
      addLog('📦 Building theme package...');
      const distDir = join(themePath, '.vitrin', 'dist');
      await fs.mkdir(distDir, { recursive: true });
      const packagePath = join(distDir, 'theme.zip');
      
      const archiver = (await import('archiver')).default;
      const { createWriteStream } = await import('fs');
      const output = createWriteStream(packagePath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
        
        archive.pipe(output);
        
        archive.glob('**/*', {
          cwd: themePath,
          ignore: [
            '*.git*',
            '**/node_modules/**',
            '**/.vitrin/**',
            '*.zip'
          ]
        });
        
        archive.finalize();
      });
      
      let theme: any;
      let isNewTheme = !themeConfig.id;
      
      if (themeConfig.id) {
        addLog('🔍 Checking existing theme...');
        try {
          theme = await api.getTheme(themeConfig.id);
          addLog(`✅ Found theme: ${theme.name.en}`);
        } catch {
          isNewTheme = true;
        }
      }
      
      if (isNewTheme) {
        addLog('✨ Creating new theme on Zid...');
        theme = await api.createTheme({
          name: themeJson.name || { en: 'New Theme', ar: 'موضوع جديد' },
          description: themeJson.description || { en: 'A new theme', ar: 'موضوع جديد' },
          slug: themeJson.slug || `theme-${Date.now()}`
        });
        await themeManager.updateThemeId(theme.id, theme.slug);
        addLog(`✅ Created theme: ${theme.name.en}`);
      }
      
      addLog('📝 Creating theme version...');
      let versionToUse = version || themeJson.version || '1.0.0';
      if (!/^\d+\.\d+\.\d+/.test(versionToUse)) {
        versionToUse = `${versionToUse}.0.0`.replace(/[^\d.]/g, '').split('.').slice(0, 3).join('.');
        if (!/^\d+\.\d+\.\d+$/.test(versionToUse)) {
          versionToUse = '1.0.0';
        }
      }
      const changelogToUse = changelog || 'Updated theme';
      
      const versionResponse = await api.createThemeVersion(theme.id, {
        version: versionToUse,
        minimum_api_version: themeJson.minimum_api_version || '1.0.0',
        changelog: { en: changelogToUse, ar: changelogToUse }
      });
      
      const versionData = versionResponse.theme_version || versionResponse;
      const uploadData = {
        upload_url: versionResponse.upload_url,
        upload_fields: versionResponse.upload_fields,
        key: versionResponse.key,
        max_size_mb: versionResponse.max_size_mb
      };
      
      addLog(`✅ Created version ${versionData.version}`);
      
      addLog('📤 Uploading to S3...');
      const fileBuffer = await fs.readFile(packagePath);
      const form = new FormData();
      
      if (uploadData.upload_fields.key) {
        form.append('key', uploadData.upload_fields.key);
      }
      if (uploadData.upload_fields.AWSAccessKeyId) {
        form.append('AWSAccessKeyId', uploadData.upload_fields.AWSAccessKeyId);
      }
      if (uploadData.upload_fields.policy) {
        form.append('policy', uploadData.upload_fields.policy);
      }
      if (uploadData.upload_fields.signature) {
        form.append('signature', uploadData.upload_fields.signature);
      }
      
      form.append('Content-Type', 'application/zip');
      
      form.append('file', fileBuffer, {
        filename: 'theme.zip',
        contentType: 'application/zip'
      });
      
      const axios = (await import('axios')).default;
      const s3Response = await axios.post(uploadData.upload_url, form, {
        headers: {
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      if (s3Response.status >= 400) {
        throw new Error('Failed to upload to S3');
      }
      addLog('✅ Theme uploaded successfully');
      
      const pushRecord: any = {
        themeId: theme.id,
        versionId: versionData.id,
        version: versionData.version,
        pushedAt: new Date().toISOString()
      };

      if (selectedStore && selectedStore !== 'none') {
        const targetStore = stores.find(s => s.store_id === selectedStore);
        pushRecord.store = targetStore?.name || selectedStore;
      }

      await themeManager.recordPush(pushRecord);
      
      if (selectedStore && selectedStore !== 'none') {
        const targetStore = stores.find(s => s.store_id === selectedStore);
        addLog(`🏪 Installing on store ${targetStore?.name || selectedStore}...`);

        if (!targetStore) {
          throw new Error(`Store with ID ${selectedStore} not found`);
        }

        await api.installTheme(
          selectedStore,
          theme.id,
          versionData.id
        );
        addLog('✅ Theme installed on store');
      }
      
      setState('complete');
    } catch (err) {
      setError(`Push failed: ${err}`);
      setState('error');
    }
  };

  if (state === 'checking') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue">
          <Spinner type="dots" /> Checking authentication...
        </Text>
      </Box>
    );
  }

  if (state === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue</Text>
        </Box>
      </Box>
    );
  }

  if (state === 'select-store') {
    if (enteringVersion) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="cyan">Enter version number (or press Enter for default):</Text>
          <Box marginTop={1}>
            <TextInput
              value={version}
              onChange={setVersion}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      );
    }

    if (enteringChangelog) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="cyan">Enter changelog (or press Enter for default):</Text>
          <Box marginTop={1}>
            <TextInput
              value={changelog}
              onChange={setChangelog}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to push theme</Text>
          </Box>
        </Box>
      );
    }

    const items = [
      { label: '🚀 Push without installing', value: 'none' },
      ...stores.map(store => ({
        label: `🏪 ${store.name} (${store.email})`,
        value: store.store_id
      })),
      { label: '← Back', value: 'back' }
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Select deployment target:</Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item) => {
              if (item.value === 'back') {
                onBack();
              } else {
                setSelectedStore(item.value);
                setEnteringVersion(true);
              }
            }}
          />
        </Box>
      </Box>
    );
  }

  if (state === 'pushing') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue" bold>🚀 Pushing theme to Zid...</Text>
        <Box flexDirection="column" marginTop={1}>
          {logs.map((log, i) => (
            <Text key={i} dimColor>{log}</Text>
          ))}
          <Text color="blue">
            <Spinner type="dots" /> {status || 'Processing...'}
          </Text>
        </Box>
      </Box>
    );
  }

  if (state === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>✅ Theme pushed successfully!</Text>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue</Text>
        </Box>
      </Box>
    );
  }

  return null;
}