import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Divider } from '../components/Divider.js';
import api from '../../core/api.js';
import {
  STATUS_LABELS,
  getPartnerAllowedTransitions,
  type ThemeVersionStatus,
} from '../../core/themeStatus.js';

interface VersionsViewProps {
  themeId: string;
  themeName: string;
  onBack: () => void;
}

interface ThemeVersion {
  id: string;
  version: string;
  status: ThemeVersionStatus;
  created_at?: string;
  changelog?: { en?: string; ar?: string } | string | null;
}

type Mode =
  | 'loading'
  | 'list'
  | 'detail'
  | 'edit-changelog'
  | 'change-status'
  | 'saving'
  | 'success'
  | 'error';

type ChangelogField = 'en' | 'ar';
const CHANGELOG_FIELDS: ChangelogField[] = ['en', 'ar'];

function statusColor(status: ThemeVersionStatus): string {
  switch (status) {
    case 'published':
      return 'green';
    case 'draft':
      return 'yellow';
    case 'pending_review':
    case 'in_review':
      return 'magenta';
    case 'approved':
      return 'cyan';
    case 'rejected':
    case 'deprecated':
      return 'red';
    case 'archived':
      return 'gray';
    default:
      return 'gray';
  }
}

function readChangelog(
  cl: ThemeVersion['changelog']
): { en: string; ar: string } {
  if (!cl) return { en: '', ar: '' };
  if (typeof cl === 'string') return { en: cl, ar: '' };
  return { en: cl.en || '', ar: cl.ar || '' };
}

