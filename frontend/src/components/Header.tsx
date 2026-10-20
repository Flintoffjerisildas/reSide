import { Building2, Moon, Sun, LogIn, LogOut, User, Menu, LayoutDashboard, Home, Globe2, Grid2X2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeaderProps {
  onLogout?: () => void;
  onDashboardClick?: () => void;
  onHomeClick?: () => void;
  onAboutClick?: () => void;
  onRentClick?: () => void;
  onBuyClick?: () => void;
  isDashboardActive?: boolean;
  onLoginClick?: () => void;
}

export default function Header({ 
  onLogout, 
  onDashboardClick,
  onHomeClick,
  onAboutClick,
  onRentClick,
  onBuyClick,
  isDashboardActive = false,
  onLoginClick
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout, isInitializing } = useAuth();
  const { data: userProfile } = useGetCallerUserProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<'home' | 'about' | 'rent' | 'buy' | 'contact'>('home');
  const { language, setLanguage, t } = useLanguage();

  const isAuthenticated = !!user;
  const isLoggingIn = isInitializing; // Simplified

  const navClass = (item: typeof activeNav) =>
    `whitespace-nowrap rounded-full px-3 py-2 transition-all hover:-translate-y-0.5 hover:bg-white/70 hover:text-blue-700 dark:hover:bg-blue-950/70 dark:hover:text-blue-200 lg:px-4 ${
      activeNav === item
        ? 'bg-white/85 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/80 dark:text-blue-200 dark:ring-blue-800'
        : ''
    }`;

  const handleHomeNavigation = () => {
    setActiveNav('home');
    onHomeClick?.();
  };

  const handleRentNavigation = () => {
    setActiveNav('rent');
    onRentClick?.();
  };

  const handleBuyNavigation = () => {
    setActiveNav('buy');
    onBuyClick?.();
  };

  const handleLogout = async () => {
    logout();
    if (onLogout) {
      onLogout();
    }
    setMobileMenuOpen(false);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('Admin', 'நிர்வாகம்');
      case 'owners':
      case 'Owner':
        return t('Owner', 'உரிமையாளர்');
      case 'brokersBuilders':
        return t('Broker/Builder', 'தரகர்/கட்டுபவர்');
      case 'customers':
      case 'Tenant':
      case 'Buyer':
        return t('Customer', 'வாடிக்கையாளர்');
      default:
        return role;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-blue-100/80 bg-gradient-to-r from-white/90 via-blue-50/85 to-emerald-50/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl transition-colors dark:border-blue-900/70 dark:bg-none dark:bg-slate-950/85 dark:shadow-black/20">
      <div className="container flex min-h-[76px] items-center gap-4 py-3 lg:gap-6">
        <div 
          className="flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900 transition-all hover:-translate-y-0.5 hover:text-blue-700 dark:text-white dark:hover:text-blue-200"
          onClick={handleHomeNavigation}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-transform hover:rotate-3 hover:scale-105"><Building2 className="h-5 w-5" /></span>
          <span>Reside</span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden min-w-0 flex-1 items-center justify-between gap-4 lg:flex">
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 text-sm font-medium text-muted-foreground">
            <button type="button" onClick={handleHomeNavigation} className={navClass('home')}>
              {t('Home', 'முகப்பு')}
            </button>
            <button type="button" onClick={() => { setActiveNav('about'); onAboutClick?.(); }} className={navClass('about')}>
              {t('About us', 'எங்களைப் பற்றி')}
            </button>
            <button type="button" onClick={handleRentNavigation} className={navClass('rent')}>
              {t('Rent', 'வாடகை')}
            </button>
            <button type="button" onClick={handleBuyNavigation} className={navClass('buy')}>
              {t('Buy', 'வாங்க')}
            </button>
            <button type="button" onClick={() => setActiveNav('contact')} className={navClass('contact')}>
                {t('Contact', 'தொடர்பு')}
            </button>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
          <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
            <SelectTrigger className="h-10 w-auto min-w-[108px] rounded-full border-blue-100 bg-white/75 px-3 shadow-sm transition-colors hover:bg-white dark:border-blue-800 dark:bg-slate-900/70 dark:hover:bg-slate-900">
              <Globe2 className="mr-1 h-4 w-4 text-blue-600" />
              <SelectValue placeholder={t('Language', 'மொழி')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ta">தமிழ்</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-full text-slate-600 transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950/70 dark:hover:text-blue-200"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {isAuthenticated && (
            <Button
              variant="default"
              size="sm"
              onClick={onDashboardClick}
              className="hidden gap-2 rounded-full bg-blue-600 px-4 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 lg:flex"
            >
              {isDashboardActive ? <Home className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
              {isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}
            </Button>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="max-w-[180px] gap-2 rounded-full border-blue-100 bg-white/70 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white dark:border-blue-800 dark:bg-slate-900/70 dark:hover:bg-slate-900">
                  <User className="h-4 w-4" />
                  <span className="max-w-[150px] truncate">
                    {userProfile?.name || user?.name || t('User', 'பயனர்')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {t('My Account', 'என் கணக்கு')}
                  {(((userProfile as any)?.internalRole === 'admin') || userProfile?.role || user?.role) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {getRoleLabel(((userProfile as any)?.internalRole === 'admin') ? 'admin' : (userProfile?.role || user?.role || ''))}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDashboardClick}>
                  {isDashboardActive ? <Home className="mr-2 h-4 w-4" /> : <LayoutDashboard className="mr-2 h-4 w-4" />}
                  {isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('Logout', 'வெளியேறு')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => {
                if (onLoginClick) {
                  onLoginClick();
                }
              }}
              disabled={isLoggingIn}
              className="rounded-full bg-blue-600 px-5 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <LogIn className="mr-2 h-4 w-4" />
              {t('Login', 'உள்நுழைய')}
            </Button>
          )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t('Menu', 'பட்டியல்')}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center justify-between">
                  <span>{t('Theme', 'தீம்')}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <span>{t('Language', 'மொழி')}</span>
                  <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder={t('Language', 'மொழி')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ta">தமிழ்</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setActiveNav('about');
                    onAboutClick?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  {t('About us', 'எங்களைப் பற்றி')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleRentNavigation();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  {t('Rent', 'வாடகை')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleBuyNavigation();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  {t('Buy', 'வாங்க')}
                </Button>

                {isAuthenticated ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                      <User className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">{userProfile?.name || user?.name || 'User'}</span>
                        {(userProfile?.role || user?.role) && (
                          <span className="text-xs text-muted-foreground">
                            {getRoleLabel(userProfile?.role || user?.role || '')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="default" onClick={onDashboardClick} className="w-full justify-start">
                      {isDashboardActive ? <Home className="mr-2 h-4 w-4" /> : <LayoutDashboard className="mr-2 h-4 w-4" />}
                      {isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}
                    </Button>
                    <Button variant="destructive" onClick={handleLogout} className="w-full justify-start">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('Logout', 'வெளியேறு')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (onLoginClick) {
                        onLoginClick();
                      }
                      setMobileMenuOpen(false);
                    }}
                    className="w-full"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('Login', 'உள்நுழைய')}
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
