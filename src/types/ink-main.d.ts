declare module 'ink' {
  import { FC, ReactNode } from 'react';

  export interface BoxProps {
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    justifyContent?:
      | 'flex-start'
      | 'center'
      | 'flex-end'
      | 'space-between'
      | 'space-around';
    width?: number | string;
    height?: number | string;
    minWidth?: number;
    minHeight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingX?: number;
    paddingY?: number;
    padding?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    marginX?: number;
    marginY?: number;
    margin?: number;
    gap?: number;
    borderStyle?:
      | 'single'
      | 'double'
      | 'round'
      | 'bold'
      | 'singleDouble'
      | 'doubleSingle'
      | 'classic'
      | 'arrow';
    borderColor?: string;
    borderTop?: boolean;
    borderBottom?: boolean;
    borderLeft?: boolean;
    borderRight?: boolean;
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
    overflow?: 'visible' | 'hidden';
    overflowX?: 'visible' | 'hidden';
    overflowY?: 'visible' | 'hidden';
    children?: ReactNode;
  }

  export interface TextProps {
    color?: string;
    backgroundColor?: string;
    dimColor?: boolean;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    inverse?: boolean;
    wrap?:
      | 'wrap'
      | 'truncate'
      | 'truncate-start'
      | 'truncate-middle'
      | 'truncate-end';
    children?: ReactNode;
  }

  export interface NewlineProps {
    count?: number;
  }

  export interface SpacerProps {
    width?: number;
    height?: number;
  }

  export interface StaticProps {
    children?: ReactNode;
  }

  export interface TransformProps {
    transform?: (children: string) => string;
    children?: ReactNode;
  }

  export const Box: FC<BoxProps>;
  export const Text: FC<TextProps>;
  export const Newline: FC<NewlineProps>;
  export const Spacer: FC<SpacerProps>;
  export const Static: FC<StaticProps>;
  export const Transform: FC<TransformProps>;

  export function render(element: React.ReactElement): {
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
    rerender: (element: React.ReactElement) => void;
    clear: () => void;
  };

  export function useApp(): {
    exit: (error?: Error) => void;
  };

  export function useInput(handler: (input: string, key: any) => void): void;

  export function useFocus(options?: {
    autoFocus?: boolean;
    isActive?: boolean;
    id?: string;
  }): {
    isFocused: boolean;
    focus: () => void;
    blur: () => void;
  };

  export function useStdin(): {
    stdin: NodeJS.ReadStream;
    setRawMode: (value: boolean) => void;
  };

  export function useStdout(): {
    stdout: NodeJS.WriteStream;
    write: (data: string) => void;
  };

  export function useStderr(): {
    stderr: NodeJS.WriteStream;
    write: (data: string) => void;
  };

  export function measureElement(ref: any): {
    width: number;
    height: number;
  };
}
