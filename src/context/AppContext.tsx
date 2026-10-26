import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
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
}

export interface AppContextType {
  user: User | null;
  supabase: typeof supabase;
  logout: () => void;
  refreshUser: () => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleRegister: (email: string, password: string, name: string) => Promise<void>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

