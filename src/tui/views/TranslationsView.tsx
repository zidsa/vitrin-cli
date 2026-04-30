import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { generateTranslations } from '../../utils/translations.js';

interface TranslationsViewProps {
  themePath: string;
  onComplete: () => void;
  onBack: () => void;
}

type State = 'configure' | 'running' | 'done' | 'error';

export const TranslationsView: React.FC<TranslationsViewProps> = ({
  themePath,
  onComplete,
  onBack,
}) => {
  const [state, setState] = useState<State>('configure');
  const [languagesInput, setLanguagesInput] = useState<string>('ar');
  const [error, setError] = useState<string>('');

  useInput((_, key) => {
    if (state === 'done' || state === 'error') {
      onBack();
      return;
    }
    if (key.escape) {
      onBack();
    }
  });

  useEffect(() => {
    if (state !== 'running') return;
    const run = async (): Promise<void> => {
      try {
        const languages = languagesInput
          .split(/[\s,]+/)
          .map(l => l.trim())
          .filter(Boolean);
        await generateTranslations({
          themePath: themePath || process.cwd(),
          languages: languages.length > 0 ? languages : ['ar'],
        });
        setState('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    };
    void run();
  }, [state, languagesInput, themePath]);

  if (state === 'configure') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🌐 Generate translations
        </Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text dimColor>
            Scans .jinja files for _("...") strings and writes
          </Text>
          <Text dimColor>
            locale/messages.pot plus per-language .po/.mo catalogs.
          </Text>
        </Box>
        <Text>Languages (space or comma separated):</Text>
        <Box marginTop={1}>
          <TextInput
            value={languagesInput}
            onChange={setLanguagesInput}
            onSubmit={() => setState('running')}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to run · Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  if (state === 'running') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue">
          <Spinner type="dots" /> Generating translations…
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

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>
        ✅ Translations generated
      </Text>
      <Box marginTop={1}>
        <Text dimColor>
          Edit locale/&lt;lang&gt;/LC_MESSAGES/messages.po to add msgstr
          values, then run this command again to recompile messages.mo.
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to continue</Text>
      </Box>
    </Box>
  );
};

export default TranslationsView;
