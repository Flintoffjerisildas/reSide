import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function AuthServiceCheckingScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <ShieldCheck className="absolute h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">reSide</h2>
          <p className="text-sm font-medium text-foreground">
            {t('Verifying Authentication Service...', 'அங்கீகார சேவையைச் சரிபார்க்கிறது...')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              'Connecting to auth_serv before initializing application...',
              'பயன்பாட்டைத் தொடங்குவதற்கு முன் auth_serv உடன் இணைகிறது...'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
