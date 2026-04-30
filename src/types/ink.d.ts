declare module 'ink-big-text' {
  import { FC } from 'react';
  interface BigTextProps {
    text: string;
    font?: string;
    align?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    backgroundColor?: string;
    colors?: string[];
  }
  const BigText: FC<BigTextProps>;
  export default BigText;
}

declare module 'ink-spinner' {
  import { FC } from 'react';
  interface SpinnerProps {
    type?: string;
  }
  const Spinner: FC<SpinnerProps>;
  export default Spinner;
}

declare module 'ink-select-input' {
  import { FC } from 'react';
  interface SelectInputProps {
    items: Array<{ label: string; value: any }>;
    onSelect?: (item: any) => void;
    onHighlight?: (item: any) => void;
    indicatorComponent?: FC<{ isSelected: boolean }>;
    itemComponent?: FC<{ label: string; isSelected: boolean }>;
    limit?: number;
    initialIndex?: number;
  }
  const SelectInput: FC<SelectInputProps>;
  export default SelectInput;
}

declare module 'ink-text-input' {
  import { FC } from 'react';
  interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
    focus?: boolean;
    mask?: string;
    showCursor?: boolean;
  }
  const TextInput: FC<TextInputProps>;
  export default TextInput;
}

declare module 'ink-table' {
  import { FC } from 'react';
  interface TableProps {
    data: any[];
    columns?: string[];
  }
  const Table: FC<TableProps>;
  export default Table;
}

declare module 'ink-link' {
  import { FC, ReactNode } from 'react';
  interface LinkProps {
    url: string;
    children?: ReactNode;
  }
  const Link: FC<LinkProps>;
  export default Link;
}
