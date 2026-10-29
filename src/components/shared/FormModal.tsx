import React from 'react';
import { View, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import { formStyles } from './form-styles';
import { theme } from '@/styles/theme';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showFooter?: boolean;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  loading = false,
  submitDisabled = false,
  size = 'lg',
  showFooter = true,
}: FormModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={size}
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <ModalBackdrop onPress={onClose} />
      <ModalContent 
        style={[
          formStyles.modalContent,
          { alignSelf: 'center' }
        ]}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flexShrink: 1, maxHeight: '100%' }}
        >
          {/* Header */}
          <View style={formStyles.modalHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={formStyles.modalTitle}>{title}</Text>
              {subtitle ? (
                <Text style={formStyles.modalSubtitle}>{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.slate[100],
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={formStyles.modalBody}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {showFooter && (
            <View style={formStyles.modalFooter}>
              <TouchableOpacity
                onPress={onClose}
                style={formStyles.buttonCancel}
                activeOpacity={0.7}
              >
                <Text style={formStyles.buttonCancelText}>{cancelLabel}</Text>
              </TouchableOpacity>

              {onSubmit && (
                <TouchableOpacity
                  onPress={onSubmit}
                  disabled={loading || submitDisabled}
                  style={[
                    formStyles.buttonPrimary,
                    (loading || submitDisabled) && formStyles.buttonPrimaryDisabled,
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={formStyles.buttonPrimaryText}>
                    {loading ? 'Processing...' : submitLabel}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </ModalContent>
    </Modal>
  );
}
