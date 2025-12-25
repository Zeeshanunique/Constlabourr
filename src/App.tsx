import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { View, ActivityIndicator, Text } from 'react-native';
import { AuthNavigator } from './navigation/AuthNavigator';
import { AppNavigator } from './navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { AppContext, AppContextType, User } from './context/AppContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.access_token) {
        setAccessToken(session.access_token);
        await fetchUserProfile(session.access_token);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Profile fetch error details:', errorData);
        throw new Error(errorData.error || 'Failed to fetch user profile');
      }

      const data = await response.json();
      console.log('User profile fetched successfully:', data.user);
      setUser(data.user);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load user profile',
      });
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
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

  const handleRegister = async (email: string, password: string, name: string) => {
    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email, password, name, role: 'contractor' }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Registration successful! You can now login with your credentials.',
      });
      return data;
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let errorMessage = error.message || 'Registration failed';
      if (errorMessage.includes('already registered')) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (errorMessage.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: errorMessage,
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Logout failed',
      });
    }
  };

  const refreshUser = async () => {
    if (accessToken) {
      await fetchUserProfile(accessToken);
    }
  };

  if (loading) {
    return (
      <GluestackUIProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 16, color: '#717182' }}>Loading...</Text>
        </View>
      </GluestackUIProvider>
    );
  }

  const contextValue: AppContextType = {
    user,
    supabase,
    logout,
    refreshUser,
    handleLogin,
    handleRegister,
  };

  return (
    <GluestackUIProvider>
      <AppContext.Provider value={contextValue}>
        <NavigationContainer>
          {!user ? (
            <AuthNavigator />
          ) : (
            <AppNavigator role={user.role} accessToken={accessToken!} />
          )}
        </NavigationContainer>
        <Toast />
      </AppContext.Provider>
    </GluestackUIProvider>
  );
}
