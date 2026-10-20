import { MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function HeroSection() {
  const { t } = useLanguage();

  return (
    <div className="flex h-full flex-col md:flex-row items-center justify-center gap-8 p-6 text-center md:text-left bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 rounded-xl">
      <div className="flex flex-col items-center md:items-start space-y-6 flex-1">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-10 w-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            {t('Welcome to Reside', 'Reside க்கு வரவேற்கிறோம்')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('Your Bilingual Real Estate Assistant', 'உங்கள் இருமொழி ரியல் எஸ்டேட் உதவியாளர்')}
          </p>
        </div>

        <div className="grid w-full gap-3 text-left">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">🏠</span>
              <h3 className="font-semibold">{t('List Properties', 'சொத்துகளை பட்டியலிடுங்கள்')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Owners and brokers can add properties', 'உரிமையாளர்கள் மற்றும் தரகர்கள் சொத்துகளை சேர்க்கலாம்')}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <h3 className="font-semibold">{t('Search Properties', 'சொத்துகளை தேடுங்கள்')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Customers can find their dream property', 'வாடிக்கையாளர்கள் தங்கள் கனவு சொத்தை கண்டுபிடிக்கலாம்')}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">🎤</span>
              <h3 className="font-semibold">{t('Voice Support', 'குரல் ஆதரவு')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Speak in Tamil or English', 'தமிழ் அல்லது ஆங்கிலத்தில் பேசுங்கள்')}
            </p>
          </div>
        </div>
      </div>
      
      <div className="hidden md:block flex-1 h-full max-h-[600px] w-full relative">
        <img 
          src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
          alt="Modern House Exterior" 
          className="h-full w-full object-cover rounded-2xl shadow-2xl transform transition-transform hover:scale-105 duration-500"
        />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 bg-white p-2 rounded-lg shadow-xl hidden lg:block transform rotate-6">
           <img 
            src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" 
            alt="Apartment" 
            className="h-full w-full object-cover rounded"
          />
        </div>
        <div className="absolute -top-6 -right-6 h-40 w-40 bg-white p-2 rounded-lg shadow-xl hidden lg:block transform -rotate-3">
           <img 
            src="https://images.unsplash.com/photo-1600596542815-27b88e31e971?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" 
            alt="Living Room" 
            className="h-full w-full object-cover rounded"
          />
        </div>
      </div>
    </div>
  );
}
