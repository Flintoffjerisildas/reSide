import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { AIProvider } from './contexts/AIContext';
import { PropertyProvider } from './contexts/PropertyContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthServiceAvailabilityProvider } from './contexts/AuthServiceContext';
import AuthServiceGate from './components/AuthServiceGate';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <AuthServiceAvailabilityProvider>
          <AuthServiceGate>
            <PropertyProvider>
              <AIProvider>
                <RouterProvider router={router} />
                <Toaster />
              </AIProvider>
            </PropertyProvider>
          </AuthServiceGate>
        </AuthServiceAvailabilityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
