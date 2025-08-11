import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  percent: number;
  width?: number;
  character?: string;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent = 0,
  width = 20,
  character = '█',
  color = 'cyan'
}) => {
  const clampedPercent = Math.min(Math.max(percent, 0), 1);
  const filled = Math.floor(clampedPercent * width);
  const empty = width - filled;
  
  return (
    <Box>
      <Text color={color}>
        {character.repeat(filled)}
      </Text>
      <Text color="gray">
        {'░'.repeat(empty)}
      </Text>
    </Box>
  );
};

export default ProgressBar;