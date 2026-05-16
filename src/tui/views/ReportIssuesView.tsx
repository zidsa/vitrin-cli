import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import open from 'open';
import { Divider } from '../components/Divider.js';

const ISSUES_URL = 'https://github.com/zidsa/vitrin-cli/issues';

interface ReportIssuesViewProps {
  onBack: () => void;
}

export const ReportIssuesView: React.FC<ReportIssuesViewProps> = ({ onBack }) => {
  const [opened, setOpened] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    open(ISSUES_URL)
      .then(() => setOpened('success'))
      .catch(() => setOpened('failed'));
  }, []);

  useInput((_input, key) => {
    if (key.escape || key.return) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="rgb(232, 131, 136)">🐞 Report Issues</Text>
      <Divider />

      <Box flexDirection="column" marginTop={1}>
        {opened === 'pending' && <Text>Opening the issues page in your browser…</Text>}
        {opened === 'success' && (
          <Text color="green">✓ Opened the issues page in your default browser.</Text>
        )}
        {opened === 'failed' && (
          <Text color="yellow">
            ⚠️ Couldn't open the browser automatically. Visit the URL below manually.
          </Text>
        )}
        <Box marginTop={1}>
          <Text>
            <Text color="cyan">URL:</Text> {ISSUES_URL}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Divider />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter or Esc to return • q for dashboard</Text>
      </Box>
    </Box>
  );
};
