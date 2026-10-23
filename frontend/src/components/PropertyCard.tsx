import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Send, Edit, Trash2, Heart, BedDouble, Bath, Ruler, ImageOff, Compass } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { translateText } from '../lib/api';
import RequestPropertyDialog from './RequestPropertyDialog';

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
  const [isFavorite, setIsFavorite] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const rawImage = property.images && property.images.length > 0 ? property.images[0] : null;
  const imageSrc = typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : null;

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc]);

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

  const isBuy = String((property as any)?.transactionType ?? '').toLowerCase() === 'buy' || String((property as any)?.transactionType ?? '').toLowerCase() === 'purchase';
  const isUnavailable = isBuy ? (property as any)?.saleStatus === 'sold' : !!property.tenant;

  const handleRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRequestDialog(true);
  };

  const getPropertyIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'flat':
      case 'apartment':
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
      case 'apartment':
        return t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்');
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
      <Badge variant="secondary" className="glass-pill text-[10px] px-1.5 py-0.5 font-medium">
        {t('Rent', 'வாடகை')}
      </Badge>
    ) : (
      <Badge variant="default" className="text-[10px] px-1.5 py-0.5 font-medium bg-blue-600 text-white">
        {t('Purchase', 'வாங்க')}
      </Badge>
    );
  };

  const getOccupancyBadge = () => {
    if ((property as any)?.saleStatus === 'sold') {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] px-1.5 py-0.5 font-medium">
          ✓ {t('Acquired / Owned', 'வாங்கப்பட்டது')}
        </Badge>
      );
    }
    if (property.tenant) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] px-1.5 py-0.5">{t('Occupied', 'குடியேற்றப்பட்டது')}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0.5">{t('Vacant', 'காலியாக உள்ளது')}</Badge>;
  };

  if (compact) {
    return (
      <Card className="glass-card w-full overflow-hidden p-0 gap-0 rounded-xl">
        <div className="p-2 sm:p-2.5">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base sm:text-lg">
              {getPropertyIcon(property.propertyType)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs sm:text-sm font-semibold">{displayTitle}</h4>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0 text-primary" />
                <span className="truncate">{displayLocation}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-primary">{formatPrice(property.price)}</span>
                {getTransactionBadge(property.transactionType)}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const hasValidImage = Boolean(imageSrc && !imgFailed);

  return (
    <Card className="glass-card flex flex-col h-full w-full overflow-hidden rounded-xl p-0 gap-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/20 dark:border-white/10 group">
      {/* Property Image Container - Compact Height */}
      <div className="relative h-32 w-full overflow-hidden bg-muted/60 sm:h-36 flex-shrink-0">
        {hasValidImage ? (
          <img
            src={imageSrc!}
            alt={displayTitle}
            onError={() => setImgFailed(true)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50/70 via-slate-100/50 to-teal-50/70 dark:from-blue-950/40 dark:via-slate-900/40 dark:to-teal-950/30">
            <div className="absolute -right-6 -top-10 h-28 w-28 rounded-full bg-blue-200/30 blur-2xl dark:bg-blue-500/10" />
            <div className="absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-teal-200/30 blur-2xl dark:bg-teal-500/10" />
            <div className="relative flex flex-col items-center gap-1 text-blue-600/80 dark:text-blue-300/80">
              <Building2 className="h-8 w-8" strokeWidth={1.4} />
              <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider">
                <ImageOff className="h-2.5 w-2.5" /> {t('Image unavailable', 'படம் இல்லை')}
              </span>
            </div>
          </div>
        )}

        {/* Verified Badge */}
        <div className="glass-pill absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border-emerald-400/40 dark:text-emerald-400 shadow-sm backdrop-blur-md">
          ✓ {t('Verified', 'சரிபார்க்கப்பட்டது')}
        </div>

        {/* Save / Favorite Button */}
        <button
          type="button"
          aria-label={t('Save property', 'சொத்தை சேமிக்கவும்')}
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite((value) => !value);
          }}
          className={`glass-pill absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition duration-200 hover:scale-110 active:scale-95 motion-reduce:transition-none backdrop-blur-md ${isFavorite ? 'text-rose-500' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
        >
          <Heart className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Header Info */}
      <div className="p-2.5 sm:p-3 pb-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm flex-shrink-0">
              {getPropertyIcon(property.propertyType)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold truncate leading-tight" title={displayTitle}>
                {displayTitle}
              </h3>
              <p className="text-[10px] text-muted-foreground capitalize mt-0.5 truncate">
                {getPropertyTypeLabel(property.propertyType)}
              </p>
            </div>
          </div>
          {!showRequestButton && getOccupancyBadge()}
        </div>
      </div>

      {/* Body Content */}
      <div className="px-2.5 sm:px-3 py-1 flex-1 flex flex-col justify-between space-y-2">
        {/* Location & GPS */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="h-3 w-3 flex-shrink-0 text-primary" />
            <span className="truncate" title={displayLocation}>{displayLocation}</span>
          </div>
          {property.geoLocation?.latitude && property.geoLocation?.longitude && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 font-mono font-medium">
              GPS
            </span>
          )}
        </div>

        {/* Price and Transaction Badge */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm sm:text-base font-bold text-primary tracking-tight">
              {formatPrice(property.price)}
            </span>
            {property.transactionType?.toLowerCase() === 'rent' && (
              <span className="text-[9px] text-muted-foreground font-normal">/mo</span>
            )}
          </div>
          {getTransactionBadge(property.transactionType)}
        </div>

        {/* Specs: Area, Bedrooms, Dimensions, Facing */}
        {/* {(property.totalArea || property.bedrooms || property.facing || (property.propertyType?.toLowerCase() === 'land' && property.landDimensions)) && (
          <div className="mt-1 flex items-center gap-2 border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground flex-wrap">
            {property.totalArea && (
              <div className="flex items-center gap-1" title={`${property.totalArea} sq.ft`}>
                <Ruler className="h-2.5 w-2.5 text-muted-foreground/80 shrink-0" />
                <span className="truncate">
                  {property.totalArea} {t('sq.ft', 'சதுர அடி')}
                  {property.propertyType?.toLowerCase() === 'land' && (
                    <span className="opacity-80">
                      {' '}({(property.cent !== undefined && property.cent !== null)
                        ? property.cent
                        : parseFloat((property.totalArea / 435.6).toFixed(2))} {t('cent', 'சென்ட்')})
                    </span>
                  )}
                </span>
              </div>
            )}
            {property.bedrooms && (
              <div className="flex items-center gap-1 shrink-0">
                <BedDouble className="h-2.5 w-2.5 text-muted-foreground/80 shrink-0" />
                <span>{property.bedrooms} {t('Beds', 'படுக்கைகள்')}</span>
              </div>
            )}
            {property.propertyType?.toLowerCase() === 'land' && property.landDimensions && (
              property.landDimensions.ab != null || property.landDimensions.bc != null
            ) && (
              <div className="flex items-center gap-1 shrink-0" title={`${property.landDimensions.ab ?? '-'} × ${property.landDimensions.bc ?? '-'} × ${property.landDimensions.cd ?? '-'} × ${property.landDimensions.da ?? '-'} ft`}>
                <Compass className="h-2.5 w-2.5 text-primary shrink-0" />
                <span>
                  {[property.landDimensions.ab, property.landDimensions.bc, property.landDimensions.cd, property.landDimensions.da].filter((v): v is number => typeof v === 'number').join(' × ')} ft
                </span>
              </div>
            )}
            {property.facing && (
              <div className="flex items-center gap-1 shrink-0">
                <Bath className="h-2.5 w-2.5 text-muted-foreground/80 shrink-0" />
                <span>{t('Baths', 'குளியலறைகள்')}</span>
              </div>
            )}
          </div>
        )} */}
      </div>

      {/* Footer Actions */}
      {(showRequestButton || onEdit || onDelete) && (
        <div className="px-2.5 sm:px-3 pb-2.5 pt-1 mt-auto">
          {showRequestButton ? (
            <Button
              size="sm"
              className="w-full h-7 sm:h-8 text-xs font-medium rounded-lg shadow-sm hover:shadow"
              onClick={handleRequest}
              disabled={isUnavailable}
            >
              {isUnavailable ? (
                isBuy ? t('Sold Out', 'விற்கப்பட்டது') : t('Occupied', 'குடியேற்றப்பட்டது')
              ) : (
                <>
                  <Send className="mr-1 h-3 w-3" />
                  {isBuy ? t('Buy / Offer', 'வாங்க / சலுகை') : t('Rent / Apply', 'வாடகை / கோரிக்கை')}
                </>
              )}
            </Button>
          ) : (
            <div className="flex w-full justify-end gap-1.5">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Edit clicked for property:', property);
                    onEdit(property);
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(property);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {!showRequestButton && !onEdit && !onDelete && (
        <div className="pb-2" />
      )}

      <RequestPropertyDialog
        property={property}
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
      />
    </Card>
  );
}
