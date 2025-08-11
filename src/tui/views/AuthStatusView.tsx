import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Divider } from '../components/Divider.js';
import auth from '../../core/auth.js';
import apiService from '../../core/api.js';

interface AuthStatusViewProps {
  onBack: () => void;
  onLogout: () => void;
}

interface UserInfo {
  accessToken?: string;
}

export const AuthStatusView: React.FC<AuthStatusViewProps> = ({ onBack, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loadAuthInfo = async () => {
      try {
        const authStatus = await auth.isAuthenticated();
        setIsAuthenticated(authStatus);
        
        if (authStatus) {
          const authInfo = await auth.getAuthInfo();
          setUserInfo({
            accessToken: authInfo?.token ? '••••••••' + authInfo.token.slice(-8) : 'N/A'
          });
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    void loadAuthInfo();
  }, []);

  useInput((input: string, key: any) => {
    if (key.escape || input === 'q') {
      onBack();
    } else if (input === 'l' && isAuthenticated) {
      handleLogout();
    } else if (input === 'r' || (input === 'l' && !isAuthenticated)) {
      handleLogin();
    }
  });

  const handleLogout = async () => {
    try {
      await auth.logout();
      onLogout();
    } catch (err) {
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      const authModule = await import('../../core/auth.js');
      await authModule.default.login();
      
      const authStatus = await authModule.default.isAuthenticated();
      setIsAuthenticated(authStatus);
      
      if (authStatus) {
        const authInfo = await authModule.default.getAuthInfo();
        setUserInfo({
          accessToken: authInfo?.token ? '••••••••' + authInfo.token.slice(-8) : 'N/A'
        });
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Loading authentication status...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Authentication Status
          </Text>
        </Box>

        <Divider />

        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text bold>Status: </Text>
            {isAuthenticated ? (
              <Text color="green">✓ Authenticated</Text>
            ) : (
              <Text color="yellow">✗ Not Authenticated</Text>
            )}
          </Box>

          {isAuthenticated && (
            <>
              <Box marginTop={1}>
                <Text bold>Access Token: </Text>
                <Text dimColor>{userInfo.accessToken}</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Token stored in ~/.vitrin/config.json</Text>
              </Box>
            </>
          )}
        </Box>

        <Box marginTop={1}>
          <Divider />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            {isAuthenticated ? '[l] Logout • [r] Re-login • ' : '[l] Login • '}[Esc] Back
          </Text>
        </Box>
      </Box>
    </Box>
  );
};