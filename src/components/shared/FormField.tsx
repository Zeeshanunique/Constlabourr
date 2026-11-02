import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formStyles } from './form-styles';
import { Dropdown } from './Dropdown';
import { theme } from '@/styles/theme';

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'phone' | 'select' | 'textarea' | 'date';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  selectOptions?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  icon?: keyof typeof MaterialIcons.glyphMap;
  suffix?: string;
  maxLength?: number;
}

export const getFieldIcon = (
  label: string,
  type?: string,
  explicitIcon?: keyof typeof MaterialIcons.glyphMap
): keyof typeof MaterialIcons.glyphMap => {
  if (explicitIcon) return explicitIcon;
  const l = (label || '').toLowerCase();

  if (l.includes('aadhaar') || l.includes('adhaar') || l.includes('identity') || l.includes('govt id')) return 'badge';
  if (l.includes('phone') || l.includes('mobile') || l.includes('contact')) return 'phone';
  if (l.includes('email') || l.includes('mail')) return 'mail-outline';
  if (l.includes('password')) return 'lock-outline';
  if (
    l.includes('wage') ||
    l.includes('salary') ||
    l.includes('payment') ||
    l.includes('rate') ||
    l.includes('amount') ||
    l.includes('charge') ||
    l.includes('canteen') ||
    l.includes('mess') ||
    l.includes('cost') ||
    l.includes('overtime') ||
    l.includes('upi')
  ) return 'currency-rupee';
  if (
    l.includes('site') ||
    l.includes('project') ||
    l.includes('location') ||
    l.includes('address') ||
    l.includes('building') ||
    l.includes('firm') ||
    l.includes('company')
  ) return 'business';
  if (l.includes('foreman') || l.includes('supervisor')) return 'engineering';
  if (
    l.includes('worker') ||
    l.includes('labor') ||
    l.includes('labour') ||
    l.includes('name') ||
    l.includes('person') ||
    l.includes('user')
  ) return 'person';
  if (l.includes('skill') || l.includes('qualification') || l.includes('trade') || l.includes('role')) return 'military-tech';
  if (l.includes('date') || l.includes('start') || l.includes('completion') || l.includes('end') || type === 'date') return 'calendar-today';
  if (l.includes('bank') || l.includes('account')) return 'account-balance';
  if (l.includes('ifsc') || l.includes('code') || l.includes('gstin') || l.includes('license')) return 'qr-code';
  if (l.includes('hours') || l.includes('time') || l.includes('check-in') || l.includes('check-out')) return 'access-time';

  if (type === 'phone') return 'phone';
  if (type === 'email') return 'mail-outline';
  if (type === 'password') return 'lock-outline';
  if (type === 'number') return 'tag';
  if (type === 'select') return 'list';
  if (type === 'textarea') return 'notes';
  return 'edit';
};

