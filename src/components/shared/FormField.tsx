import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formStyles } from './form-styles';
import { Dropdown } from './Dropdown';
import { theme } from '@/styles/theme';

interface FormFieldProps {
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
}

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
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleTextChange = (text: string) => {
    if (onChangeText) onChangeText(text);
    if (onValueChange) onValueChange(text);
  };

  const renderInput = () => {
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
            style={[
              formStyles.formInput,
              disabled && { opacity: 0.6 },
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                formStyles.formInputField,
                { paddingHorizontal: 0, flex: 1 },
                !displayValue && formStyles.formInputPlaceholder,
              ]}
            >
              {displayValue || placeholder || 'Select date (DD-MM-YYYY)'}
            </Text>
            <MaterialIcons name="event" size={20} color={theme.colors.slate[500]} />
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
            style={[
              formStyles.formInput,
              disabled && { opacity: 0.6 },
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                formStyles.formInputField,
                { paddingHorizontal: 0, flex: 1 },
                !selectedOption && formStyles.formInputPlaceholder,
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label || placeholder || `Select ${label.toLowerCase()}`}
            </Text>
            <MaterialIcons name="expand-more" size={22} color={theme.colors.slate[500]} />
          </TouchableOpacity>

          <Dropdown
            visible={isDropdownVisible}
            onClose={() => setIsDropdownVisible(false)}
            options={selectOptions}
            selectedValue={value}
            title={`Select ${label.replace(/\*/g, '').trim()}`}
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
        <View
          style={[
            formStyles.formInput,
            isFocused && formStyles.formInputFocused,
            errorText && { borderColor: theme.colors.red[500] },
            { minHeight: 88, padding: 12 },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            placeholderTextColor={formStyles.formInputPlaceholder.color}
            multiline
            numberOfLines={numberOfLines}
            style={[formStyles.formInputField, { paddingHorizontal: 0, paddingVertical: 0, textAlignVertical: 'top' }]}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
      );
    }

    // Default: text, email, phone, number, password
    let determinedKeyboardType: any = keyboardType;
    if (!determinedKeyboardType) {
      if (type === 'email') determinedKeyboardType = 'email-address';
      else if (type === 'phone') determinedKeyboardType = 'phone-pad';
      else if (type === 'number') determinedKeyboardType = 'numeric';
    }

    const isPassword = type === 'password' || secureTextEntry;

    return (
      <View
        style={[
          formStyles.formInput,
          isFocused && formStyles.formInputFocused,
          errorText && { borderColor: theme.colors.red[500] },
          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={formStyles.formInputPlaceholder.color}
          style={[formStyles.formInputField, { flex: 1, paddingHorizontal: 0 }]}
          editable={!disabled}
          keyboardType={determinedKeyboardType}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
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
      </View>
    );
  };

  return (
    <View style={formStyles.formField}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={formStyles.formLabel}>{label.replace(/\*/g, '').trim()}</Text>
        {required && <Text style={{ color: theme.colors.red[600], marginLeft: 4, fontWeight: '800' }}>*</Text>}
      </View>

      {renderInput()}

      {helperText && !errorText ? (
        <Text style={formStyles.formHelperText}>{helperText}</Text>
      ) : null}

      {errorText ? (
        <Text style={formStyles.formErrorText}>{errorText}</Text>
      ) : null}
    </View>
  );
}
