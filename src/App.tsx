import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { LanguageProvider } from './i18n';
import { projectId, publicAnonKey } from './utils/supabase/info';
import {
  View,
  ActivityIndicator,
  Text,
  AppState,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthNavigator } from './navigation/AuthNavigator';
import { AppNavigator } from './navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { AppContext, AppContextType, User, supabase } from './context/AppContext';
import { BrandLogo } from './components/shared/BrandLogo';
import { OfflineBanner } from './components/shared/OfflineBanner';
import { colors } from './styles/theme';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Application initialization error',
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Fatal render error caught by RootErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialIcons name="warning" size={48} color="#F97316" />
          <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
            ConstLabour App Recovery
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
            {this.state.errorMessage}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#F97316', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Retry Launch</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // 1. Initial boot check
    const initApp = async () => {
      try {
        // Fast-load cached user for instant rendering
        const cachedUserJson = await AsyncStorage.getItem('@constlabour_cached_user');
        if (cachedUserJson) {
          try {
            const parsed = JSON.parse(cachedUserJson);
            setUser(parsed);
          } catch (e) {
            console.error('Error parsing cached user:', e);
          }
        }

        // Check if biometric app lock is enabled
        const lockEnabled = await AsyncStorage.getItem('@constlabour_app_lock');
        if (lockEnabled === 'true' && cachedUserJson) {
          setIsAppLocked(true);
          triggerBiometricUnlock();
        }
      } catch (e) {
        console.error('Initial storage read error:', e);
      }

      await checkSession();
    };

    initApp();

    // 2. AppState change listener (Lock on resume & Single Device enforcement)
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const lockEnabled = await AsyncStorage.getItem('@constlabour_app_lock');
        const cachedUserJson = await AsyncStorage.getItem('@constlabour_cached_user');
        if (lockEnabled === 'true' && cachedUserJson) {
          setIsAppLocked(true);
          triggerBiometricUnlock();
        }

        // Re-validate single-device session on foreground
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetchUserProfile(session.access_token, true);
          }
        } catch (err) {
          console.error('Foreground session re-validation error:', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 3. Supabase Auth State Change Listener
  useEffect(() => {
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || (!session && event === 'USER_UPDATED')) {
          setUser(null);
          setAccessToken(null);
          await AsyncStorage.multiRemove([
            '@constlabour_cached_user',
            '@constlabour_device_session_id',
          ]);
        } else if (session?.access_token) {
          setAccessToken(session.access_token);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  // 4. Realtime Single-Device Guard & Periodic Session Heartbeat
  useEffect(() => {
    if (!user?.id) return;

    // A. Realtime subscription to profiles table for immediate single-device logout
    const channel = supabase
      .channel(`profile_device_guard_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload: any) => {
          const newSessionId = payload?.new?.device_session_id;
          const localSessionId = await AsyncStorage.getItem('@constlabour_device_session_id');
          if (newSessionId && localSessionId && newSessionId !== localSessionId) {
            console.warn('Realtime guard: Another device logged in. Terminating session.');
            await handleUnauthorized(
              'Your ConstLabour account was logged in from another device. For your security, you have been redirected to the login screen.'
            );
          }
        }
      )
      .subscribe();

    // B. Periodic Heartbeat (every 10 seconds when app is in foreground)
    const heartbeatInterval = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const localSessionId = await AsyncStorage.getItem('@constlabour_device_session_id');
        if (!localSessionId) return;

        // Query profiles table for device_session_id
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('device_session_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('Unauthorized')) {
            console.warn('Heartbeat: Session invalid/expired.');
            await handleUnauthorized('Your session has expired. Please log in again.');
          }
          return;
        }

        if (
          profile?.device_session_id &&
          localSessionId &&
          profile.device_session_id !== localSessionId
        ) {
          console.warn('Heartbeat: Device mismatch. Another device logged in.');
          await handleUnauthorized(
            'Your ConstLabour account was logged in from another device. For your security, you have been redirected to the login screen.'
          );
        }
      } catch (err) {
        console.error('Heartbeat check error:', err);
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(heartbeatInterval);
    };
  }, [user?.id]);

  const triggerBiometricUnlock = async () => {
    try {
      setIsAuthenticating(true);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Device lacks biometric/PIN enrollment
        setIsAppLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock ConstLabour',
        fallbackLabel: 'Use Device PIN / Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAppLocked(false);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.access_token) {
        setAccessToken(session.access_token);
        await fetchUserProfile(session.access_token);
      } else {
        // No active supabase session, clear cached user
        setUser(null);
        await AsyncStorage.removeItem('@constlabour_cached_user');
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (token: string, isSilentCheck = false) => {
    try {
      const localDeviceSessionId = await AsyncStorage.getItem('@constlabour_device_session_id');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(localDeviceSessionId ? { 'x-device-session-id': localDeviceSessionId } : {}),
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        console.warn('Profile fetch returned 401/403: session revoked on backend.');
        await handleUnauthorized(
          'Your ConstLabour account was logged in from another device. Please log in again.'
        );
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Profile fetch error details:', errorData);
        throw new Error(errorData.error || 'Failed to fetch user profile');
      }

      const data = await response.json();
      const profile = data.profile;

      // SINGLE-DEVICE LOGIN ENFORCEMENT
      if (
        profile?.deviceSessionId &&
        localDeviceSessionId &&
        profile.deviceSessionId !== localDeviceSessionId
      ) {
        console.warn('Single-device mismatch: DB has', profile.deviceSessionId, 'local is', localDeviceSessionId);
        await handleUnauthorized(
          'Your ConstLabour account was logged in from another device. For your security, only one active device is permitted at a time.'
        );
        return;
      }

      // If local session ID was not set, store it
      if (profile?.deviceSessionId && !localDeviceSessionId) {
        await AsyncStorage.setItem('@constlabour_device_session_id', profile.deviceSessionId);
      } else if (!profile?.deviceSessionId && localDeviceSessionId) {
        // Sync local ID to server
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-device-session-id': localDeviceSessionId,
          },
          body: JSON.stringify({ deviceSessionId: localDeviceSessionId }),
        }).catch(console.error);
      }

      setUser(profile);
      await AsyncStorage.setItem('@constlabour_cached_user', JSON.stringify(profile));
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      if (!isSilentCheck) {
        // Only keep cached user if it was not an authentication failure
        if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
          const cached = await AsyncStorage.getItem('@constlabour_cached_user');
          if (cached) {
            try {
              setUser(JSON.parse(cached));
            } catch {}
          }
        }
      }
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const deviceSessionId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      await AsyncStorage.setItem('@constlabour_device_session_id', deviceSessionId);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error details:', error);
        throw error;
      }

      if (data.session?.access_token) {
        setAccessToken(data.session.access_token);

        // Sync deviceSessionId to backend profile
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ deviceSessionId }),
          }
        ).catch(console.error);

        await fetchUserProfile(data.session.access_token);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Login successful!',
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed';
      
      if (errorMessage.includes('Invalid login credentials')) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Invalid email or password. Please check your credentials.',
        });
      } else if (errorMessage.includes('Email not confirmed')) {
        Toast.show({
          type: 'error',
          text1: 'Email Not Verified',
          text2: 'Please verify your email address.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: errorMessage,
        });
      }
      throw error;
    }
  };

  const handleLoginWithPhone = async (phone: string, password: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
      if (cleanPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number');
      }

      const deviceSessionId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      await AsyncStorage.setItem('@constlabour_device_session_id', deviceSessionId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/login-phone`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ phone: cleanPhone, password, deviceSessionId }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.session?.access_token) {
        await supabase.auth.setSession(data.session);
        setAccessToken(data.session.access_token);
        await fetchUserProfile(data.session.access_token);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Login successful!',
        });
      }
    } catch (error: any) {
      console.error('Phone login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.message || 'Login failed',
      });
      throw error;
    }
  };

  const handleLoginWithOtp = async (_phone: string, _otp: string) => {
    Toast.show({
      type: 'error',
      text1: 'OTP Login Disabled',
      text2: 'Please log in with your mobile number and password.',
    });
    throw new Error('OTP login is temporarily disabled.');
  };

  const handleRegister = async (dataOrEmail: any, password?: string, name?: string, phone?: string) => {
    try {
      let regPayload: any = {};
      if (typeof dataOrEmail === 'object') {
        regPayload = { ...dataOrEmail };
      } else {
        regPayload = { email: dataOrEmail, password, name, phone };
      }

      if (!regPayload.phone || regPayload.phone.replace(/\D/g, '').length !== 10) {
        throw new Error('Mobile number is required and must be exactly 10 digits');
      }
      if (!regPayload.password || regPayload.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (!regPayload.name) {
        throw new Error('Name is required');
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: regPayload.phone.replace(/\D/g, '').slice(0, 10),
            password: regPayload.password,
            name: regPayload.name,
            email: regPayload.email ? regPayload.email.trim() : null,
            role: regPayload.role || 'contractor',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'Your account is ready. You can now login.',
      });
      return data;
    } catch (error: any) {
      console.error('Registration error:', error);
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: error.message || 'Registration failed',
      });
      throw error;
    }
  };

  const logout = async (isForced = false) => {
    try {
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.multiRemove([
        '@constlabour_cached_user',
        '@constlabour_device_session_id',
      ]);
      setUser(null);
      setAccessToken(null);
      setIsAppLocked(false);
      if (!isForced) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Logged out successfully',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setAccessToken(null);
      setIsAppLocked(false);
    }
  };

  const handleUnauthorized = async (message?: string) => {
    console.warn('Handling unauthorized session termination:', message);
    await logout(true);
    Alert.alert(
      'Session Expired',
      message ||
        'Your ConstLabour account was logged in from another device. For your security, you have been redirected to the login screen.',
      [{ text: 'OK' }]
    );
  };

  const refreshUser = async () => {
    if (accessToken) {
      await fetchUserProfile(accessToken);
    }
  };

  if (loading) {
    return (
      <RootErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <GluestackUIProvider>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={{ marginTop: 16, color: '#717182' }}>Loading...</Text>
              </View>
            </GluestackUIProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </RootErrorBoundary>
    );
  }

  const contextValue: AppContextType = {
    user,
    supabase,
    logout,
    handleUnauthorized,
    refreshUser,
    handleLogin,
    handleLoginWithPhone,
    handleLoginWithOtp,
    handleRegister,
  };

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LanguageProvider>
            <GluestackUIProvider>
              <AppContext.Provider value={contextValue}>
                <OfflineBanner />
                <NavigationContainer>
                  {!user ? (
                    <AuthNavigator />
                  ) : (
                    <AppNavigator role={user.role} accessToken={accessToken!} />
                  )}
                </NavigationContainer>

                {/* PAYMENT-APP-STYLE BIOMETRIC & PIN APP LOCK OVERLAY */}
                {isAppLocked && user && (
                  <View style={lockStyles.overlay}>
                    <View style={lockStyles.card}>
                      <View style={lockStyles.logoWrapper}>
                        <BrandLogo size={46} variant="light" />
                      </View>

                      <View style={lockStyles.lockIconCircle}>
                        <MaterialIcons name="lock" size={38} color="#F97316" />
                      </View>

                      <Text style={lockStyles.lockTitle}>ConstLabour Secure Lock</Text>
                      <Text style={lockStyles.lockSubtitle}>
                        Logged in as <Text style={{ fontWeight: '700', color: '#F1F5F9' }}>{user.name}</Text>
                      </Text>
                      <Text style={lockStyles.lockInstructions}>
                        Unlock using your Face ID, Fingerprint, or Device PIN to view labor, attendance & wage records.
                      </Text>

                      <TouchableOpacity
                        style={lockStyles.unlockButton}
                        onPress={triggerBiometricUnlock}
                        disabled={isAuthenticating}
                        activeOpacity={0.85}
                      >
                        <MaterialIcons name="fingerprint" size={24} color="#FFFFFF" />
                        <Text style={lockStyles.unlockButtonText}>
                          {isAuthenticating ? 'Authenticating...' : 'Unlock ConstLabour'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={lockStyles.switchAccountBtn}
                        onPress={() => logout(false)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="logout" size={16} color="#94A3B8" />
                        <Text style={lockStyles.switchAccountText}>Switch Account or Log Out</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Toast />
              </AppContext.Provider>
            </GluestackUIProvider>
          </LanguageProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

const lockStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  logoWrapper: {
    marginBottom: 16,
    alignItems: 'center',
  },
  lockIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 2,
    borderColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  lockTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockInstructions: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    gap: 10,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
    gap: 6,
  },
  switchAccountText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
