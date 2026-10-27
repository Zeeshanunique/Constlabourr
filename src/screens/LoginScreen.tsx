import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, AppContextType } from '../context/AppContext';
import Toast from 'react-native-toast-message';
import { Phone, Mail, Lock, User as UserIcon, ArrowLeft } from 'lucide-react-native';

const { height: screenHeight } = Dimensions.get('window');

interface LoginScreenProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, name: string) => Promise<void>;
}

type AuthMode = 'phone' | 'otp' | 'email' | 'register';

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('phone');
  
  // Form states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const context = useContext(AppContext) as AppContextType | null;

  const handleSendOTP = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone Number',
        text2: 'Please enter a valid 10-digit mobile number.',
      });
      return;
    }
    
    setLoading(true);
    // Simulate sending OTP
    setTimeout(() => {
      setLoading(false);
      setAuthMode('otp');
      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: 'Use verification code 123456 to continue.',
      });
    }, 1000);
  };

  const handleVerifyOTP = async () => {
    if (otpCode !== '123456') {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Incorrect OTP code. Try 123456.',
      });
      return;
    }

    setLoading(true);
    try {
      // Since phone auth is mock, we sign into a demo account or prompt them
      // In a real production flow, this would connect to supabase phone auth.
      // For this implementation, we will log in with a default demo contractor account if available
      // or we just show a success message and guide them to use email auth for active projects.
      const loginHandler = onLogin || context?.handleLogin;
      if (loginHandler) {
        // Try to log in with a demo user to let them see the app
        await loginHandler('contractor@example.com', 'password');
        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome to ConstLabour (Demo Mode).',
        });
      } else {
        throw new Error('Login handler not found');
      }
    } catch (error: any) {
      console.error('Demo login error:', error);
      Toast.show({
        type: 'info',
        text1: 'OTP Verified',
        text2: 'Please use Email Login to access your specific account.',
      });
      setAuthMode('email');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please enter both email and password.',
      });
      return;
    }

    const loginHandler = onLogin || context?.handleLogin;
    if (!loginHandler) return;

    setLoading(true);
    try {
      await loginHandler(email, password);
    } catch (error) {
      console.error('Login error:', error);
      // Toast shown in App.tsx
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterContractor = async () => {
    if (!registerName || !registerEmail || !registerPassword) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please fill in all fields.',
      });
      return;
    }

    const registerHandler = onRegister || context?.handleRegister;
    if (!registerHandler) return;

    setLoading(true);
    try {
      await registerHandler(registerEmail, registerPassword, registerName);
      // Reset registration states
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      // Redirect to email login
      setEmail(registerEmail);
      setAuthMode('email');
    } catch (error) {
      console.error('Registration error:', error);
      // Toast shown in App.tsx
    } finally {
      setLoading(false);
    }
  };

  const handleTruecallerLogin = () => {
    Toast.show({
      type: 'info',
      text1: 'Truecaller Integration',
      text2: 'Simulating login with Truecaller profile...',
    });
    setPhoneNumber('9876543210');
    handleSendOTP();
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
          {/* Top Banner Section */}
          <View style={styles.bannerContainer}>
            {/* App Logo & Name Row */}
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoMini}
                resizeMode="contain"
              />
              <Text style={styles.appNameText}>ConstLabour</Text>
            </View>
            
            {/* Contractor Worker Illustration */}
            <Image
              source={require('../../assets/contractor_worker_clean.png')}
              style={styles.workerImage}
              resizeMode="contain"
            />
          </View>

          {/* Overlapping Interactive Sheet */}
          <View style={styles.cardSheet}>
            {authMode === 'phone' && (
              <View style={styles.formContainer}>
                <Text style={styles.cardTitle}>Enter your Mobile number</Text>
                
                <View style={styles.phoneInputRow}>
                  <View style={styles.phoneInputContainer}>
                    <Text style={styles.countryCode}>+91</Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Mobile Number"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.otpButton}
                    onPress={handleSendOTP}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.otpButtonText}>Get OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Truecaller button */}
                <TouchableOpacity
                  style={styles.truecallerButton}
                  onPress={handleTruecallerLogin}
                  activeOpacity={0.8}
                >
                  <Phone size={18} color="#2563eb" style={styles.truecallerIcon} />
                  <Text style={styles.truecallerText}>Continue with Truecaller</Text>
                </TouchableOpacity>

                {/* Footer links */}
                <View style={styles.footerLinks}>
                  <TouchableOpacity
                    style={styles.footerLinkButton}
                    onPress={() => setAuthMode('email')}
                  >
                    <Text style={styles.footerLinkPrimary}>Login with Email & Password</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.footerLinkButton, { marginTop: 12 }]}
                    onPress={() => setAuthMode('register')}
                  >
                    <Text style={styles.footerLinkSecondary}>Register as a Contractor</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {authMode === 'otp' && (
              <View style={styles.formContainer}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setAuthMode('phone')}
                >
                  <ArrowLeft size={20} color="#475569" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>Verify OTP</Text>
                <Text style={styles.otpSubtitle}>
                  We have sent a verification code to +91 {phoneNumber}
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verification Code</Text>
                  <TextInput
                    style={styles.fullWidthInput}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {authMode === 'email' && (
              <View style={styles.formContainer}>
                <Text style={styles.cardTitle}>Login with Email</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputIconWrapper}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="contractor@example.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputIconWrapper}>
                    <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="Enter your password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleEmailLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Login</Text>
                  )}
                </TouchableOpacity>

                {/* Footer links */}
                <View style={styles.footerLinks}>
                  <TouchableOpacity
                    style={styles.footerLinkButton}
                    onPress={() => setAuthMode('phone')}
                  >
                    <Text style={styles.footerLinkPrimary}>Login with Mobile Number</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.footerLinkButton, { marginTop: 12 }]}
                    onPress={() => setAuthMode('register')}
                  >
                    <Text style={styles.footerLinkSecondary}>Register as a Contractor</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {authMode === 'register' && (
              <View style={styles.formContainer}>
                <Text style={styles.cardTitle}>Register as Contractor</Text>
                <Text style={styles.registerSubtext}>
                  Create an account to manage your construction workforce.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputIconWrapper}>
                    <UserIcon size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="John Doe"
                      value={registerName}
                      onChangeText={setRegisterName}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputIconWrapper}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="contractor@example.com"
                      value={registerEmail}
                      onChangeText={setRegisterEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputIconWrapper}>
                    <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="Create a password"
                      value={registerPassword}
                      onChangeText={setRegisterPassword}
                      secureTextEntry
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRegisterContractor}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Register</Text>
                  )}
                </TouchableOpacity>

                {/* Footer links */}
                <View style={styles.footerLinks}>
                  <TouchableOpacity
                    style={styles.footerLinkButton}
                    onPress={() => setAuthMode('email')}
                  >
                    <Text style={styles.footerLinkPrimary}>Already have an account? Login</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.footerLinkButton, { marginTop: 12 }]}
                    onPress={() => setAuthMode('phone')}
                  >
                    <Text style={styles.footerLinkSecondary}>Login with Mobile Number</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1859C1', // Match banner background color for status bars
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
  },
  bannerContainer: {
    width: '100%',
    height: 290,
    backgroundColor: '#1859C1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  logoMini: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  workerImage: {
    width: 160,
    height: 160,
    marginBottom: 10,
  },
  cardSheet: {
    flex: 1,
    marginTop: -32, // Overlaps the bottom of the banner
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    minHeight: screenHeight - 258,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  formContainer: {
    width: '100%',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  phoneInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    height: 54,
    paddingHorizontal: 16,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
    height: '100%',
    padding: 0,
  },
  otpButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 54,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 95,
  },
  otpButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  dividerText: {
    fontSize: 14,
    color: '#94a3b8',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  truecallerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 12,
    height: 54,
    backgroundColor: '#ffffff',
    marginBottom: 32,
  },
  truecallerIcon: {
    marginRight: 10,
  },
  truecallerText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    height: 54,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  iconInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%',
    fontWeight: '500',
  },
  fullWidthInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    height: 54,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 4,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerLinkButton: {
    paddingVertical: 4,
  },
  footerLinkPrimary: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '700',
  },
  footerLinkSecondary: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  registerSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6,
  },
});
