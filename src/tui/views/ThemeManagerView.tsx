import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import apiService from '../../core/api.js';
import auth from '../../core/auth.js';

interface ThemeManagerViewProps {
  onBack: () => void;
}

type ViewMode = 'list' | 'actions' | 'edit' | 'delete' | 'loading' | 'error' | 'success';

export const ThemeManagerView: React.FC<ThemeManagerViewProps> = ({ onBack }) => {
  const [mode, setMode] = useState<ViewMode>('loading');
  const [themes, setThemes] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editField, setEditField] = useState<'name' | 'description'>('name');

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setMode('loading');
      setMessage('Loading themes...');
      
      const isAuth = await auth.isAuthenticated();
      if (!isAuth) {
        setError('Not authenticated. Please login first.');
        setMode('error');
        return;
      }

      const response = await apiService.getThemes({ page_size: 100 });
      
      if (!response.results || response.results.length === 0) {
        setError('No themes found. Create one first.');
        setMode('error');
        return;
      }

      setThemes(response.results);
      setMode('list');
    } catch (err: any) {
      setError(err.message || 'Failed to load themes');
      setMode('error');
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'actions' || mode === 'edit' || mode === 'delete') {
        setMode('list');
      } else {
        onBack();
      }
    }

    if (mode === 'edit' && key.return) {
      if (editField === 'name' && editName.trim()) {
        setEditField('description');
      } else if (editField === 'description') {
        handleEditSave();
      }
    }

    if (mode === 'delete') {
      if (input === 'y' || input === 'Y') {
        handleDeleteConfirm();
      } else if (input === 'n' || input === 'N') {
        setMode('actions');
      }
    }

    if (mode === 'success' && (key.return || input)) {
      loadThemes();
    }
  });

  const handleThemeSelect = (theme: any) => {
    setSelectedTheme(theme);
    setMode('actions');
  };

  const handleActionSelect = (action: string) => {
    if (action === 'edit') {
      const name = typeof selectedTheme.name === 'object' 
        ? (selectedTheme.name.en || '') 
        : selectedTheme.name;
      const desc = typeof selectedTheme.description === 'object'
        ? (selectedTheme.description.en || '')
        : (selectedTheme.description || '');
      
      setEditName(name);
      setEditDescription(desc);
      setEditField('name');
      setMode('edit');
    } else if (action === 'delete') {
      setMode('delete');
    } else if (action === 'back') {
      setMode('list');
    }
  };

  const handleEditSave = async () => {
    setLoading(true);
    setMessage('Updating theme...');
    
    try {
      await apiService.updateTheme(selectedTheme.id, {
        name: { en: editName },
        description: { en: editDescription }
      });
      
      setMessage(`✅ Theme "${editName}" updated successfully!`);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to update theme');
      setMode('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setMessage('Deleting theme...');
    
    try {
      await apiService.deleteTheme(selectedTheme.id);
      
      const name = typeof selectedTheme.name === 'object' 
        ? selectedTheme.name.en 
        : selectedTheme.name;
      
      setMessage(`✅ Theme "${name}" deleted successfully!`);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to delete theme');
      setMode('error');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'loading':
        return (
          <Box>
            <Spinner type="dots" />
            <Text> {message}</Text>
          </Box>
        );

      case 'list':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Select a theme to manage:</Text>
            </Box>
            <SelectInput
              items={themes.map((theme, index) => ({
                label: `${typeof theme.name === 'object' ? theme.name.en : theme.name} (${theme.id})`,
                value: theme,
                key: `theme-${theme.id}-${index}`,
              }))}
              onSelect={(item) => handleThemeSelect(item.value)}
              indicatorComponent={({ isSelected }: any) => (
                <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
              )}
              itemComponent={({ label, isSelected }: any) => (
                <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
              )}
            />
            <Box marginTop={1}>
              <Text dimColor>[↑↓] Navigate • [Enter] Select • [Esc] Back</Text>
            </Box>
          </Box>
        );

      case 'actions':
        const themeName = typeof selectedTheme.name === 'object' 
          ? selectedTheme.name.en 
          : selectedTheme.name;
        
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>
                Theme: {themeName} ({selectedTheme.id})
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>
                Created: {new Date(selectedTheme.created_at).toLocaleString()}
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text bold>Choose an action:</Text>
            </Box>
            <SelectInput
              items={[
                { label: '✏️  Edit Theme Details', value: 'edit' },
                { label: '🗑️  Delete Theme', value: 'delete' },
                { label: '← Back to List', value: 'back' }
              ]}
              onSelect={(item) => handleActionSelect(item.value)}
              indicatorComponent={({ isSelected }: any) => (
                <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
              )}
              itemComponent={({ label, isSelected }: any) => (
                <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
              )}
            />
          </Box>
        );

      case 'edit':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Edit Theme Details</Text>
            </Box>
            
            <Box marginBottom={1}>
              <Text color={editField === 'name' ? 'cyan' : 'white'}>
                Name: 
              </Text>
              {editField === 'name' ? (
                <Box marginLeft={1}>
                  <TextInput
                    value={editName}
                    onChange={setEditName}
                    placeholder="Theme name"
                  />
                </Box>
              ) : (
                <Text> {editName}</Text>
              )}
            </Box>

            <Box marginBottom={1}>
              <Text color={editField === 'description' ? 'cyan' : 'white'}>
                Description: 
              </Text>
              {editField === 'description' ? (
                <Box marginLeft={1}>
                  <TextInput
                    value={editDescription}
                    onChange={setEditDescription}
                    placeholder="Theme description"
                  />
                </Box>
              ) : (
                <Text> {editDescription || '(none)'}</Text>
              )}
            </Box>

            <Box marginTop={1}>
              <Text dimColor>
                {editField === 'name' 
                  ? '[Enter] Next field • [Esc] Cancel'
                  : '[Enter] Save • [Esc] Cancel'}
              </Text>
            </Box>
          </Box>
        );

      case 'delete':
        const deleteThemeName = typeof selectedTheme.name === 'object' 
          ? selectedTheme.name.en 
          : selectedTheme.name;
        
        return (
          <Box flexDirection="column">
            <Text color="red" bold>⚠️  Delete Theme</Text>
            <Box marginTop={1}>
              <Text>
                Are you sure you want to delete "{deleteThemeName}"?
              </Text>
              <Text dimColor>
                Theme ID: {selectedTheme.id}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color="red">This action cannot be undone!</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>[Y] Yes, delete • [N] No, cancel • [Esc] Cancel</Text>
            </Box>
          </Box>
        );

      case 'success':
        return (
          <Box flexDirection="column">
            <Text color="green" bold>{message}</Text>
            <Box marginTop={1}>
              <Text dimColor>[Enter] Continue</Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection="column">
            <Text color="red" bold>❌ Error</Text>
            <Box marginTop={1}>
              <Text>{error}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>[Esc] Back</Text>
            </Box>
          </Box>
        );

      default:
        return <Text>Loading...</Text>;
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            🎨 Manage Themes
          </Text>
        </Box>
        {renderContent()}
      </Box>
    </Box>
  );
};