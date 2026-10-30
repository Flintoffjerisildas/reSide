import { useEffect, useMemo, useState } from 'react';
import { useGetAllProperties } from '../hooks/useQueries';
import PropertyCard from './PropertyCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, ChevronLeft, ChevronRight, Send, ArrowUpRight, Home, Search, Mic2, Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Property } from '../types';
import AuthDialog from './AuthDialog';
import RequestPropertyDialog from './RequestPropertyDialog';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { translateText } from '../lib/api';
import HeroSection from './HeroSection';

interface PropertyListingsProps {
  showAbout?: boolean;
  initialTransactionType?: 'rent' | 'buy' | '';
  selectedPropertyId?: string | null;
  onSelectProperty?: (propertyId: string | null) => void;
  onTransactionTypeChange?: (type: 'rent' | 'buy' | '') => void;
}

export default function PropertyListings({
  showAbout = false,
  initialTransactionType = '',
  selectedPropertyId = null,
  onSelectProperty,
  onTransactionTypeChange
}: PropertyListingsProps) {
  const { data: properties = [], isLoading } = useGetAllProperties();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const createRequest = useCreateRequest();

  useEffect(() => {
    if (!showAbout) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById('about-us')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showAbout]);

  // Filter states
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [transactionType, setTransactionType] = useState<string>(initialTransactionType);
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modalImgFailed, setModalImgFailed] = useState(false);

  useEffect(() => {
    setModalImgFailed(false);
  }, [currentImageIndex, selectedPropertyIndex]);

  useEffect(() => {
    setTransactionType(initialTransactionType);
  }, [initialTransactionType]);

  useEffect(() => {
    if (!initialTransactionType) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialTransactionType]);

  const normalizePropertyType = (value: unknown) => {
    const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s/_-]+/g, '');
    if (
      normalized === 'flat' ||
      normalized === 'flats' ||
      normalized === 'apartment' ||
      normalized === 'apartments' ||
      normalized === 'flatapartment' ||
      normalized === 'apartmentflat'
    ) {
      return 'flat';
    }
    if (normalized === 'house' || normalized === 'houses') {
      return 'house';
    }
    if (normalized === 'villa' || normalized === 'villas') {
      return 'villa';
    }
    if (normalized === 'pg' || normalized === 'pgs') {
      return 'pg';
    }
    if (normalized === 'land' || normalized === 'plot' || normalized === 'plots') {
      return 'land';
    }
    if (
      normalized === 'commercial' ||
      normalized === 'office' ||
      normalized === 'offices' ||
      normalized === 'shop' ||
      normalized === 'shops' ||
      normalized === 'commercialspace'
    ) {
      return 'commercial';
    }
    if (normalized === 'farmhouse' || normalized === 'farmhouses' || normalized === 'farm') {
      return 'farmhouse';
    }
    return normalized;
  };

  const normalizeTransactionType = (value: unknown) => {
    const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s/_-]+/g, '');
    if (
      normalized === 'buy' ||
      normalized === 'purchase' ||
      normalized === 'purchases' ||
      normalized === 'sale' ||
      normalized === 'sell' ||
      normalized === 'forsale'
    ) {
      return 'purchase';
    }
    if (normalized === 'rent' || normalized === 'rental' || normalized === 'lease' || normalized === 'forrent') {
      return 'rent';
    }
    return normalized;
  };

  // Filter logic
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const propertyLocation = String((property as any)?.location ?? '').toLowerCase();
      const filterLocation = String(location ?? '').toLowerCase();
      const locationMatch = propertyLocation.includes(filterLocation);

      const propertyPropertyType = normalizePropertyType((property as any)?.propertyType);
      const typeMatch = propertyType ? propertyPropertyType === normalizePropertyType(propertyType) : true;

      const propertyTransactionType = normalizeTransactionType((property as any)?.transactionType);
      const transactionMatch = transactionType
        ? propertyTransactionType === normalizeTransactionType(transactionType)
        : true;

      const propertyPrice = Number((property as any)?.price ?? 0);
      const hasMinPrice = priceRange[0] > 0;
      const hasMaxPrice = priceRange[1] > 0;
      const priceMatch =
        (!hasMinPrice || propertyPrice >= priceRange[0]) &&
        (!hasMaxPrice || propertyPrice <= priceRange[1]);
      
      const isRent = propertyTransactionType === 'rent';
      const occupancyEligible = isRent
        ? (property as any)?.occupancyStatus !== 'occupied' && !property.tenant
        : true; // Sale listings can be occupied (tenant in place)

      // Strict public visibility check: must be explicitly listed, not unlisted, not unavailable, not sold, and eligible for transaction
      const isPubliclyAvailable =
        (property.isListed === true || property.listingStatus === 'listed') &&
        property.listingStatus !== 'unlisted' &&
        property.listingStatus !== 'unavailable' &&
        (property as any)?.saleStatus !== 'sold' &&
        occupancyEligible;

      return isPubliclyAvailable && locationMatch && typeMatch && transactionMatch && priceMatch;
    });
  }, [properties, location, propertyType, transactionType, priceRange]);

  // Sync selectedPropertyId prop with index
  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      const idx = filteredProperties.findIndex(
        (p: any) => (p.id || p._id) === selectedPropertyId
      );
      if (idx !== -1) {
        setSelectedPropertyIndex(idx);
      }
    } else if (!selectedPropertyId) {
      setSelectedPropertyIndex(null);
    }
  }, [selectedPropertyId, filteredProperties, properties]);

  // Check if any filters are active
  const hasActiveFilters = location || propertyType || transactionType || priceRange[0] !== 0 || priceRange[1] !== 0;

  const resetFilters = () => {
    setLocation('');
    setPropertyType('');
    setTransactionType('');
    setPriceRange([0, 0]);
    onTransactionTypeChange?.('');
  };

  const handlePropertyTypeChange = (value: string) => {
    setPropertyType(value);
    requestAnimationFrame(() => {
      document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleTransactionTypeChange = (value: string) => {
    setTransactionType(value);
    if (onTransactionTypeChange) {
      const normalized = value === 'purchase' || value === 'buy' ? 'buy' : value === 'rent' ? 'rent' : '';
      onTransactionTypeChange(normalized);
    }
  };

  const directProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p: any) => (p.id || (p as any)._id) === selectedPropertyId) || null;
  }, [selectedPropertyId, properties]);

  // Navigation for property details view
  const selectedProperty = selectedPropertyIndex !== null ? filteredProperties[selectedPropertyIndex] : directProperty;
  const [selectedTitleTa, setSelectedTitleTa] = useState<string | null>(null);
  const [selectedLocationTa, setSelectedLocationTa] = useState<string | null>(null);
  const selectedImages = useMemo(() => {
    const raw = (selectedProperty as any)?.images;
    if (!Array.isArray(raw)) return [];
    return raw.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
  }, [selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;
    if (selectedImages.length === 0) return;
    if (currentImageIndex >= selectedImages.length) setCurrentImageIndex(0);
  }, [selectedProperty, selectedImages.length, currentImageIndex]);

  useEffect(() => {
    if (language !== 'ta' || !selectedProperty) {
      setSelectedTitleTa(null);
      setSelectedLocationTa(null);
      return;
    }

    const title = String(selectedProperty.title || '').trim();
    const loc = String(selectedProperty.location || '').trim();

    (async () => {
      try {
        if (title) {
          const res = await translateText(title, 'ta');
          const tt = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setSelectedTitleTa(tt && tt.trim() ? tt : null);
        } else {
          setSelectedTitleTa(null);
        }

        if (loc) {
          const res = await translateText(loc, 'ta');
          const tl = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setSelectedLocationTa(tl && tl.trim() ? tl : null);
        } else {
          setSelectedLocationTa(null);
        }
      } catch {
        setSelectedTitleTa(null);
        setSelectedLocationTa(null);
      }
    })();
  }, [language, selectedProperty?.title, selectedProperty?.location]);

  const handlePreviousProperty = () => {
    if (selectedPropertyIndex !== null && selectedPropertyIndex > 0) {
      const newIdx = selectedPropertyIndex - 1;
      setSelectedPropertyIndex(newIdx);
      setCurrentImageIndex(0);
      const prop = filteredProperties[newIdx];
      if (prop && onSelectProperty) {
        onSelectProperty(prop.id || (prop as any)._id);
      }
    }
  };

  const handleNextProperty = () => {
    if (selectedPropertyIndex !== null && selectedPropertyIndex < filteredProperties.length - 1) {
      const newIdx = selectedPropertyIndex + 1;
      setSelectedPropertyIndex(newIdx);
      setCurrentImageIndex(0);
      const prop = filteredProperties[newIdx];
      if (prop && onSelectProperty) {
        onSelectProperty(prop.id || (prop as any)._id);
      }
    }
  };

  const handleCardClick = (index: number) => {
    setSelectedPropertyIndex(index);
    setCurrentImageIndex(0);
    const prop = filteredProperties[index];
    if (prop && onSelectProperty) {
      onSelectProperty(prop.id || (prop as any)._id);
    }
  };

  const handleCloseDetail = () => {
    setSelectedPropertyIndex(null);
    setCurrentImageIndex(0);
    if (onSelectProperty) {
      onSelectProperty(null);
    }
  };

  const handleRequestProperty = () => {
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    if (!selectedProperty) return;

    setShowRequestDialog(true);
  };

  return (
    <div className="w-full max-w-screen mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      <div>
        <HeroSection
          location={location}
          onLocationChange={setLocation}
          propertyType={propertyType}
          onPropertyTypeChange={handlePropertyTypeChange}
          transactionType={transactionType}
          onTransactionTypeChange={handleTransactionTypeChange}
          priceRange={priceRange as [number, number]}
          onPriceRangeChange={setPriceRange}
          maxPrice={priceRange[1]}
          onMaxPriceChange={(value) => setPriceRange([0, value])}
          onSearch={() => document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth' })}
        />
        {/* Property Listings */}
        <div className="space-y-5 sm:space-y-6 mt-8 sm:mt-10">
          {/* Filters Section */}
          <div className="hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold">{t('Filter Properties', 'சொத்துகளை வடிகட்டவும்')}</h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                  {t('Clear Filters', 'வடிகட்டிகளை அழிக்கவும்')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('Location', 'இடம்')}
                </label>
                <input
                  type="text"
                  placeholder={t('Search location...', 'இடத்தைத் தேடுங்கள்...')}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Property Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('Property Type', 'சொத்து வகை')}
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t('All Types', 'அனைத்து வகைகளும்')}</option>
                  <option value="flat">{t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்')}</option>
                  <option value="house">{t('House', 'வீடு')}</option>
                  <option value="villa">{t('Villa', 'வில்லா')}</option>
                  <option value="pg">{t('PG / Hostel', 'பி.ஜி / விடுதி')}</option>
                  <option value="land">{t('Land / Plot', 'நிலம் / மனை')}</option>
                  <option value="commercial">{t('Commercial', 'வணிக இடம்')}</option>
                  <option value="farmhouse">{t('Farm House', 'பண்ணை வீடு')}</option>
                </select>
              </div>

              {/* Looking For */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('Looking For', 'தேடுகிறேன்')}
                </label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t('All', 'அனைத்தும்')}</option>
                  <option value="rent">{t('Rent', 'வாடகை')}</option>
                  <option value="lease">{t('Lease', 'குத்தகை')}</option>
                  <option value="purchase">{t('Purchase', 'கொள்ளிப் பெறுதல்')}</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('Max Price', 'அधिकतम விலை')}: ₹
                  {transactionType === 'rent' || transactionType === 'lease'
                    ? (priceRange[1] / 1000).toFixed(0) + 'K'
                    : (priceRange[1] / 100000).toFixed(1) + 'L'}
                </label>
                <input
                  type="range"
                  min="0"
                  max={transactionType === 'rent' || transactionType === 'lease' ? '10000000' : '100000000'}
                  step={transactionType === 'rent' || transactionType === 'lease' ? '1000' : '30000'}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="text-xs text-muted-foreground">
                  {transactionType === 'rent' || transactionType === 'lease'
                    ? '₹0 - ₹100L'
                    : '₹0 - ₹10Cr'}
                </div>
              </div>
            </div>
          </div>

          {/* Listings */}
          <div id="property-listings" className="relative z-10 space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/80"><Home className="h-4 w-4" /></span>
                  {t('Homes picked for you', 'உங்களுக்காக தேர்ந்தெடுக்கப்பட்ட வீடுகள்')}
                </h2>
                <p className="text-xs ml-11 sm:text-sm text-muted-foreground mt-0.5">
                  {t('Explore handpicked spaces worth seeing', 'பார்க்க வேண்டிய சிறந்த இடங்களை ஆராயுங்கள்')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: '', label: t('All', 'அனைத்தும்') },
                  { value: 'flat', label: t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்') },
                  { value: 'house', label: t('House', 'வீடு') },
                  { value: 'villa', label: t('Villa', 'வில்லா') },
                  { value: 'pg', label: t('PG', 'பி.ஜி') },
                  { value: 'land', label: t('Land', 'நிலம்') },
                  { value: 'commercial', label: t('Commercial', 'வணிகம்') },
                  { value: 'farmhouse', label: t('Farm House', 'பண்ணை வீடு') },
                ].map((item) => (
                  <button
                    key={item.value || 'all'}
                    type="button"
                    onClick={() => handlePropertyTypeChange(item.value)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 ${propertyType === item.value
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'glass-pill text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
                {!isLoading && (
                  <span className="hidden text-xs text-muted-foreground xl:inline ml-1 font-medium">
                    {filteredProperties.length} {t('available', 'கிடைக்கும்')}
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="glass-card rounded-2xl p-0 overflow-hidden space-y-3">
                    <Skeleton className="h-40 sm:h-44 w-full" />
                    <div className="p-3.5 space-y-2.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-5 w-2/3 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 glass-panel p-8 sm:p-12 text-center">
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl sm:text-3xl">🏘️</span>
                </div>
                <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
                  {t('No Properties Yet', 'இன்னும் சொத்துகள் இல்லை')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Use the AI assistant to add your first property', 'உங்கள் முதல் சொத்தை சேர்க்க AI உதவியாளரைப் பயன்படுத்தவும்')}
                </p>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 glass-panel p-8 sm:p-12 text-center">
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl sm:text-3xl">🔍</span>
                </div>
                <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
                  {t('No Matching Properties', 'பொருந்தும் சொத்துகள் இல்லை')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Try adjusting your filters to find properties', 'சொத்துகளைக் கண்டறிய உங்கள் வடிகட்டிகளை சரிசெய்ய முயற்சிக்கவும்')}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-3.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 items-stretch">
                {filteredProperties.map((property, index) => (
                  <div
                    key={String((property as any)?.id ?? (property as any)?._id ?? index)}
                    onClick={() => handleCardClick(index)}
                    className="cursor-pointer h-full transition duration-200"
                  >
                    <PropertyCard property={property} showRequestButton={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Property Details Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass-dialog rounded-2xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl border border-white/20">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border/40 glass-nav">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">
                    {language === 'ta' ? (selectedTitleTa || selectedProperty.title) : selectedProperty.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-1">
                    <span>
                      📍 {language === 'ta' ? (selectedLocationTa || selectedProperty.location) : selectedProperty.location}
                    </span>
                    {selectedProperty.geoLocation?.latitude && selectedProperty.geoLocation?.longitude && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                        GPS: {Number(selectedProperty.geoLocation.latitude).toFixed(4)}°, {Number(selectedProperty.geoLocation.longitude).toFixed(4)}°
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCloseDetail}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Image Carousel */}
                {selectedImages.length > 0 && !modalImgFailed ? (
                  <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                    <img
                      src={selectedImages[currentImageIndex]}
                      alt={language === 'ta' ? (selectedTitleTa || selectedProperty.title) : selectedProperty.title}
                      onError={() => setModalImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                    {selectedImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : prev))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                          disabled={currentImageIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev < selectedImages.length - 1 ? prev + 1 : prev
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                          disabled={currentImageIndex === selectedImages.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          {currentImageIndex + 1} / {selectedImages.length}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-blue-50/60 via-slate-100/40 to-teal-50/60 dark:from-blue-950/40 dark:via-slate-900/40 dark:to-teal-950/30 aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Building2 className="h-12 w-12 text-primary/60" />
                    <span className="text-xs uppercase tracking-wider font-semibold">{t('Image unavailable', 'படம் இல்லை')}</span>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Type', 'வகை')}</div>
                    <div className="font-semibold">{selectedProperty.propertyType}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Price', 'விலை')}</div>
                    <div className="font-semibold">
                      ₹{Number(selectedProperty.price).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Transaction', 'பரிவர்த்தனை')}</div>
                    <div className="font-semibold capitalize">{selectedProperty.transactionType}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Total Area', 'மொத்த பரப்பளவு')}</div>
                    <div className="font-semibold">
                      {selectedProperty.totalArea
                        ? `${selectedProperty.totalArea} ${t('sq ft', 'சதுர அடி')}`
                        : t('Not specified', 'குறிப்பிடப்படவில்லை')}
                    </div>
                  </div>
                  {selectedProperty.propertyType?.toLowerCase() !== 'land' ? (
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">{t('Bedrooms', 'படுக்கையறைகள்')}</div>
                      <div className="font-semibold">
                        {selectedProperty.bedrooms
                          ? `${selectedProperty.bedrooms} BHK`
                          : t('Not specified', 'குறிப்பிடப்படவில்லை')}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">{t('Cent Area', 'சென்ட் பரப்பளவு')}</div>
                      <div className="font-semibold">
                        {(selectedProperty.cent !== undefined && selectedProperty.cent !== null)
                          ? `${selectedProperty.cent} ${t('cent', 'சென்ட்')}`
                          : selectedProperty.totalArea
                            ? `${parseFloat((selectedProperty.totalArea / 435.6).toFixed(4))} ${t('cent', 'சென்ட்')}`
                            : t('Not specified', 'குறிப்பிடப்படவில்லை')}
                      </div>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Property Facing', 'சொத்து திசை')}</div>
                    <div className="font-semibold">
                      {selectedProperty.facing || t('Not specified', 'குறிப்பிடப்படவில்லை')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Occupancy Status', 'குடியேற்ற நிலை')}</div>
                    <div className="font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                      {(selectedProperty as any).occupancyStatus === 'occupied' || (selectedProperty as any).tenant ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                          <span className="text-purple-700 dark:text-purple-300">
                            {t('Occupied (Tenant in Place)', 'குடியேற்றப்பட்டுள்ளது')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="text-emerald-700 dark:text-emerald-300">
                            {t('Vacant Possession', 'காலியாக உள்ளது')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Land Dimensions if available */}
                {selectedProperty.propertyType?.toLowerCase() === 'land' && selectedProperty.landDimensions && (
                  (selectedProperty.landDimensions.ab !== undefined && selectedProperty.landDimensions.ab !== null && selectedProperty.landDimensions.ab !== '') ||
                  (selectedProperty.landDimensions.bc !== undefined && selectedProperty.landDimensions.bc !== null && selectedProperty.landDimensions.bc !== '') ||
                  (selectedProperty.landDimensions.cd !== undefined && selectedProperty.landDimensions.cd !== null && selectedProperty.landDimensions.cd !== '') ||
                  (selectedProperty.landDimensions.da !== undefined && selectedProperty.landDimensions.da !== null && selectedProperty.landDimensions.da !== '')
                ) && (
                    <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                      <div className="text-sm font-semibold">{t('Land Dimensions', 'நில அளவுகள்')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {selectedProperty.landDimensions.ab !== undefined && selectedProperty.landDimensions.ab !== null && selectedProperty.landDimensions.ab !== '' && (
                          <div className="p-2 glass-surface rounded-lg">
                            <span className="text-muted-foreground">A → B:</span> <b>{selectedProperty.landDimensions.ab} ft</b>
                          </div>
                        )}
                        {selectedProperty.landDimensions.bc !== undefined && selectedProperty.landDimensions.bc !== null && selectedProperty.landDimensions.bc !== '' && (
                          <div className="p-2 glass-surface rounded-lg">
                            <span className="text-muted-foreground">B → C:</span> <b>{selectedProperty.landDimensions.bc} ft</b>
                          </div>
                        )}
                        {selectedProperty.landDimensions.cd !== undefined && selectedProperty.landDimensions.cd !== null && selectedProperty.landDimensions.cd !== '' && (
                          <div className="p-2 glass-surface rounded-lg">
                            <span className="text-muted-foreground">C → D:</span> <b>{selectedProperty.landDimensions.cd} ft</b>
                          </div>
                        )}
                        {selectedProperty.landDimensions.da !== undefined && selectedProperty.landDimensions.da !== null && selectedProperty.landDimensions.da !== '' && (
                          <div className="p-2 glass-surface rounded-lg">
                            <span className="text-muted-foreground">D → A:</span> <b>{selectedProperty.landDimensions.da} ft</b>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Description */}
                <div>
                  <h3 className="font-semibold mb-2">{t('Description', 'விவரம்')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedProperty.description?.trim()
                      ? selectedProperty.description
                      : t('No description provided.', 'விவரம் வழங்கப்படவில்லை.')}
                  </p>
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-t border-border/40 glass-nav sticky bottom-0 z-10">
                <Button
                  onClick={handlePreviousProperty}
                  disabled={selectedPropertyIndex === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('Previous', 'முந்தைய')}
                </Button>

                <Button
                  onClick={handleRequestProperty}
                  disabled={createRequest.isPending}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white sm:flex-shrink-0"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                  {selectedProperty.transactionType?.toLowerCase() === 'buy' || selectedProperty.transactionType?.toLowerCase() === 'purchase'
                    ? t('Buy / Express Interest', 'வாங்க / விருப்பம் தெரிவிக்க')
                    : t('Rent / Apply', 'வாடகைக்கு விண்ணப்பிக்க')}
                </Button>

                <div className="text-sm text-muted-foreground text-center hidden sm:block">
                  {selectedPropertyIndex! + 1} / {filteredProperties.length}
                </div>

                <Button
                  onClick={handleNextProperty}
                  disabled={selectedPropertyIndex === filteredProperties.length - 1}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {t('Next', 'அடுத்து')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Auth Dialog */}
        <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />

        {/* Request Property Dialog */}
        <RequestPropertyDialog
          property={selectedProperty}
          open={showRequestDialog}
          onOpenChange={setShowRequestDialog}
          onSuccess={() => {
            setShowRequestDialog(false);
            handleCloseDetail();
          }}
        />
      </div>
    </div>
  );
}
