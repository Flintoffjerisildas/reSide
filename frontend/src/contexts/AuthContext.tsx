import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string; // 'admin' | 'user'
  registrationPurpose?: string; // 'Owner' | 'Builder' | 'Dealer' | 'Customer'
  tamilRole?: string;
  internalRole?: string; // 'admin' | 'user'
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, registrationPurpose: string, tamilRole?: string) => Promise<any>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  forgotPasswordStart: (email: string) => Promise<any>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  identity: any;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously hydrate token and user from localStorage so refresh never flashes logged-out
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        return JSON.parse(storedUser) as User;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Keep loading true while background validation runs if token exists
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('token'));
    } catch {
      return false;
    }
  });

  const [initializing, setInitializing] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('token'));
    } catch {
      return false;
    }
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!currentToken) {
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setLoading(false);
      setInitializing(false);
      return;
    }

    if (storedUser && !user) {
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
        registrationPurpose: u.registrationPurpose,
        tamilRole: u.tamilRole,
        internalRole: u.role,
      };
      setUser(normalizedUser);
      setToken(currentToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    } catch (err: any) {
      const status = err?.response?.status;
      // Only clear credentials if the server explicitly returns 401 Unauthorized or 403
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
        queryClient.clear();
      } else {
        // Preserve user session on transient network/server errors
        console.warn('[AuthContext] Background /api/auth/me validation hit non-auth error; preserving session:', err?.message);
      }
    } finally {
      setLoading(false);
      setInitializing(false);
    }
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
        role: apiUser.role || (apiUser.internalRole === 'admin' ? 'admin' : 'user'),
        registrationPurpose: apiUser.registrationPurpose || (apiUser.tamilRole === 'owners' ? 'Owner' : apiUser.tamilRole === 'brokersBuilders' ? 'Builder' : 'Customer'),
        tamilRole: apiUser.tamilRole,
        internalRole: apiUser.internalRole || apiUser.role,
      };
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setToken(res.data.token);
      setUser(normalizedUser);
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStatus'] });
      queryClient.invalidateQueries({ queryKey: ['callerAdmin'] });
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, registrationPurpose: string, tamilRole?: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { 
        name, 
        email, 
        password, 
        registrationPurpose, 
        tamilRole: tamilRole || registrationPurpose 
      });
      return res.data;
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
        role: apiUser.role || (apiUser.internalRole === 'admin' ? 'admin' : 'user'),
        registrationPurpose: apiUser.registrationPurpose || (apiUser.tamilRole === 'owners' ? 'Owner' : apiUser.tamilRole === 'brokersBuilders' ? 'Builder' : 'Customer'),
        tamilRole: apiUser.tamilRole,
        internalRole: apiUser.internalRole || apiUser.role,
      };
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setToken(res.data.token);
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
      const res = await api.post('/auth/forgot-password', { email });
      return res.data;
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
    setToken(null);
    setUser(null);
    queryClient.clear();
  };

  useEffect(() => {
    const onForcedLogout = () => {
      setToken(null);
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
      token,
      loading, 
      login, 
      register, 
      verifyRegisterOtp,
      forgotPasswordStart,
      resetPasswordWithOtp,
      logout,
      isAuthenticated: Boolean(token && user) || Boolean(user),
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
