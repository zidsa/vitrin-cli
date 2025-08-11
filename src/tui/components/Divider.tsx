import React from 'react';
import { Box, Text } from 'ink';

interface DividerProps {
  title?: string;
  width?: number;
  dividerChar?: string;
  titleColor?: string;
  dividerColor?: string;
}

export const Divider: React.FC<DividerProps> = ({
  title,
  width = 50,
  dividerChar = '─',
  titleColor = 'cyan',
  dividerColor = 'gray'
}) => {
  if (title) {
    const padding = 2;
    const titleLength = title.length + (padding * 2);
    const leftWidth = Math.floor((width - titleLength) / 2);
    const rightWidth = width - titleLength - leftWidth;
    
    return (
      <Box>
        <Text color={dividerColor}>{dividerChar.repeat(Math.max(0, leftWidth))}</Text>
        <Text color={titleColor}>{` ${title} `}</Text>
        <Text color={dividerColor}>{dividerChar.repeat(Math.max(0, rightWidth))}</Text>
      </Box>
    );
  }
  
  return <Text color={dividerColor}>{dividerChar.repeat(width)}</Text>;
};

export default Divider;