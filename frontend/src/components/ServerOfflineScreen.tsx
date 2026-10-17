import { useState } from 'react';
import { ServerOff, RefreshCw, AlertCircle, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthServiceGate } from '../contexts/AuthServiceContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ServerOfflineScreen() {
  const { isRetrying, retry, serviceUrl, errorMessage, lastChecked } = useAuthServiceGate();
  const { t } = useLanguage();
  const [retryFailedNotice, setRetryFailedNotice] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetryFailedNotice(null);
    const success = await retry();
    if (!success) {
      setRetryFailedNotice(
        t(
          'Connection retry failed. Please verify auth_serv is active on the configured port.',
          'மீண்டும் இணைக்க முடியவில்லை. குறிப்பிட்ட போர்ட்டில் auth_serv இயங்குவதை உறுதிசெய்யவும்.'
        )
      );
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background selection:bg-primary/20"
      role="alert"
      aria-live="assertive"
    >
      <Card className="w-full max-w-lg border-destructive/30 shadow-2xl backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          {/* Animated icon container */}
          <div className="mx-auto mb-4 relative flex items-center justify-center">
            <div className="absolute h-20 w-20 rounded-full bg-destructive/15 animate-ping opacity-60" />
            <div className="relative h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive shadow-inner">
              <ServerOff className="h-8 w-8" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="border-destructive/40 text-destructive bg-destructive/5 font-mono text-xs px-2.5 py-0.5 flex items-center gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              {t('Status: Connection unavailable', 'நிலை: இணைப்பு கிடைக்கவில்லை')}
            </Badge>
          </div>

          <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('Authentication Server Offline', 'அங்கீகார சேவையகம் ஆஃப்லைனில் உள்ளது')}
          </CardTitle>
          <CardDescription className="text-sm font-normal text-muted-foreground mt-2 px-2 leading-relaxed">
            {t(
              'We cannot connect to the authentication server right now. Please ensure that auth_serv is running before accessing reSide.',
              'தற்போது அங்கீகார சேவையகத்துடன் இணைக்க முடியவில்லை. reSide-ஐ அணுகுவதற்கு முன் auth_serv இயங்குவதை உறுதிசெய்யவும்.'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">
          {/* Diagnostic Service Info Panel */}
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium text-foreground">
                {t('Required service:', 'தேவையான சேவை:')}
              </span>
              <span className="font-mono font-semibold text-primary">auth_serv</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('Service endpoint:', 'சேவை முகவரி:')}</span>
              <span className="font-mono text-[11px] truncate max-w-[220px]" title={serviceUrl}>
                {serviceUrl}
              </span>
            </div>
            {lastChecked && (
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>{t('Last checked:', 'கடைசியாக சோதிக்கப்பட்டது:')}</span>
                <span>{lastChecked.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Failure feedback alert if retry failed */}
          {retryFailedNotice && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{retryFailedNotice}</span>
            </div>
          )}

          {/* Guidance note */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-blue-500" />
              <span>{t('Security Policy Enforcement', 'பாதுகாப்புக் கொள்கை அமலாக்கம்')}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {t(
                'reSide strictly requires the authentication microservice to protect real-estate data and maintain verified user access.',
                'ரியல் எஸ்டேட் தரவைப் பாதுகாக்கவும் சரிபார்க்கப்பட்ட பயனர் அணுகலைப் பராமரிக்கவும் reSide-க்கு அங்கீகார மைக்ரோ சர்வீஸ் கட்டாயமாக தேவைப்படுகிறது.'
              )}
            </p>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full h-11 text-sm font-semibold shadow-md gap-2"
              variant="default"
              size="lg"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying
                ? t('Checking connection...', 'இணைப்பைச் சரிபார்க்கிறது...')
                : t('Retry Connection', 'மீண்டும் இணைக்கவும்')}
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {t(
              'reSide will also automatically recheck connectivity in the background.',
              'reSide தானாகவும் பின்னணியில் இணைப்பை மீண்டும் சோதிக்கும்.'
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
