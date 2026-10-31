import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
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
  logout: () => void;
  refreshUser: () => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLoginWithPhone: (phone: string, password: string) => Promise<void>;
  handleLoginWithOtp: (phone: string, otp: string) => Promise<void>;
  handleRegister: (dataOrEmail: any, password?: string, name?: string, phone?: string) => Promise<void>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

