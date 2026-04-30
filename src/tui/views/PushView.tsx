import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { ThemeManager } from '../../core/theme.js';
import api from '../../core/api.js';
import auth from '../../core/auth.js';
import buildService from '../../utils/build.js';
import {
  findDiscouragedTemplates,
  removeDiscouragedTemplates,
} from '../../utils/themeValidation.js';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import FormData from 'form-data';
import {
  bumpSemVer,
  formatSemVer,
  isValidSemVer,
  nextVersions,
  parseSemVer,
  type BumpKind,
} from '../../utils/version.js';

interface PushViewProps {
  onComplete: () => void;
  onBack: () => void;
}

interface DevStore {
  store_id: string;
  email: string;
  name: string;
}

type WizardStep =
  | 'select-store'
  | 'discouraged-templates'
  | 'strategy'
  | 'confirm-new'
  | 'bump'
  | 'custom-version'
  | 'changelog-en'
  | 'changelog-ar'
  | 'review';

type Strategy = 'keep' | 'new';

export default function PushView({ onComplete, onBack }: PushViewProps) {
  const [state, setState] = useState<
    'checking' | 'wizard' | 'pushing' | 'complete' | 'error'
  >('checking');
  const [step, setStep] = useState<WizardStep>('select-store');
  const [stores, setStores] = useState<DevStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [strategy, setStrategy] = useState<Strategy>('keep');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [computedVersion, setComputedVersion] = useState<string>('');
  const [customVersionInput, setCustomVersionInput] = useState<string>('');
  const [changelogEn, setChangelogEn] = useState<string>('');
  const [changelogAr, setChangelogAr] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [stepError, setStepError] = useState<string>('');
  const [discouragedTemplates, setDiscouragedTemplates] = useState<string[]>(
    []
  );

  useEffect(() => {
    void checkAuth();
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
      const response = await api.getDevStores();
      const storeList = response.stores.map((store: any) => ({
        store_id: store.store_id,
        email: store.email,
        name: store.name,
      }));
      setStores(storeList);
      setState('wizard');
      setStep('select-store');
    } catch (err) {
      setError(`Failed to load stores: ${err}`);
      setState('error');
    }
  };

  const fetchLatestVersion = async (): Promise<string | null> => {
    try {
      const tm = new ThemeManager(process.cwd());
      const cfg = await tm.getConfig();
      if (!cfg.id) return null;
      const list = await api.listThemeVersions(cfg.id, { page_size: 1 });
      const latest = list?.results?.[0];
      return latest?.version ?? null;
    } catch {
      return null;
    }
  };

  useInput((input, key) => {
    if (state === 'complete' || state === 'error') {
      onBack();
      return;
    }

    if (key.escape) {
      if (state === 'wizard') {
        if (step === 'select-store') {
          onBack();
        } else if (step === 'discouraged-templates') {
          setStep('select-store');
        } else if (step === 'strategy') {
          setStep(
            discouragedTemplates.length > 0
              ? 'discouraged-templates'
              : 'select-store'
          );
        } else if (step === 'confirm-new') {
          setStep('strategy');
        } else if (step === 'bump') {
          setStep('confirm-new');
        } else if (step === 'custom-version') {
          setStep('bump');
        } else if (step === 'changelog-en') {
          setStep(strategy === 'new' ? 'bump' : 'strategy');
        } else if (step === 'changelog-ar') {
          setStep('changelog-en');
        } else if (step === 'review') {
          setStep('changelog-ar');
        }
      } else {
        onBack();
      }
      return;
    }

    if (state !== 'wizard') return;

    if (step === 'changelog-en' && key.return) {
      if (!changelogEn.trim()) {
        setStepError('English changelog is required');
        return;
      }
      setStepError('');
      setStep('changelog-ar');
    } else if (step === 'changelog-ar' && key.return) {
      setStepError('');
      setStep('review');
    } else if (step === 'custom-version' && key.return) {
      const trimmed = customVersionInput.trim();
      if (!isValidSemVer(trimmed)) {
        setStepError('Use format X.Y.Z (e.g., 1.2.3)');
        return;
      }
      const parsed = parseSemVer(trimmed)!;
      const base = parseSemVer(latestVersion);
      if (base) {
        const isHigher =
          parsed.major > base.major ||
          (parsed.major === base.major && parsed.minor > base.minor) ||
          (parsed.major === base.major &&
            parsed.minor === base.minor &&
            parsed.patch > base.patch);
        if (!isHigher) {
          setStepError(
            `Custom version must be higher than current latest ${formatSemVer(base)}`
          );
          return;
        }
      }
      setComputedVersion(trimmed);
      setStepError('');
      setStep('changelog-en');
    } else if (step === 'review' && key.return) {
      void pushTheme();
    }
  });

  const handleStoreSelect = async (item: { value: string }) => {
    if (item.value === 'back') {
      onBack();
      return;
    }
    setSelectedStore(item.value);

    const found = await findDiscouragedTemplates(process.cwd());
    setDiscouragedTemplates(found);
    setStep(found.length > 0 ? 'discouraged-templates' : 'strategy');
  };

  const handleDiscouragedSelect = async (item: {
    value: 'upload' | 'remove' | 'cancel';
  }) => {
    if (item.value === 'cancel') {
      onBack();
      return;
    }
    if (item.value === 'remove') {
      await removeDiscouragedTemplates(process.cwd(), discouragedTemplates);
      setDiscouragedTemplates([]);
    }
    setStep('strategy');
  };

  const handleStrategySelect = async (item: { value: Strategy }) => {
    setStrategy(item.value);
    setStepError('');

    if (item.value === 'keep') {
      // Update latest — keep current version, just take new changelog
      const latest = await fetchLatestVersion();
      setLatestVersion(latest);
      setComputedVersion(latest || '1.0.0');
      setStep('changelog-en');
    } else {
      // New version — show confirmation first
      const latest = await fetchLatestVersion();
      setLatestVersion(latest);
      setStep('confirm-new');
    }
  };

  const handleConfirmNew = (item: { value: string }) => {
    if (item.value === 'cancel') {
      setStep('strategy');
      return;
    }
    setStep('bump');
  };

  const handleBumpSelect = (item: { value: BumpKind | 'custom' }) => {
    if (item.value === 'custom') {
      setCustomVersionInput('');
      setStep('custom-version');
      return;
    }
    const base = parseSemVer(latestVersion) ?? { major: 1, minor: 0, patch: 0 };
    setComputedVersion(formatSemVer(bumpSemVer(base, item.value)));
    setStep('changelog-en');
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const pushTheme = async () => {
    try {
      setState('pushing');
      const themePath = process.cwd();

      addLog('🔎 Validating theme directory...');
      const validation =
        await buildService.validateThemeStructureDetailed(themePath);
      if (!validation.valid) {
        throw new Error(
          `Missing ${validation.missing.join(', ')} in ${validation.resolvedPath}. ` +
            `Refusing to push: this directory is not a theme. ` +
            `Use 'Switch Theme' or cd to the actual theme folder.`
        );
      }

      addLog('🛠️  Compiling theme assets...');
      const assetResult = await buildService.runAssetBuild(themePath, line =>
        addLog(`   ${line.length > 80 ? line.slice(0, 80) + '…' : line}`)
      );
      if (!assetResult.ran) {
        addLog(`   skipped (${assetResult.reason})`);
      } else {
        addLog(`   ✓ Built with ${assetResult.installer}`);
      }

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
          description: {
            en: pkg.description || 'Theme',
            ar: pkg.description || 'Theme',
          },
          version: pkg.version || '1.0.0',
          slug:
            pkg.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
            themeDirName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        };
      } else {
        themeJson = {
          name: { en: themeDirName, ar: themeDirName },
          description: { en: 'Theme', ar: 'Theme' },
          version: '1.0.0',
          slug:
            themeDirName.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
            `theme-${Date.now()}`,
        };
      }

      addLog('📦 Building theme package...');
      const distDir = join(themePath, '.vitrin', 'dist');
      await fs.mkdir(distDir, { recursive: true });
      const packagePath = join(distDir, 'theme.zip');

      const archiver = (await import('archiver')).default;
      const { createWriteStream } = await import('fs');
      const output = createWriteStream(packagePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      await new Promise<void>((resolveP, rejectP) => {
        output.on('close', () => resolveP());
        output.on('error', rejectP);
        archive.on('error', rejectP);
        archive.pipe(output);
        archive.glob('**/*', {
          cwd: themePath,
          ignore: ['*.git*', '**/node_modules/**', '**/.vitrin/**', '*.zip'],
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
          description:
            themeJson.description || { en: 'A new theme', ar: 'موضوع جديد' },
          slug: themeJson.slug || `theme-${Date.now()}`,
        });
        await themeManager.updateThemeId(theme.id, theme.slug);
        addLog(`✅ Created theme: ${theme.name.en}`);
      }

      addLog(
        strategy === 'keep'
          ? '📝 Updating latest version...'
          : `📝 Creating new version ${computedVersion}...`
      );

      const versionToUse =
        computedVersion || latestVersion || themeJson.version || '1.0.0';

      const changelog: { en: string; ar?: string } = {
        en: changelogEn.trim() || 'Updated theme',
      };
      if (changelogAr.trim()) {
        changelog.ar = changelogAr.trim();
      }

      const versionResponse = await api.createThemeVersion(theme.id, {
        version: versionToUse,
        changelog,
        keep_using_latest: strategy === 'keep',
      });

      const versionData = versionResponse.theme_version || versionResponse;
      const uploadData = {
        upload_url: versionResponse.upload_url,
        upload_fields: versionResponse.upload_fields,
        key: versionResponse.key,
        max_size_mb: versionResponse.max_size_mb,
      };

      addLog(`✅ Version ${versionData.version} ready`);

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
        contentType: 'application/zip',
      });

      const axios = (await import('axios')).default;
      const s3Response = await axios.post(uploadData.upload_url, form, {
        headers: { ...form.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (s3Response.status >= 400) {
        throw new Error('Failed to upload to S3');
      }

      addLog('Finalizing...');
      try {
        await api.notifyArtifactUpload(theme.id, versionData.id, {
          key: uploadData.upload_fields.key,
        });
        addLog('✅ Upload complete');
      } catch (err) {
        throw new Error('Failed to finalize:', err as Error);
      }

      addLog('✅ Theme uploaded successfully');

      const pushRecord: any = {
        themeId: theme.id,
        versionId: versionData.id,
        version: versionData.version,
        pushedAt: new Date().toISOString(),
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

        await api.installTheme(selectedStore, theme.id, versionData.id);
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

  if (state === 'pushing') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue" bold>🚀 Pushing theme to Zid...</Text>
        <Box flexDirection="column" marginTop={1}>
          {logs.map((log, i) => (
            <Text key={i} dimColor>{log}</Text>
          ))}
          <Text color="blue">
            <Spinner type="dots" /> Processing...
          </Text>
        </Box>
      </Box>
    );
  }

  if (state === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>
          ✅ Theme pushed successfully ({computedVersion})!
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue</Text>
        </Box>
      </Box>
    );
  }

  // Wizard steps
  if (step === 'select-store') {
    const items = [
      { label: '🚀 Push without installing', value: 'none' },
      ...stores.map(store => ({
        label: `🏪 ${store.name} (${store.email})`,
        value: store.store_id,
      })),
      { label: '← Back', value: 'back' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Step 1 — Deployment target:</Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={item => void handleStoreSelect(item)}
          />
        </Box>
      </Box>
    );
  }

  if (step === 'discouraged-templates') {
    const items = [
      { label: 'Upload them anyway', value: 'upload' as const },
      {
        label: 'Remove them and use platform defaults',
        value: 'remove' as const,
      },
      { label: 'Cancel push', value: 'cancel' as const },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow" bold>
          ⚠️  Discouraged templates detected
        </Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text dimColor>
            Zid manages these templates with platform defaults. Uploading them
            overrides the defaults — only do this if you intend to customize
            them.
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {discouragedTemplates.map(template => (
              <Text key={template} color="yellow">
                • {template}
              </Text>
            ))}
          </Box>
        </Box>
        <SelectInput
          items={items}
          onSelect={item => void handleDiscouragedSelect(item)}
        />
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'strategy') {
    const items = [
      {
        label: '🩹 Update latest version  (templates / bugfixes / copy)',
        value: 'keep' as Strategy,
      },
      {
        label: '🆕 Create a new version  (asset paths changed / breaking)',
        value: 'new' as Strategy,
      },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Step 2 — Version strategy:</Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text dimColor>
            • Update latest (default): ships in-place. Safe for template
          </Text>
          <Text dimColor>
            {'  '}patches, translation tweaks and bugfixes that don't move
          </Text>
          <Text dimColor>{'  '}asset URLs.</Text>
          <Text dimColor>
            • New version: required when asset paths change. Older installs
          </Text>
          <Text dimColor>
            {'  '}stay on the previous version so cached assets still match.
          </Text>
          {latestVersion && (
            <Text dimColor>
              Current latest: <Text color="cyan">{latestVersion}</Text>
            </Text>
          )}
        </Box>
        <SelectInput
          items={items}
          onSelect={item => void handleStrategySelect(item as any)}
          indicatorComponent={({ isSelected }: any) => (
            <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
          )}
          itemComponent={({ label, isSelected }: any) => (
            <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
          )}
        />
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'confirm-new') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow" bold>⚠️  Create a new version?</Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text>
            A new version is permanent — existing stores stay on their
            current version until they explicitly update. Make sure you need
            this rather than updating the latest version in place.
          </Text>
          {latestVersion ? (
            <Text dimColor>
              Current latest version: <Text color="cyan">{latestVersion}</Text>
            </Text>
          ) : (
            <Text dimColor>
              No previous version found — this will be the first version.
            </Text>
          )}
        </Box>
        <SelectInput
          items={[
            { label: 'Yes, cut a new version', value: 'confirm' },
            { label: 'No, go back to strategy', value: 'cancel' },
          ]}
          onSelect={handleConfirmNew}
        />
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'bump') {
    const next = nextVersions(latestVersion);
    const items = [
      {
        label: `🩹 Patch  → ${next.patch}  (bugfix-level changes)`,
        value: 'patch' as BumpKind,
      },
      {
        label: `✨ Minor  → ${next.minor}  (backwards-compatible additions)`,
        value: 'minor' as BumpKind,
      },
      {
        label: `🚀 Major  → ${next.major}  (breaking changes)`,
        value: 'major' as BumpKind,
      },
      { label: '✏️  Enter a custom version', value: 'custom' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Step 3 — Bump strategy:</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>
            Current latest:{' '}
            <Text color="cyan">{latestVersion || '(none)'}</Text>
          </Text>
        </Box>
        <SelectInput
          items={items}
          onSelect={item => handleBumpSelect(item as any)}
          indicatorComponent={({ isSelected }: any) => (
            <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
          )}
          itemComponent={({ label, isSelected }: any) => (
            <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
          )}
        />
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'custom-version') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Custom version (X.Y.Z):</Text>
        <Box marginTop={1}>
          <TextInput
            value={customVersionInput}
            onChange={setCustomVersionInput}
            placeholder="2.0.0"
          />
        </Box>
        {latestVersion && (
          <Box marginTop={1}>
            <Text dimColor>
              Must be greater than {latestVersion}.
            </Text>
          </Box>
        )}
        {stepError && (
          <Box marginTop={1}>
            <Text color="red">❌ {stepError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>Enter to continue • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'changelog-en') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          Step 4 — Changelog (English):
        </Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>
            {strategy === 'keep'
              ? `Will update latest version ${latestVersion ?? '(unknown)'} in place.`
              : `Will create new version ${computedVersion}.`}
          </Text>
        </Box>
        <TextInput
          value={changelogEn}
          onChange={setChangelogEn}
          placeholder="What changed in this version"
        />
        {stepError && (
          <Box marginTop={1}>
            <Text color="red">❌ {stepError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>Enter to continue • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'changelog-ar') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          Step 4 — Changelog (Arabic, optional):
        </Text>
        <Box marginTop={1}>
          <TextInput
            value={changelogAr}
            onChange={setChangelogAr}
            placeholder="ما الذي تغير في هذا الإصدار (اختياري)"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter to continue • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'review') {
    const targetStore = stores.find(s => s.store_id === selectedStore);
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>Review — about to push:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text dimColor>Strategy: </Text>
            <Text color="yellow">
              {strategy === 'keep'
                ? `Update latest version (${latestVersion ?? 'unknown'}) in place`
                : `Create new version ${computedVersion}`}
            </Text>
          </Text>
          <Text>
            <Text dimColor>Deployment: </Text>
            {selectedStore === 'none'
              ? 'push without installing'
              : `install on ${targetStore?.name || selectedStore}`}
          </Text>
          <Text>
            <Text dimColor>Changelog (en): </Text>
            {changelogEn}
          </Text>
          {changelogAr && (
            <Text>
              <Text dimColor>Changelog (ar): </Text>
              {changelogAr}
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="green">[Enter] Push now</Text>
          <Text dimColor> • [Esc] Go back</Text>
        </Box>
      </Box>
    );
  }

  return null;
}
