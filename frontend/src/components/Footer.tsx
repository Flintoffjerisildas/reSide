import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container py-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <p className="text-sm flex items-center gap-1">
            Made with <span className="text-red-500">❤️</span> by Krishub
          </p>
        </div>
      </div>
    </footer>
  );
}
