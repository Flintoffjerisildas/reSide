import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border/70 bg-white/70 backdrop-blur-xl dark:bg-[#0c1a2b]/85">
      <div className="container flex min-h-[64px] items-center justify-center px-4 py-4">
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Reside · {t('Better homes, brighter futures.', 'சிறந்த வீடுகள், பிரகாசமான எதிர்காலம்.')}
        </p>
      </div>
    </footer>
  );
}
