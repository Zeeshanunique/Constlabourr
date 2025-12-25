import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FormControl, FormControlLabel, FormControlLabelText, FormControlHelper, FormControlHelperText, FormControlError, FormControlErrorText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formStyles } from './form-styles';
import { Dropdown } from './Dropdown';

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
  autoCapitalize,
  selectOptions = [],
  disabled = false,
  multiline = false,
  numberOfLines = 4,
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const triggerRef = useRef<View>(null);

  const renderInput = () => {
    if (type === 'date') {
      const dateValue = value ? new Date(value) : new Date();
      const displayValue = value ? new Date(value).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }) : '';

      const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
          setShowDatePicker(false);
        }
        
        if (selectedDate && onChangeText) {
          const dateStr = selectedDate.toISOString().split('T')[0];
          onChangeText(dateStr);
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
              { backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
            ]}
          >
            <Input
              variant="outline"
              size="md"
              style={[formStyles.formInput, { backgroundColor: '#ffffff', flex: 1, borderWidth: 0 }]}
              isDisabled={true}
            >
              <InputField
                placeholder={placeholder || 'Select date'}
                style={[formStyles.formInputField, { backgroundColor: 'transparent' }]}
                placeholderTextColor={formStyles.formInputPlaceholder.color}
                value={displayValue}
                editable={false}
              />
            </Input>
            <MaterialIcons 
              name="calendar-today" 
              size={20} 
              color="#6B7280"
              style={{ marginRight: 8 }}
            />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dateValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date(2100, 11, 31)}
              minimumDate={new Date(2000, 0, 1)}
            />
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={{ backgroundColor: '#ffffff', padding: 10 }}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={{ alignSelf: 'flex-end', padding: 8 }}
              >
                <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      );
    }

    if (type === 'select') {
      const selectedOption = selectOptions.find(opt => opt.value === value);
      
      const handlePress = () => {
        if (disabled) return;
        
        triggerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          setTriggerLayout({ x: pageX, y: pageY, width, height });
          setIsDropdownVisible(true);
        });
      };
      
      return (
        <>
          <TouchableOpacity
            ref={triggerRef}
            onPress={handlePress}
            disabled={disabled}
            style={[
              formStyles.formInput,
              disabled && { opacity: 0.6 },
              { backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
            ]}
          >
            <Input
              variant="outline"
              size="md"
              style={[formStyles.formInput, { backgroundColor: '#ffffff', flex: 1, borderWidth: 0 }]}
              isDisabled={true}
            >
              <InputField
                placeholder={placeholder || `Select ${label.toLowerCase()}`}
                style={[formStyles.formInputField, { backgroundColor: 'transparent' }]}
                placeholderTextColor={formStyles.formInputPlaceholder.color}
                value={selectedOption?.label || ''}
                editable={false}
              />
            </Input>
            <MaterialIcons 
              name="arrow-drop-down" 
              size={24} 
              color="#6B7280"
              style={{ marginRight: 8 }}
            />
          </TouchableOpacity>
          
          <Dropdown
            visible={isDropdownVisible}
            onClose={() => setIsDropdownVisible(false)}
            options={selectOptions}
            selectedValue={value}
            onSelect={(selectedValue) => {
              if (onValueChange) {
                onValueChange(selectedValue);
              }
            }}
            triggerLayout={triggerLayout}
          />
        </>
      );
    }

    if (type === 'textarea') {
      return (
        <Textarea
          size="md"
          variant="outline"
          style={[
            formStyles.formInput,
            isFocused && formStyles.formInputFocused,
            disabled && { opacity: 0.6 },
            { backgroundColor: '#ffffff' },
          ]}
        >
          <TextareaInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={formStyles.formInputPlaceholder.color}
            style={[formStyles.formInputField, { backgroundColor: 'transparent' }]}
            multiline={multiline}
            numberOfLines={numberOfLines}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!disabled}
          />
        </Textarea>
      );
    }

    return (
      <Input
        size="md"
        variant="outline"
        style={[
          formStyles.formInput,
          isFocused && formStyles.formInputFocused,
          disabled && { opacity: 0.6 },
          { backgroundColor: '#ffffff' },
        ]}
      >
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={formStyles.formInputPlaceholder.color}
          keyboardType={keyboardType || (type === 'email' ? 'email-address' : type === 'number' ? 'numeric' : type === 'phone' ? 'phone-pad' : 'default')}
          secureTextEntry={secureTextEntry || type === 'password'}
          autoCapitalize={autoCapitalize || (type === 'email' ? 'none' : 'sentences')}
          style={[formStyles.formInputField, { backgroundColor: 'transparent' }]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
        />
      </Input>
    );
  };

  return (
    <FormControl
      isRequired={required}
      isInvalid={!!errorText}
      isDisabled={disabled}
      style={formStyles.formField}
    >
      <FormControlLabel>
        <FormControlLabelText style={formStyles.formLabelText}>
          {label}
          {required && <Text style={{ color: '#dc2626' }}> *</Text>}
        </FormControlLabelText>
      </FormControlLabel>
      {renderInput()}
      {helperText && !errorText && (
        <FormControlHelper>
          <FormControlHelperText style={formStyles.formHelperText}>
            {helperText}
          </FormControlHelperText>
        </FormControlHelper>
      )}
      {errorText && (
        <FormControlError>
          <FormControlErrorText style={formStyles.formErrorText}>
            {errorText}
          </FormControlErrorText>
        </FormControlError>
      )}
    </FormControl>
  );
}

