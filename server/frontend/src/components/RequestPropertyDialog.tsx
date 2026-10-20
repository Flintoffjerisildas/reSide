import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { translateText } from '../lib/api';

interface RequestPropertyDialogProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function RequestPropertyDialog({ 
  property, 
  open, 
  onOpenChange,
  onSuccess 
}: RequestPropertyDialogProps) {
  const { t, language } = useLanguage();
  const createRequest = useCreateRequest();
  const [message, setMessage] = useState('');
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

  const displayTitle = language === 'ta' ? (titleTa || property.title) : property.title;
  const displayLocation = language === 'ta' ? (locationTa || property.location) : property.location;

  const handleSubmit = () => {
    const requestType = property.transactionType.toLowerCase() === 'rent' ? 'rent' : 'buy';
    
    createRequest.mutate(
      { 
        propertyId: property.id || (property as any)._id, 
        type: requestType,
        message: message.trim()
      },
      {
        onSuccess: () => {
          toast.success(t('Request sent successfully!', 'கோரிக்கை வெற்றிகரமாக அனுப்பப்பட்டது!'));
          setMessage('');
          onOpenChange(false);
          if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
          const msg = error.response?.data?.msg || t('Failed to send request', 'கோரிக்கையை அனுப்ப முடியவில்லை');
          toast.error(msg);
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Request Property', 'சொத்தை கோரவும்')}</DialogTitle>
          <DialogDescription>
            {t(
              `Send a request to the owner of "${displayTitle}"`,
              `"${displayTitle}" இன் உரிமையாளருக்கு கோரிக்கை அனுப்பவும்`
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            {property.images && property.images.length > 0 ? (
              <img 
                src={property.images[0]} 
                alt={displayTitle}
                className="w-16 h-16 object-cover rounded-md" 
              />
            ) : (
              <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-md text-2xl">
                🏠
              </div>
            )}
            <div>
              <h4 className="font-semibold line-clamp-1">{displayTitle}</h4>
              <p className="text-sm text-muted-foreground">{displayLocation}</p>
              <p className="text-sm font-medium text-primary mt-1">
                ₹{Number(property.price).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              {t('Message to Owner (Optional)', 'உரிமையாளருக்கு செய்தி (விரும்பினால்)')}
            </Label>
            <Textarea
              id="message"
              placeholder={t(
                "Hi, I'm interested in this property. When can I visit?",
                "வணக்கம், நான் இந்த சொத்தில் ஆர்வமாக உள்ளேன். நான் எப்போது பார்வையிடலாம்?"
              )}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none h-32"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel', 'ரத்து செய்')}
          </Button>
          <Button onClick={handleSubmit} disabled={createRequest.isPending}>
            {createRequest.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('Sending...', 'அனுப்புகிறது...')}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t('Send Request', 'கோரிக்கையை அனுப்பு')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
