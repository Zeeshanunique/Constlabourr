import React from 'react';
import {
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  showFooter = true,
}: FormModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={formStyles.fullScreenContainer} edges={['top', 'bottom']}>
        {/* Full-Screen Dark Header */}
        <View style={formStyles.fullScreenHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={formStyles.headerBackButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-left" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={formStyles.headerTitleArea}>
            <Text style={formStyles.fullScreenHeaderTitle} numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text style={formStyles.fullScreenHeaderSubtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {/* Scrollable Form Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={formStyles.fullScreenScroll}
            contentContainerStyle={formStyles.fullScreenScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Full-Width Action Button Dock */}
          {showFooter && onSubmit && (
            <View style={formStyles.fullScreenFooter}>
              <TouchableOpacity
                onPress={onSubmit}
                disabled={loading || submitDisabled}
                style={[
                  formStyles.fullScreenSubmitBtn,
                  (loading || submitDisabled) && formStyles.fullScreenSubmitBtnDisabled,
                ]}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={formStyles.fullScreenSubmitBtnText}>{submitLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
