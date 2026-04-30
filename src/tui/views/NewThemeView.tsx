import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { resolve } from 'path';
import {
  createThemeFromTemplate,
  registerExistingTheme,
  TEMPLATE_REPO_URL,
} from '../../utils/createTheme.js';

interface NewThemeViewProps {
  onComplete: (themeName?: string, themePath?: string) => void;
  onBack: () => void;
}

type Step =
  | 'mode'
  | 'name-clone'
  | 'name-existing'
  | 'path-existing'
  | 'creating'
  | 'complete';

type Mode = 'clone' | 'existing';

export const NewThemeView: React.FC<NewThemeViewProps> = ({
  onComplete,
  onBack,
}) => {
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<Mode>('clone');
  const [themeName, setThemeName] = useState('');
  const [existingPath, setExistingPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdPath, setCreatedPath] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  useInput((_input: string, key: any) => {
    if (key.escape) {
      if (step === 'mode') {
        onBack();
      } else if (step === 'name-clone' || step === 'name-existing') {
        setStep('mode');
        setError(null);
      } else if (step === 'path-existing') {
        setStep('name-existing');
        setError(null);
      }
      return;
    }

    if (key.return) {
      if (step === 'name-clone') {
        void handleCloneSubmit();
      } else if (step === 'name-existing') {
        handleExistingNameSubmit();
      } else if (step === 'path-existing') {
        void handleExistingPathSubmit();
      }
    }
  });

  const handleModeSelect = (item: { value: Mode }) => {
    setMode(item.value);
    setError(null);
    if (item.value === 'clone') {
      setStep('name-clone');
    } else {
      setStep('name-existing');
    }
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) return 'Theme name is required';
    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Theme name must be lowercase with hyphens only';
    }
    return null;
  };

  const handleCloneSubmit = async () => {
    const validation = validateName(themeName);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep('creating');
    setProgressMsg(`Cloning template from ${TEMPLATE_REPO_URL}...`);

    try {
      const resolvedPath = await createThemeFromTemplate({
        themeName,
        targetDir: themeName,
        skipGit: false,
        onProgress: msg => setProgressMsg(msg),
      });

      process.chdir(resolvedPath);
      setCreatedPath(resolvedPath);
      setStep('complete');

      setTimeout(() => {
        onComplete(themeName, resolvedPath);
      }, 2500);
    } catch (err) {
      setError(`Failed to create theme: ${(err as Error).message}`);
      setStep('name-clone');
    }
  };

  const handleExistingNameSubmit = () => {
    const validation = validateName(themeName);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep('path-existing');
  };

  const handleExistingPathSubmit = async () => {
    if (!existingPath.trim()) {
      setError('Path is required');
      return;
    }
    setError(null);
    setStep('creating');
    setProgressMsg('Registering existing directory...');

    try {
      const resolvedPath = await registerExistingTheme({
        themeName,
        existingPath: existingPath.trim(),
        onProgress: msg => setProgressMsg(msg),
      });

      process.chdir(resolvedPath);
      setCreatedPath(resolvedPath);
      setStep('complete');

      setTimeout(() => {
        onComplete(themeName, resolvedPath);
      }, 2500);
    } catch (err) {
      setError(`Failed to register theme: ${(err as Error).message}`);
      setStep('path-existing');
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
      >
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ✨ Create New Theme
          </Text>
        </Box>

        {step === 'mode' && (
          <Box flexDirection="column">
            <Text>How would you like to start your theme?</Text>
            <Box marginTop={1}>
              <SelectInput
                items={[
                  {
                    label: '📥 Clone the default Growth Theme template',
                    value: 'clone',
                  },
                  {
                    label: '📂 Use an existing local directory',
                    value: 'existing',
                  },
                ]}
                onSelect={handleModeSelect as any}
                indicatorComponent={({ isSelected }: any) => (
                  <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
                )}
                itemComponent={({ label, isSelected }: any) => (
                  <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
                )}
              />
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                The clone option fetches the official template from:
              </Text>
              <Text color="cyan" dimColor>
                {'  '}
                {TEMPLATE_REPO_URL}
              </Text>
              <Text dimColor>
                The existing-directory option registers a folder you already
                have so vitrin can build/push it without copying files.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>↑↓ Navigate • Enter to select • Esc to go back</Text>
            </Box>
          </Box>
        )}

        {step === 'name-clone' && (
          <Box flexDirection="column">
            <Text>Theme name (lowercase letters, numbers, hyphens):</Text>
            <Box marginTop={1}>
              <TextInput
                value={themeName}
                onChange={setThemeName}
                placeholder="my-awesome-theme"
              />
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                A new directory <Text color="cyan">./{themeName || '<name>'}</Text>{' '}
                will be created.
              </Text>
              <Text dimColor>
                Template will be cloned from{' '}
                <Text color="cyan">{TEMPLATE_REPO_URL}</Text>.
              </Text>
              <Text dimColor>
                The path is saved locally and globally so the theme is tracked
                even before you push.
              </Text>
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">⚠️ {error}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Enter to continue • Esc to go back</Text>
            </Box>
          </Box>
        )}

        {step === 'name-existing' && (
          <Box flexDirection="column">
            <Text>Give this theme a name (used as a label):</Text>
            <Box marginTop={1}>
              <TextInput
                value={themeName}
                onChange={setThemeName}
                placeholder="my-existing-theme"
              />
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">⚠️ {error}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Enter to continue • Esc to go back</Text>
            </Box>
          </Box>
        )}

        {step === 'path-existing' && (
          <Box flexDirection="column">
            <Text>Path to the existing theme directory:</Text>
            <Box marginTop={1}>
              <TextInput
                value={existingPath}
                onChange={setExistingPath}
                placeholder="./my-theme or /absolute/path"
              />
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                Resolved:{' '}
                <Text color="cyan">
                  {existingPath
                    ? resolve(process.cwd(), existingPath)
                    : '<path>'}
                </Text>
              </Text>
              <Text dimColor>
                A .vitrin/theme.json will be written there to track the theme.
              </Text>
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">⚠️ {error}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Enter to continue • Esc to go back</Text>
            </Box>
          </Box>
        )}

        {step === 'creating' && (
          <Box flexDirection="column">
            <Box>
              <Spinner type="dots" />
              <Text> {progressMsg || `Working on "${themeName}"...`}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>This may take a few moments...</Text>
            </Box>
          </Box>
        )}

        {step === 'complete' && (
          <Box flexDirection="column">
            <Text color="green" bold>
              ✓ {mode === 'clone' ? 'Theme created' : 'Theme registered'}{' '}
              successfully!
            </Text>
            <Box marginTop={1}>
              <Text>Path: </Text>
              <Text color="cyan">{createdPath}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Saved to local .vitrin/theme.json</Text>
              <Text dimColor>Saved to global ~/.vitrin/themes.json</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Next steps:</Text>
              <Text dimColor> 1. vitrin build</Text>
              <Text dimColor> 2. vitrin push</Text>
              <Box marginTop={1}>
                <Text color="cyan">Switching to theme directory...</Text>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
