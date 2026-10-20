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
}

export default function PropertyListings({ showAbout = false, initialTransactionType = '' }: PropertyListingsProps) {
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
    if (normalized === 'pg' || normalized === 'pgs') {
      return 'pg';
    }
    if (normalized === 'land' || normalized === 'plot' || normalized === 'plots') {
      return 'land';
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
      const priceMatch = priceRange[1] === 0 || (propertyPrice >= priceRange[0] && propertyPrice <= priceRange[1]);
      const availabilityMatch = !property.tenant; // Only show properties without a tenant (available)
      
      return locationMatch && typeMatch && transactionMatch && priceMatch && availabilityMatch;
    });
  }, [properties, location, propertyType, transactionType, priceRange]);

  // Check if any filters are active
  const hasActiveFilters = location || propertyType || transactionType || priceRange[0] !== 0 || priceRange[1] !== 0;

  const resetFilters = () => {
    setLocation('');
    setPropertyType('');
    setTransactionType('');
    setPriceRange([0, 0]);
  };

  const handlePropertyTypeChange = (value: string) => {
    setPropertyType(value);
    requestAnimationFrame(() => {
      document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Navigation for property details view
  const selectedProperty = selectedPropertyIndex !== null ? filteredProperties[selectedPropertyIndex] : null;
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
      setSelectedPropertyIndex(selectedPropertyIndex - 1);
      setCurrentImageIndex(0);
    }
  };

  const handleNextProperty = () => {
    if (selectedPropertyIndex !== null && selectedPropertyIndex < filteredProperties.length - 1) {
      setSelectedPropertyIndex(selectedPropertyIndex + 1);
      setCurrentImageIndex(0);
    }
  };

  const handleCardClick = (index: number) => {
    setSelectedPropertyIndex(index);
    setCurrentImageIndex(0);
  };

  const handleCloseDetail = () => {
    setSelectedPropertyIndex(null);
    setCurrentImageIndex(0);
  };

  const handleRequestProperty = () => {
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    if (!selectedProperty) return;

    const tx = String((selectedProperty as any)?.transactionType ?? '').toLowerCase();
    const requestType = tx === 'rent' ? 'rent' : 'buy';
    const propertyId = (selectedProperty as any)?.id || (selectedProperty as any)?._id;
    if (!propertyId) {
      toast.error(t('Unable to send request', 'கோரிக்கையை அனுப்ப முடியவில்லை'));
      return;
    }
    
    createRequest.mutate(
      { propertyId, type: requestType },
      {
        onSuccess: () => {
          toast.success(t('Request sent successfully!', 'கோரிக்கை வெற்றிகரமாக அனுப்பப்பட்டது!'));
          handleCloseDetail();
        },
        onError: (error: any) => {
          const msg = error.response?.data?.msg || t('Failed to send request', 'கோரிக்கையை அனுப்ப முடியவில்லை');
          toast.error(msg);
        }
      }
    );
  };

  return (
    <div className="container py-4 sm:py-6 lg:py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <HeroSection
          location={location}
          onLocationChange={setLocation}
          propertyType={propertyType}
          onPropertyTypeChange={handlePropertyTypeChange}
          transactionType={transactionType}
          onTransactionTypeChange={setTransactionType}
          maxPrice={priceRange[1]}
          onMaxPriceChange={(value) => setPriceRange([0, value])}
          onSearch={() => document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth' })}
        />

        <section id="about-us" className="scroll-mt-32 overflow-hidden rounded-[2rem] border border-blue-100/80 bg-card shadow-xl shadow-blue-950/10 dark:border-blue-900/70 dark:shadow-black/20">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative min-h-[20rem] overflow-hidden bg-slate-900 lg:min-h-full">
                <img
                  src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85"
                  alt={t('Modern Reside home interior', 'Reside நவீன வீட்டு உட்புறம்')}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/65 via-blue-900/25 to-teal-950/55" />
                <div className="relative flex h-full flex-col justify-between p-7 text-white sm:p-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-950/30">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="mt-16">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                      {t('About Reside', 'Reside பற்றி')}
                    </p>
                    <p className="mt-3 max-w-sm text-3xl font-semibold leading-tight">
                      {t('Your Space, Your Story, Your Home.', 'உங்கள் இடம், உங்கள் கதை, உங்கள் வீடு.')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-7 sm:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {t('Welcome to Reside', 'Reside-க்கு வரவேற்கிறோம்')}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {t('Find more than a property.', 'ஒரு சொத்தை விட அதிகமாகக் கண்டறியுங்கள்.')}
                </h2>
                <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    {t(
                      'Welcome to Reside, your trusted destination for discovering properties and simplifying your housing journey. Whether you are looking for your dream home, searching for a rental property, or listing a property of your own, Reside makes the process simple, convenient, and accessible.',
                      'சொத்துகளைக் கண்டறிந்து உங்கள் வீட்டு பயணத்தை எளிதாக்கும் நம்பகமான தளம் Reside. உங்கள் கனவு வீட்டைத் தேடினாலும், வாடகை வீட்டைத் தேடினாலும் அல்லது உங்கள் சொத்தைப் பட்டியலிட்டாலும், Reside செயல்முறையை எளிமையாகவும் வசதியாகவும் அணுகக்கூடியதாகவும் மாற்றுகிறது.'
                    )}
                  </p>
                  <p>
                    {t(
                      'Our platform brings property seekers, owners, and brokers together with smart search options, personalized filters, and a user-friendly experience. With support for Tamil and English voice interactions, we aim to make property discovery easier for everyone.',
                      'ஸ்மார்ட் தேடல், தனிப்பயன் வடிகட்டிகள் மற்றும் எளிய அனுபவத்தின் மூலம் சொத்தைத் தேடுபவர்கள், உரிமையாளர்கள் மற்றும் தரகர்களை எங்கள் தளம் இணைக்கிறது. தமிழ் மற்றும் ஆங்கில குரல் தொடர்பு ஆதரவுடன், அனைவருக்கும் சொத்து தேடலை எளிதாக்குகிறோம்.'
                    )}
                  </p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    t('Trusted property discovery', 'நம்பகமான சொத்து தேடல்'),
                    t('Tamil and English support', 'தமிழ் மற்றும் ஆங்கில ஆதரவு'),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/55 px-3 py-2.5 text-sm font-medium text-foreground dark:border-blue-900/70 dark:bg-slate-950/30">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-7 border-l-2 border-primary pl-4 text-sm font-semibold italic text-foreground">
                  {t(
                    'At Reside, finding the right place is more than finding a property — it is where life happens, memories grow, and dreams become reality.',
                    'Reside-ல் சரியான இடத்தைக் கண்டுபிடிப்பது ஒரு சொத்தை கண்டுபிடிப்பதை விட அதிகம் — வாழ்க்கை நிகழும், நினைவுகள் வளரும், கனவுகள் நனவாகும் இடம் அது.'
                  )}
                </p>
                <p className="mt-5 text-base font-semibold text-primary">
                  {t('Reside — Find Your Place. Feel at Home.', 'Reside — உங்கள் இடத்தைக் கண்டறியுங்கள். வீட்டைப் போல் உணருங்கள்.')}
                </p>
              </div>
            </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Home, title: t('List your property', 'உங்கள் சொத்தை பட்டியலிடுங்கள்'), text: t('Reach genuine buyers and tenants with our trusted platform.', 'நம்பகமான தளத்தின் மூலம் உண்மையான வாங்குபவர்களை அடையுங்கள்.') },
            { icon: Search, title: t('Smart property search', 'ஸ்மார்ட் சொத்து தேடல்'), text: t('Find the perfect home with advanced filters and recommendations.', 'மேம்பட்ட வடிகட்டிகளுடன் சரியான வீட்டைக் கண்டறியுங்கள்.') },
            { icon: Mic2, title: t('Tamil & English voice assistant', 'தமிழ் மற்றும் ஆங்கில குரல் உதவியாளர்'), text: t('Ask, search and explore properties in your preferred language.', 'உங்கள் விருப்ப மொழியில் கேட்டு சொத்துகளை ஆராயுங்கள்.') },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950"><Icon className="h-5 w-5" /></div>
              <h3 className="pr-8 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              <span className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border transition group-hover:bg-blue-600 group-hover:text-white"><ArrowUpRight className="h-4 w-4" /></span>
            </div>
          ))}
        </div>

        {/* Property Listings */}
        <div className="space-y-4 sm:space-y-6">
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
                  <option value="pg">PG</option>
                  <option value="land">{t('Land', 'நிலம்')}</option>
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
          <div id="property-listings">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950"><Home className="h-4 w-4" /></span>
                  {t('Homes picked for you', 'உங்களுக்காக தேர்ந்தெடுக்கப்பட்ட வீடுகள்')}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Explore handpicked spaces worth seeing', 'பார்க்க வேண்டிய சிறந்த இடங்களை ஆராயுங்கள்')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: '', label: t('All', 'அனைத்தும்') },
                  { value: 'flat', label: t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்') },
                  { value: 'house', label: t('House', 'வீடு') },
                  { value: 'pg', label: 'PG' },
                  { value: 'land', label: t('Land', 'நிலம்') },
                ].map((item) => (
                  <button
                    key={item.value || 'all'}
                    type="button"
                    onClick={() => handlePropertyTypeChange(item.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      propertyType === item.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {!isLoading && (
                  <span className="hidden text-xs text-muted-foreground xl:inline">
                    {filteredProperties.length} {t('available', 'கிடைக்கும்')}
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-40 sm:h-48 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="rounded-lg sm:rounded-xl border border-dashed border-border bg-muted/30 p-8 sm:p-12 text-center">
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-muted">
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
              <div className="rounded-lg sm:rounded-xl border border-dashed border-border bg-muted/30 p-8 sm:p-12 text-center">
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-muted">
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
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProperties.map((property, index) => (
                  <div
                    key={String((property as any)?.id ?? (property as any)?._id ?? index)}
                    onClick={() => handleCardClick(index)}
                    className="cursor-pointer transition-transform hover:scale-105"
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
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-background rounded-xl max-w-4xl w-full my-8">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b bg-background">
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
                {selectedImages.length > 0 ? (
                  <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                    <img
                      src={selectedImages[currentImageIndex]}
                      alt={language === 'ta' ? (selectedTitleTa || selectedProperty.title) : selectedProperty.title}
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
                  <div className="relative rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
                    <span className="text-4xl">🏠</span>
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
                        <div className="p-2 bg-background rounded border">
                          <span className="text-muted-foreground">A → B:</span> <b>{selectedProperty.landDimensions.ab} ft</b>
                        </div>
                      )}
                      {selectedProperty.landDimensions.bc !== undefined && selectedProperty.landDimensions.bc !== null && selectedProperty.landDimensions.bc !== '' && (
                        <div className="p-2 bg-background rounded border">
                          <span className="text-muted-foreground">B → C:</span> <b>{selectedProperty.landDimensions.bc} ft</b>
                        </div>
                      )}
                      {selectedProperty.landDimensions.cd !== undefined && selectedProperty.landDimensions.cd !== null && selectedProperty.landDimensions.cd !== '' && (
                        <div className="p-2 bg-background rounded border">
                          <span className="text-muted-foreground">C → D:</span> <b>{selectedProperty.landDimensions.cd} ft</b>
                        </div>
                      )}
                      {selectedProperty.landDimensions.da !== undefined && selectedProperty.landDimensions.da !== null && selectedProperty.landDimensions.da !== '' && (
                        <div className="p-2 bg-background rounded border">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-t bg-background sticky bottom-0">
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
                  {createRequest.isPending ? t('Sending...', 'அனுப்பிக்கொண்டிருக்கிறது...') : t('Request Property', 'சொத்தைக் கோரவும்')}
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