export const VersionsView: React.FC<VersionsViewProps> = ({
  themeId,
  themeName,
  onBack,
}) => {
  const [mode, setMode] = useState<Mode>('loading');
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading versions...');
  const [editEn, setEditEn] = useState('');
  const [editAr, setEditAr] = useState('');
  const [changelogField, setChangelogField] =
    useState<ChangelogField>('en');

  useEffect(() => {
    void loadVersions();
  }, [themeId]);

  const loadVersions = async () => {
    try {
      setMode('loading');
      setMessage('Loading versions...');
      const response = await api.listThemeVersions(themeId, { page_size: 100 });
      const list: ThemeVersion[] = response.results || [];
      setVersions(list);
      if (list.length === 0) {
        setError(
          'This theme has no versions yet. Run `vitrin push` to create one.'
        );
        setMode('error');
        return;
      }
      setMode('list');
    } catch (err: any) {
      setError(err.message || 'Failed to load versions');
      setMode('error');
    }
  };

  const selected = versions[selectedIndex];

  useInput((input, key) => {
    if (mode === 'loading' || mode === 'saving') return;

    if (key.escape) {
      if (mode === 'list' || mode === 'error') {
        onBack();
      } else if (mode === 'detail') {
        setMode('list');
      } else if (mode === 'edit-changelog' || mode === 'change-status') {
        setMode('detail');
      } else if (mode === 'success') {
        setMode('list');
      }
      return;
    }

    if (mode === 'list') {
      if (key.upArrow) {
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : versions.length - 1
        );
      } else if (key.downArrow) {
        setSelectedIndex(prev =>
          prev < versions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        setMode('detail');
      } else if (input === 'e' || input === 'E') {
        beginEditChangelog();
      } else if (input === 's' || input === 'S') {
        setMode('change-status');
      } else if (input === 'r' || input === 'R') {
        void loadVersions();
      }
    } else if (mode === 'detail') {
      if (input === 'e' || input === 'E') {
        beginEditChangelog();
      } else if (input === 's' || input === 'S') {
        setMode('change-status');
      } else if (key.return) {
        setMode('list');
      }
    } else if (mode === 'edit-changelog') {
      if (key.tab) {
        setChangelogField(prev => (prev === 'en' ? 'ar' : 'en'));
      } else if (key.return) {
        const idx = CHANGELOG_FIELDS.indexOf(changelogField);
        if (idx === CHANGELOG_FIELDS.length - 1) {
          void saveChangelog();
        } else {
          setChangelogField(CHANGELOG_FIELDS[idx + 1]!);
        }
      }
    } else if (mode === 'success') {
      void loadVersions();
    }
  });

  const beginEditChangelog = () => {
    if (!selected) return;
    const { en, ar } = readChangelog(selected.changelog);
    setEditEn(en);
    setEditAr(ar);
    setChangelogField('en');
    setError(null);
    setMode('edit-changelog');
  };

  const saveChangelog = async () => {
    if (!selected) return;
    if (!editEn.trim()) {
      setError('English changelog is required');
      return;
    }
    setMode('saving');
    setMessage('Saving changelog...');
    try {
      const payload: { changelog: { en: string; ar?: string } } = {
        changelog: { en: editEn.trim() },
      };
      if (editAr.trim()) {
        payload.changelog.ar = editAr.trim();
      }
      await api.updateThemeVersion(themeId, selected.id, payload);
      setMessage(`✅ Changelog updated for ${selected.version}`);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to update changelog');
      setMode('error');
    }
  };

  const changeStatus = async (target: ThemeVersionStatus) => {
    if (!selected) return;
    setMode('saving');
    setMessage(`Setting status to ${STATUS_LABELS[target]}...`);
    try {
      await api.updateThemeVersionStatus(themeId, selected.id, target);
      setMessage(
        `✅ ${selected.version}: ${STATUS_LABELS[selected.status]} → ${STATUS_LABELS[target]}`
      );
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
      setMode('error');
    }
  };

  if (mode === 'loading' || mode === 'saving') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📚 Versions of {themeName}
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> {message}</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'error') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📚 Versions of {themeName}
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'success') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📚 Versions of {themeName}
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Text color="green" bold>{message}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[Enter] Refresh • [Esc] Back to list</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'list') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📚 Versions of {themeName}
        </Text>
        <Text dimColor>theme id: {themeId}</Text>
        <Divider />

        <Box flexDirection="column" marginTop={1}>
          {versions.map((v, idx) => {
            const isSelected = idx === selectedIndex;
            const cl = readChangelog(v.changelog);
            const summary =
              cl.en.split('\n')[0]?.slice(0, 60) || '(no changelog)';
            return (
              <Box
                key={`v-${v.id}-${idx}`}
                flexDirection="column"
                marginBottom={1}
              >
                <Box>
                  <Text color={isSelected ? 'cyan' : 'gray'}>
                    {isSelected ? '▶ ' : '  '}
                  </Text>
                  <Box width={10}>
                    <Text bold color={isSelected ? 'cyan' : 'white'}>
                      {v.version}
                    </Text>
                  </Box>
                  <Box width={16}>
                    <Text color={statusColor(v.status)}>
                      {STATUS_LABELS[v.status] || v.status}
                    </Text>
                  </Box>
                  <Text dimColor>
                    {v.created_at
                      ? new Date(v.created_at).toLocaleDateString()
                      : ''}
                  </Text>
                </Box>
                <Box marginLeft={4}>
                  <Text dimColor>{summary}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Divider />
        <Box marginTop={1}>
          <Text dimColor>[↑↓] Navigate • </Text>
          <Text color="cyan">[Enter] Detail • </Text>
          <Text color="green">[E] Edit changelog • </Text>
          <Text color="yellow">[S] Change status • </Text>
          <Text dimColor>[R] Refresh • [Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'detail' && selected) {
    const cl = readChangelog(selected.changelog);
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          📚 {themeName} · v{selected.version}
        </Text>
        <Divider />

        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text dimColor>Status: </Text>
            <Text color={statusColor(selected.status)}>
              {STATUS_LABELS[selected.status]} ({selected.status})
            </Text>
          </Text>
          <Text>
            <Text dimColor>Version ID: </Text>
            <Text color="yellow">{selected.id}</Text>
          </Text>
          {selected.created_at && (
            <Text>
              <Text dimColor>Created: </Text>
              {new Date(selected.created_at).toLocaleString()}
            </Text>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="cyan">Changelog (English)</Text>
          <Text>{cl.en || '(empty)'}</Text>
        </Box>
        {cl.ar && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color="cyan">Changelog (Arabic)</Text>
            <Text>{cl.ar}</Text>
          </Box>
        )}

        <Divider />
        <Box marginTop={1}>
          <Text color="green">[E] Edit changelog • </Text>
          <Text color="yellow">[S] Change status • </Text>
          <Text dimColor>[Enter/Esc] Back to list</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'edit-changelog' && selected) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          ✏️  Edit changelog · {selected.version}
        </Text>
        <Divider />

        <Box marginTop={1} flexDirection="column">
          <Box marginBottom={1}>
            <Box width={26}>
              <Text color={changelogField === 'en' ? 'cyan' : 'white'}>
                Changelog (English):
              </Text>
            </Box>
            {changelogField === 'en' ? (
              <TextInput
                value={editEn}
                onChange={setEditEn}
                placeholder="What changed in this version"
              />
            ) : (
              <Text dimColor>{editEn || '(empty)'}</Text>
            )}
          </Box>

          <Box>
            <Box width={26}>
              <Text color={changelogField === 'ar' ? 'cyan' : 'white'}>
                Changelog (Arabic):
              </Text>
            </Box>
            {changelogField === 'ar' ? (
              <TextInput
                value={editAr}
                onChange={setEditAr}
                placeholder="ما الذي تغير في هذا الإصدار (اختياري)"
              />
            ) : (
              <Text dimColor>{editAr || '(empty, optional)'}</Text>
            )}
          </Box>
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            {changelogField === 'en'
              ? '[Enter] Next field • [Tab] Toggle • [Esc] Cancel'
              : '[Enter] Save • [Tab] Toggle • [Esc] Cancel'}
          </Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'change-status' && selected) {
    const info = getPartnerAllowedTransitions(selected.status);
    if (info.partnerBlocked) {
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text color="cyan" bold>
            🚦 Change status · {selected.version}
          </Text>
          <Divider />
          <Box marginTop={1}>
            <Text color="yellow">
              {info.reason || `No transitions allowed from ${selected.status}.`}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>[Esc] Back</Text>
          </Box>
        </Box>
      );
    }

    const items = info.allowed.map(s => ({
      label: `${STATUS_LABELS[s]} (${s})`,
      value: s,
    }));

    if (items.length === 0) {
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text color="cyan" bold>
            🚦 Change status · {selected.version}
          </Text>
          <Divider />
          <Box marginTop={1}>
            <Text color="yellow">
              {STATUS_LABELS[selected.status]} is a terminal state for partners.
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>[Esc] Back</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="cyan" bold>
          🚦 Change status · {selected.version}
        </Text>
        <Divider />
        <Box marginTop={1}>
          <Text>
            <Text dimColor>Current: </Text>
            <Text color={statusColor(selected.status)}>
              {STATUS_LABELS[selected.status]}
            </Text>
          </Text>
        </Box>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={item =>
              void changeStatus(item.value as ThemeVersionStatus)
            }
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>↑↓ Navigate • Enter to confirm • Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
