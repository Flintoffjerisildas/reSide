import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string; // tamilRole
  internalRole?: string; // admin/user
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, tamilRole: string) => Promise<void>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  forgotPasswordStart: (email: string) => Promise<void>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  identity: any;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token) {
      localStorage.removeItem('user');
      setUser(null);
      setInitializing(false);
      return;
    }

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        setUser(parsed);
      } catch {
        localStorage.removeItem('user');
      }
    }

    try {
      const res = await api.get('/auth/me');
      const u = res.data;
      const normalizedUser: User = {
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.tamilRole,
        internalRole: u.role,
      };
      setUser(normalizedUser);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        queryClient.clear();
      }
    }

    setInitializing(false);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const apiUser = res.data.user;
      const normalizedUser: User = {
        id: apiUser._id || apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        role: apiUser.tamilRole,
        internalRole: apiUser.internalRole || apiUser.role,
      };
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStatus'] });
      queryClient.invalidateQueries({ queryKey: ['callerAdmin'] });
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, tamilRole: string) => {
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password, tamilRole });
    } finally {
      setLoading(false);
    }
  };

  const verifyRegisterOtp = async (email: string, otp: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-register-otp', { email, otp });
      const apiUser = res.data.user;
      const normalizedUser: User = {
        id: apiUser._id || apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        role: apiUser.tamilRole,
        internalRole: apiUser.internalRole || apiUser.role,
      };
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStatus'] });
      queryClient.invalidateQueries({ queryKey: ['callerAdmin'] });
    } finally {
      setLoading(false);
    }
  };

  const forgotPasswordStart = async (email: string) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordWithOtp = async (email: string, otp: string, newPassword: string) => {
    setLoading(true);
    try {
      await api.post('/auth/reset-password-otp', { email, otp, newPassword });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    queryClient.clear();
  };

  useEffect(() => {
    const onForcedLogout = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('reside:logout', onForcedLogout);
    return () => window.removeEventListener('reside:logout', onForcedLogout);
  }, [queryClient]);

  // Compatibility mocks
  const identity = user ? { 
    getPrincipal: () => ({ 
      toText: () => user.id,
      isAnonymous: () => false
    }) 
  } : null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      verifyRegisterOtp,
      forgotPasswordStart,
      resetPasswordWithOtp,
      logout,
      isAuthenticated: !!user,
      identity,
      isInitializing: initializing
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
