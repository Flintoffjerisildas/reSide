import { ReactNode } from 'react';
import { useAuthServiceGate } from '../contexts/AuthServiceContext';
import ServerOfflineScreen from './ServerOfflineScreen';
import AuthServiceCheckingScreen from './AuthServiceCheckingScreen';

interface AuthServiceGateProps {
  children: ReactNode;
}

/**
 * AuthServiceGate
 *
 * Central application-availability gate that strictly controls whether reSide
 * can mount and render its application interface based on auth_serv availability.
 *
 * States:
 * 1. 'checking' -> Displays full-screen loading screen (AuthServiceCheckingScreen).
 * 2. 'offline'  -> Displays blocking full-screen error screen (ServerOfflineScreen).
 * 3. 'online'   -> Displays normal reSide application children.
 *
 * Prevents any cached session, URL parameter, admin bypass flag, or React state
 * from revealing normal application views when auth_serv is offline.
 */
export default function AuthServiceGate({ children }: AuthServiceGateProps) {
  const { status } = useAuthServiceGate();

  if (status === 'checking') {
    return <AuthServiceCheckingScreen />;
  }

  if (status === 'offline') {
    return <ServerOfflineScreen />;
  }

  return <>{children}</>;
}
