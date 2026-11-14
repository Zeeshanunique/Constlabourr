import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const validKey =
  publicAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3J1cHhyamJybXV1ZnhldGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTc1NDMsImV4cCI6MjA5MzE5MzU0M30.iRwt4RHTIkUfK7C_a-yOtByCqJtI9vEH2VsC-LTB4x8';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  validKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export type UserRole = 'contractor' | 'foreman' | 'labour';

export { supabase };

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  contractorId?: string;
  workerId?: string;
  phone?: string;
  upiId?: string;
  deviceSessionId?: string;
}

export interface AppContextType {
  user: User | null;
  supabase: typeof supabase;
  logout: (isForced?: boolean) => void;
  handleUnauthorized: (message?: string) => Promise<void>;
  takeOverSession?: (token?: string, userId?: string) => Promise<void>;
  promptDeviceTakeover?: (token: string, userId?: string) => void;
  refreshUser: () => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLoginWithPhone: (phone: string, password: string) => Promise<void>;
  handleLoginWithOtp: (phone: string, otp: string) => Promise<void>;
  handleRegister: (dataOrEmail: any, password?: string, name?: string, phone?: string) => Promise<void>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

