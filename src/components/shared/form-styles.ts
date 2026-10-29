import { StyleSheet } from 'react-native';
import { theme } from '@/styles/theme';

export const formStyles = StyleSheet.create({
  // Form Field Styles
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.slate[800],
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  formLabelRequired: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.slate[800],
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  formLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate[700],
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: '#ffffff',
    minHeight: 48,
    opacity: 1,
  },
  formInputFocused: {
    borderColor: theme.colors.safetyOrange,
    borderWidth: 1.5,
  },
  formInputField: {
    fontSize: 14,
    color: theme.colors.slate[900],
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontWeight: '500',
  },
  formInputPlaceholder: {
    color: theme.colors.slate[400],
  },
  formHelperText: {
    fontSize: 11,
    color: theme.colors.slate[500],
    marginTop: 4,
  },
  formErrorText: {
    fontSize: 11,
    color: theme.colors.red[600],
    marginTop: 4,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '88%',
    width: '92%',
    maxWidth: 580,
    flexDirection: 'column',
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    flexGrow: 1,
    flexShrink: 1,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.slate[100],
    backgroundColor: theme.colors.slate[50],
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  
  // Button Styles
  buttonCancel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancelText: {
    color: theme.colors.slate[700],
    fontWeight: '700',
    fontSize: 13,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.safetyOrange,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  buttonPrimaryDisabled: {
    backgroundColor: theme.colors.slate[300],
    opacity: 0.7,
    elevation: 0,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
