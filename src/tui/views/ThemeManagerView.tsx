import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import apiService from '../../core/api.js';
import auth from '../../core/auth.js';

interface ThemeManagerViewProps {
  onBack: () => void;
  onOpenVersions?: (theme: any) => void;
}

type ViewMode =
  | 'list'
  | 'edit'
  | 'delete'
  | 'archive'
  | 'loading'
  | 'error'
  | 'success';

type EditField = 'name_en' | 'name_ar' | 'desc_en' | 'desc_ar';

const EDIT_FIELDS: EditField[] = ['name_en', 'name_ar', 'desc_en', 'desc_ar'];

const FIELD_LABEL: Record<EditField, string> = {
  name_en: 'Name (English)',
  name_ar: 'Name (Arabic)',
  desc_en: 'Description (English)',
  desc_ar: 'Description (Arabic)',
};

const FIELD_PLACEHOLDER: Record<EditField, string> = {
  name_en: 'Theme name',
  name_ar: 'اسم القالب (اختياري)',
  desc_en: 'Theme description',
  desc_ar: 'وصف القالب (اختياري)',
};

export const ThemeManagerView: React.FC<ThemeManagerViewProps> = ({
  onBack,
  onOpenVersions,
}) => {
  const [mode, setMode] = useState<ViewMode>('loading');
  const [themes, setThemes] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editValues, setEditValues] = useState<Record<EditField, string>>({
    name_en: '',
    name_ar: '',
    desc_en: '',
    desc_ar: '',
  });
  const [editField, setEditField] = useState<EditField>('name_en');

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
      if (mode === 'edit' || mode === 'delete' || mode === 'archive') {
        setMode('list');
      } else if (mode === 'error') {
        if (error && error.includes('installed on stores')) {
          setMode('list');
        } else {
          onBack();
        }
      } else {
        onBack();
      }
    }

    if (mode === 'error' && (input === 'a' || input === 'A')) {
      if (error && error.includes('installed on stores') && selectedTheme) {
        setError(null);
        setMode('archive');
      }
    }

    if (mode === 'list' && themes.length > 0) {
      if (input === 'e' || input === 'E') {
        handleQuickEdit(themes[selectedIndex]);
      } else if (input === 'd' || input === 'D') {
        handleQuickDelete(themes[selectedIndex]);
      } else if (input === 'a' || input === 'A') {
        handleQuickArchive(themes[selectedIndex]);
      } else if ((input === 'v' || input === 'V') && onOpenVersions) {
        onOpenVersions(themes[selectedIndex]);
      } else if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : themes.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => (prev < themes.length - 1 ? prev + 1 : 0));
      }
    }

    if (mode === 'edit' && key.return) {
      const idx = EDIT_FIELDS.indexOf(editField);
      if (idx === EDIT_FIELDS.length - 1) {
        void handleEditSave();
      } else {
        setEditField(EDIT_FIELDS[idx + 1]!);
      }
    }

    if (mode === 'edit' && key.tab) {
      // allow Tab as forward navigation as well
      const idx = EDIT_FIELDS.indexOf(editField);
      const nextIdx = (idx + 1) % EDIT_FIELDS.length;
      setEditField(EDIT_FIELDS[nextIdx]!);
    }

    if (mode === 'delete' || mode === 'archive') {
      if (input === 'y' || input === 'Y' || key.return) {
        if (mode === 'delete') {
          handleDeleteConfirm();
        } else if (mode === 'archive') {
          handleArchiveConfirm();
        }
      } else if (input === 'n' || input === 'N' || key.escape) {
        setMode('list');
      }
    }

    if (mode === 'success' && (key.return || input)) {
      loadThemes();
    }
  });

  const handleQuickEdit = (theme: any) => {
    setSelectedTheme(theme);
    const nameObj =
      typeof theme.name === 'object' && theme.name !== null
        ? theme.name
        : { en: theme.name || '', ar: '' };
    const descObj =
      typeof theme.description === 'object' && theme.description !== null
        ? theme.description
        : { en: theme.description || '', ar: '' };

    setEditValues({
      name_en: nameObj.en || '',
      name_ar: nameObj.ar || '',
      desc_en: descObj.en || '',
      desc_ar: descObj.ar || '',
    });
    setEditField('name_en');
    setMode('edit');
  };

  const handleQuickDelete = (theme: any) => {
    setSelectedTheme(theme);
    setMode('delete');
  };

  const handleQuickArchive = (theme: any) => {
    setSelectedTheme(theme);
    setMode('archive');
  };

  const handleEditSave = async () => {
    if (!editValues.name_en.trim()) {
      setError('English name is required');
      setMode('error');
      return;
    }

    setMessage('Updating theme...');

    try {
      const payload: any = {
        name: { en: editValues.name_en.trim() },
        description: { en: editValues.desc_en.trim() },
      };
      if (editValues.name_ar.trim()) {
        payload.name.ar = editValues.name_ar.trim();
      }
      if (editValues.desc_ar.trim()) {
        payload.description.ar = editValues.desc_ar.trim();
      }

      await apiService.updateTheme(selectedTheme.id, payload);

      setMessage(`✅ Theme "${editValues.name_en}" updated successfully!`);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to update theme');
      setMode('error');
    }
  };

  const handleDeleteConfirm = async () => {
    setMessage('Deleting theme...');

    try {
      await apiService.deleteTheme(selectedTheme.id);

      const name =
        typeof selectedTheme.name === 'object'
          ? selectedTheme.name.en
          : selectedTheme.name;

      setMessage(`✅ Theme "${name}" deleted successfully!`);
      setMode('success');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete theme';
      if (
        errorMsg.includes('installed in stores') ||
        errorMsg.includes('Cannot delete')
      ) {
        setError(
          'This theme is installed on stores. Use [A] to archive it instead.'
        );
      } else {
        setError(errorMsg);
      }
      setMode('error');
    }
  };

  const handleArchiveConfirm = async () => {
    setMessage('Archiving theme...');

    try {
      if (selectedTheme.latest_version) {
        await apiService.updateThemeVersionStatus(
          selectedTheme.id,
          selectedTheme.latest_version.id,
          'archived'
        );
      } else {
        const details = await apiService.getTheme(selectedTheme.id);
        if (details.versions && details.versions.length > 0) {
          const latestVersion = details.versions[0];
          await apiService.updateThemeVersionStatus(
            selectedTheme.id,
            latestVersion.id,
            'archived'
          );
        }
      }

      const name =
        typeof selectedTheme.name === 'object'
          ? selectedTheme.name.en
          : selectedTheme.name;

      setMessage(`✅ Theme "${name}" archived successfully!`);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to archive theme');
      setMode('error');
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
              <Text bold>Your themes ({themes.length}):</Text>
            </Box>

            <Box>
              <Text color="gray">   ┌─────────────────────────┬──────────────────────────────────────┬────────────┐</Text>
            </Box>
            <Box>
              <Text color="gray">   │ </Text>
              <Text bold color="cyan">Name                    </Text>
              <Text color="gray">│ </Text>
              <Text bold color="cyan">ID                                   </Text>
              <Text color="gray">│ </Text>
              <Text bold color="cyan">Status     </Text>
              <Text color="gray">│</Text>
            </Box>
            <Box>
              <Text color="gray">   ├─────────────────────────┼──────────────────────────────────────┼────────────┤</Text>
            </Box>

            {themes.map((theme, index) => {
              const name = typeof theme.name === 'object' ? theme.name.en : theme.name;
              const isSelected = index === selectedIndex;
              const displayName = name.length > 23 ? name.substring(0, 20) + '...' : name.padEnd(23);
              const displayId = theme.id.padEnd(36);

              let statusColor: string = 'gray';
              let statusText = 'No version ';

              if (theme.latest_version) {
                switch (theme.latest_version.status) {
                  case 'published':
                    statusText = 'Published  ';
                    statusColor = 'green';
                    break;
                  case 'draft':
                    statusText = 'Draft      ';
                    statusColor = 'yellow';
                    break;
                  case 'archived':
                    statusText = 'Archived   ';
                    statusColor = 'gray';
                    break;
                  default:
                    statusText = (theme.latest_version.status || 'Unknown').substring(0, 10).padEnd(11);
                    statusColor = 'gray';
                }
              }

              return (
                <Box key={`theme-${theme.id}-${index}`}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>
                    {isSelected ? '▶ ' : '  '}
                  </Text>
                  <Text color="gray">│ </Text>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {displayName}
                  </Text>
                  <Text color="gray">│ </Text>
                  <Text color={isSelected ? 'yellow' : 'gray'}>
                    {displayId}
                  </Text>
                  <Text color="gray">│ </Text>
                  <Text color={statusColor}>
                    {statusText}
                  </Text>
                  <Text color="gray">│</Text>
                </Box>
              );
            })}

            <Box>
              <Text color="gray">   └─────────────────────────┴──────────────────────────────────────┴────────────┘</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>[↑↓] Navigate  </Text>
              <Text color="green">[E] Edit  </Text>
              {onOpenVersions && <Text color="cyan">[V] Versions  </Text>}
              <Text color="red">[D] Delete  </Text>
              <Text color="yellow">[A] Archive  </Text>
              <Text dimColor>[Esc] Back</Text>
            </Box>
          </Box>
        );

      case 'edit':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Edit Theme Details</Text>
              <Text dimColor>  (Arabic fields optional)</Text>
            </Box>

            {EDIT_FIELDS.map(field => {
              const isActive = editField === field;
              const value = editValues[field];
              return (
                <Box key={field} marginBottom={1}>
                  <Box width={26}>
                    <Text color={isActive ? 'cyan' : 'white'}>
                      {FIELD_LABEL[field]}:
                    </Text>
                  </Box>
                  {isActive ? (
                    <TextInput
                      value={value}
                      onChange={next =>
                        setEditValues(prev => ({ ...prev, [field]: next }))
                      }
                      placeholder={FIELD_PLACEHOLDER[field]}
                    />
                  ) : (
                    <Text dimColor>{value || '(none)'}</Text>
                  )}
                </Box>
              );
            })}

            <Box marginTop={1}>
              <Text dimColor>
                {EDIT_FIELDS.indexOf(editField) === EDIT_FIELDS.length - 1
                  ? '[Enter] Save • [Tab] Cycle field • [Esc] Cancel'
                  : '[Enter] Next field • [Tab] Cycle field • [Esc] Cancel'}
              </Text>
            </Box>
          </Box>
        );

      case 'delete':
        const deleteThemeName =
          typeof selectedTheme.name === 'object'
            ? selectedTheme.name.en
            : selectedTheme.name;

        return (
          <Box flexDirection="column">
            <Text color="red" bold>⚠️  Delete "{deleteThemeName}"?</Text>
            <Text dimColor>ID: {selectedTheme.id}</Text>
            <Box marginTop={1}>
              <Text color="yellow">[Y/Enter] Delete • [N/Esc] Cancel</Text>
            </Box>
          </Box>
        );

      case 'archive':
        const archiveThemeName =
          typeof selectedTheme.name === 'object'
            ? selectedTheme.name.en
            : selectedTheme.name;

        return (
          <Box flexDirection="column">
            <Text color="yellow" bold>📦 Archive "{archiveThemeName}"?</Text>
            <Text dimColor>This will mark the theme as archived</Text>
            <Box marginTop={1}>
              <Text color="yellow">[Y/Enter] Archive • [N/Esc] Cancel</Text>
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
              {error && error.includes('installed on stores') ? (
                <Text dimColor>[A] Archive • [Esc] Back to themes</Text>
              ) : (
                <Text dimColor>[Esc] Back</Text>
              )}
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
