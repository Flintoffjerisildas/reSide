import { Building2, Moon, Sun, LogIn, LogOut, User, Menu, LayoutDashboard, Home, Globe2, Grid2X2, Bell, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from '@tanstack/react-router';
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
  onAccountClick?: () => void;
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
  onNotificationsClick,
  onAccountClick
}: HeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout, isInitializing } = useAuth();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: notificationsData } = useGetNotifications();
  const notifications = notificationsData?.notifications || [];
  const unreadNotifications = notifications.filter((n: any) => !n.isRead && !n.read);
  const unreadCount = notifications.length > 0 ? unreadNotifications.length : 0;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const handleMyAccountClick = () => {
    setDropdownOpen(false);
    if (onAccountClick) {
      onAccountClick();
    } else {
      navigate({ to: '/dashboard/$tab', params: { tab: 'settings' } });
    }
  };

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
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex h-14 sm:h-[58px] items-center justify-between gap-4">
        <div 
          className="flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight text-[#0B1736] transition-all hover:text-blue-600 dark:text-white dark:hover:text-blue-300 cursor-pointer"
          onClick={handleHomeNavigation}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/30 transition-transform hover:scale-105">
            <Building2 className="h-4.5 w-4.5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#0B1736] dark:text-white">Reside</span>
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
            <SelectTrigger className="h-8.5 w-auto rounded-full px-3 text-xs bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:bg-slate-50 transition-colors">
              <Globe2 className="mr-1.5 h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
              <SelectValue placeholder={t('Language', 'மொழி')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ta">தமிழ்</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8.5 w-8.5 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 shadow-2xs"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {isAuthenticated && (
            <Button
              variant="outline"
              size="icon"
              onClick={onNotificationsClick || onDashboardClick}
              title={t('Notifications', 'அறிவிப்புகள்')}
              className="relative h-8.5 w-8.5 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 shadow-2xs"
            >
              <Bell className="h-4 w-4" />
              {notifications && notifications.length > 0 && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={onDashboardClick}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-gray-700 dark:text-slate-200 hover:text-blue-600 text-xs font-medium shadow-sm backdrop-blur-sm cursor-pointer transition-all"
            >
              {isDashboardActive ? <Home className="h-3.5 w-3.5" /> : <Grid2X2 className="h-3.5 w-3.5" />}
              <span>{isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}</span>
            </button>
          )}

          {isAuthenticated ? (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8.5 gap-2 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 px-3 text-xs font-medium shadow-2xs cursor-pointer">
                  <User className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  <span className="max-w-[120px] truncate">
                    {userProfile?.name || user?.name || 'Customer'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-1.5">
                <DropdownMenuItem
                  onClick={handleMyAccountClick}
                  className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-colors hover:bg-blue-50 focus:bg-blue-50 dark:hover:bg-blue-950/40 dark:focus:bg-blue-950/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {t('My Account', 'என் கணக்கு')}
                      </span>
                      {(((userProfile as any)?.internalRole === 'admin') || userProfile?.role || user?.role) && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {getRoleLabel(((userProfile as any)?.internalRole === 'admin') ? 'admin' : (userProfile?.role || user?.role || ''))}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      {t('Manage profile & settings', 'சுயவிவரம் & அமைப்புகளை நிர்வகிக்க')}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={onDashboardClick} className="cursor-pointer">
                  {isDashboardActive ? <Home className="mr-2 h-4 w-4" /> : <LayoutDashboard className="mr-2 h-4 w-4" />}
                  {isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
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
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleMyAccountClick();
                      }}
                      className="flex items-center gap-2.5 p-2 bg-blue-50/60 hover:bg-blue-50 dark:bg-muted dark:hover:bg-muted/80 rounded-xl text-left transition-colors cursor-pointer"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground">{userProfile?.name || user?.name || 'User'}</span>
                          {(userProfile?.role || user?.role) && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                              {getRoleLabel(userProfile?.role || user?.role || '')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{t('Manage profile & settings', 'சுயவிவரம் & அமைப்புகளை நிர்வகிக்க')}</span>
                      </div>
                    </button>
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
