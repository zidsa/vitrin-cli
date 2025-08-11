#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export const startTUI = () => {
  const { unmount, waitUntilExit } = render(<App />);
  
  return {
    unmount,
    waitUntilExit,
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startTUI();
}