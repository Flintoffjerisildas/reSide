import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useGetCallerUserProfile,
  useGetMyProperties,
  useGetOwnerRequests,
  useGetTenantRequests,
  useAnnouncements,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useApproveRequest,
  useRejectRequest
} from '../hooks/useQueries';
import { toast } from 'sonner';
import {
  Home,
  Building,
  KeyRound,
  Inbox,
  Megaphone,
  FileText,
  Settings,
  Plus,
  ArrowUpRight,
  Send,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  Bell,
  IndianRupee,
  Eye,
  CheckCheck,
  MapPin
} from 'lucide-react';
import OwnerDashboard from './OwnerDashboard';
import CustomerDashboard from './CustomerDashboard';
import PropertyForm from './PropertyForm';
import RequestDetailsModal from './RequestDetailsModal';
import { PropertyRequest } from '../types';

interface UserDashboardProps {
  onBrowseProperties?: (transactionType: 'rent' | 'buy') => void;
}

export default function UserDashboard({ onBrowseProperties }: UserDashboardProps) {
  const { t } = useLanguage();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: myProperties = [] } = useGetMyProperties();
  const { data: ownerRequests = [] } = useGetOwnerRequests();
  const { data: tenantRequests = [] } = useGetTenantRequests();
  const { data: announcements = [] } = useAnnouncements();
  const { data: notificationData } = useGetNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const approveRequestMutation = useApproveRequest();
  const rejectRequestMutation = useRejectRequest();

  const notifications = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;

  const [mainTab, setMainTab] = useState<
    | 'overview'
    | 'properties'
    | 'my-requests'
    | 'incoming-requests'
    | 'transactions'
    | 'notifications'
    | 'rentals'
    | 'reports'
    | 'announcements'
    | 'settings'
  >('overview');

  const [reportsSubTab, setReportsSubTab] = useState<'owner' | 'tenant'>('owner');
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PropertyRequest | null>(null);

  // Filters for My Requests (Customer categories: My Requests, Pending Owner Approval, Awaiting Payment, Completed / Rejected)
  const [sentFilterType, setSentFilterType] = useState<'all' | 'buy' | 'rent'>('all');
  const [sentFilterStatus, setSentFilterStatus] = useState<string>('all');

  // Filters for Incoming Requests (Owner categories: Incoming Requests, Accept / Reject, Accepted / Awaiting Payment, Completed Transactions)
  const [incomingFilterType, setIncomingFilterType] = useState<'all' | 'buy' | 'rent'>('all');
  const [incomingFilterStatus, setIncomingFilterStatus] = useState<string>('all');

  // Pending counts
  const pendingOwnerRequests = useMemo(
    () => (Array.isArray(ownerRequests) ? ownerRequests.filter((r: any) => r.status === 'pending').length : 0),
    [ownerRequests]
  );
  const pendingTenantRequests = useMemo(
    () => (Array.isArray(tenantRequests) ? tenantRequests.filter((r: any) => r.status === 'pending' || r.status === 'counteroffer').length : 0),
    [tenantRequests]
  );

  // Customer category counts (Requirement 6)
  const customerCounts = useMemo(() => {
    const list = tenantRequests || [];
    return {
      all: list.length,
      pending: list.filter((r: any) => ['pending', 'counteroffer'].includes(r.status)).length,
      awaitingPayment: list.filter((r: any) => ['accepted', 'approved', 'terms_confirmed'].includes(r.status)).length,
      completedRejected: list.filter((r: any) => ['completed', 'rejected', 'cancelled'].includes(r.status)).length,
    };
  }, [tenantRequests]);

  // Owner category counts (Requirement 6)
  const ownerCounts = useMemo(() => {
    const list = ownerRequests || [];
    return {
      all: list.length,
      pending: list.filter((r: any) => r.status === 'pending').length,
      awaitingPayment: list.filter((r: any) => ['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(r.status)).length,
      completed: list.filter((r: any) => r.status === 'completed').length,
    };
  }, [ownerRequests]);

  // Transactions list (accepted, terms_confirmed, payment_pending, completed)
  const activeTransactions = useMemo(() => {
    const list: Array<{ request: any; role: 'buyer' | 'owner' }> = [];
    (tenantRequests || []).forEach((r: any) => {
      if (['accepted', 'approved', 'terms_confirmed', 'payment_pending', 'completed'].includes(r.status)) {
        list.push({ request: r, role: 'buyer' });
      }
    });
    (ownerRequests || []).forEach((r: any) => {
      if (['accepted', 'approved', 'terms_confirmed', 'payment_pending', 'completed'].includes(r.status)) {
        // avoid duplicates if user somehow owns and tenants same request
        if (!list.some((item) => item.request._id === r._id)) {
          list.push({ request: r, role: 'owner' });
        }
      }
    });
    return list.sort((a, b) => new Date(b.request.updatedAt || b.request.createdAt).getTime() - new Date(a.request.updatedAt || a.request.createdAt).getTime());
  }, [tenantRequests, ownerRequests]);

  // Filtered Sent Requests
  const filteredSentRequests = useMemo(() => {
    return (tenantRequests || []).filter((r: any) => {
      const typeMatch = sentFilterType === 'all' || r.type === sentFilterType;
      let statusMatch = true;
      if (sentFilterStatus === 'pending') {
        statusMatch = ['pending', 'counteroffer'].includes(r.status);
      } else if (sentFilterStatus === 'awaiting_payment') {
        statusMatch = ['accepted', 'approved', 'terms_confirmed'].includes(r.status);
      } else if (sentFilterStatus === 'completed_rejected') {
        statusMatch = ['completed', 'rejected', 'cancelled'].includes(r.status);
      }
      return typeMatch && statusMatch;
    });
  }, [tenantRequests, sentFilterType, sentFilterStatus]);

  // Filtered Incoming Requests
  const filteredIncomingRequests = useMemo(() => {
    return (ownerRequests || []).filter((r: any) => {
      const typeMatch = incomingFilterType === 'all' || r.type === incomingFilterType;
      let statusMatch = true;
      if (incomingFilterStatus === 'pending') {
        statusMatch = r.status === 'pending';
      } else if (incomingFilterStatus === 'awaiting_payment') {
        statusMatch = ['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(r.status);
      } else if (incomingFilterStatus === 'completed') {
        statusMatch = r.status === 'completed';
      }
      return typeMatch && statusMatch;
    });
  }, [ownerRequests, incomingFilterType, incomingFilterStatus]);

  const registrationPurpose = userProfile?.registrationPurpose || 'Customer';

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case 'Owner':
        return t('Owner', 'சொத்து உரிமையாளர்');
      case 'Builder':
        return t('Builder', 'கட்டுமான நிறுவனம்');
      case 'Dealer':
        return t('Dealer', 'முகவர் / டீலர்');
      case 'Customer':
      default:
        return t('Customer', 'வாடிக்கையாளர் / வாடகைதாரர்');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[11px] px-2 py-0.5">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending', 'நிலுவையில்')}
          </Badge>
        );
      case 'counteroffer':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-300 text-[11px] px-2 py-0.5">
            <IndianRupee className="w-3 h-3 mr-1 inline" />
            {t('Counteroffer', 'எதிர் சலுகை')}
          </Badge>
        );
      case 'accepted':
      case 'approved':
        return (
          <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 text-[11px] px-2 py-0.5 font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {t('Accepted — Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது - கட்டணம் செலுத்தலாம்')}
          </Badge>
        );
      case 'terms_confirmed':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300 text-[11px] px-2 py-0.5 font-medium">
            <ShieldCheck className="w-3 h-3 mr-1 inline" />
            {t('Awaiting Payment', 'கட்டணம் நிலுவையில்')}
          </Badge>
        );
      case 'payment_pending':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300 text-[11px] px-2 py-0.5 font-medium">
            <CreditCard className="w-3 h-3 mr-1 inline" />
            {t('Payment Verification Pending', 'கட்டண சரிபார்ப்பு நிலுவையில்')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-emerald-600 text-white text-[11px] px-2 py-0.5 font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {t('Completed', 'முடிக்கப்பட்டது')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-[11px] px-2 py-0.5">
            <XCircle className="w-3 h-3 mr-1 inline" />
            {t('Declined', 'நிராகரிக்கப்பட்டது')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {t('Withdrawn', 'திரும்பப்பெறப்பட்டது')}
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.read) {
      markReadMutation.mutate(notif._id);
    }
    if (notif.request) {
      const fullRequest = (ownerRequests as any[]).concat(tenantRequests as any[]).find((r: any) => r._id === (notif.request._id || notif.request));
      if (fullRequest) {
        setSelectedRequest(fullRequest);
      } else if (typeof notif.request === 'object') {
        setSelectedRequest(notif.request);
      }
    }
  };

  return (
    <div className="w-full py-6 sm:py-8 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 space-y-6">
      {/* Top Profile & Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 shadow-md transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t('Welcome back', 'மீண்டும் வருக')}, {userProfile?.name || 'User'}
              </h1>
              <Badge variant="outline" className="glass-pill bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                <UserCheck className="w-3 h-3 mr-1 inline" />
                {getPurposeLabel(registrationPurpose)}
              </Badge>
              <Badge variant="secondary" className="glass-pill text-xs">
                <ShieldCheck className="w-3 h-3 mr-1 inline text-emerald-500" />
                {t('Unified Account', 'ஒருங்கிணைந்த கணக்கு')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                'Buy, rent, sell, or lease from one unified hub with complete transaction security and verified payment workflow.',
                'ஒரே மையத்திலிருந்து வாங்கலாம், வாடகைக்கு எடுக்கலாம், விற்கலாம் மற்றும் கட்டணங்களை சரிபார்க்கலாம்.'
              )}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrowseProperties?.('rent')}
              className="glass-pill gap-1.5 rounded-xl hover:-translate-y-0.5 transition-all text-foreground"
            >
              <Home className="h-4 w-4 text-primary" />
              {t('Browse to Rent', 'வாடகைக்கு தேடு')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrowseProperties?.('buy')}
              className="glass-pill gap-1.5 rounded-xl hover:-translate-y-0.5 transition-all text-foreground"
            >
              <Building className="h-4 w-4 text-emerald-600" />
              {t('Browse to Buy', 'வாங்க தேடு')}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsPropertyFormOpen(true)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 hover:-translate-y-0.5 rounded-xl transition-all"
            >
              <Plus className="h-4 w-4" />
              {t('List Property', 'சொத்தை பட்டியலிடு')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Unified Navigation Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="w-full space-y-6">
        <TabsList className="glass-surface grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-9 w-full h-auto p-1.5 gap-1 rounded-2xl shadow-sm">
          <TabsTrigger value="overview" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            {t('Overview', 'கண்ணோட்டம்')}
          </TabsTrigger>

          <TabsTrigger value="properties" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Building className="h-3.5 w-3.5" />
            {t('My Properties', 'என் சொத்துக்கள்')}
            {myProperties.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 h-4 text-[10px]">
                {myProperties.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="my-requests" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Send className="h-3.5 w-3.5 text-blue-500" />
            {t('My Requests', 'என் கோரிக்கைகள்')}
            {pendingTenantRequests > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 h-4 text-[10px]">
                {pendingTenantRequests}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="incoming-requests" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Inbox className="h-3.5 w-3.5 text-amber-500" />
            {t('Incoming', 'வந்த கோரிக்கைகள்')}
            {pendingOwnerRequests > 0 && (
              <Badge variant="destructive" className="ml-0.5 px-1.5 py-0 h-4 text-[10px]">
                {pendingOwnerRequests}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="transactions" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
            {t('Transactions', 'பரிவர்த்தனைகள்')}
            {activeTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 h-4 text-[10px]">
                {activeTransactions.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="notifications" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Bell className="h-3.5 w-3.5 text-indigo-500" />
            {t('Notifications', 'அறிவிப்புகள்')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-0.5 px-1.5 py-0 h-4 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="rentals" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <KeyRound className="h-3.5 w-3.5" />
            {t('My Rentals', 'எனது வாடகைகள்')}
          </TabsTrigger>

          <TabsTrigger value="reports" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <FileText className="h-3.5 w-3.5" />
            {t('Reports', 'அறிக்கைகள்')}
          </TabsTrigger>

          <TabsTrigger value="settings" className="gap-1.5 py-2 rounded-lg text-xs font-medium">
            <Settings className="h-3.5 w-3.5" />
            {t('Settings', 'அமைப்புகள்')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified Overview */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('my-requests')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('My Sent Requests', 'அனுப்பிய கோரிக்கைகள்')}
                </CardTitle>
                <Send className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantRequests.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingTenantRequests > 0
                    ? `${pendingTenantRequests} ${t('awaiting action / response', 'பதிலுக்காக காத்திருக்கிறது')}`
                    : t('Track purchase offers & rentals', 'கொள்முதல் & வாடகை கண்காணிப்பு')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('incoming-requests')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Incoming Inquiries', 'பெறப்பட்ட கோரிக்கைகள்')}
                </CardTitle>
                <Inbox className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ownerRequests.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingOwnerRequests > 0
                    ? `${pendingOwnerRequests} ${t('pending your review', 'உங்கள் ஆய்வுக்கு நிலுவையில்')}`
                    : t('Inquiries on your properties', 'உங்கள் சொத்துக்கான கோரிக்கைகள்')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('transactions')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Active Transactions', 'செயலில் உள்ள ஒப்பந்தங்கள்')}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTransactions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Accepted offers, terms, and payments', 'ஏற்கப்பட்ட சலுகைகள் மற்றும் கட்டணங்கள்')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('notifications')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Notifications', 'அறிவிப்புகள்')}
                </CardTitle>
                <Bell className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unreadCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {unreadCount > 0 ? t('Unread action alerts', 'படிக்காத அறிவிப்புகள்') : t('All alerts caught up', 'அனைத்தும் படிக்கப்பட்டது')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dual Action Launchpads */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Buyer & Tenant Launchpad */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {t('Buyer & Tenant Hub', 'வாங்குபவர் & வாடகைதாரர் மையம்')}
                    </CardTitle>
                    <CardDescription>
                      {t('Make offers to buy, submit rental applications, and track payments.', 'வாங்க சலுகை அளியுங்கள், வாடகை விண்ணப்பம் அனுப்புங்கள் மற்றும் கட்டணங்களை செலுத்துங்கள்.')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tenantRequests.length === 0
                    ? t(
                        'You have not submitted any purchase or rental requests yet. Explore verified listings anytime.',
                        'நீங்கள் இன்னும் எந்த கொள்முதல் அல்லது வாடகை கோரிக்கையையும் அனுப்பவில்லை.'
                      )
                    : t(
                        `You have ${tenantRequests.length} active request(s) underway across sale and rental properties.`,
                        `உங்களிடம் ${tenantRequests.length} செயலில் உள்ள கோரிக்கைகள் உள்ளன.`
                      )}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBrowseProperties?.('buy')}
                    className="gap-1.5"
                  >
                    <Building className="h-3.5 w-3.5 text-blue-600" />
                    {t('Browse to Buy', 'வாங்க தேட')}
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBrowseProperties?.('rent')}
                    className="gap-1.5"
                  >
                    <Home className="h-3.5 w-3.5 text-primary" />
                    {t('Browse to Rent', 'வாடகைக்கு தேட')}
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setMainTab('my-requests')}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t('View My Requests', 'என் கோரிக்கைகள்')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Landlord & Property Owner Launchpad */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {t('Property Owner & Seller Hub', 'சொத்து உரிமையாளர் & விற்பனையாளர் மையம்')}
                    </CardTitle>
                    <CardDescription>
                      {t('List properties for sale or rent, evaluate incoming offers, and verify payments.', 'சொத்துக்களை பட்டியலிடவும், சலுகைகளை மதிப்பாய்வு செய்யவும், கட்டணங்களை சரிபார்க்கவும்.')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {myProperties.length === 0
                    ? t(
                        'You have not listed any properties yet. Click List Property to add your home, plot, or commercial space.',
                        'நீங்கள் இதுவரை எந்த சொத்தையும் பட்டியலிடவில்லை. சொத்தை சேர்க்கலாம்.'
                      )
                    : t(
                        `You have ${myProperties.length} property listing(s) and ${pendingOwnerRequests} pending inquiry/offer(s).`,
                        `உங்களிடம் ${myProperties.length} சொத்துகள் மற்றும் ${pendingOwnerRequests} நிலுவை சலுகைகள் உள்ளன.`
                      )}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={() => setIsPropertyFormOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t('List New Property', 'புதிய சொத்து சேர்க்க')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMainTab('incoming-requests')}
                    className="gap-1.5"
                  >
                    <Inbox className="h-3.5 w-3.5 text-amber-500" />
                    {t('Review Inquiries', 'கோரிக்கைகளை ஆராய்க')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMainTab('properties')}
                    className="gap-1.5"
                  >
                    {t('Manage Listings', 'பட்டியல்களை நிர்வகிக்க')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: My Properties */}
        <TabsContent value="properties" className="mt-0">
          <OwnerDashboard
            initialTab="properties"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>

        {/* Tab 3: My Requests (Sent requests by current user) */}
        <TabsContent value="my-requests" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-500" />
                  {t('My Sent Requests & Offers', 'நான் அனுப்பிய கோரிக்கைகள் மற்றும் சலுகைகள்')}
                </CardTitle>
                <CardDescription>
                  {t('Track all purchase offers and rental applications you submitted for properties.', 'நீங்கள் சமர்ப்பித்த அனைத்து கொள்முதல் மற்றும் வாடகை கோரிக்கைகளைக் கண்காணிக்கவும்.')}
                </CardDescription>
              </div>

              {/* Customer Filters (Requirement 6) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sentFilterStatus === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('My Requests', 'என் கோரிக்கைகள்')} ({customerCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sentFilterStatus === 'pending'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Pending Owner Approval', 'உரிமையாளர் ஒப்புதல் நிலுவையில்')} ({customerCounts.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('awaiting_payment')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sentFilterStatus === 'awaiting_payment'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Awaiting Payment', 'கட்டணம் நிலுவையில்')} ({customerCounts.awaitingPayment})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('completed_rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sentFilterStatus === 'completed_rejected'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Completed / Rejected', 'முடிந்தவை / நிராகரிக்கப்பட்டவை')} ({customerCounts.completedRejected})
                  </button>
                </div>

                <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSentFilterType('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      sentFilterType === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t('All', 'அனைத்தும்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterType('buy')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      sentFilterType === 'buy' ? 'bg-background shadow-xs text-blue-600 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {t('Buy Offers', 'வாங்க சலுகைகள்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterType('rent')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      sentFilterType === 'rent' ? 'bg-background shadow-xs text-emerald-600 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {t('Rentals', 'வாடகை')}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSentRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-medium">{t('No sent requests found.', 'அனுப்பப்பட்ட கோரிக்கைகள் எதுவும் இல்லை.')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Browse listings to submit purchase offers or rental requests.', 'சொத்துக்களைக் கண்டறிந்து கோரிக்கைகளை அனுப்பவும்.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredSentRequests.map((req: any) => (
                    <div
                      key={req._id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/40 transition-all gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                              req.type === 'buy'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {req.type === 'buy' ? t('Buy / Purchase Offer', 'வாங்க சலுகை') : t('Rent Application', 'வாடகை கோரிக்கை')}
                          </span>
                          {renderStatusBadge(req.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-semibold text-base truncate">{req.property?.title || 'Property'}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          {req.property?.location || '-'}
                        </p>

                        <div className="flex items-center gap-4 text-xs pt-1 flex-wrap">
                          <span>
                            <span className="text-muted-foreground">{t('Listed Price: ', 'பட்டியல் விலை: ')}</span>
                            <b>₹{Number(req.property?.price || 0).toLocaleString('en-IN')}</b>
                          </span>
                          {req.offerAmount && (
                            <span>
                              <span className="text-muted-foreground">{t('My Offer: ', 'என் சலுகை: ')}</span>
                              <b className="text-primary">₹{Number(req.offerAmount).toLocaleString('en-IN')}</b>
                            </span>
                          )}
                          {req.counterOfferAmount && req.status === 'counteroffer' && (
                            <span className="text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200">
                              {t('Owner Counteroffer: ', 'உரிமையாளர் எதிர் சலுகை: ')} ₹{Number(req.counterOfferAmount).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        {req.message && (
                          <p className="text-xs text-muted-foreground italic truncate">
                            "{req.message}"
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        {req.status === 'counteroffer' && (
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => setSelectedRequest(req)}
                          >
                            {t('Review Counteroffer', 'எதிர் சலுகையை காண்க')}
                          </Button>
                        )}
                        {['accepted', 'approved', 'terms_confirmed'].includes(req.status) && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                            onClick={() => setSelectedRequest(req)}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {t('Pay Now', 'கட்டணம் செலுத்து')}
                          </Button>
                        )}
                        {req.status === 'payment_pending' && (
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300 text-xs px-2.5 py-1">
                            <Clock className="w-3 h-3 mr-1 inline" />
                            {t('Verification Pending', 'சரிபார்ப்பு நிலுவையில்')}
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                          className="gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t('View Details', 'விவரங்கள்')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Incoming Requests (Received requests on owned properties) */}
        <TabsContent value="incoming-requests" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-amber-500" />
                  {t('Incoming Inquiries & Offers', 'பெறப்பட்ட விசாரணைகள் மற்றும் சலுகைகள்')}
                </CardTitle>
                <CardDescription>
                  {t('Review purchase and rental requests submitted by other users for your listed properties.', 'உங்கள் சொத்துகளுக்காக பயனர்கள் சமர்ப்பித்த கோரிக்கைகளை மதிப்பாய்வு செய்யவும்.')}
                </CardDescription>
              </div>

              {/* Owner Filters (Requirement 6) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      incomingFilterStatus === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Incoming Requests', 'பெறப்பட்ட கோரிக்கைகள்')} ({ownerCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      incomingFilterStatus === 'pending'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Accept / Reject', 'ஏற்க / நிராகரிக்க')} ({ownerCounts.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('awaiting_payment')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      incomingFilterStatus === 'awaiting_payment'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Accepted / Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது / கட்டணம் நிலுவையில்')} ({ownerCounts.awaitingPayment})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      incomingFilterStatus === 'completed'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t('Completed Transactions', 'முடிந்த ஒப்பந்தங்கள்')} ({ownerCounts.completed})
                  </button>
                </div>

                <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIncomingFilterType('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      incomingFilterType === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t('All', 'அனைத்தும்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterType('buy')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      incomingFilterType === 'buy' ? 'bg-background shadow-xs text-blue-600 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {t('Purchase Offers', 'கொள்முதல் சலுகைகள்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterType('rent')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      incomingFilterType === 'rent' ? 'bg-background shadow-xs text-emerald-600 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {t('Rentals', 'வாடகை')}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredIncomingRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-medium">{t('No incoming requests found.', 'பெறப்பட்ட கோரிக்கைகள் எதுவும் இல்லை.')}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredIncomingRequests.map((req: any) => (
                    <div
                      key={req._id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/40 transition-all gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                              req.type === 'buy'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {req.type === 'buy' ? t('Buy Inquiry / Offer', 'வாங்க சலுகை') : t('Rent Request', 'வாடகை கோரிக்கை')}
                          </span>
                          {renderStatusBadge(req.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-semibold text-base truncate">{req.property?.title || 'Property'}</h4>

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{t('Applicant: ', 'விண்ணப்பதாரர்: ')}</span>
                            {req.tenant?.name || 'Applicant'} ({req.tenant?.email})
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs pt-1 flex-wrap">
                          <span>
                            <span className="text-muted-foreground">{t('Listed Price: ', 'பட்டியல் விலை: ')}</span>
                            <b>₹{Number(req.property?.price || 0).toLocaleString('en-IN')}</b>
                          </span>
                          {req.offerAmount && (
                            <span>
                              <span className="text-muted-foreground">{t('Offered: ', 'சலுகை: ')}</span>
                              <b className="text-primary">₹{Number(req.offerAmount).toLocaleString('en-IN')}</b>
                            </span>
                          )}
                          {req.status === 'payment_pending' && (
                            <span className="text-indigo-600 font-semibold bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200">
                              {t('Payment proof uploaded — verify now', 'கட்டண ஆதாரம் பதிவேற்றப்பட்டது')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        {req.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-sm"
                              disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                              onClick={() => {
                                approveRequestMutation.mutate(req._id, {
                                  onSuccess: () => toast.success(t('Offer/Request accepted! Customer notified to proceed with payment.', 'கோரிக்கை ஏற்கப்பட்டது! கட்டணம் செலுத்த வாடிக்கையாளருக்கு அறிவிக்கப்பட்டது.')),
                                  onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to accept request', 'கோரிக்கையை ஏற்க முடியவில்லை'))
                                });
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {req.type === 'buy' ? t('Accept Offer', 'சலுகையை ஏற்றுக்கொள்') : t('Accept Application', 'விண்ணப்பத்தை ஏற்றுக்கொள்')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 font-medium gap-1"
                              disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                              onClick={() => {
                                rejectRequestMutation.mutate(req._id, {
                                  onSuccess: () => toast.success(t('Request rejected', 'கோரிக்கை நிராகரிக்கப்பட்டது')),
                                  onError: () => toast.error(t('Failed to reject request', 'கோரிக்கையை நிராகரிக்க முடியவில்லை'))
                                });
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {t('Reject', 'நிராகரி')}
                            </Button>
                          </>
                        )}
                        {req.status === 'payment_pending' && (
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1 shadow-sm"
                            onClick={() => setSelectedRequest(req)}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {t('Verify Payment', 'கட்டணத்தை சரிபார்')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                          className="gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t('Manage Request', 'கோரிக்கையை நிர்வகி')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Active Transactions Hub */}
        <TabsContent value="transactions" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                {t('Property Transactions & Closings', 'சொத்து பரிவர்த்தனைகள் & விற்பனை முன்னேற்றம்')}
              </CardTitle>
              <CardDescription>
                {t(
                  'Real-time overview of accepted purchase offers and leases through terms confirmation, deposit payment, and closing.',
                  'ஏற்றுக்கொள்ளப்பட்ட கொள்முதல் சலுகைகள் மற்றும் குத்தகைகளின் நிகழ்நேர கண்ணோட்டம்.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-medium">{t('No active transactions in progress.', 'செயலில் உள்ள பரிவர்த்தனைகள் இல்லை.')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeTransactions.map(({ request: req, role }) => (
                    <Card key={req._id} className="border shadow-none bg-muted/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs px-2 py-0.5">
                              {role === 'buyer'
                                ? req.type === 'buy'
                                  ? t('As Buyer', 'வாங்குபவராக')
                                  : t('As Tenant', 'வாடகைதாரராக')
                                : t('As Property Owner', 'உரிமையாளராக')}
                            </Badge>
                            <span
                              className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                                req.type === 'buy' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {req.type === 'buy' ? t('Purchase Closing', 'கொள்முதல்') : t('Rental Lease', 'வாடகை')}
                            </span>
                            {renderStatusBadge(req.status)}
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            {req.type === 'rent' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setMainTab('rentals')}
                                className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                {t('View in My Rentals', 'எனது வாடகைகளில் பார்க்க')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRequest(req)}
                              className="gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t('Open Deal Details', 'ஒப்பந்த விவரங்கள்')}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-base">{req.property?.title || 'Property'}</h4>
                          <p className="text-xs text-muted-foreground">{req.property?.location || '-'}</p>
                        </div>

                        {/* Transaction Progress Steps */}
                        {req.type === 'buy' ? (
                          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-300 text-emerald-700 dark:text-emerald-300">
                              <span className="font-semibold block">1. {t('Offer Accepted', 'ஏற்றுக்கொள்ளப்பட்டது')}</span>
                              <span className="text-[10px]">✓ {t('Done', 'முடிந்தது')}</span>
                            </div>
                            <div
                              className={`p-2 rounded-lg border ${
                                ['terms_confirmed', 'payment_pending', 'completed'].includes(req.status)
                                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-muted/40 border-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              <span className="font-semibold block">2. {t('Terms Confirmed', 'விதிமுறைகள்')}</span>
                              <span className="text-[10px]">
                                {['terms_confirmed', 'payment_pending', 'completed'].includes(req.status)
                                  ? `✓ ${t('Confirmed', 'உறுதியானது')}`
                                  : t('Pending', 'நிலுவையில்')}
                              </span>
                            </div>
                            <div
                              className={`p-2 rounded-lg border ${
                                ['payment_pending', 'completed'].includes(req.status)
                                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                  : req.status === 'terms_confirmed'
                                  ? 'bg-blue-500/10 border-blue-300 text-blue-700 animate-pulse'
                                  : 'bg-muted/40 border-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              <span className="font-semibold block">3. {t('Payment', 'கட்டணம்')}</span>
                              <span className="text-[10px]">
                                {req.status === 'completed'
                                  ? `✓ ${t('Verified', 'சரிபார்க்கப்பட்டது')}`
                                  : req.status === 'payment_pending'
                                  ? t('Under Verification', 'சரிபார்ப்பில்')
                                  : t('Ready', 'தயார்')}
                              </span>
                            </div>
                            <div
                              className={`p-2 rounded-lg border ${
                                req.status === 'completed'
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                  : 'bg-muted/40 border-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              <span className="font-semibold block">4. {t('Closed / Sold', 'முடிந்தது')}</span>
                              <span className="text-[10px]">
                                {req.status === 'completed' ? `✓ ${t('Complete', 'முடிந்தது')}` : t('Pending', 'நிலுவை')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                            {/* Rental Step 1: Application Review */}
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-300 text-emerald-700 dark:text-emerald-300">
                              <span className="font-semibold block">1. {t('Application', 'விண்ணப்பம்')}</span>
                              <span className="text-[10px]">✓ {t('Approved', 'அங்கீகரிக்கப்பட்டது')}</span>
                            </div>
                            {/* Rental Step 2: Lease Agreement */}
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-300 text-emerald-700 dark:text-emerald-300">
                              <span className="font-semibold block">2. {t('Lease Agreement', 'குத்தகை ஒப்பந்தம்')}</span>
                              <span className="text-[10px]">✓ {t('Agreement Active', 'ஒப்பந்தம் செயலில்')}</span>
                            </div>
                            {/* Rental Step 3: Deposit / Rent */}
                            <div
                              className={`p-2 rounded-lg border ${
                                req.status === 'completed' || req.paymentDetails?.status === 'verified'
                                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                  : req.status === 'payment_pending'
                                  ? 'bg-indigo-500/10 border-indigo-300 text-indigo-700 animate-pulse'
                                  : 'bg-emerald-500/5 border-emerald-200 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              <span className="font-semibold block">3. {t('Deposit / Rent', 'முன்பணம் / வாடகை')}</span>
                              <span className="text-[10px]">
                                {req.status === 'completed' || req.paymentDetails?.status === 'verified'
                                  ? `✓ ${t('Verified', 'சரிபார்க்கப்பட்டது')}`
                                  : req.status === 'payment_pending'
                                  ? t('Under Verification', 'சரிபார்ப்பில்')
                                  : `✓ ${t('Billing Active', 'கட்டணம் தொடக்கம்')}`}
                              </span>
                            </div>
                            {/* Rental Step 4: Active Tenancy */}
                            <div
                              className={`p-2 rounded-lg border ${
                                req.status === 'completed'
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400 font-medium'
                              }`}
                            >
                              <span className="font-semibold block">4. {t('Tenancy Status', 'குத்தகை நிலை')}</span>
                              <span className="text-[10px]">
                                {req.status === 'completed'
                                  ? `✓ ${t('Complete & Finalized', 'முடிக்கப்பட்டது')}`
                                  : `✓ ${t('Occupancy Active', 'செயலில் உள்ள குத்தகை')}`}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-1 border-t text-muted-foreground">
                          <span>
                            {t('Agreed Deal Value: ', 'ஒப்புக்கொள்ளப்பட்ட மதிப்பு: ')}
                            <b className="text-foreground">
                              ₹{Number(req.agreedAmount || req.offerAmount || req.property?.price || 0).toLocaleString('en-IN')}
                            </b>
                          </span>
                          {req.paymentDetails?.receiptNumber && (
                            <span className="font-mono text-emerald-600 font-semibold">
                              {t('Receipt: ', 'ரசீது: ')}{req.paymentDetails.receiptNumber}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Notifications Hub */}
        <TabsContent value="notifications" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-500" />
                  {t('In-App Action Notifications', 'செயல் அறிவிப்புகள்')}
                </CardTitle>
                <CardDescription>
                  {t('Actionable alerts for offers, counteroffers, terms, and payments.', 'சலுகைகள், எதிர் சலுகைகள் மற்றும் கட்டணங்களுக்கான அறிவிப்புகள்.')}
                </CardDescription>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  className="gap-1.5 text-xs"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-primary" />
                  {t('Mark all as read', 'அனைத்தையும் படித்ததாக குறி')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-medium">{t('No notifications yet.', 'அறிவிப்புகள் எதுவும் இல்லை.')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((notif: any) => (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        notif.read ? 'bg-card hover:bg-muted/40' : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 hover:border-indigo-400'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                        {notif.type.includes('payment') ? (
                          <CreditCard className="w-4 h-4" />
                        ) : notif.type.includes('counter') ? (
                          <IndianRupee className="w-4 h-4" />
                        ) : notif.type.includes('accepted') ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : notif.type.includes('rejected') ? (
                          <XCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <Inbox className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm ${notif.read ? 'font-medium' : 'font-bold text-foreground'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                        {notif.property?.title && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium mt-1">
                            <Home className="w-3 h-3" />
                            {notif.property.title}
                          </span>
                        )}
                      </div>

                      {!notif.read && (
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: My Rentals (Leases & maintenance) */}
        <TabsContent value="rentals" className="mt-0">
          <CustomerDashboard
            initialTab="rentals"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>

        {/* Tab 8: Reports */}
        <TabsContent value="reports" className="space-y-4 mt-0">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Button
                variant={reportsSubTab === 'owner' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportsSubTab('owner')}
                className="gap-1.5"
              >
                <Building className="h-4 w-4" />
                {t('Landlord Reports (Rent & Occupancy)', 'உரிமையாளர் அறிக்கைகள்')}
              </Button>
              <Button
                variant={reportsSubTab === 'tenant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportsSubTab('tenant')}
                className="gap-1.5"
              >
                <KeyRound className="h-4 w-4" />
                {t('Tenant Reports (Payments & Expenses)', 'வாடகைதாரர் அறிக்கைகள்')}
              </Button>
            </div>
          </div>

          {reportsSubTab === 'owner' ? (
            <OwnerDashboard
              initialTab="reports"
              hideHeaderActions={true}
              onBrowseProperties={onBrowseProperties}
            />
          ) : (
            <CustomerDashboard
              initialTab="reports"
              hideHeaderActions={true}
              onBrowseProperties={onBrowseProperties}
            />
          )}
        </TabsContent>

        {/* Tab 9: Settings */}
        <TabsContent value="settings" className="mt-0">
          <OwnerDashboard
            initialTab="settings"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>
      </Tabs>

      {/* Property Creation Dialog */}
      <PropertyForm
        open={isPropertyFormOpen}
        onOpenChange={setIsPropertyFormOpen}
      />

      {/* Request Details & Transaction Progression Modal */}
      <RequestDetailsModal
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedRequest(null);
        }}
        onNavigateToRentals={() => setMainTab('rentals')}
      />
    </div>
  );
}
