import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { Loader2, Send, IndianRupee } from 'lucide-react';
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
  const [offerPrice, setOfferPrice] = useState<string>('');
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);
  const title = String(property?.title || '').trim();
  const loc = String(property?.location || '').trim();

  const isBuy = property?.transactionType?.toLowerCase() === 'buy' || property?.transactionType?.toLowerCase() === 'purchase';

  useEffect(() => {
    if (property) {
      setOfferPrice(String(property.price || ''));
      setMessage('');
    }
  }, [property, open]);

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
    const requestType = isBuy ? 'buy' : 'rent';
    const numericOffer = Number(offerPrice);
    
    if (isBuy && (!Number.isFinite(numericOffer) || numericOffer <= 0)) {
      toast.error(t('Please enter a valid offer amount', 'சரியான சலுகைத் தொகையை உள்ளிடவும்'));
      return;
    }

    createRequest.mutate(
      { 
        propertyId: (property as any).id || (property as any)._id, 
        type: requestType,
        message: message.trim(),
        offerAmount: numericOffer > 0 ? numericOffer : Number(property.price)
      },
      {
        onSuccess: () => {
          toast.success(
            isBuy
              ? t('Purchase offer submitted successfully!', 'கொள்முதல் சலுகை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!')
              : t('Rental request submitted successfully!', 'வாடகை கோரிக்கை வெற்றிகரமாக அனுப்பப்பட்டது!')
          );
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
          <DialogTitle className="flex items-center gap-2">
            <span>{isBuy ? t('Make a Purchase Offer', 'வாங்க சலுகை அளிக்கவும்') : t('Submit Rental Request', 'வாடகை கோரிக்கை சமர்ப்பிக்கவும்')}</span>
            <Badge variant={isBuy ? 'default' : 'secondary'} className="text-xs">
              {isBuy ? t('Buy / Sale', 'வாங்க') : t('Rent', 'வாடகை')}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {isBuy
              ? t(
                  `Send a purchase offer or express interest to the owner of "${displayTitle}"`,
                  `"${displayTitle}" இன் உரிமையாளருக்கு கொள்முதல் சலுகையை அனுப்பவும்`
                )
              : t(
                  `Send a rental application to the owner of "${displayTitle}"`,
                  `"${displayTitle}" இன் உரிமையாளருக்கு வாடகை விண்ணப்பத்தை அனுப்பவும்`
                )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-3">
          <div className="flex items-center gap-3.5 p-3.5 bg-muted/50 rounded-xl border">
            {property.images && property.images.length > 0 ? (
              <img 
                src={property.images[0]} 
                alt={displayTitle}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0" 
              />
            ) : (
              <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-lg text-2xl flex-shrink-0">
                🏠
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm truncate">{displayTitle}</h4>
              <p className="text-xs text-muted-foreground truncate">{displayLocation}</p>
              <p className="text-sm font-semibold text-primary mt-1">
                {t('Listed Price:', 'பட்டியலிடப்பட்ட விலை:')} ₹{Number(property.price).toLocaleString('en-IN')}
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  ({property.transactionType})
                </span>
              </p>
            </div>
          </div>

          {/* Offer Amount for Buy */}
          {isBuy && (
            <div className="space-y-1.5">
              <Label htmlFor="offer-price" className="text-xs font-semibold flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-primary" />
                {t('Your Offer Amount (₹)', 'உங்கள் சலுகைத் தொகை (₹)')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="offer-price"
                type="number"
                placeholder={String(property.price)}
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('You can offer the asking price or propose a counter-amount.', 'பட்டியல் விலையையோ அல்லது உங்கள் சலுகைத் தொகையையோ குறிப்பிடலாம்.')}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs font-semibold">
              {t('Message to Owner (Optional)', 'உரிமையாளருக்கு செய்தி (விரும்பினால்)')}
            </Label>
            <Textarea
              id="message"
              placeholder={
                isBuy
                  ? t(
                      "Hi, I'm interested in purchasing this property. I'd like to discuss the closing timeline and terms.",
                      "வணக்கம், நான் இந்த சொத்தை வாங்க ஆர்வமாக உள்ளேன். நிபந்தனைகளை விவாதிக்க விரும்புகிறேன்."
                    )
                  : t(
                      "Hi, I'm interested in renting this property. When can I schedule a visit?",
                      "வணக்கம், நான் இந்த சொத்தை வாடகைக்கு எடுக்க ஆர்வமாக உள்ளேன். எப்போது பார்வையிடலாம்?"
                    )
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none h-24 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('Cancel', 'ரத்து செய்')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={createRequest.isPending}>
            {createRequest.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('Submitting...', 'சமர்ப்பிக்கிறது...')}
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" />
                {isBuy ? t('Submit Offer', 'சலுகையை சமர்ப்பி') : t('Send Request', 'கோரிக்கையை அனுப்பு')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
