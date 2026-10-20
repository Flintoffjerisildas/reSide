import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import {
  checkAuthServiceAvailability,
  getAuthServiceBaseUrl,
  AuthServiceStatus,
} from '../services/authServiceAvailability';

export type AuthServiceGateStatus = 'checking' | 'online' | 'offline';

export interface AuthServiceContextType {
  status: AuthServiceGateStatus;
  isAvailable: boolean;
  isChecking: boolean;
  isRetrying: boolean;
  lastChecked: Date | null;
  errorMessage: string | null;
  serviceUrl: string;
  retry: () => Promise<boolean>;
}

const AuthServiceContext = createContext<AuthServiceContextType | undefined>(undefined);

// Default polling interval: 15 seconds (15000ms), configurable via VITE_AUTH_SERVICE_POLL_INTERVAL
function getPollInterval(): number {
  const envVal = (import.meta as any).env?.VITE_AUTH_SERVICE_POLL_INTERVAL;
  const parsed = parseInt(String(envVal), 10);
  if (!isNaN(parsed) && parsed >= 3000) {
    return parsed;
  }
  return 15000;
}

export function AuthServiceAvailabilityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthServiceGateStatus>('checking');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const serviceUrl = getAuthServiceBaseUrl();

  // Internal guards to prevent overlapping or stale requests
  const inFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const performCheck = useCallback(
    async (isManualRetry: boolean = false): Promise<boolean> => {
      // Prevent overlapping checks
      if (inFlightRef.current) {
        return isAvailable;
      }

      inFlightRef.current = true;
      if (isManualRetry) {
        setIsRetrying(true);
      } else {
        setIsChecking(true);
      }

      // Cancel any previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result: AuthServiceStatus = await checkAuthServiceAvailability({
          signal: controller.signal,
          timeoutMs: 5000,
        });

        if (!isMountedRef.current) return result.isAvailable;

        lastCheckTimeRef.current = Date.now();
        setLastChecked(result.lastChecked);

        if (result.isAvailable) {
          setIsAvailable(true);
          setStatus('online');
          setErrorMessage(null);
          return true;
        } else {
          setIsAvailable(false);
          setStatus('offline');
          setErrorMessage(result.error || 'Authentication server is unreachable.');
          return false;
        }
      } catch (err: any) {
        if (!isMountedRef.current) return false;
        if (err?.name === 'AbortError') {
          return isAvailable;
        }
        setIsAvailable(false);
        setStatus('offline');
        setErrorMessage(err?.message || 'Connection failure while contacting auth_serv.');
        return false;
      } finally {
        inFlightRef.current = false;
        if (isMountedRef.current) {
          setIsChecking(false);
          setIsRetrying(false);
        }
      }
    },
    [isAvailable]
  );

  const retry = useCallback(async (): Promise<boolean> => {
    return await performCheck(true);
  }, [performCheck]);

  // Initial startup check
  useEffect(() => {
    isMountedRef.current = true;
    performCheck(false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [performCheck]);

  // Periodic polling interval
  useEffect(() => {
    const intervalMs = getPollInterval();
    const intervalTimer = setInterval(() => {
      // Periodically verify auth_serv health
      performCheck(false);
    }, intervalMs);

    return () => clearInterval(intervalTimer);
  }, [performCheck]);

  // Recheck when window regains focus or network status changes
  useEffect(() => {
    const onFocus = () => {
      // Throttle window focus checks to at most once every 5 seconds
      const now = Date.now();
      if (now - lastCheckTimeRef.current >= 5000) {
        performCheck(false);
      }
    };

    const onOnline = () => {
      performCheck(false);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [performCheck]);

  return (
    <AuthServiceContext.Provider
      value={{
        status,
        isAvailable,
        isChecking,
        isRetrying,
        lastChecked,
        errorMessage,
        serviceUrl,
        retry,
      }}
    >
      {children}
    </AuthServiceContext.Provider>
  );
}

export function useAuthServiceGate() {
  const context = useContext(AuthServiceContext);
  if (!context) {
    throw new Error('useAuthServiceGate must be used within an AuthServiceAvailabilityProvider');
  }
  return context;
}
