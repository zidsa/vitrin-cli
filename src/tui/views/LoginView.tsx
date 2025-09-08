import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import auth from '../../core/auth.js';

interface LoginViewProps {
  onComplete: () => void;
  onBack: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onComplete, onBack }) => {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'authenticating' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [authUrl] = useState('https://partner.zid.sa/cli/authorized');

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await auth.isAuthenticated();
      if (isAuth) {
        setStatus('authenticated');
      } else {
        setStatus('authenticating');
        startAuth();
      }
    };

    void checkAuth();
  }, []);

  const startAuth = async () => {
    try {
      setStatus('authenticating');
      await auth.login();
      setStatus('authenticated');
      setTimeout(onComplete, 500);
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  };

  useInput((input: string, key: any) => {
    if (key.escape || input === 'q') {
      onBack();
    } else if (input === 'r' && status === 'error') {
      setStatus('authenticating');
      startAuth();
    }
  });

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <Box>
            <Spinner type="dots" />
            <Text> Checking authentication status...</Text>
          </Box>
        );

      case 'authenticating':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Spinner type="dots" />
              <Text> Opening browser for authentication...</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text>Please visit this URL if the browser doesn't open:</Text>
              <Text color="cyan" underline>{authUrl}</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>Waiting for authentication...</Text>
            </Box>
          </Box>
        );

      case 'authenticated':
        return (
          <Box flexDirection="column">
            <Text color="green" bold>✓ Authentication Successful!</Text>
            <Box marginTop={1}>
              <Text>You are now logged in to Zid Partner Dashboard.</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>Redirecting...</Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection="column">
            <Text color="red" bold>✗ Authentication Failed</Text>
            <Box marginTop={1}>
              <Text>{error || 'Failed to authenticate with Zid'}</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>[r] Retry • [Esc] Back</Text>
            </Box>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Authentication
          </Text>
        </Box>
        {renderContent()}
      </Box>
    </Box>
  );
};