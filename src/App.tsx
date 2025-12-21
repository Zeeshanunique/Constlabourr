import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { LoginScreen } from './components/LoginScreen';
import { ModernContractorDashboard } from './components/ModernContractorDashboard';
import { ForemanDashboard } from './components/ForemanDashboard';
import { LabourDashboard } from './components/LabourDashboard';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export type UserRole = 'contractor' | 'foreman' | 'labour';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  contractorId?: string;
  workerId?: string;
}

export interface AppContextType {
  user: User | null;
  supabase: typeof supabase;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

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
      toast.error(error.message || 'Failed to load user profile');
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
        toast.success('Login successful!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed';
      
      // Provide more helpful error messages
      if (errorMessage.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please check your credentials.');
      } else if (errorMessage.includes('Email not confirmed')) {
        toast.error('Please verify your email address.');
      } else {
        toast.error(errorMessage);
      }
      throw error;
    }
  };

  const handleRegister = async (email: string, password: string, name: string) => {
    try {
      // Validate password length
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

      toast.success('Registration successful! You can now login with your credentials.');
      return data;
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Registration failed';
      if (errorMessage.includes('already registered')) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (errorMessage.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const refreshUser = async () => {
    if (accessToken) {
      await fetchUserProfile(accessToken);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />
        <Toaster />
      </>
    );
  }

  const contextValue: AppContextType = {
    user,
    supabase,
    logout,
    refreshUser,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50">
        {user.role === 'contractor' && <ModernContractorDashboard accessToken={accessToken!} />}
        {user.role === 'foreman' && <ForemanDashboard accessToken={accessToken!} />}
        {user.role === 'labour' && <LabourDashboard accessToken={accessToken!} />}
      </div>
      <Toaster />
    </AppContext.Provider>
  );
}