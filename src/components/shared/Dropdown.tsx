import React, { useRef, useEffect } from 'react';
import { Modal, TouchableOpacity, StyleSheet, ScrollView, View, Dimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { MaterialIcons } from '@expo/vector-icons';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  visible: boolean;
  onClose: () => void;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  triggerLayout?: { x: number; y: number; width: number; height: number };
}

export const Dropdown: React.FC<DropdownProps> = ({
  visible,
  onClose,
  options,
  selectedValue,
  onSelect,
  triggerLayout,
}) => {
  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
  };

  if (!visible || !triggerLayout) return null;

  const screenHeight = Dimensions.get('window').height;
  const dropdownMaxHeight = 250;
  
  // Position dropdown below the trigger
  const dropdownTop = triggerLayout.y + triggerLayout.height + 4;
  const spaceBelow = screenHeight - dropdownTop;
  const shouldShowAbove = spaceBelow < dropdownMaxHeight && triggerLayout.y > dropdownMaxHeight;
  
  const dropdownStyle = shouldShowAbove
    ? {
        bottom: screenHeight - triggerLayout.y + 4,
        left: triggerLayout.x,
        width: triggerLayout.width,
        maxHeight: dropdownMaxHeight,
      }
    : {
        top: dropdownTop,
        left: triggerLayout.x,
        width: triggerLayout.width,
        maxHeight: Math.min(dropdownMaxHeight, spaceBelow - 20),
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.dropdown, dropdownStyle]}>
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled
          >
            <VStack>
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                const isFirst = index === 0;
                const isLast = index === options.length - 1;
                
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      isFirst && styles.optionFirst,
                      isLast && styles.optionLast,
                    ]}
                    onPress={() => handleSelect(option.value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={18} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </VStack>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  scrollView: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#ffffff',
  },
  optionFirst: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  optionLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  optionSelected: {
    backgroundColor: '#F0F9FF',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
});

