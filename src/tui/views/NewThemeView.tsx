import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { ThemeManager } from '../../core/theme.js';

interface NewThemeViewProps {
  onComplete: (themeName?: string, themePath?: string) => void;
  onBack: () => void;
}

export const NewThemeView: React.FC<NewThemeViewProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState<'name' | 'creating' | 'complete'>('name');
  const [themeName, setThemeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdPath, setCreatedPath] = useState('');

  useInput((input: string, key: any) => {
    if (key.escape) {
      onBack();
    } else if (key.return && step === 'name') {
      handleNameSubmit();
    }
  });

  const handleNameSubmit = async () => {
    if (!themeName.trim()) {
      setError('Theme name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(themeName)) {
      setError('Theme name must be lowercase with hyphens only');
      return;
    }
    setError(null);
    setStep('creating');
    
    try {
      const { resolve, join } = await import('path');
      const fs = (await import('fs')).promises;
      const { execSync } = await import('child_process');
      
      const targetDir = themeName;
      const resolvedPath = resolve(process.cwd(), targetDir);
      
      try {
        await fs.access(resolvedPath);
        setError(`Directory already exists: ${resolvedPath}`);
        setStep('name');
        return;
      } catch {
      }
      
      const templateRepo = 'https://github.com/zidsa/soft-theme-vitrin.git';
      
      try {
        execSync(`git clone ${templateRepo} "${resolvedPath}"`, {
          stdio: 'pipe'
        });
      } catch (cloneError) {
        setError('Failed to create theme. Please check your internet connection.');
        setStep('name');
        return;
      }
      
      try {
        const gitDir = join(resolvedPath, '.git');
        await fs.rm(gitDir, { recursive: true, force: true });
      } catch {
      }
      
      const packageJsonPath = join(resolvedPath, 'package.json');
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );
      packageJson.name = themeName.toLowerCase().replace(/\s+/g, '-');
      packageJson.description = `${themeName} theme created with Vitrin CLI`;
      packageJson.version = '1.0.0';
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      const themeManager = new ThemeManager(resolvedPath);
      await themeManager.init({
        name: themeName,
        createdAt: new Date().toISOString()
      });
      
      process.chdir(resolvedPath);
      
      setCreatedPath(resolvedPath);
      setStep('complete');
      
      setTimeout(() => {
        onComplete(themeName, resolvedPath);
      }, 3000);
    } catch (err) {
      setError(`Failed to create theme: ${(err as Error).message}`);
      setStep('name');
    }
  };


  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Create New Theme
          </Text>
        </Box>

        {step === 'name' && (
          <Box flexDirection="column">
            <Text>Enter theme name:</Text>
            <Box marginTop={1}>
              <TextInput
                value={themeName}
                onChange={setThemeName}
                placeholder="my-awesome-theme"
              />
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">⚠️ {error}</Text>
              </Box>
            )}
            <Box marginTop={2}>
              <Text dimColor>[Enter] Continue • [Esc] Cancel</Text>
            </Box>
          </Box>
        )}


        {step === 'creating' && (
          <Box flexDirection="column">
            <Box>
              <Spinner type="dots" />
              <Text> Creating theme "{themeName}"...</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>This may take a few moments...</Text>
            </Box>
          </Box>
        )}

        {step === 'complete' && (
          <Box flexDirection="column">
            <Text color="green" bold>✓ Theme created successfully!</Text>
            <Box marginTop={1}>
              <Text>Theme created at: {createdPath}</Text>
            </Box>
            <Box marginTop={2} flexDirection="column">
              <Box>
                <Text dimColor>Next steps:</Text>
              </Box>
              <Box>
                <Text dimColor>  1. Build your theme: vitrin build</Text>
              </Box>
              <Box>
                <Text dimColor>  2. Push to Zid: vitrin push</Text>
              </Box>
              <Box marginTop={1}>
                <Text color="cyan">Switching to new theme directory...</Text>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};