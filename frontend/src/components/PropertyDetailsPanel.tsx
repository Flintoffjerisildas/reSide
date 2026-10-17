import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Home, MapPin, IndianRupee } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Property } from '../types';
import { translateText } from '../lib/api';

interface Props {
  property: Property | null;
}

export default function PropertyDetailsPanel({ property }: Props) {
  const { t, language } = useLanguage();
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);
  const title = String(property?.title || '').trim();
  const loc = String(property?.location || '').trim();

  useEffect(() => {
    if (language !== 'ta' || !property) {
      setTitleTa(null);
      setLocationTa(null);
      return;
    }

    (async () => {
      try {
        if (title) {
          const res = await translateText(title, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setTitleTa(out && out.trim() ? out : null);
        } else {
          setTitleTa(null);
        }

        if (loc) {
          const res = await translateText(loc, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setLocationTa(out && out.trim() ? out : null);
        } else {
          setLocationTa(null);
        }
      } catch {
        setTitleTa(null);
        setLocationTa(null);
      }
    })();
  }, [language, property, title, loc]);

  if (!property) return (
    <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
      {t('Select a property to see details', 'விபரங்களைக் காண சொத்தைத் தேர்ந்தெடுக்கவும்')}
    </div>
  );

  const tenant = typeof property.tenant === 'object' ? property.tenant : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden bg-card border">
        <div className="aspect-video relative bg-muted">
          {property.images && property.images.length > 0 ? (
            <img
              src={property.images[0]}
              alt={language === 'ta' ? (titleTa || property.title) : property.title}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Home className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold">{language === 'ta' ? (titleTa || property.title) : property.title}</h3>
          <div className="flex items-center text-muted-foreground mt-1">
            <MapPin className="h-4 w-4 mr-2" />
            <span>{language === 'ta' ? (locationTa || property.location) : property.location}</span>
          </div>
          <div className="flex items-center text-xl font-semibold mt-2">
            <IndianRupee className="h-5 w-5 mr-1" />
            <span>{property.price.toLocaleString()}</span>
            <span className="text-sm font-normal text-muted-foreground ml-2 capitalize">({property.transactionType})</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <User className="h-4 w-4" /> {t('Tenant Details', 'குத்தகைதாரர் விவரங்கள்')}
        </h4>

        {tenant ? (
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t('Name:', 'பெயர்:')}</span>
              <span>{tenant.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{tenant.email}</span>
            </div>
            {tenant.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{tenant.phone}</span>
              </div>
            )}
            <Badge variant="default" className="bg-green-600 hover:bg-green-700 mt-2">
              {t('Occupied', 'குடியேற்றப்பட்டது')}
            </Badge>
          </div>
        ) : (
          <div className="bg-slate-50 p-4 rounded-lg text-center border border-dashed">
            <p className="text-muted-foreground mb-2">{t('No tenant assigned to this property.', 'இந்த சொத்திற்கு குத்தகைதாரர் யாரும் நியமிக்கப்படவில்லை.')}</p>
            <Badge variant="secondary">{t('Vacant', 'காலியாக')}</Badge>
          </div>
        )}
      </div>
    </div>
  );
}