export function FormField({
  label,
  value,
  onChangeText,
  onValueChange,
  placeholder,
  required = false,
  helperText,
  errorText,
  type = 'text',
  keyboardType,
  secureTextEntry = false,
  autoCapitalize = 'none',
  selectOptions = [],
  disabled = false,
  multiline = false,
  numberOfLines = 4,
  icon,
  suffix,
  maxLength,
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const cleanLabel = (label || '').replace(/\*/g, '').trim();
  const lowerLabel = cleanLabel.toLowerCase();
  const isPhone = type === 'phone' || lowerLabel.includes('phone') || lowerLabel.includes('mobile');
  const isAadhaar = lowerLabel.includes('aadhaar') || lowerLabel.includes('adhaar');

  // Hard limits for phone (10) and Aadhaar (12)
  let effectiveMaxLength = maxLength;
  if (isPhone) effectiveMaxLength = 10;
  if (isAadhaar) effectiveMaxLength = 12;

  let determinedKeyboardType: any = keyboardType;
  if (isPhone) determinedKeyboardType = 'phone-pad';
  else if (isAadhaar) determinedKeyboardType = 'numeric';
  else if (!determinedKeyboardType) {
    if (type === 'email') determinedKeyboardType = 'email-address';
    else if (type === 'number') determinedKeyboardType = 'numeric';
  }

  const handleTextChange = (text: string) => {
    let sanitized = text;
    if (isPhone) {
      sanitized = text.replace(/[^0-9]/g, '').slice(0, 10);
    } else if (isAadhaar) {
      sanitized = text.replace(/[^0-9]/g, '').slice(0, 12);
    }
    if (onChangeText) onChangeText(sanitized);
    if (onValueChange) onValueChange(sanitized);
  };

  const resolvedIcon = getFieldIcon(cleanLabel, type, icon);

  const renderControl = () => {
    if (type === 'date') {
      const dateValue = value ? new Date(value) : new Date();
      const displayValue = value
        ? new Date(value).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '';

      const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
          setShowDatePicker(false);
        }
        if (selectedDate) {
          const dateStr = selectedDate.toISOString().split('T')[0];
          handleTextChange(dateStr);
        }
      };

      return (
        <>
          <TouchableOpacity
            onPress={() => !disabled && setShowDatePicker(true)}
            disabled={disabled}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                formStyles.fieldValueText,
                !displayValue && formStyles.fieldPlaceholderText,
              ]}
              numberOfLines={1}
            >
              {displayValue || placeholder || 'Select date (DD-MM-YYYY)'}
            </Text>
            <MaterialIcons name="event" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={isNaN(dateValue.getTime()) ? new Date() : dateValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date(2100, 11, 31)}
              minimumDate={new Date(2000, 0, 1)}
            />
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={{ backgroundColor: '#ffffff', padding: 8, alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={{ color: theme.colors.safetyOrange, fontSize: 15, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      );
    }

    if (type === 'select') {
      const selectedOption = selectOptions.find((opt) => opt.value === value);

      return (
        <>
          <TouchableOpacity
            onPress={() => !disabled && setIsDropdownVisible(true)}
            disabled={disabled}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                formStyles.fieldValueText,
                !selectedOption && formStyles.fieldPlaceholderText,
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label || placeholder || `Select ${lowerLabel}`}
            </Text>
            <MaterialIcons name="expand-more" size={22} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <Dropdown
            visible={isDropdownVisible}
            onClose={() => setIsDropdownVisible(false)}
            options={selectOptions}
            selectedValue={value}
            title={`Select ${cleanLabel}`}
            onSelect={(val) => {
              handleTextChange(val);
              setIsDropdownVisible(false);
            }}
          />
        </>
      );
    }

    if (type === 'textarea') {
      return (
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={formStyles.fieldPlaceholderText.color}
          multiline
          numberOfLines={numberOfLines}
          style={[
            formStyles.fieldTextInput,
            { minHeight: 64, textAlignVertical: 'top' },
          ]}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      );
    }

    // Default: text, email, phone, number, password
    const isPassword = type === 'password' || secureTextEntry;

    return (
      <>
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={formStyles.fieldPlaceholderText.color}
          style={formStyles.fieldTextInput}
          editable={!disabled}
          keyboardType={determinedKeyboardType}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
          maxLength={effectiveMaxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name={isPasswordVisible ? 'visibility-off' : 'visibility'}
              size={20}
              color={theme.colors.slate[400]}
            />
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={[
          formStyles.fieldCard,
          isFocused && formStyles.fieldCardFocused,
          Boolean(errorText) && formStyles.fieldCardError,
          disabled && formStyles.fieldCardDisabled,
        ]}
      >
        {/* Card Header: Label on top */}
        <View style={formStyles.fieldCardHeader}>
          <Text style={formStyles.fieldCardLabel}>
            {cleanLabel}
            {required && <Text style={formStyles.requiredAsterisk}> *</Text>}
          </Text>
          {!required && !lowerLabel.includes('optional') && (
            <Text style={formStyles.optionalTag}>(Optional)</Text>
          )}
        </View>

        {/* Card Input Row: Leading Icon + Control + Suffix/Trailing */}
        <View style={formStyles.fieldInputRow}>
          <MaterialIcons
            name={resolvedIcon}
            size={20}
            color={isFocused ? theme.colors.safetyOrange : theme.colors.slate[700]}
            style={formStyles.leadingIcon}
          />
          {renderControl()}
          {suffix ? <Text style={formStyles.fieldSuffix}>{suffix}</Text> : null}
        </View>
      </View>

      {helperText && !errorText ? (
        <Text style={formStyles.fieldHelperText}>{helperText}</Text>
      ) : null}

      {errorText ? (
        <Text style={formStyles.fieldErrorText}>{errorText}</Text>
      ) : null}
    </View>
  );
}
