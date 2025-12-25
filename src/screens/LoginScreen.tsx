import React, { useState, useContext } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '../components/ui/box';
import { Button, ButtonText } from '../components/ui/button';
import { VStack } from '../components/ui/vstack';
import { HStack } from '../components/ui/hstack';
import { Text } from '../components/ui/text';
import { Input, InputField } from '../components/ui/input';
import { AppContext } from '../context/AppContext';

interface LoginScreenProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, name: string) => Promise<void>;
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const context = useContext(AppContext);

  const handleLogin = async () => {
    const loginHandler = onLogin || context?.handleLogin;
    if (!loginHandler) return;

    setLoading(true);
    try {
      await loginHandler(loginEmail, loginPassword);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const registerHandler = onRegister || context?.handleRegister;
    if (!registerHandler) return;

    setLoading(true);
    try {
      await registerHandler(registerEmail, registerPassword, registerName);
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterName('');
      setActiveTab('login');
    } catch (error) {
      console.error('Register error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../../assets/icon.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text 
                size="2xl" 
                bold 
                style={{ 
                  fontSize: 28, 
                  fontWeight: '700', 
                  color: '#111827', 
                  marginTop: 16,
                  marginBottom: 8,
                  letterSpacing: -0.5,
                }}
              >
                ConstLabour
              </Text>
              <Text 
                size="sm" 
                style={{ 
                  fontSize: 14, 
                  color: '#6b7280',
                  textAlign: 'center',
                }}
              >
                Construction Labour Management
              </Text>
            </View>

            <Box className="bg-white rounded-lg p-6 shadow-md w-full" style={[styles.card, { 
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }]}>
            <View style={styles.tabContainer}>
              <View style={styles.tabWrapper}>
                <Button
                  onPress={() => setActiveTab('login')}
                  style={[
                    styles.tabButton,
                    activeTab === 'login' && styles.tabButtonActive,
                  ]}
                >
                  <ButtonText style={[
                    styles.tabButtonText,
                    activeTab === 'login' && styles.tabButtonTextActive,
                  ]}>
                    Login
                  </ButtonText>
                </Button>
                <Button
                  onPress={() => setActiveTab('register')}
                  style={[
                    styles.tabButton,
                    activeTab === 'register' && styles.tabButtonActive,
                  ]}
                >
                  <ButtonText style={[
                    styles.tabButtonText,
                    activeTab === 'register' && styles.tabButtonTextActive,
                  ]}>
                    Register
                  </ButtonText>
                </Button>
              </View>
            </View>

            {activeTab === 'login' ? (
              <VStack space="lg">
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email</Text>
                  <Input 
                    size="lg" 
                    variant="outline"
                    style={styles.inputWrapper}
                  >
                    <InputField
                      placeholder="contractor@example.com"
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                      placeholderTextColor="#9ca3af"
                    />
                  </Input>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Password</Text>
                  <Input 
                    size="lg" 
                    variant="outline"
                    style={styles.inputWrapper}
                  >
                    <InputField
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      secureTextEntry
                      style={styles.input}
                      placeholderTextColor="#9ca3af"
                    />
                  </Input>
                </View>
                <Button
                  onPress={handleLogin}
                  isDisabled={loading}
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                >
                  <ButtonText style={styles.submitButtonText}>
                    {loading ? 'Loading...' : 'Login'}
                  </ButtonText>
                </Button>
              </VStack>
            ) : (
              <View>
                <Text style={styles.registerSubtext}>
                  Register as a Contractor to get started
                </Text>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <Input 
                    size="lg" 
                    variant="outline"
                    style={styles.inputWrapper}
                  >
                    <InputField
                      placeholder="John Doe"
                      value={registerName}
                      onChangeText={setRegisterName}
                      style={styles.input}
                      placeholderTextColor="#9ca3af"
                    />
                  </Input>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email</Text>
                  <Input 
                    size="lg" 
                    variant="outline"
                    style={styles.inputWrapper}
                  >
                    <InputField
                      placeholder="contractor@example.com"
                      value={registerEmail}
                      onChangeText={setRegisterEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                      placeholderTextColor="#9ca3af"
                    />
                  </Input>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Password</Text>
                  <Input 
                    size="lg" 
                    variant="outline"
                    style={styles.inputWrapper}
                  >
                    <InputField
                      placeholder="Create a password"
                      value={registerPassword}
                      onChangeText={setRegisterPassword}
                      secureTextEntry
                      style={styles.input}
                      placeholderTextColor="#9ca3af"
                    />
                  </Input>
                </View>
                <Button
                  onPress={handleRegister}
                  isDisabled={loading}
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                >
                  <ButtonText style={styles.submitButtonText}>
                    {loading ? 'Loading...' : 'Register'}
                  </ButtonText>
                </Button>
              </View>
            )}
            </Box>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
    padding: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  tabContainer: {
    marginBottom: 24,
    width: '100%',
  },
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    width: '100%',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  registerSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
});
