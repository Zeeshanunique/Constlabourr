import { StyleSheet } from 'react-native';
import { theme } from '@/styles/theme';

export const formStyles = StyleSheet.create({
  // Full Screen Page Styles (matching contractor register & mobile full-screen flow)
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullScreenHeader: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginRight: 4,
  },
  headerTitleArea: {
    flex: 1,
    justifyContent: 'center',
  },
  fullScreenHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  fullScreenHeaderSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  fullScreenScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fullScreenScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  fullScreenFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  fullScreenSubmitBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 25,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...theme.shadows.sm,
  },
  fullScreenSubmitBtnDisabled: {
    backgroundColor: '#64748B',
    opacity: 0.5,
  },
  fullScreenSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Section Header (Grouping sections: Basic Information, Payment Information, etc.)
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: -0.1,
  },

  // Field Card Styles (enclosed white card with leading icon)
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  fieldCardFocused: {
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  fieldCardError: {
    borderColor: theme.colors.red[500],
  },
  fieldCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  fieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.1,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '800',
  },
  optionalTag: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },
  leadingIcon: {
    marginRight: 10,
  },
  fieldTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  fieldValueText: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  fieldPlaceholderText: {
    color: '#94A3B8',
  },
  fieldSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },
  fieldHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    paddingHorizontal: 2,
  },
  fieldErrorText: {
    fontSize: 11,
    color: theme.colors.red[600],
    marginTop: 3,
    paddingHorizontal: 2,
    fontWeight: '600',
  },

  // Legacy Form Field Styles (retained for popup modals like Issue Advance)
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
  
  // Popup Modal Styles (retained for Issue Advance & Edit Attendance)
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
