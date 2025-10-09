import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { ProgressBar } from '../components/ProgressBar.js';
import buildService from '../../utils/build.js';

interface BuildViewProps {
  themePath: string;
  themeName: string;
  onComplete: () => void;
  onBack: () => void;
}

interface BuildStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
}

export const BuildView: React.FC<BuildViewProps> = ({
  themePath,
  themeName,
  onComplete,
  onBack,
}) => {
  const [steps, setSteps] = useState<BuildStep[]>([
    { name: 'Validating theme structure', status: 'pending' },
    { name: 'Cleaning system files', status: 'pending' },
    { name: 'Counting theme files', status: 'pending' },
    { name: 'Creating theme.zip archive', status: 'pending' },
    { name: 'Verifying build output', status: 'pending' },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [buildSize, setBuildSize] = useState<string>('');
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useInput((input: string, key: any) => {
    if (key.escape || input === 'q') {
      onBack();
    }
  });

  useEffect(() => {
    if (!themePath || !themeName) {
      setError('No theme selected');
      return;
    }

    const runBuild = async () => {
      try {
        const { resolve } = await import('path');
        const fs = (await import('fs')).promises;
        
        updateStep(0, 'running');
        const isValid = await buildService.validateThemeStructure(themePath);
        if (!isValid) {
          throw new Error('Invalid theme structure');
        }
        updateStep(0, 'completed');

        updateStep(1, 'running');
        await buildService.removeDSStore(themePath);
        updateStep(1, 'completed');

        updateStep(2, 'running');
        const countFiles = async (dir: string): Promise<number> => {
          let count = 0;
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile()) {
              count++;
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              count += await countFiles(resolve(dir, entry.name));
            }
          }
          return count;
        };
        
        const totalFiles = await countFiles(themePath);
        setFileCount(totalFiles);
        updateStep(2, 'completed');

        updateStep(3, 'running');
        const outputPath = await buildService.zipTheme(themeName, themePath, {
          compression: 9,
          useTemp: false,
        });
        
        const stats = await fs.stat(outputPath);
        setBuildSize(`${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        updateStep(3, 'completed');

        updateStep(4, 'running');
        try {
          await fs.access(outputPath);
        } catch {
          throw new Error('Build output verification failed');
        }
        updateStep(4, 'completed');

        setTimeout(() => {
          onComplete();
        }, 1000);
      } catch (err) {
        setError((err as Error).message);
        updateStep(currentStep, 'error');
      }
    };

    void runBuild();
  }, [themePath, themeName]);

  const updateStep = (index: number, status: BuildStep['status']) => {
    setSteps(prev => {
      const newSteps = [...prev];
      newSteps[index]!.status = status;
      return newSteps;
    });
    if (status === 'completed' && index < steps.length - 1) {
      setCurrentStep(index + 1);
    }
  };

  const getStepIcon = (status: BuildStep['status']) => {
    switch (status) {
      case 'completed':
        return <Text color="green">✓</Text>;
      case 'running':
        return <Text color="cyan"><Spinner type="dots" /></Text>;
      case 'error':
        return <Text color="red">✗</Text>;
      default:
        return <Text color="gray">○</Text>;
    }
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalProgress = (completedSteps / steps.length) * 100;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Building Theme
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>📦 {themeName || 'Unknown Theme'}</Text>
        </Box>

        <Box flexDirection="column" marginY={1}>
          {steps.map((step, index) => (
            <Box key={index} marginBottom={1}>
              <Box width={3}>{getStepIcon(step.status)}</Box>
              <Text color={step.status === 'running' ? 'cyan' : step.status === 'completed' ? 'green' : 'gray'}>
                {step.name}
              </Text>
              {step.progress !== undefined && step.status === 'running' && (
                <Box marginLeft={2}>
                  <ProgressBar percent={step.progress / 100} />
                  <Text color="gray"> {step.progress}%</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {error ? (
          <Box marginTop={1}>
            <Text color="red">❌ Error: {error}</Text>
          </Box>
        ) : (
          <>
            <Box marginTop={1}>
              <Text>Overall Progress: </Text>
              <Box width={30}>
                <ProgressBar percent={totalProgress / 100} />
              </Box>
              <Text> {Math.round(totalProgress)}%</Text>
            </Box>

            {buildSize && (
              <Box marginTop={1}>
                <Text color="gray">
                  Size: {buildSize} • Files: {fileCount}
                </Text>
              </Box>
            )}
          </>
        )}

        <Box marginTop={1}>
          <Text dimColor>[Esc] Cancel</Text>
        </Box>
      </Box>
    </Box>
  );
};