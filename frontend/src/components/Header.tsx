import {
  Building2,
  Moon,
  Sun,
  LogIn,
  LogOut,
  User,
  Menu,
  LayoutDashboard,
  Home,
  Globe2,
  Grid2X2,
  Bell,
  ChevronDown,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  CheckCheck,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '../contexts/AuthContext';
import {
  useGetCallerUserProfile,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useQueries';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useMessenger, dispatchOpenMessenger } from '../hooks/useMessenger';
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
  const { data: notificationsData, refetch: refetchNotifications, isFetching: isFetchingNotifications } = useGetNotifications();
  const notifications = notificationsData?.notifications || [];
  const unreadNotifications = notifications.filter((n: any) => !n.isRead && !n.read);
  const unreadCount = notifications.length > 0 ? unreadNotifications.length : 0;
  const markNotificationReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount: messengerUnreadCount } = useMessenger();
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
  const isSuperAdmin = (userProfile as any)?.internalRole === 'superadmin' || user?.role === 'superadmin' || userProfile?.role === 'superadmin';

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
      case 'superadmin':
        return t('Super Admin', 'சூப்பர் நிர்வாகி');
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
      <div className="w-full px-3 sm:px-5 lg:px-6 flex h-14 sm:h-[58px] items-center justify-between gap-4">
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

          {isAuthenticated && isSuperAdmin ? (
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  title={t('Notifications', 'அறிவிப்புகள்')}
                  className="relative h-8.5 w-8.5 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[340px] sm:w-[400px] p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 text-slate-900 dark:text-white overflow-hidden z-50 backdrop-blur-md"
              >
                {/* Header */}
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {t('Notifications', 'அறிவிப்புகள்')}
                        </h4>
                        {unreadCount > 0 && (
                          <Badge className="bg-red-600 text-white border-0 text-[10px] font-bold px-1.5 py-0 rounded-full shrink-0">
                            {unreadCount} {t('New', 'புதியவை')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {t('Super Admin Platform Alerts', 'சூப்பர் அட்மின் எச்சரிக்கைகள்')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refetchNotifications()}
                      disabled={isFetchingNotifications}
                      title={t('Refresh', 'புதுப்பி')}
                      className="h-7 w-7 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isFetchingNotifications ? 'animate-spin' : ''}`} />
                    </Button>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        className="h-7 px-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5 mr-1" />
                        {t('Mark all read', 'அனைத்தும் படித்ததாக குறி')}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notifications List / Clean Empty State */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-2.5">
                      <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t('No new notifications', 'புதிய அறிவிப்புகள் எதுவும் இல்லை')}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('You are all caught up with platform and admin alerts.', 'நீங்கள் அனைத்து விழிப்பூட்டல்களையும் பார்த்துவிட்டீர்கள்.')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchNotifications()}
                        disabled={isFetchingNotifications}
                        className="h-7 px-2.5 text-xs font-semibold rounded-lg mt-1 cursor-pointer"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1.5 ${isFetchingNotifications ? 'animate-spin' : ''}`} />
                        {t('Refresh', 'புதுப்பி')}
                      </Button>
                    </div>
                  ) : (
                    notifications.map((item: any) => {
                      const isUnread = !item.read && !item.isRead;
                      return (
                        <div
                          key={item._id}
                          className={`p-3 transition-colors flex items-start gap-2.5 ${
                            isUnread
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="pt-0.5 shrink-0">
                            {isUnread ? (
                              <span className="h-2 w-2 rounded-full bg-blue-600 block mt-1" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 block mt-1" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className={`text-xs leading-tight truncate ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                                {item.title}
                              </h5>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                              {item.message}
                            </p>
                            {item.propertyTitle && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{item.propertyTitle}</span>
                              </div>
                            )}
                          </div>
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationReadMutation.mutate(item._id);
                              }}
                              title={t('Mark as read', 'படித்ததாக குறி')}
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 shrink-0 cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {notifications.length} {t('Total Notifications', 'மொத்த அறிவிப்புகள்')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2 py-0.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                  >
                    {t('Close', 'மூடு')}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          ) : isAuthenticated ? (
            <Button
              variant="outline"
              size="icon"
              onClick={onNotificationsClick || onDashboardClick}
              title={t('Notifications', 'அறிவிப்புகள்')}
              className="relative h-8.5 w-8.5 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 shadow-2xs"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          ) : null}

          {isAuthenticated && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => dispatchOpenMessenger()}
              title={t('Messenger', 'செய்தியாளர்')}
              className="relative h-8.5 w-8.5 rounded-full border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 shadow-2xs"
            >
              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {messengerUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {messengerUnreadCount > 9 ? '9+' : messengerUnreadCount}
                </span>
              )}
            </Button>
          )}

          {isAuthenticated && isSuperAdmin && window.location.pathname.startsWith('/admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/superadmin' })}
              className="h-8.5 rounded-full bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 text-xs font-bold gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{t('Back to Super Admin Center', 'சூப்பர் அட்மின் மையத்திற்கு திரும்பவும்')}</span>
            </Button>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={onDashboardClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 text-xs font-bold cursor-pointer transition-all"
            >
              {isDashboardActive ? <Home className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" /> : <Grid2X2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />}
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
                      {(((userProfile as any)?.internalRole === 'superadmin') || ((userProfile as any)?.internalRole === 'admin') || userProfile?.role || user?.role) && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {getRoleLabel(
                            (userProfile as any)?.internalRole === 'superadmin' || user?.role === 'superadmin'
                              ? 'superadmin'
                              : (userProfile as any)?.internalRole === 'admin'
                              ? 'admin'
                              : (userProfile?.role || user?.role || '')
                          )}
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
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[340px] p-4 flex flex-col justify-between">
              <div>
                <SheetHeader className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
                  <SheetTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>{t('Menu', 'பட்டியல்')}</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2.5 mt-3">
                  <div className="flex items-center justify-between min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('Theme', 'தீம்')}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                      <Sun className="h-4.5 w-4.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
                      <Moon className="absolute h-4.5 w-4.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('Language', 'மொழி')}</span>
                    <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                      <SelectTrigger className="w-[105px] h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder={t('Language', 'மொழி')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ta">தமிழ்</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="my-0.5 border-t border-slate-200/80 dark:border-slate-800" />

                  {isAuthenticated ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleMyAccountClick();
                        }}
                        className="flex items-center gap-2.5 p-2.5 min-h-[44px] bg-blue-50/60 hover:bg-blue-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-xl text-left border border-blue-100/80 dark:border-slate-700/80 transition-colors cursor-pointer"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate">{userProfile?.name || user?.name || 'User'}</span>
                            {(userProfile?.role || user?.role) && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium shrink-0">
                                {getRoleLabel(userProfile?.role || user?.role || '')}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate">{t('Manage profile & settings', 'சுயவிவரம் & அமைப்புகளை நிர்வகிக்க')}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          dispatchOpenMessenger();
                        }}
                        className="flex items-center justify-between px-3 py-2 min-h-[44px] bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 text-left transition-colors hover:bg-blue-100/70 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          {t('Messenger', 'செய்தியாளர்')}
                        </span>
                        {messengerUnreadCount > 0 && (
                          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {messengerUnreadCount > 9 ? '9+' : messengerUnreadCount}
                          </span>
                        )}
                      </button>
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setNotificationsOpen(true);
                          }}
                          className="flex items-center justify-between px-3 py-2 min-h-[44px] bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 text-left transition-colors hover:bg-blue-100/70 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            {t('Notifications', 'அறிவிப்புகள்')}
                          </span>
                          {unreadCount > 0 ? (
                            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">{notifications.length}</span>
                          )}
                        </button>
                      ) : unreadCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onDashboardClick?.();
                          }}
                          className="flex items-center justify-between px-3 py-2 min-h-[44px] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 text-left transition-colors hover:bg-blue-100/70 cursor-pointer"
                        >
                          <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t('Unread Notifications', 'படிக்காத அறிவிப்புகள்')}</span>
                          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
                        </button>
                      ) : null}
                      {isSuperAdmin && window.location.pathname.startsWith('/admin') && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            navigate({ to: '/superadmin' });
                          }}
                          className="w-full min-h-[44px] justify-start bg-white text-slate-800 border border-slate-200 shadow-xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 font-semibold text-xs rounded-xl"
                        >
                          <ShieldCheck className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                          {t('Back to Super Admin Center', 'சூப்பர் அட்மின் மையத்திற்கு திரும்பவும்')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={onDashboardClick}
                        className="w-full min-h-[44px] justify-start bg-white text-slate-800 border border-slate-200 shadow-xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 font-semibold text-xs rounded-xl"
                      >
                        {isDashboardActive ? <Home className="mr-2 h-4 w-4 text-slate-600 dark:text-slate-300" /> : <LayoutDashboard className="mr-2 h-4 w-4 text-slate-600 dark:text-slate-300" />}
                        {isDashboardActive ? t('Back to Home', 'முகப்புக்கு திரும்பவும்') : t('Go to Dashboard', 'டாஷ்போர்டுக்கு செல்லவும்')}
                      </Button>
                      <Button variant="destructive" onClick={handleLogout} className="w-full min-h-[44px] justify-start rounded-xl font-semibold text-xs">
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
                      className="w-full min-h-[44px] justify-center rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('Login', 'உள்நுழைய')}
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
