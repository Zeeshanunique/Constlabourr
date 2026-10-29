import React, { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, StyleSheet, ScrollView, View, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/styles/theme';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  visible: boolean;
  onClose: () => void;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  title?: string;
  triggerLayout?: { x: number; y: number; width: number; height: number };
}

export const Dropdown: React.FC<DropdownProps> = ({
  visible,
  onClose,
  options,
  selectedValue,
  onSelect,
  title = 'Select Option',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSelect = (value: string) => {
    onSelect(value);
    setSearchQuery('');
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  if (!visible) return null;

  // Filter options based on search query
  const filteredOptions = searchQuery
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={20} color={theme.colors.slate[500]} />
            </TouchableOpacity>
          </View>

          {/* Search Input - show if more than 4 options */}
          {options.length > 4 && (
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={18} color={theme.colors.slate[400]} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search options..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.colors.slate[400]}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color={theme.colors.slate[400]} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Options List */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === selectedValue;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <MaterialIcons name="check-circle" size={18} color={theme.colors.safetyOrange} />
                    ) : (
                      <View style={styles.uncheckCircle} />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No matching options found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    width: '100%',
    maxWidth: 440,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.slate[100],
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.slate[50],
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.slate[900],
    paddingVertical: 6,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: theme.colors.safetyOrangeLight,
  },
  optionText: {
    fontSize: 14,
    color: theme.colors.slate[800],
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  optionTextSelected: {
    color: theme.colors.safetyOrange,
    fontWeight: '700',
  },
  uncheckCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.slate[300],
  },
  noResults: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: theme.colors.slate[400],
  },
});
