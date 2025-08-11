import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Divider } from '../components/Divider.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface SettingsViewProps {
  onSave: () => void;
  onBack: () => void;
}

interface Setting {
  category: string;
  items: {
    label: string;
    value: string | boolean | number;
    type: 'toggle' | 'select' | 'number' | 'text';
    options?: string[];
    envVar?: string;
  }[];
}

const CONFIG_DIR = join(homedir(), '.vitrin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const SettingsView: React.FC<SettingsViewProps> = ({ onSave, onBack }) => {
  const [editingItem, setEditingItem] = useState<{ catIndex: number; itemIndex: number } | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  const saveSettings = async () => {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
      
      let existingConfig: Record<string, any> = {};
      try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        existingConfig = JSON.parse(data);
      } catch {
      }
      
      const apiConfig = settings.find(s => s.category === 'API Configuration');
      
      if (apiConfig) {
        apiConfig.items.forEach(item => {
          if (item.envVar) {
            existingConfig[item.envVar] = item.value;
            process.env[item.envVar] = String(item.value);
          }
        });
      }
      
      await fs.writeFile(CONFIG_FILE, JSON.stringify(existingConfig, null, 2));
      
      setSaveMessage('✅ Settings saved and applied successfully!');
      setTimeout(() => {
        setSaveMessage(null);
        onSave();
      }, 1500);
    } catch (error) {
      setSaveMessage('❌ Failed to save settings');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };
  
  const loadSettings = async (): Promise<Record<string, string>> => {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf8');
      const savedConfig = JSON.parse(data) as Record<string, string>;
      
      Object.entries(savedConfig).forEach(([key, value]) => {
        if (key.startsWith('VITRIN_')) {
          process.env[key] = String(value);
        }
      });
      
      return savedConfig;
    } catch {
      return {};
    }
  };
  
  const [settings, setSettings] = useState<Setting[]>([
    {
      category: 'Display',
      items: [
        { label: 'Animations', value: true, type: 'toggle' },
        { label: 'Colors', value: '256 colors', type: 'select', options: ['16 colors', '256 colors', 'True color'] },
        { label: 'Unicode borders', value: true, type: 'toggle' },
      ],
    },
    {
      category: 'Build Options',
      items: [
        { label: 'Auto-rebuild', value: true, type: 'toggle' },
        { label: 'Validation', value: 'Strict', type: 'select', options: ['None', 'Basic', 'Strict'] },
        { label: 'Compression', value: 9, type: 'number' },
      ],
    },
    {
      category: 'API Configuration',
      items: [
        { label: 'API URL', value: process.env.VITRIN_API_URL || 'https://api.zid.sa', type: 'text', envVar: 'VITRIN_API_URL' },
        { label: 'Partner URL', value: process.env.VITRIN_PARTNER_URL || 'https://partner.zid.sa', type: 'text', envVar: 'VITRIN_PARTNER_URL' },
        { label: 'Timeout', value: '30s', type: 'select', options: ['10s', '30s', '60s'] },
      ],
    },
  ]);

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  
  useEffect(() => {
    const initSettings = async () => {
      const saved = await loadSettings();
      
      const apiUrl = saved.VITRIN_API_URL || process.env.VITRIN_API_URL || 'https://api.zid.sa';
      const partnerUrl = saved.VITRIN_PARTNER_URL || process.env.VITRIN_PARTNER_URL || 'https://partner.zid.sa';
      
      setSettings(prev => {
        const newSettings = [...prev];
        const apiConfig = newSettings.find(s => s.category === 'API Configuration');
        if (apiConfig) {
          const apiUrlItem = apiConfig.items.find(i => i.label === 'API URL');
          const partnerUrlItem = apiConfig.items.find(i => i.label === 'Partner URL');
          if (apiUrlItem) apiUrlItem.value = apiUrl;
          if (partnerUrlItem) partnerUrlItem.value = partnerUrl;
        }
        return newSettings;
      });
    };
    
    void initSettings();
  }, []);

  useInput((input: string, key: any) => {
    if (editingItem) {
        if (key.escape) {
        setEditingItem(null);
        setTempValue('');
      } else if (key.return) {
        const newSettings = [...settings];
        newSettings[editingItem.catIndex]!.items[editingItem.itemIndex]!.value = tempValue;
        setSettings(newSettings);
        
        const item = newSettings[editingItem.catIndex]!.items[editingItem.itemIndex];
        if (item?.envVar) {
          process.env[item.envVar] = tempValue;
        }
        
        setEditingItem(null);
        setTempValue('');
      }
    } else {
      if (key.escape) {
        onBack();
      } else if (key.return || input === ' ') {
        const currentCat = settings[selectedCategory];
        if (currentCat) {
          const item = currentCat.items[selectedItem];
          if (item) {
            if (item.type === 'toggle') {
                const newSettings = [...settings];
              newSettings[selectedCategory]!.items[selectedItem]!.value = !item.value;
              setSettings(newSettings);
            } else if (item.type === 'text') {
                setEditingItem({ catIndex: selectedCategory, itemIndex: selectedItem });
              setTempValue(String(item.value));
            }
          }
        }
      } else if (key.tab || key.rightArrow) {
        setSelectedCategory((prev) => (prev + 1) % settings.length);
        setSelectedItem(0);
      } else if (key.shift && key.tab || key.leftArrow) {
        setSelectedCategory((prev) => (prev - 1 + settings.length) % settings.length);
        setSelectedItem(0);
      } else if (key.upArrow) {
        const currentCat = settings[selectedCategory];
        if (currentCat) {
          setSelectedItem((prev) => (prev - 1 + currentCat.items.length) % currentCat.items.length);
        }
      } else if (key.downArrow) {
        const currentCat = settings[selectedCategory];
        if (currentCat) {
          setSelectedItem((prev) => (prev + 1) % currentCat.items.length);
        }
      } else if (input === 's' || input === 'S') {
        void saveSettings();
      }
    }
  });

  const currentCategory = settings[selectedCategory];

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {saveMessage && (
        <Box marginBottom={1} paddingX={2}>
          <Text>{saveMessage}</Text>
        </Box>
      )}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Settings
          </Text>
        </Box>

        <Box flexDirection="row" marginBottom={1}>
          {settings.map((setting, index) => (
            <Box key={index} marginRight={2}>
              <Text
                color={index === selectedCategory ? 'cyan' : 'gray'}
                underline={index === selectedCategory}
              >
                {setting.category}
              </Text>
            </Box>
          ))}
        </Box>

        <Divider />

        <Box flexDirection="column" marginY={1}>
          {currentCategory?.items.map((item, index) => {
            const isEditing = editingItem?.catIndex === selectedCategory && editingItem?.itemIndex === index;
            
            return (
              <Box key={index} marginBottom={1}>
                <Box width={20}>
                  <Text color={index === selectedItem ? 'cyan' : 'white'}>
                    {index === selectedItem ? '▶ ' : '  '}
                    {item.label}
                  </Text>
                </Box>
                <Box>
                  {isEditing ? (
                    <TextInput
                      value={tempValue}
                      onChange={setTempValue}
                      placeholder="Enter value..."
                    />
                  ) : item.type === 'toggle' ? (
                    <Text color={item.value ? 'green' : 'red'}>
                      {item.value ? '✓ Enabled' : '✗ Disabled'}
                    </Text>
                  ) : item.type === 'text' ? (
                    <Text color="yellow" dimColor={index !== selectedItem}>
                      {String(item.value).length > 40 
                        ? String(item.value).substring(0, 40) + '...' 
                        : String(item.value)}
                    </Text>
                  ) : (
                    <Text color="yellow">{String(item.value)}</Text>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Divider />

        <Box marginTop={1}>
          <Text dimColor>
            {editingItem 
              ? '[Enter] Save • [Esc] Cancel'
              : '[←→/Tab] Switch Category • [↑↓] Navigate • [Enter] Edit/Toggle • [S] Save • [Esc] Back'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};