import { ArrowUpRight, Building2, CheckCircle2, Globe2, Home, Mic2, Search, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function AboutUs() {
  const { t } = useLanguage();

  return (
    <main className="container py-10 sm:py-16">
      <section className="glass-surface overflow-hidden rounded-[2rem]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[22rem] overflow-hidden bg-slate-900 lg:min-h-full">
            <img
              src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85"
              alt={t('Modern Reside home interior', 'Reside நவீன வீட்டு உட்புறம்')}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/75 via-blue-900/30 to-teal-950/65" />
            <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-7 text-white sm:p-10">
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
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t('Find more than a property.', 'ஒரு சொத்தை விட அதிகமாகக் கண்டறியுங்கள்.')}
            </h1>
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

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { icon: CheckCircle2, text: t('Trusted discovery', 'நம்பகமான தேடல்') },
                { icon: Globe2, text: t('Bilingual support', 'இருமொழி ஆதரவு') },
                { icon: ShieldCheck, text: t('Secure access', 'பாதுகாப்பான அணுகல்') },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/55 px-3 py-2.5 text-sm font-medium text-foreground dark:border-blue-900/70 dark:bg-slate-950/30">
                  <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Home,
            title: t('List your property', 'உங்கள் சொத்தை பட்டியலிடுங்கள்'),
            text: t('Reach genuine buyers and tenants with our trusted platform.', 'நம்பகமான தளத்தின் மூலம் உண்மையான வாங்குபவர்களை அடையுங்கள்.'),
          },
          {
            icon: Search,
            title: t('Smart property search', 'ஸ்மார்ட் சொத்து தேடல்'),
            text: t('Find the perfect home with advanced filters and recommendations.', 'மேம்பட்ட வடிகட்டிகளுடன் சரியான வீட்டைக் கண்டறியுங்கள்.'),
          },
          {
            icon: Mic2,
            title: t('Tamil & English voice assistant', 'தமிழ் மற்றும் ஆங்கில குரல் உதவியாளர்'),
            text: t('Ask, search and explore properties in your preferred language.', 'உங்கள் விருப்ப மொழியில் கேட்டு சொத்துகளை ஆராயுங்கள்.'),
          },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="glass-surface group relative overflow-hidden rounded-2xl p-6 transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="pr-8 text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            <span className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border transition group-hover:bg-blue-600 group-hover:text-white">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
