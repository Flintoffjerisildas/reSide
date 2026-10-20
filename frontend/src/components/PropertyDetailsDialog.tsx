import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Home, MapPin, IndianRupee } from 'lucide-react';
import { translateText } from '../lib/api';

interface PropertyDetailsDialogProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PropertyDetailsDialog({ property, open, onOpenChange }: PropertyDetailsDialogProps) {
  const { t, language } = useLanguage();
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);
  const title = String(property?.title || '').trim();
  const loc = String(property?.location || '').trim();

  useEffect(() => {
    if (!open || language !== 'ta' || !property) {
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
  }, [open, language, property, title, loc]);

  if (!property) return null;

  // Helper to get tenant details safely
  const tenant = typeof property.tenant === 'object' ? property.tenant : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Property Details', 'சொத்து விவரங்கள்')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Property Images */}
          <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
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
            <div className="absolute top-2 right-2 flex gap-2">
              <Badge variant={property.status === 'approved' ? 'default' : 'secondary'}>
                {property.status}
              </Badge>
              <Badge variant="outline" className="bg-background/80">
                {property.propertyType}
              </Badge>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid gap-4">
            <h2 className="text-2xl font-bold">{language === 'ta' ? (titleTa || property.title) : property.title}</h2>
            
            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-2" />
              {language === 'ta' ? (locationTa || property.location) : property.location}
            </div>

            <div className="flex items-center text-xl font-semibold">
              <IndianRupee className="h-5 w-5 mr-1" />
              {property.price.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-2 capitalize">
                ({property.transactionType})
              </span>
            </div>
          </div>

          <Separator />

          {/* Tenant Details Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('Tenant Details', 'குத்தகைதாரர் விவரங்கள்')}
            </h3>
            
            {tenant ? (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
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
              <div className="bg-slate-50 p-6 rounded-lg text-center border border-dashed">
                <p className="text-muted-foreground mb-2">
                  {t('No tenant assigned to this property.', 'இந்த சொத்திற்கு குத்தகைதாரர் யாரும் நியமிக்கப்படவில்லை.')}
                </p>
                <Badge variant="secondary">
                  {t('Vacant', 'காலியாக')}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
