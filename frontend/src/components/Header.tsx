import { Building2, Moon, Sun, LogIn, LogOut, User, Menu, LayoutDashboard, Home, Globe2, Grid2X2, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useGetCallerUserProfile, useGetNotifications } from '../hooks/useQueries';
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
  onNotificationsClick?: () => void;
}

export default function Header({ 
  onLogout, 
  onDashboardClick,
  onHomeClick,
  onAboutClick,
  onRentClick,
  onBuyClick,
  isDashboardActive = false,
  onLoginClick,
  onNotificationsClick
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout, isInitializing } = useAuth();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: notificationsData } = useGetNotifications();
  const unreadCount = notificationsData?.unreadCount || 0;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const isAuthenticated = !!user;
  const isLoggingIn = isInitializing; // Simplified

  const handleHomeNavigation = () => {
    onHomeClick?.();
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
    <header className="sticky top-0 z-50 w-full glass-nav backdrop-blur-xl transition-colors">
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex min-h-[76px] items-center justify-between gap-4 py-3 lg:gap-6">
        <div 
          className="flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900 transition-all hover:-translate-y-0.5 hover:text-blue-700 dark:text-white dark:hover:text-blue-200 cursor-pointer"
          onClick={handleHomeNavigation}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-transform hover:rotate-3 hover:scale-105"><Building2 className="h-5 w-5" /></span>
          <span>Reside</span>
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
            <SelectTrigger className="glass-pill h-10 w-auto min-w-[108px] rounded-full px-3 shadow-sm transition-all hover:-translate-y-0.5">
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
          className="glass-pill rounded-full text-slate-600 transition-all hover:-translate-y-0.5 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNotificationsClick || onDashboardClick}
              title={t('Notifications', 'அறிவிப்புகள்')}
              className="relative glass-pill rounded-full text-slate-600 transition-all hover:-translate-y-0.5 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          )}

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
                <Button variant="outline" className="glass-surface max-w-[180px] gap-2 rounded-full shadow-sm transition-all hover:-translate-y-0.5">
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
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onDashboardClick?.();
                        }}
                        className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 font-medium text-left"
                      >
                        <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t('Unread Notifications', 'படிக்காத அறிவிப்புகள்')}</span>
                        <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
                      </button>
                    )}
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
