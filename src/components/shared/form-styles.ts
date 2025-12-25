import { StyleSheet } from 'react-native';

export const formStyles = StyleSheet.create({
  // Form Field Styles
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  formLabelRequired: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  formLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    minHeight: 48,
    opacity: 1,
  },
  formInputFocused: {
    borderColor: '#2563eb',
    borderWidth: 2,
  },
  formInputField: {
    fontSize: 16,
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  formInputPlaceholder: {
    color: '#9ca3af',
  },
  formHelperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  formErrorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 6,
  },
  
  // Modal Styles
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    maxHeight: '90%',
    width: '90%',
    maxWidth: 640,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    flexGrow: 1,
    flexShrink: 1,
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  
  // Button Styles
  buttonCancel: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
  },
  buttonCancelText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 120,
  },
  buttonPrimaryDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Section Styles
  formSection: {
    marginBottom: 32,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  formSectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
});

export const formColors = {
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  error: '#dc2626',
  success: '#16a34a',
  text: {
    primary: '#111827',
    secondary: '#374151',
    tertiary: '#6b7280',
    placeholder: '#9ca3af',
  },
  border: {
    default: '#e5e7eb',
    focused: '#2563eb',
    error: '#dc2626',
  },
  background: {
    default: '#ffffff',
    modal: '#fafafa',
    input: '#ffffff',
  },
};

