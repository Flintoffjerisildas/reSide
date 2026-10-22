import { Building2, CheckCircle2, Home, ImagePlus, MapPin, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import PropertyForm from './PropertyForm';

interface ListPropertyPageProps {
  onClose: () => void;
}

export default function ListPropertyPage({ onClose }: ListPropertyPageProps) {
  const { t } = useLanguage();

  return (
    <main className="container px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {t('List your property', 'உங்கள் சொத்தைப் பட்டியலிடுங்கள்')}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('Reach the right people for your property.', 'உங்கள் சொத்திற்கான சரியான நபர்களை அடையுங்கள்.')}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t(
              'Share your property details, add photos, and connect with genuine buyers and tenants on Reside.',
              'உங்கள் சொத்து விவரங்களையும் புகைப்படங்களையும் பகிர்ந்து, Reside மூலம் உண்மையான வாங்குபவர்களையும் வாடகையாளர்களையும் இணைக்கவும்.'
            )}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="glass-surface h-fit rounded-[2rem] p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">
              {t('A simple way to list', 'எளிய பட்டியலிடும் வழி')}
            </h2>
            <div className="mt-6 space-y-5">
              {[
                { icon: Home, text: t('Describe your property', 'உங்கள் சொத்தை விவரிக்கவும்') },
                { icon: ImagePlus, text: t('Add clear property photos', 'தெளிவான சொத்து புகைப்படங்களைச் சேர்க்கவும்') },
                { icon: MapPin, text: t('Help people find its location', 'மக்கள் இருப்பிடத்தைக் கண்டறிய உதவுங்கள்') },
                { icon: ShieldCheck, text: t('Build trust with complete details', 'முழுமையான விவரங்களுடன் நம்பிக்கையை உருவாக்குங்கள்') },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{text}</span>
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                </div>
              ))}
            </div>
          </aside>

          <section className="glass-surface rounded-[2rem] p-3 sm:p-5">
            <PropertyForm open onOpenChange={(open) => !open && onClose()} />
          </section>
        </div>
      </div>
    </main>
  );
}
