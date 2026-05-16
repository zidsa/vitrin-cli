import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import open from 'open';
import { Divider } from '../components/Divider.js';
import { ThemeManager, Installation } from '../../core/theme.js';

interface ThemeEditorViewProps {
  themePath: string;
  themeName: string;
  onBack: () => void;
}

type Step = 'loading' | 'select' | 'opened' | 'error';

const buildEditorUrl = (storeId: string, installationId: string) =>
  `https://dashboard.zid.sa/ar-sa/stores/${storeId}/theme-editor/${installationId}`;

export const ThemeEditorView: React.FC<ThemeEditorViewProps> = ({
  themePath,
  themeName,
  onBack,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const [openSucceeded, setOpenSucceeded] = useState<boolean>(true);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
    }
  });

  useEffect(() => {
    const load = async () => {
      try {
        const manager = new ThemeManager(themePath);
        const config = await manager.getConfig();

        if (!config.id) {
          setError(
            'Theme has not been pushed to Zid yet. Push the theme first to install it on a store.'
          );
          setStep('error');
          return;
        }

        const list = config.installations || [];
        if (list.length === 0) {
          setError(
            'No store installations recorded for this theme. Use Preview on Store or Activate Theme first.'
          );
          setStep('error');
          return;
        }

        const dedupedByStore = new Map<string, Installation>();
        for (const inst of [...list].sort(
          (a, b) =>
            new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime()
        )) {
          if (!dedupedByStore.has(inst.store_id)) {
            dedupedByStore.set(inst.store_id, inst);
          }
        }

        const ordered = Array.from(dedupedByStore.values());
        setInstallations(ordered);

        if (ordered.length === 1) {
          const only = ordered[0]!;
          await openEditor(only);
          return;
        }

        setStep('select');
      } catch (err: any) {
        setError(err?.message || 'Failed to load theme installations');
        setStep('error');
      }
    };

    void load();
  }, [themePath]);

  const openEditor = async (inst: Installation) => {
    const url = buildEditorUrl(inst.store_id, inst.id);
    setOpenedUrl(url);
    try {
      await open(url);
      setOpenSucceeded(true);
    } catch {
      setOpenSucceeded(false);
    }
    setStep('opened');
  };

  if (step === 'loading') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🎨 Open Theme Editor</Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="gray">
            <Spinner type="dots" /> Looking up installations…
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'error') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🎨 Open Theme Editor</Text>
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

  if (step === 'select') {
    const items = installations.map(inst => ({
      label: `${inst.store_name} — store ${inst.store_id} (installed ${new Date(inst.installed_at).toLocaleDateString()}${inst.version ? `, v${inst.version}` : ''})`,
      value: inst,
      key: `${inst.store_id}-${inst.id}`,
    }));

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🎨 Open Theme Editor</Text>
        <Divider />

        <Box marginTop={1}>
          <Text>Theme: {themeName}</Text>
        </Box>

        <Box marginTop={1}>
          <Text bold>Select a store to open in the theme editor:</Text>
        </Box>

        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item: { value: Installation }) => void openEditor(item.value)}
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
          <Text dimColor>Arrow keys to navigate • Enter to open • Esc/q to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">🎨 Open Theme Editor</Text>
      <Divider />
      <Box marginTop={1}>
        {openSucceeded ? (
          <Text color="green">✓ Opened the theme editor in your default browser.</Text>
        ) : (
          <Text color="yellow">
            ⚠️ Couldn't open the browser automatically. Visit the URL below manually.
          </Text>
        )}
      </Box>
      {openedUrl && (
        <Box marginTop={1}>
          <Text>
            <Text color="cyan">URL:</Text> {openedUrl}
          </Text>
        </Box>
      )}
      <Box marginTop={2}>
        <Text dimColor>Esc or q to go back</Text>
      </Box>
    </Box>
  );
};
