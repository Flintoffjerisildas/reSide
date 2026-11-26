import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Send,
  Edit,
  Trash2,
  Heart,
  BedDouble,
  Bath,
  Ruler,
  ImageOff,
  Compass,
  Globe,
  EyeOff,
  Lock,
  Users,
  MessageSquare,
  Check,
  Phone
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { translateText, API_BASE_URL } from '../lib/api';
import api from '../lib/api';
import axios from 'axios';
import { dispatchOpenMessenger } from '../hooks/useMessenger';
import RequestPropertyDialog from './RequestPropertyDialog';

interface PropertyCardProps {
  property: Property;
  compact?: boolean;
  showRequestButton?: boolean;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
  isOwnerView?: boolean;
  onManageListing?: (property: Property, defaultAction?: 'sale' | 'rent' | 'edit') => void;
  onUnlist?: (property: Property) => void;
  onClick?: () => void;
}

export default function PropertyCard({
  property,
  compact = false,
  showRequestButton = true,
  onEdit,
  onDelete,
  isOwnerView = false,
  onManageListing,
  onUnlist,
  onClick
}: PropertyCardProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const currentUserId = (user as any)?._id || (user as any)?.id;
  const rawOwner = (property as any).owner;
  const ownerId = String(
    (property as any).ownerId?._id ||
    (property as any).ownerId ||
    (property as any).owner?._id ||
    (property as any).owner ||
    (property as any).userId?._id ||
    (property as any).userId ||
    (property as any).landlordId?._id ||
    (property as any).landlordId ||
    ''
  );
  const isCurrentOwner = isOwnerView || (!!currentUserId && !!ownerId && String(currentUserId) === String(ownerId));
  const isOwnProperty = Boolean(isCurrentOwner || (!!currentUserId && !!ownerId && String(currentUserId) === String(ownerId)));

  const ownerObj = typeof rawOwner === 'object' && rawOwner !== null ? rawOwner : null;
  const ownerPhone =
    ownerObj?.phone ||
    (property as any).ownerPhone ||
    (property as any).ownerId?.phone ||
    '';
  const ownerName =
    ownerObj?.name ||
    ownerObj?.fullName ||
    (property as any).ownerName ||
    'Owner';

  const createRequest = useCreateRequest();
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedLocation, setTranslatedLocation] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());

  const handleConnectClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error(
        t('Please log in to message or connect with the owner', 'உரிமையாளருடன் பேச தயவுசெய்து உள்நுழையவும்'),
        { id: 'connect-toast' }
      );
      return;
    }
    if (!ownerId) {
      toast.error(
        t('Owner information is not available for this property', 'இந்த சொத்தின் உரிமையாளர் தகவல் கிடைக்கவில்லை'),
        { id: 'connect-toast' }
      );
      return;
    }

    if (isCurrentOwner || (currentUserId && ownerId && String(currentUserId) === String(ownerId))) {
      toast.info(
        t('This is your own property listing', 'இது உங்கள் சொந்த சொத்து பட்டியல்'),
        { id: 'connect-toast' }
      );
      return;
    }

    const propId = String((property as any)._id || property.id || '');
    if (sendingIds.has(propId)) {
      return;
    }

    const ownerName = typeof rawOwner === 'object' && rawOwner?.name
      ? rawOwner.name
      : (property as any).ownerName || t('Owner', 'உரிமையாளர்');

    setSendingIds((prev) => new Set(prev).add(propId));

    const token = localStorage.getItem('token') || (user as any)?.token;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      requestHeaders['x-auth-token'] = token;
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const payload = {
        receiverId: ownerId,
        recipientId: ownerId,
        targetUserId: ownerId,
        ownerId: ownerId,
        propertyId: propId,
        propertyTitle: property.title || (property as any).name || ''
      };

      let res;
      try {
        res = await api.post('/messages/friend-request', payload);
      } catch (firstErr: any) {
        if (firstErr.response?.status === 404) {
          const endpoint = API_BASE_URL
            ? `${API_BASE_URL.replace(/\/$/, '')}/api/messages/friend-request`
            : '/api/messages/friend-request';
          res = await axios.post(endpoint, payload, { headers: requestHeaders });
        } else {
          throw firstErr;
        }
      }

      if (res.data?.connected || res.data?.status === 'already_connected' || res.data?.status === 'connected') {
        dispatchOpenMessenger(ownerId, propId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('open-reside-messenger', {
              detail: { userId: ownerId, targetUserId: ownerId, propertyId: propId }
            })
          );
        }
      } else if (res.data?.status === 'accepted') {
        setSentRequestIds((prev) => new Set(prev).add(propId));
        toast.success(
          t(`Connected with ${ownerName}! Opening chat...`, `${ownerName} உடன் இணைக்கப்பட்டது! அரட்டை திறக்கிறது...`),
          { id: 'connect-toast' }
        );
        dispatchOpenMessenger(ownerId, propId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('open-reside-messenger', {
              detail: { userId: ownerId, targetUserId: ownerId, propertyId: propId }
            })
          );
        }
      } else {
        setSentRequestIds((prev) => new Set(prev).add(propId));
        toast.success(
          t(`Friend & chat request sent to ${ownerName}`, `நண்பர் மற்றும் அரட்டை கோரிக்கை ${ownerName} க்கு அனுப்பப்பட்டது`),
          { id: 'connect-toast' }
        );
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.msg ||
        (err.response?.status ? `Request failed (${err.response.status})` : err.message) ||
        'Failed to send connect request';
      toast.error(errMsg, { id: 'connect-toast' });
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(propId);
        return next;
      });
    }
  };

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
      case 'villa':
        return '🏡';
      case 'pg':
        return '🏘️';
      case 'land':
      case 'plot':
        return '🌳';
      case 'commercial':
      case 'office':
      case 'shop':
        return '🏬';
      case 'farmhouse':
        return '🌾';
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
      case 'villa':
        return t('Villa', 'வில்லா');
      case 'pg':
        return 'PG';
      case 'land':
      case 'plot':
        return t('Land / Plot', 'நிலம் / மனை');
      case 'commercial':
        return t('Commercial', 'வணிக இடம்');
      case 'farmhouse':
        return t('Farm House', 'பண்ணை வீடு');
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

  const getTransactionBadge = (type?: string) => {
    if (!type) return null;
    return type.toLowerCase() === 'rent' ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300">
        {t('Rent', 'வாடகை')}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300">
        {t('Sale', 'விற்பனை')}
      </Badge>
    );
  };

  const isAcquired = (property as any)?.saleStatus === 'sold' || !!property.buyer || (Array.isArray(property.previousOwners) && property.previousOwners.length > 0);
  const isCurrentlyListed = property.listingStatus === 'listed' || (property.isListed && property.listingStatus !== 'unlisted');
  const isOccupied = property.occupancyStatus === 'occupied' || !!property.tenant;
  const isUnderContract = (property as any)?.saleStatus === 'under_contract';

  const getOwnerStatusBadge = () => {
    if (isUnderContract) {
      return (
        <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1 shrink-0">
          <Lock className="h-2.5 w-2.5" />
          {t('Under Contract', 'ஒப்பந்தத்தில்')}
        </Badge>
      );
    }
    if (isCurrentlyListed) {
      const isRent = property.transactionType?.toLowerCase() === 'rent';
      return (
        <Badge className={`text-white text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1 shrink-0 ${isRent ? 'bg-purple-600' : 'bg-blue-600'}`}>
          <Globe className="h-2.5 w-2.5" />
          {isRent ? t('Listed: Rent', 'வாடகைக்கு') : t('Listed: Sale', 'விற்பனைக்கு')}
        </Badge>
      );
    }
    if (isOccupied) {
      return (
        <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1 shrink-0">
          <Users className="h-2.5 w-2.5" />
          {t('Occupied', 'குடியேற்றப்பட்டது')}
        </Badge>
      );
    }
    if (property.listingStatus === 'unavailable') {
      return (
        <Badge variant="secondary" className="text-muted-foreground text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1 shrink-0">
          <Lock className="h-2.5 w-2.5" />
          {t('Unavailable', 'கிடைக்கவில்லை')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1 shrink-0">
        <EyeOff className="h-2.5 w-2.5" />
        {t('Private', 'தனிப்பட்டது')}
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
    if (property.tenant || property.occupancyStatus === 'occupied') {
      return (
        <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 font-medium flex items-center gap-1">
          <Users className="h-2.5 w-2.5" />
          {t('Occupied', 'குடியேற்றப்பட்டது')}
        </Badge>
      );
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
                <span className="truncate">
                  {!isOwnerView && property.showAddress === false
                    ? t('Location upon request', 'இருப்பிடம் கோரிக்கையின் பேரில்')
                    : displayLocation}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-primary">
                  {!isOwnerView && property.showPrice === false
                    ? t('Price upon request', 'விலை கோரிக்கையின் பேரில்')
                    : formatPrice(property.price)}
                </span>
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
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`glass-card flex flex-col h-full w-full overflow-hidden rounded-xl p-0 gap-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/20 dark:border-white/10 group ${
        onClick
          ? 'cursor-pointer hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
          : ''
      }`}
    >
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

        {/* Call Owner Phone Icon */}
        {ownerPhone && !isOwnProperty && (
          <a
            href={`tel:${ownerPhone.replace(/\s+/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            title={`Call ${ownerName || 'Owner'}: ${ownerPhone}`}
            aria-label="Call Owner"
            className="absolute top-3 left-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/95 text-blue-600 shadow-md hover:bg-blue-600 hover:text-white transition-colors"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}

        {/* Message / Connect Button - customer view only (hidden for owner) */}
        {!isCurrentOwner && (
          <button
            type="button"
            aria-label={t('Message or connect with property owner', 'உரிமையாளருடன் பேசவும்')}
            title={
              sentRequestIds.has(String((property as any)._id || property.id || ''))
                ? t('Request Sent', 'கோரிக்கை அனுப்பப்பட்டது')
                : t('Message / Send Friend Request to Owner', 'உரிமையாளருடன் அரட்டை / நண்பர் கோரிக்கை')
            }
            onClick={handleConnectClick}
            className={`w-8 h-8 rounded-full shadow-md flex items-center justify-center transition absolute right-2 top-2 backdrop-blur-md cursor-pointer group z-10 border ${
              sentRequestIds.has(String((property as any)._id || property.id || ''))
                ? 'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'bg-white/95 dark:bg-slate-900/85 hover:bg-blue-600 text-slate-700 hover:text-white border-white/60 dark:border-slate-700/60'
            }`}
          >
            {sentRequestIds.has(String((property as any)._id || property.id || '')) ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-200" />
            ) : (
              <MessageSquare className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
          </button>
        )}
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
          {isOwnerView ? (
            getOwnerStatusBadge()
          ) : (
            getOccupancyBadge()
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="px-2.5 sm:px-3 py-1 flex-1 flex flex-col justify-between space-y-2">
        {/* Location */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 flex-shrink-0 text-primary" />
          <span className="truncate" title={!isOwnerView && property.showAddress === false ? t('Location upon request', 'இருப்பிடம் கோரிக்கையின் பேரில்') : displayLocation}>
            {!isOwnerView && property.showAddress === false
              ? t('Location upon request', 'இருப்பிடம் கோரிக்கையின் பேரில்')
              : displayLocation}
          </span>
        </div>

                {/* Price and Transaction Badge */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-baseline gap-0.5">
            {!isOwnerView && property.showPrice === false ? (
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground italic">
                {t('Price upon request', 'விலை கோரிக்கையின் பேரில்')}
              </span>
            ) : (
              <>
                <span className="text-sm sm:text-base font-bold text-primary tracking-tight">
                  {formatPrice(property.price)}
                </span>
                {property.transactionType?.toLowerCase() === 'rent' && (
                  <span className="text-[9px] text-muted-foreground font-normal">/mo</span>
                )}
                {isOwnerView && property.showPrice === false && (
                  <span className="text-[9px] font-normal text-amber-600 dark:text-amber-400 ml-1">
                    ({t('Hidden', 'மறைக்கப்பட்டது')})
                  </span>
                )}
              </>
            )}
          </div>
          {!isOwnerView && !showRequestButton && getTransactionBadge(property.transactionType)}
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

        {/* Amenities Badges if enabled */}
        {((!isOwnerView && property.showAmenities !== false && property.amenities && property.amenities.length > 0) ||
          (isOwnerView && property.amenities && property.amenities.length > 0)) && (
          <div className="flex items-center gap-1 overflow-hidden flex-nowrap pt-0.5">
            {property.showAmenities === false && isOwnerView ? (
              <span className="text-[9px] text-amber-600 dark:text-amber-400 italic">
                {t('Amenities hidden from public', 'வசதிகள் பொதுவில் மறைக்கப்பட்டுள்ளன')}
              </span>
            ) : (
              property.amenities?.slice(0, 3).map((amenity, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium truncate shrink-0 max-w-[120px]"
                >
                  ✓ {amenity}
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {(showRequestButton || onEdit || onDelete) && (
        <div className="px-2.5 sm:px-3 pb-2.5 pt-1 mt-auto">
          {showRequestButton ? (
                        <Button
              size="sm"
              className="w-full h-7 sm:h-8 text-xs font-medium rounded-lg shadow-sm hover:shadow"
              onClick={handleRequest}
              disabled={isUnavailable || (!isOwnerView && property.acceptOffers === false)}
            >
              {isUnavailable ? (
                isBuy ? t('Sold Out', 'விற்கப்பட்டது') : t('Occupied', 'குடியேற்றப்பட்டது')
              ) : !isOwnerView && property.acceptOffers === false ? (
                t('Offers Paused', 'சலுகைகள் இடைநிறுத்தப்பட்டன')
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
        <div className="pb-2.5" />
      )}

      <RequestPropertyDialog
        property={property}
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
      />
    </Card>
  );
}
