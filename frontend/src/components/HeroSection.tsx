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
  onSearch = () => undefined,
}: HeroSectionProps) {
  const { t } = useLanguage();

  return (
    <section className="relative left-1/2 -mt-12 mb-16 min-h-[620px] w-screen -translate-x-1/2 overflow-visible bg-slate-900 shadow-2xl sm:-mt-16 sm:mb-[4.5rem] sm:min-h-[650px] lg:min-h-[600px]">
      <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85" alt="Luxury villa at dusk" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/50 to-slate-900/10" />
      <div className="relative min-h-[620px] max-w-2xl px-6 pb-36 pt-12 text-white sm:min-h-[650px] sm:px-10 sm:pt-20 lg:min-h-[600px] lg:px-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-teal-950/80 px-4 py-2 text-[10px] font-bold tracking-[0.16em] text-teal-100 ring-1 ring-white/10">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> {t('YOUR NEXT CHAPTER STARTS HERE', 'உங்கள் அடுத்த அத்தியாயம் இங்கே தொடங்குகிறது')}
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-[1.2] tracking-tight sm:text-6xl sm:leading-[1.18]">
          {t('Find a place that feels like ', 'வீடு போல் உணரும் இடத்தைக் ')}<span className="text-blue-400">{t('home.', 'கண்டறியுங்கள்.')}</span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-slate-200 sm:text-lg">{t('Explore verified properties with your bilingual real-estate assistant.', 'உங்கள் இருமொழி ரியல் எஸ்டேட் உதவியாளருடன் சரிபார்க்கப்பட்ட சொத்துகளை ஆராயுங்கள்.')}</p>
      </div>
      <div className="absolute bottom-[-92px] left-1/2 z-10 w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/95 p-2 text-slate-900 shadow-[0_18px_45px_rgba(27,62,115,0.18)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-white sm:bottom-[-78px] sm:w-[calc(100%-4rem)] sm:p-3 lg:bottom-[-58px] lg:w-[calc(100%-6rem)]">
        <div className="relative z-10 mb-2 flex flex-wrap gap-1 px-2">
          {['purchase', 'rent', 'commercial'].map((tab) => (
            <button key={tab} type="button" onClick={() => onTransactionTypeChange(tab === 'commercial' ? '' : tab)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${transactionType === (tab === 'commercial' ? '' : tab) ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {tab === 'purchase' ? t('Buy', 'வாங்க') : tab === 'rent' ? t('Rent', 'வாடகை') : t('Commercial', 'வணிகம்')}
            </button>
          ))}
        </div>
        <div className="relative z-10 grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
          <label className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900"><MapPin className="h-5 w-5 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Location', 'இடம்')}</span><input value={location} onChange={(e) => onLocationChange(e.target.value)} placeholder={t('City, neighbourhood or ZIP', 'நகரம், பகுதி அல்லது ZIP')} className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" /></span></label>
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 dark:bg-slate-900"><Home className="h-5 w-5 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Property Type', 'சொத்து வகை')}</span><Select value={propertyType || 'all'} onValueChange={(value) => onPropertyTypeChange(value === 'all' ? '' : value)}><SelectTrigger className="h-auto min-h-6 w-full min-w-0 border-0 bg-transparent p-0 pr-5 text-left text-sm shadow-none focus:ring-0"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="all">{t('All Types', 'அனைத்து வகைகள்')}</SelectItem><SelectItem value="flat">Apartment</SelectItem><SelectItem value="house">House</SelectItem><SelectItem value="pg">PG</SelectItem><SelectItem value="land">Land</SelectItem></SelectContent></Select></span></div>
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 dark:bg-slate-900"><SlidersHorizontal className="h-5 w-5 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Budget', 'பட்ஜெட்')}</span><Select value={String(maxPrice)} onValueChange={(value) => onMaxPriceChange(Number(value))}><SelectTrigger className="h-auto min-h-6 w-full min-w-0 border-0 bg-transparent p-0 pr-5 text-left text-sm shadow-none focus:ring-0"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="0">{t('All Budgets', 'அனைத்து பட்ஜெட்கள்')}</SelectItem><SelectItem value="5000000">Under ₹50 L</SelectItem><SelectItem value="10000000">Under ₹1 Cr</SelectItem><SelectItem value="25000000">Under ₹2.5 Cr</SelectItem></SelectContent></Select></span></div>
          <button type="button" onClick={onSearch} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><Search className="h-5 w-5 shrink-0" />{t('Search', 'தேடு')}</button>
        </div>
      </div>
    </section>
  );
}
