import { useState, useMemo } from 'react';
import { Home, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface HeroSectionProps {
  location?: string;
  onLocationChange?: (value: string) => void;
  propertyType?: string;
  onPropertyTypeChange?: (value: string) => void;
  transactionType?: string;
  onTransactionTypeChange?: (value: string) => void;
  maxPrice?: number;
  onMaxPriceChange?: (value: number) => void;
  priceRange?: [number, number];
  onPriceRangeChange?: (range: [number, number]) => void;
  onSearch?: () => void;
}

export default function HeroSection({
  location = '',
  onLocationChange = () => undefined,
  propertyType = '',
  onPropertyTypeChange = () => undefined,
  transactionType = '',
  onTransactionTypeChange = () => undefined,
  maxPrice = 0,
  onMaxPriceChange = () => undefined,
  priceRange,
  onPriceRangeChange,
  onSearch = () => undefined,
}: HeroSectionProps) {
  const { t } = useLanguage();

  // 1. Property Types Configuration
  const allPropertyTypes = useMemo(() => [
    { value: 'all', label: t('All Types', 'அனைத்து வகைகள்') },
    { value: 'flat', label: t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்') },
    { value: 'house', label: t('House', 'வீடு') },
    { value: 'villa', label: t('Villa', 'வில்லா') },
    { value: 'pg', label: t('PG / Hostel', 'பி.ஜி / விடுதி') },
    { value: 'land', label: t('Land / Plot', 'நிலம் / மனை') },
    { value: 'commercial', label: t('Commercial', 'வணிக இடம்') },
    { value: 'farmhouse', label: t('Farm House', 'பண்ணை வீடு') },
  ], [t]);

  const topFourTypes = useMemo(() => allPropertyTypes.slice(0, 4), [allPropertyTypes]);
  const [showAllTypes, setShowAllTypes] = useState(false);

  // 1 & 2: In collapsed mode, display top 4 defaults. If an item outside top 4 is selected,
  // keep it visible directly above "Show More" button with active state & checkmark.
  const displayedPropertyTypes = useMemo(() => {
    if (showAllTypes) {
      return allPropertyTypes;
    }
    const normalizedSelected = (propertyType || '').toLowerCase();
    const isTopFour = ['all', '', 'flat', 'house', 'villa'].includes(normalizedSelected);

    if (!isTopFour) {
      const selectedItem = allPropertyTypes.find(
        (opt) => opt.value.toLowerCase() === normalizedSelected
      );
      if (selectedItem) {
        return [...topFourTypes, selectedItem];
      }
    }
    return topFourTypes;
  }, [showAllTypes, allPropertyTypes, topFourTypes, propertyType]);

  const handlePropertyTypeSelect = (value: string) => {
    const finalValue = value === 'all' ? '' : value;
    onPropertyTypeChange(finalValue);
    // Requirement 2a: Automatically collapse the list back to compact mode on selection
    setShowAllTypes(false);
  };

  // 2. Budget Ranges Configuration
  const budgetOptions = useMemo(() => [
    { value: 'all', label: t('All Budgets', 'அனைத்து பட்ஜெட்கள்'), min: 0, max: 0 },
    { value: 'under-25l', label: t('Under ₹25 L', '₹25 இலட்சத்திற்குள்'), min: 0, max: 2500000 },
    { value: '25l-50l', label: t('₹25 L - ₹50 L', '₹25 இலட்சம் - ₹50 இலட்சம்'), min: 2500000, max: 5000000 },
    { value: '50l-1cr', label: t('₹50 L - ₹1 Cr', '₹50 இலட்சம் - ₹1 கோடி'), min: 5000000, max: 10000000 },
    { value: '1cr-2.5cr', label: t('₹1 Cr - ₹2.5 Cr', '₹1 கோடி - ₹2.5 கோடி'), min: 10000000, max: 25000000 },
    { value: 'above-2.5cr', label: t('Above ₹2.5 Cr', '₹2.5 கோடிக்கு மேல்'), min: 25000000, max: 0 },
  ], [t]);

  const currentBudgetValue = useMemo(() => {
    const min = priceRange ? priceRange[0] : 0;
    const max = priceRange ? priceRange[1] : maxPrice;
    const matched = budgetOptions.find((opt) => opt.min === min && opt.max === max);
    return matched ? matched.value : 'all';
  }, [priceRange, maxPrice, budgetOptions]);

  const handleBudgetChange = (value: string) => {
    const selected = budgetOptions.find((b) => b.value === value);
    const range: [number, number] = selected ? [selected.min, selected.max] : [0, 0];
    if (onPriceRangeChange) {
      onPriceRangeChange(range);
    }
    if (onMaxPriceChange) {
      onMaxPriceChange(range[1]);
    }
  };

  return (
    <section className="relative left-1/2 -mt-12 mb-24 min-h-[540px] w-screen -translate-x-1/2 overflow-visible bg-slate-900 shadow-2xl sm:-mt-16 sm:mb-24 sm:min-h-[560px] lg:mb-16 lg:min-h-[360px]">
      <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85" alt="Luxury villa at dusk" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/50 to-slate-900/10" />
      <div className="relative min-h-[320px] max-w-2xl px-6 pb-36 pt-12 text-white sm:min-h-[250px] sm:px-10 sm:pt-20 lg:min-h-[200px] lg:px-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full glass-pill bg-teal-950/60 px-4 py-2 text-[10px] font-bold tracking-[0.16em] text-teal-100">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> {t('YOUR NEXT CHAPTER STARTS HERE', 'உங்கள் அடுத்த அத்தியாயம் இங்கே தொடங்குகிறது')}
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-[1.2] tracking-tight sm:text-6xl sm:leading-[1.18]">
          {t('Find a place that feels like ', 'வீடு போல் உணரும் இடத்தைக் ')}
          <span className="text-blue-300">{t('home.', 'கண்டறியுங்கள்.')}</span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-slate-200 sm:text-lg">{t('Explore verified properties with your bilingual real-estate assistant.', 'உங்கள் இருமொழி ரியல் எஸ்டேட் உதவியாளருடன் சரிபார்க்கப்பட்ட சொத்துகளை ஆராயுங்கள்.')}</p>
      </div>

      <div className="glass-panel absolute bottom-[-72px] left-1/2 z-10 w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl p-2 text-foreground shadow-2xl backdrop-blur-2xl sm:bottom-[-64px] sm:w-[calc(100%-4rem)] sm:p-3 lg:bottom-[-48px] lg:w-[calc(100%-6rem)]">
        <div className="relative z-10 mb-2 flex flex-wrap gap-1 px-2">
          {[
            { value: '', label: t('All', 'அனைத்தும்') },
            { value: 'purchase', label: t('Buy', 'வாங்க') },
            { value: 'rent', label: t('Rent', 'வாடகை') },
          ].map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => onTransactionTypeChange(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                transactionType === tab.value
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'glass-pill text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative z-10 grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
          {/* 1. Location */}
          <label className="glass-surface flex min-w-0 items-center gap-3 rounded-xl px-4 py-3">
            <MapPin className="h-5 w-5 shrink-0 text-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('Location', 'இடம்')}
              </span>
              <input
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                placeholder={t('City, neighbourhood or ZIP', 'நகரம், பகுதி அல்லது ZIP')}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </span>
          </label>

          {/* 2. Property Type with Show More / Show Less */}
          <div className="glass-surface flex min-w-0 items-center gap-3 rounded-xl px-4 py-2">
            <Home className="h-5 w-5 shrink-0 text-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('Property Type', 'சொத்து வகை')}
              </span>
              <Select
                value={propertyType || 'all'}
                onValueChange={handlePropertyTypeSelect}
              >
                <SelectTrigger className="h-auto min-h-6 w-full min-w-0 border-0 bg-transparent p-0 pr-5 text-left text-sm shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl min-w-[200px]">
                  <div className="space-y-0.5">
                    {displayedPropertyTypes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 px-1">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAllTypes((prev) => !prev);
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-sky-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                    >
                      <span>
                        {showAllTypes
                          ? t('Show Less ↑', 'குறைவாகக் காட்டு ↑')
                          : t('Show More ↓', 'மேலும் காட்டு ↓')}
                      </span>
                    </button>
                  </div>
                </SelectContent>
              </Select>
            </span>
          </div>

          {/* 3. Budget Ranges */}
          <div className="glass-surface flex min-w-0 items-center gap-3 rounded-xl px-4 py-2">
            <SlidersHorizontal className="h-5 w-5 shrink-0 text-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('Budget', 'பட்ஜெட்')}
              </span>
              <Select value={currentBudgetValue} onValueChange={handleBudgetChange}>
                <SelectTrigger className="h-auto min-h-6 w-full min-w-0 border-0 bg-transparent p-0 pr-5 text-left text-sm shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl min-w-[190px]">
                  {budgetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </div>

          {/* 4. Search Button */}
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/35 hover:-translate-y-0.5 cursor-pointer"
          >
            <Search className="h-5 w-5 shrink-0" />
            {t('Search', 'தேடு')}
          </button>
        </div>
      </div>
    </section>
  );
}
