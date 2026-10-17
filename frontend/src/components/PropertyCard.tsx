import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, IndianRupee, Send, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { translateText } from '../lib/api';

interface PropertyCardProps {
  property: Property;
  compact?: boolean;
  showRequestButton?: boolean;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
}

export default function PropertyCard({ property, compact = false, showRequestButton = true, onEdit, onDelete }: PropertyCardProps) {
  const { t, language } = useLanguage();
  const createRequest = useCreateRequest();
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedLocation, setTranslatedLocation] = useState<string | null>(null);

  const displayTitle = useMemo(() => {
    if (language !== 'ta') return property.title;
    return translatedTitle || property.title;
  }, [language, property.title, translatedTitle]);

  const displayLocation = useMemo(() => {
    if (language !== 'ta') return property.location;
    return translatedLocation || property.location;
  }, [language, property.location, translatedLocation]);

  useEffect(() => {
    const title = String(property.title || '').trim();
    const loc = String(property.location || '').trim();

    if (language !== 'ta') {
      setTranslatedTitle(null);
      setTranslatedLocation(null);
      return;
    }

    (async () => {
      try {
        if (title) {
          const res = await translateText(title, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setTranslatedTitle(out && out.trim() ? out : null);
        } else {
          setTranslatedTitle(null);
        }

        if (loc) {
          const res = await translateText(loc, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setTranslatedLocation(out && out.trim() ? out : null);
        } else {
          setTranslatedLocation(null);
        }
      } catch {
        setTranslatedTitle(null);
        setTranslatedLocation(null);
      }
    })();
  }, [language, property.title, property.location]);

  const handleRequest = () => {
    const tx = String((property as any)?.transactionType ?? '').toLowerCase();
    const requestType = tx === 'rent' ? 'rent' : 'buy';
    const propertyId = (property as any)?.id || (property as any)?._id;
    if (!propertyId) {
      toast.error(t('Unable to send request', 'கோரிக்கையை அனுப்ப முடியவில்லை'));
      return;
    }
    
    createRequest.mutate(
      { propertyId, type: requestType },
      {
        onSuccess: () => {
          toast.success(t('Request sent successfully!', 'கோரிக்கை வெற்றிகரமாக அனுப்பப்பட்டது!'));
        },
        onError: (error: any) => {
          const msg = error.response?.data?.msg || t('Failed to send request', 'கோரிக்கையை அனுப்ப முடியவில்லை');
          toast.error(msg);
        }
      }
    );
  };
  const getPropertyIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'flat':
        return '🏢';
      case 'house':
        return '🏠';
      case 'pg':
        return '🏘️';
      case 'land':
        return '🌳';
      default:
        return '🏗️';
    }
  };

  const getPropertyTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'flat':
        return t('Flat', 'பிளாட்');
      case 'house':
        return t('House', 'வீடு');
      case 'pg':
        return 'PG';
      case 'land':
        return t('Land', 'நிலம்');
      default:
        return type;
    }
  };

  const formatPrice = (price: bigint | number) => {
    const numPrice = Number(price);
    if (numPrice >= 10000000) {
      return `₹${(numPrice / 10000000).toFixed(2)} Cr`;
    } else if (numPrice >= 100000) {
      return `₹${(numPrice / 100000).toFixed(2)} L`;
    } else {
      return `₹${numPrice.toLocaleString('en-IN')}`;
    }
  };

  const getTransactionBadge = (type: string) => {
    return type.toLowerCase() === 'rent' ? (
      <Badge variant="secondary" className="text-xs">{t('Rent', 'வாடகை')}</Badge>
    ) : (
      <Badge variant="default" className="text-xs">{t('Purchase', 'வாங்க')}</Badge>
    );
  };

  const getOccupancyBadge = () => {
    if (property.tenant) {
      return <Badge className="bg-green-600 hover:bg-green-700 text-xs">{t('Occupied', 'குடியேற்றப்பட்டது')}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground text-xs">{t('Vacant', 'காலியாக உள்ளது')}</Badge>;
  };

  if (compact) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl sm:text-2xl">
              {getPropertyIcon(property.propertyType)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm sm:text-base font-semibold">{displayTitle}</h4>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{displayLocation}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-semibold text-primary">{formatPrice(property.price)}</span>
                {getTransactionBadge(property.transactionType)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      {/* Property Image */}
      <div className="relative h-40 sm:h-48 w-full bg-muted overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <img 
            src={property.images[0]} 
            alt={displayTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-4xl sm:text-5xl">{getPropertyIcon(property.propertyType)}</span>
          </div>
        )}
      </div>

      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-lg sm:text-xl flex-shrink-0">
              {getPropertyIcon(property.propertyType)}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg truncate">{displayTitle}</CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">{getPropertyTypeLabel(property.propertyType)}</p>
            </div>
          </div>
          {/* Show occupancy status if request button is hidden (Owner view) or always if desired */}
          {!showRequestButton && getOccupancyBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate">{displayLocation}</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-lg sm:text-xl font-bold text-primary">{formatPrice(property.price)}</span>
          </div>
          {getTransactionBadge(property.transactionType)}
        </div>
        {(property.totalArea || property.bedrooms || property.facing) && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] sm:text-xs text-muted-foreground">
            {property.totalArea && (
              <div>
                <span className="font-medium">{t('Area:', 'பரப்பளவு:')}</span>{' '}
                <span>{property.totalArea} {t('sq ft', 'சதுர அடி')}</span>
              </div>
            )}
            {property.bedrooms && (
              <div>
                <span className="font-medium">{t('Bedrooms:', 'படுக்கையறைகள்:')}</span>{' '}
                <span>{property.bedrooms} BHK</span>
              </div>
            )}
            {property.facing && (
              <div>
                <span className="font-medium">{t('Facing:', 'திசை:')}</span>{' '}
                <span>{property.facing}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        {showRequestButton ? (
          <Button 
            className="w-full" 
            onClick={handleRequest}
            disabled={createRequest.isPending || !!property.tenant}
          >
            {createRequest.isPending ? (
              t('Sending...', 'அனுப்புகிறது...')
            ) : property.tenant ? (
              t('Occupied', 'குடியேற்றப்பட்டது')
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t('Request', 'கோரிக்கை')}
              </>
            )}
          </Button>
        ) : (
          <div className="flex w-full justify-end gap-2">
            {onEdit && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Edit clicked for property:', property);
                  onEdit(property);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button 
                variant="destructive" 
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(property);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
