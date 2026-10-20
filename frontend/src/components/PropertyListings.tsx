import { useEffect, useMemo, useState } from 'react';
import { useGetAllProperties } from '../hooks/useQueries';
import PropertyCard from './PropertyCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, ChevronLeft, ChevronRight, Send, Search, PlayCircle, MapPin, Home, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Property } from '../types';
import AuthDialog from './AuthDialog';
import RequestPropertyDialog from './RequestPropertyDialog';
import { useCreateRequest } from '../hooks/useQueries';
import { toast } from 'sonner';
import { translateText } from '../lib/api';
import{
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
export default function PropertyListings() {
  const { data: properties = [], isLoading } = useGetAllProperties();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const createRequest = useCreateRequest();

  // Filter states
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [transactionType, setTransactionType] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Filter logic
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const propertyLocation = String((property as any)?.location ?? '').toLowerCase();
      const filterLocation = String(location ?? '').toLowerCase();
      const locationMatch = propertyLocation.includes(filterLocation);

      const propertyPropertyType = String((property as any)?.propertyType ?? '');
      const typeMatch = (!propertyType || propertyType === 'all') ? true : propertyPropertyType === propertyType ;

      const propertyTransactionType = String((property as any)?.transactionType ?? '');
      const transactionMatch = (transactionType && transactionType !== 'all') ? propertyTransactionType === transactionType : true;

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
    <div className="container py-4 sm:py-6 lg:py-0 px-4 sm:px-6">
      <div className="mx-auto max-w-8xl space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden  border border-white/10 shadow-2xl bg-zinc-950 min-h-[520px] sm:min-h-[580px] lg:min-h-[620px] xl:min-h-[660px] flex flex-col justify-between">
          {/* Background Villa Image */}
          <img
            src="https://truevae.com/wp-content/uploads/2026/10/Twilight-Villa-Overlooking-the-City-skyline.jpg"
            alt="Discover Luxury Homes"
            className="absolute inset-0 h-full w-full object-cover object-[75%_center] lg:object-center pointer-events-none select-none transition-transform duration-1000 scale-100 hover:scale-105"
          />

          {/* Gradients tailored to image lighting and text contrast */}
          {/* 1. Left-to-right dusk gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/30 md:from-black/90 md:via-black/60 md:to-transparent lg:from-black/85 lg:via-black/45 lg:to-transparent pointer-events-none" />

          {/* 2. Bottom subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

          {/* 3. Top subtle vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Hero Content */}
          <div className="relative z-10 flex flex-col justify-between flex-1 p-6 sm:p-10 md:p-12 lg:p-14 xl:p-16">
            {/* Top / Main Hero Content */}
            <div className="max-w-2xl">
              {/* Category / Pre-heading */}
              <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-[#e8c98d] uppercase mb-3 sm:mb-4 drop-shadow-sm">
                {t('FIND YOUR PERFECT PLACE', 'உங்கள் சரியான இடத்தை கண்டறியுங்கள்')}
              </p>

              {/* Headline */}
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] mb-3 sm:mb-5 drop-shadow-md">
                {t('Discover Homes', 'உங்கள் விருப்பத்திற்கேற்ற இல்லங்கள்')} <br />
                <span className="bg-gradient-to-r from-[#FFF5E1] via-[#E8C98D] to-[#D4AA63] bg-clip-text text-transparent">
                  {t('That Feel Like You', 'உங்களை போன்ற உணர்வு')}
                </span>
              </h1>

              {/* Subheading / Description */}
              <p className="text-sm sm:text-base lg:text-lg text-gray-200/90 max-w-xl font-normal leading-relaxed mb-6 sm:mb-8 drop-shadow-sm">
                {t(
                  'Buy, Rent, or Explore Premium Properties with Reside – Your Smart, Bilingual Real Estate Companion.',
                  'Reside உடன் பிரீமியம் சொத்துகளை வாங்குங்கள், வாடகைக்கு எடுங்கள் அல்லது ஆராயுங்கள் – உங்கள் இருமொழி ரியல் எஸ்டேட் துணை.'
                )}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {/* Explore Properties Button */}
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('explore-properties');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="group inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base text-zinc-950 bg-gradient-to-r from-[#F5D289] via-[#E8B862] to-[#DC9F42] shadow-[0_4px_22px_rgba(232,184,98,0.4)] hover:shadow-[0_6px_28px_rgba(232,184,98,0.6)] hover:brightness-105 active:scale-95 transition-all duration-300 cursor-pointer"
                >
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-950 stroke-[2.5]" />
                  <span>{t('Explore Properties', 'சொத்துகளை ஆராயுங்கள்')}</span>
                </button>

                {/* Watch Video Button */}
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="group inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full font-medium text-sm sm:text-base text-white bg-black/40 hover:bg-white/10 backdrop-blur-md border border-white/30 hover:border-white/60 active:scale-95 transition-all duration-300 shadow-lg cursor-pointer"
                >
                  <PlayCircle className="w-5 h-5 text-white/90 group-hover:text-white transition-colors" />
                  <span>{t('Watch Video', 'வீடியோ பாருங்கள்')}</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Stats & Luxury Living Badge */}
            <div className="mt-8 sm:mt-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              {/* Stats Counters */}
              <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 flex-wrap sm:flex-nowrap">
                {/* Stat 1 */}
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">5K+</div>
                  <div className="text-xs sm:text-sm text-gray-300 font-medium">
                    {t('Verified Listings', 'சரிபார்க்கப்பட்டவை')}
                  </div>
                </div>

                <div className="h-8 sm:h-10 w-px bg-white/20" />

                {/* Stat 2 */}
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">2K+</div>
                  <div className="text-xs sm:text-sm text-gray-300 font-medium">
                    {t('Happy Customers', 'வாடிக்கையாளர்கள்')}
                  </div>
                </div>

                <div className="h-8 sm:h-10 w-px bg-white/20" />

                {/* Stat 3 */}
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">50+</div>
                  <div className="text-xs sm:text-sm text-gray-300 font-medium">
                    {t('Cities Covered', 'நகரங்கள்')}
                  </div>
                </div>
              </div>

              {/* Luxury Living Floating Card */}
              <div className="self-start lg:self-end">
                <div className="inline-flex items-center gap-3.5 px-4 sm:px-5 py-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-amber-400/40 hover:bg-black/70 transition-all duration-300">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                    <MapPin className="w-5 h-5 fill-amber-400/30 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-semibold text-white tracking-wide">
                      {t('Luxury Living', 'ஆடம்பர வாழ்க்கை')}
                    </div>
                    <div className="text-xs text-white/70 font-medium tracking-wide">
                      {t('Modern • Spacious • Elegant', 'நவீன • விசாலமான • நேர்த்தியான')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg sm:rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex gap-3 items-start">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
                <span className="text-xl sm:text-2xl"><Home className='text-primary' /></span>
              </div>
              <div>
                <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
                  {t('List Properties', 'சொத்துகளை பட்டியலிடுங்கள்')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Owners and brokers can easily add properties to our platform', 'உரிமையாளர்கள் மற்றும் தரகர்கள் எளிதாக சொத்துகளை சேர்க்கலாம்')}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg sm:rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex gap-3 items-start">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
                <span className="text-xl sm:text-2xl"><Search className='text-primary' /></span>
              </div>
              <div>
                <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
                  {t('Find Properties', 'சொத்துகளை கண்டுபிடிக்கவும்')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Customers can search for properties matching their requirements', 'வாடிக்கையாளர்கள் தங்கள் தேவைகளுக்கு ஏற்ற சொத்துகளை தேடலாம்')}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg sm:rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
            <div className="flex gap-3 items-start">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
                <span className="text-xl sm:text-2xl"><Mic className='text-primary' /></span>
              </div>
              <div>
                <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
                  {t('Voice Support', 'குரல் ஆதரவு')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Speak in Tamil or English and get voice responses', 'தமிழ் அல்லது ஆங்கிலத்தில் பேசி குரல் பதில்களைப் பெறுங்கள்')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Property Listings */}
        <div id="explore-properties" className="space-y-4 sm:space-y-6 scroll-mt-8">
          {/* Filters Section */}
          <div className="rounded-lg sm:rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-4 sm:p-6 shadow-sm">
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
              <div className="space-y-2 ">
                <label className="text-sm font-medium text-foreground">
                  {t('Property Type', 'சொத்து வகை')}
                </label>
                <Select value={propertyType} onValueChange={(value) => setPropertyType(value)}>
                  <SelectTrigger className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm outline-none focus:outline-none focus-visible:outline-none data-[focus]:ring-2 data-[focus]:ring-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/50">
                    <SelectValue placeholder={t('All Types', 'அனைத்து வகைகளும்')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Types', 'அனைத்து வகைகளும்')}</SelectItem>
                    <SelectItem value="flat">{t('Flat / Apartment', 'அடுக்குமாடி குடியிருப்பு')}</SelectItem>
                    <SelectItem value="house">{t('House', 'வீடு')}</SelectItem>
                    <SelectItem value="pg">{t('PG / Hostel', 'விடுதி / பி.ஜி')}</SelectItem>
                    <SelectItem value="land">{t('Land', 'நிலம்')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Looking For */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('Looking For', 'தேடுகிறேன்')}
                </label>
                <Select value={transactionType} onValueChange={(value) => setTransactionType(value)}>
                  <SelectTrigger className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm outline-none focus:outline-none focus-visible:outline-none data-[focus]:ring-2 data-[focus]:ring-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/50">
                    <SelectValue placeholder={t('All', 'அனைத்தும்')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All', 'அனைத்தும்')}</SelectItem>
                    <SelectItem value="rent">{t('Rent', 'வாடகை')}</SelectItem>
                    <SelectItem value="lease">{t('Lease', 'குத்தகை')}</SelectItem>
                    <SelectItem value="purchase">{t('Purchase', 'கொள்ளிப் பெறுதல்')}</SelectItem>
                  </SelectContent>
                </Select>
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
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {t('Available Properties', 'கிடைக்கும் சொத்துகள்')}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('Browse our latest listings', 'எங்கள் சமீபத்திய பட்டியல்களை உலாவவும்')}
                </p>
              </div>
              {!isLoading && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {filteredProperties.length} / {properties.length} {t(properties.length === 1 ? 'property' : 'properties', 'சொத்துகள்')}
                </div>
              )}
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
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <span>
                      <MapPin className="w-5 h-5 inline" />{language === 'ta' ? (selectedLocationTa || selectedProperty.location) : selectedProperty.location}
                    </span>
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
                    <span className="text-4xl text-muted-foreground"><Home /></span>
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
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Bedrooms', 'படுக்கையறைகள்')}</div>
                    <div className="font-semibold">
                      {selectedProperty.bedrooms
                        ? `${selectedProperty.bedrooms} BHK`
                        : t('Not specified', 'குறிப்பிடப்படவில்லை')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">{t('Property Facing', 'சொத்து திசை')}</div>
                    <div className="font-semibold">
                      {selectedProperty.facing || t('Not specified', 'குறிப்பிடப்படவில்லை')}
                    </div>
                  </div>
                </div>

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

        {/* Video Tour Modal */}
        <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-zinc-950 border-white/20 text-white shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
              <DialogTitle className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                {t('Discover Luxury Living – Video Tour', 'ஆடம்பர வாழ்க்கை – வீடியோ உலா')}
              </DialogTitle>
            </DialogHeader>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src="https://www.youtube-nocookie.com/embed/LXb3EKWsInQ?autoplay=1"
                title="Luxury Villa Tour"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/90 text-xs sm:text-sm text-gray-300">
              <p>
                {t('Experience architectural excellence and bespoke luxury homes with Reside.', 'Reside உடன் கட்டடக் கலை மேன்மை மற்றும் பிரத்யேக இல்லங்களை அனுபவியுங்கள்.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowVideoModal(false);
                  const el = document.getElementById('explore-properties');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-semibold hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
              >
                {t('View Available Homes', 'கிடைக்கும் இல்லங்களைக் காண்க')}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
