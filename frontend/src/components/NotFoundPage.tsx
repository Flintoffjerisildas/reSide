import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Home, Building2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export default function NotFoundPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
        <Building2 className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        404 — {t('Page Not Found', 'பக்கம் கிடைக்கவில்லை')}
      </h1>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
        {t(
          "The page you are looking for doesn't exist or has been moved.",
          'நீங்கள் தேடும் பக்கம் இல்லை அல்லது நகர்த்தப்பட்டுள்ளது.'
        )}
      </p>
      <Button 
        onClick={() => navigate({ to: '/' })} 
        className="gap-2 rounded-full bg-blue-600 px-6 hover:bg-blue-700 shadow-md shadow-blue-600/20"
      >
        <Home className="h-4 w-4" />
        {t('Back to Home', 'முகப்புக்கு திரும்பவும்')}
      </Button>
    </div>
  );
}
