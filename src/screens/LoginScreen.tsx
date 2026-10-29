import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, AppContextType } from '../context/AppContext';
import Toast from 'react-native-toast-message';
import {
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  ArrowLeft,
  Building,
  ShieldCheck,
  CheckCircle,
  Eye,
  EyeOff,
  Fingerprint,
  MessageSquare,
  HelpCircle,
  FileText,
} from 'lucide-react-native';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';

interface LoginScreenProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, name: string) => Promise<void>;
}

type AuthMode = 'login' | 'otp' | 'register';
type LoginTab = 'phone' | 'email';

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loginTab, setLoginTab] = useState<LoginTab>('phone');

  // Phone & OTP states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [activePinIndex, setActivePinIndex] = useState(0);
  const [resendTimer, setResendTimer] = useState(45);
  const otpInputRefs = useRef<any[]>([]);

  // Email login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Contractor Registration states
  const [companyName, setCompanyName] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [licenseGstin, setLicenseGstin] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const context = useContext(AppContext) as AppContextType | null;

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (authMode === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [authMode, resendTimer]);

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
    setTimeout(() => {
      setLoading(false);
      setAuthMode('otp');
      setResendTimer(45);
      // Pre-fill demo digits for seamless testing
      setOtpDigits(['1', '2', '3', '4', '', '']);
      setActivePinIndex(4);
      Toast.show({
        type: 'success',
        text1: 'Verification Code Sent',
        text2: 'Use 123456 to verify on this demo build.',
      });
    }, 800);
  };

  const handleOtpChange = (val: string, index: number) => {
    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
      setActivePinIndex(index + 1);
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
      setActivePinIndex(index - 1);
    }
  };

  const handleVerifyOTP = async () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Incomplete Code',
        text2: 'Please enter all 6 digits.',
      });
      return;
    }

    if (fullOtp !== '123456') {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Invalid OTP code. Try entering 123456.',
      });
      return;
    }

    setLoading(true);
    try {
      const loginHandler = onLogin || context?.handleLogin;
      if (loginHandler) {
        // Sign into contractor demo account
        await loginHandler('contractor@example.com', 'password');
        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome to ConstLabour Pro.',
        });
      } else {
        throw new Error('Login handler not found');
      }
    } catch (error: any) {
      console.error('OTP demo login error:', error);
      Toast.show({
        type: 'info',
        text1: 'Phone Verified',
        text2: 'Please use Email Login to access your specific registered account.',
      });
      setAuthMode('login');
      setLoginTab('email');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please enter both your email address and password.',
      });
      return;
    }

    const loginHandler = onLogin || context?.handleLogin;
    if (!loginHandler) return;

    setLoading(true);
    try {
      await loginHandler(email.trim(), password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterContractor = async () => {
    if (!companyName || !contractorName || !registerEmail || !registerPassword) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please complete all required fields.',
      });
      return;
    }

    if (!agreeTerms) {
      Toast.show({
        type: 'error',
        text1: 'Agreement Required',
        text2: 'Please accept the Terms of Service & Labour Code compliance.',
      });
      return;
    }

    const registerHandler = onRegister || context?.handleRegister;
    if (!registerHandler) return;

    setLoading(true);
    try {
      const combinedName = `${companyName} (${contractorName})`;
      await registerHandler(registerEmail.trim(), registerPassword, combinedName);
      
      // Reset form and transition to login
      setEmail(registerEmail.trim());
      setAuthMode('login');
      setLoginTab('email');
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTruecallerLogin = () => {
    setPhoneNumber('9876543210');
    Toast.show({
      type: 'info',
      text1: 'Truecaller Profile Verified',
      text2: 'Sending SMS verification code to +91 9876543210',
    });
    handleSendOTP();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Industrial Header & Brand Identity */}
          <View style={styles.headerBar}>
            <BrandLogo size={42} showText={true} subtitle="FIELD OPERATIONS OS v3.4" />
            <View style={styles.langPill}>
              <Text style={styles.langActive}>EN</Text>
              <Text style={styles.langDivider}>|</Text>
              <Text style={styles.langInactive}>हिंदी</Text>
            </View>
          </View>

          {/* VIEW 1: UNIFIED LOGIN PORTAL */}
          {authMode === 'login' && (
            <View style={styles.mainCard}>
              <View style={styles.titleSection}>
                <Text style={styles.screenHeading}>Welcome Back</Text>
                <Text style={styles.screenSubtitle}>
                  Sign in to manage sites, daily attendance & payroll records.
                </Text>
              </View>

              {/* Segmented Dual Method Switcher */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, loginTab === 'phone' && styles.tabButtonActive]}
                  onPress={() => setLoginTab('phone')}
                  activeOpacity={0.8}
                >
                  <Phone size={16} color={loginTab === 'phone' ? '#FFFFFF' : colors.textMuted} />
                  <Text style={[styles.tabText, loginTab === 'phone' && styles.tabTextActive]}>
                    Mobile & OTP
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, loginTab === 'email' && styles.tabButtonActive]}
                  onPress={() => setLoginTab('email')}
                  activeOpacity={0.8}
                >
                  <Mail size={16} color={loginTab === 'email' ? '#FFFFFF' : colors.textMuted} />
                  <Text style={[styles.tabText, loginTab === 'email' && styles.tabTextActive]}>
                    Email & Password
                  </Text>
                </TouchableOpacity>
              </View>

              {/* METHOD A: PHONE NUMBER & OTP */}
              {loginTab === 'phone' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>REGISTERED MOBILE NUMBER</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    Foremen and workers: enter the phone number provided to your contractor.
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={handleSendOTP}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryActionText}>Get 6-Digit OTP</Text>
                        <Text style={styles.arrowIcon}>➔</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Fast Sign In Alternative */}
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or fast track with</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.truecallerButton}
                    onPress={handleTruecallerLogin}
                    activeOpacity={0.8}
                  >
                    <Phone size={16} color="#0284C7" />
                    <Text style={styles.truecallerText}>Instant Sign In with Truecaller</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* METHOD B: EMAIL & PASSWORD */}
              {loginTab === 'email' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>OFFICIAL EMAIL ADDRESS</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="contractor@example.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>PASSWORD</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter account password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor={colors.textLight}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={colors.textMuted} />
                      ) : (
                        <Eye size={18} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={handleEmailLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryActionText}>Sign In to Dashboard</Text>
                        <Text style={styles.arrowIcon}>➔</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Architecture & Registration Notice */}
              <View style={styles.noticeBox}>
                <View style={styles.noticeIconCircle}>
                  <Building size={16} color={colors.accent} />
                </View>
                <View style={styles.noticeTextContainer}>
                  <TouchableOpacity onPress={() => setAuthMode('register')}>
                    <Text style={styles.noticeTitle}>
                      New Contractor? <Text style={styles.linkHighlight}>Register your Company ➔</Text>
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.noticeDesc}>
                    Foremen and workers are added directly by their registered contractor.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* VIEW 2: 6-DIGIT OTP VERIFICATION */}
          {authMode === 'otp' && (
            <View style={styles.mainCard}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setAuthMode('login')}
                activeOpacity={0.8}
              >
                <ArrowLeft size={18} color={colors.textMuted} />
                <Text style={styles.backButtonText}>Back to Sign In</Text>
              </TouchableOpacity>

              <View style={styles.titleSection}>
                <View style={styles.securityBadge}>
                  <ShieldCheck size={20} color={colors.success} />
                  <Text style={styles.securityBadgeText}>SECURE OTP VERIFICATION</Text>
                </View>
                <Text style={styles.screenHeading}>Verify Mobile Number</Text>
                <Text style={styles.screenSubtitle}>
                  Enter the 6-digit code sent to{' '}
                  <Text style={styles.phoneHighlight}>+91 {phoneNumber || '98765 43210'}</Text>
                </Text>
              </View>

              {/* 6-PIN Boxes Component */}
              <View style={styles.otpBoxesRow}>
                {otpDigits.map((digit, idx) => {
                  const isActive = idx === activePinIndex;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                        isActive && styles.otpBoxActive,
                      ]}
                    >
                      <TextInput
                        ref={(ref) => {
                          otpInputRefs.current[idx] = ref;
                        }}
                        style={styles.otpDigitInput}
                        value={digit}
                        onChangeText={(val) => handleOtpChange(val, idx)}
                        onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                        onFocus={() => setActivePinIndex(idx)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                      />
                    </View>
                  );
                })}
              </View>

              {/* Auto-detect SMS indicator */}
              <View style={styles.autoDetectRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.autoDetectText}>Auto-detecting SMS verification code...</Text>
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleVerifyOTP}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryActionText}>Verify & Access Portal</Text>
                    <Text style={styles.arrowIcon}>➔</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend & WhatsApp Option */}
              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend code in <Text style={styles.timerBold}>00:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOTP}>
                    <Text style={styles.resendActionText}>Resend SMS Code</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => {
                  Toast.show({
                    type: 'info',
                    text1: 'WhatsApp Delivery',
                    text2: 'Verification code resent via WhatsApp.',
                  });
                  setResendTimer(45);
                }}
                activeOpacity={0.8}
              >
                <MessageSquare size={16} color="#059669" />
                <Text style={styles.whatsappButtonText}>Send Code via WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VIEW 3: CONTRACTOR COMPANY REGISTRATION ONLY */}
          {authMode === 'register' && (
            <View style={styles.mainCard}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setAuthMode('login')}
                activeOpacity={0.8}
              >
                <ArrowLeft size={18} color={colors.textMuted} />
                <Text style={styles.backButtonText}>Back to Sign In</Text>
              </TouchableOpacity>

              <View style={styles.titleSection}>
                <View style={styles.contractorOnlyTag}>
                  <Building size={14} color="#EA580C" />
                  <Text style={styles.contractorOnlyText}>CONTRACTOR PORTAL ONLY</Text>
                </View>
                <Text style={styles.screenHeading}>Contractor Registration</Text>
                <Text style={styles.screenSubtitle}>
                  Register your company to set up sites, assign foremen & disburse payroll.
                </Text>
              </View>

              {/* Architecture Alert Notice */}
              <View style={styles.architectureAlert}>
                <HelpCircle size={18} color="#EA580C" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.alertNoticeTitle}>Contractor Accounts Only</Text>
                  <Text style={styles.alertNoticeBody}>
                    Foremen and workers cannot register on their own; they are added to sites directly by the registered contractor.
                  </Text>
                </View>
              </View>

              {/* Registration Form */}
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>CONSTRUCTION COMPANY / FIRM NAME *</Text>
                <View style={styles.inputWrapper}>
                  <Building size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Apex Infra Projects Pvt Ltd"
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>CONTRACTOR FULL NAME *</Text>
                <View style={styles.inputWrapper}>
                  <UserIcon size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Rajesh Sharma"
                    value={contractorName}
                    onChangeText={setContractorName}
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>OFFICIAL EMAIL ADDRESS *</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="contractor@company.in"
                    value={registerEmail}
                    onChangeText={setRegisterEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>CONTACT MOBILE NUMBER</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.flagEmoji}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="98765 43210"
                    value={registerPhone}
                    onChangeText={setRegisterPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                  GSTIN / CONTRACTOR LICENSE # <Text style={styles.optionalTag}>(OPTIONAL)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <FileText size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="27AAAAA0000A1Z5"
                    value={licenseGstin}
                    onChangeText={setLicenseGstin}
                    autoCapitalize="characters"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>CREATE PASSWORD *</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={colors.textLight} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Minimum 6 characters"
                    value={registerPassword}
                    onChangeText={setRegisterPassword}
                    secureTextEntry={!showRegisterPassword}
                    placeholderTextColor={colors.textLight}
                  />
                  <TouchableOpacity
                    onPress={() => setShowRegisterPassword(!showRegisterPassword)}
                    style={styles.passwordToggle}
                  >
                    {showRegisterPassword ? (
                      <EyeOff size={18} color={colors.textMuted} />
                    ) : (
                      <Eye size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Consent Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setAgreeTerms(!agreeTerms)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxBox, agreeTerms && styles.checkboxBoxChecked]}>
                    {agreeTerms && <CheckCircle size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    I agree to the Terms of Service & Indian Labour Code 2020 Compliance standards.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handleRegisterContractor}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryActionText}>Register Contractor Account</Text>
                      <Text style={styles.arrowIcon}>➔</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Enterprise Statutory Trust Strip */}
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustBadge}>
              <ShieldCheck size={14} color={colors.primary} />
              <Text style={styles.trustBadgeText}>256-Bit SSL</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustBadge}>
              <Text style={styles.trustBadgeText}>🇮🇳 Labour Code 2020</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustBadge}>
              <CheckCircle size={14} color={colors.success} />
              <Text style={styles.trustBadgeText}>Instant UPI Ready</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 4,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  langActive: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  langDivider: {
    fontSize: 12,
    color: colors.borderDark,
    marginHorizontal: 6,
  },
  langInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  titleSection: {
    marginBottom: 18,
  },
  screenHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  formSection: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  optionalTag: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textLight,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 48,
    marginRight: 8,
  },
  flagEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  passwordToggle: {
    padding: 6,
  },
  primaryActionButton: {
    backgroundColor: colors.accent,
    height: 50,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...shadows.hero,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  arrowIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
    paddingHorizontal: 12,
  },
  truecallerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  truecallerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    marginLeft: 8,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: radii.lg,
    padding: 14,
    marginTop: 20,
    alignItems: 'flex-start',
  },
  noticeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  linkHighlight: {
    color: colors.accent,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  noticeDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 6,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  securityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.successDark,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  phoneHighlight: {
    fontWeight: '800',
    color: colors.primary,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  otpBoxActive: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
  },
  otpDigitInput: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  autoDetectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  autoDetectText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  resendTimerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timerBold: {
    fontWeight: '800',
    color: colors.text,
  },
  resendActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  whatsappButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 6,
  },
  contractorOnlyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  contractorOnlyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  architectureAlert: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  alertNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  alertNoticeBody: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 6,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 4,
  },
  trustDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    marginHorizontal: 10,
  },
});
