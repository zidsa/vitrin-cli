import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { Divider } from '../components/Divider.js';
import apiService from '../../core/api.js';

interface DevStore {
  id: string | number;
  name: string;
  email: string;
  link?: string;
}

interface DevStoresViewProps {
  onSelectStore: (store: DevStore) => void;
  onBack: () => void;
}

export const DevStoresView: React.FC<DevStoresViewProps> = ({ onSelectStore, onBack }) => {
  const [stores, setStores] = useState<DevStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<DevStore | null>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await apiService.getDevStores();
        const formattedStores: DevStore[] = response.stores.map((store: any) => ({
          id: store.id,
          name: store.name,
          email: store.email,
          link: store.link
        }));
        setStores(formattedStores);
        if (formattedStores.length > 0 && formattedStores[0]) {
          setSelectedStore(formattedStores[0]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void fetchStores();
  }, []);

  useInput((input: string, key: any) => {
    if (key.escape || input === 'q') {
      onBack();
    } else if (key.return && selectedStore) {
      onSelectStore(selectedStore);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Loading dev stores...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="red">✗ Error: {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>[Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  if (stores.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">No dev stores found</Text>
        <Box marginTop={1}>
          <Text>Create a dev store in the Zid Partner Dashboard first.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Dev Stores ({stores.length})
          </Text>
        </Box>

        <Box marginBottom={1}>
          <SelectInput
            items={stores.map((store, index) => ({
              label: `${store.name} - ${store.email}`,
              value: store,
              key: `store-${store.id}-${index}`,
            }))}
            onSelect={(item: any) => onSelectStore(item.value)}
            onHighlight={(item: any) => setSelectedStore(item.value)}
            indicatorComponent={({ isSelected }: any) => (
              <Text color="cyan">{isSelected ? '▶' : ' '}</Text>
            )}
            itemComponent={({ label, isSelected }: any) => (
              <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
            )}
          />
        </Box>

        {selectedStore && (
          <>
            <Divider />
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="cyan">Store Details:</Text>
              <Text>ID: {selectedStore.id}</Text>
              <Text>Name: {selectedStore.name}</Text>
              <Text>Email: {selectedStore.email}</Text>
              {selectedStore.link && <Text>URL: {selectedStore.link}</Text>}
            </Box>
          </>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            [Enter] Select Store • [↑↓] Navigate • [Esc] Back
          </Text>
        </Box>
      </Box>
    </Box>
  );
};