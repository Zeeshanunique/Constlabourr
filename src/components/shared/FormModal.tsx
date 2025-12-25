import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { MaterialIcons } from '@expo/vector-icons';
import { formStyles } from './form-styles';

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
  submitLabel = 'Save',
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
        <ModalHeader style={formStyles.modalHeader}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={formStyles.modalTitle}>{title}</Text>
            {subtitle && (
              <Text style={formStyles.modalSubtitle}>{subtitle}</Text>
            )}
          </View>
          <ModalCloseButton onPress={onClose} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody 
          style={formStyles.modalBody}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <VStack space="lg">
            {children}
          </VStack>
        </ModalBody>
        {showFooter && (
          <ModalFooter style={formStyles.modalFooter}>
            <Button
              variant="outline"
              onPress={onClose}
              style={formStyles.buttonCancel}
            >
              <ButtonText style={formStyles.buttonCancelText}>{cancelLabel}</ButtonText>
            </Button>
            {onSubmit && (
              <Button
                onPress={onSubmit}
                isDisabled={loading || submitDisabled}
                style={[
                  formStyles.buttonPrimary,
                  (loading || submitDisabled) && formStyles.buttonPrimaryDisabled,
                ]}
              >
                <ButtonText style={formStyles.buttonPrimaryText}>
                  {loading ? 'Loading...' : submitLabel}
                </ButtonText>
              </Button>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}

