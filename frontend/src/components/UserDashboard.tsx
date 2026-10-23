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
  useAnnouncements
} from '../hooks/useQueries';
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
  Clock
} from 'lucide-react';
import OwnerDashboard from './OwnerDashboard';
import CustomerDashboard from './CustomerDashboard';
import PropertyForm from './PropertyForm';

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

  const [mainTab, setMainTab] = useState<'overview' | 'properties' | 'rentals' | 'requests' | 'reports' | 'announcements' | 'settings'>('overview');
  const [requestsSubTab, setRequestsSubTab] = useState<'received' | 'sent'>('received');
  const [reportsSubTab, setReportsSubTab] = useState<'owner' | 'tenant'>('owner');
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);

  const pendingOwnerRequests = useMemo(
    () => (Array.isArray(ownerRequests) ? ownerRequests.filter((r: any) => r.status === 'pending').length : 0),
    [ownerRequests]
  );
  const pendingTenantRequests = useMemo(
    () => (Array.isArray(tenantRequests) ? tenantRequests.filter((r: any) => r.status === 'pending').length : 0),
    [tenantRequests]
  );

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
                {t('Verified User', 'சரிபார்க்கப்பட்ட பயனர்')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                'Access all your real-estate activities from one unified hub — browse, rent, manage tenancies, or list your properties anytime.',
                'உங்கள் அனைத்து ரியல் எஸ்டேட் நடவடிக்கைகளையும் ஒரே இடத்திலிருந்து அணுகலாம் — தேடலாம், வாடகைக்கு எடுக்கலாம் அல்லது உங்கள் சொத்துக்களை பட்டியலிடலாம்.'
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
        <TabsList className="glass-surface grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 w-full h-auto p-1.5 gap-1 rounded-2xl shadow-sm">
          <TabsTrigger value="overview" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            {t('Overview', 'கண்ணோட்டம்')}
          </TabsTrigger>

          <TabsTrigger value="properties" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <Building className="h-4 w-4" />
            {t('My Properties', 'என் சொத்துக்கள்')}
            {myProperties.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">
                {myProperties.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="rentals" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <KeyRound className="h-4 w-4" />
            {t('My Rentals', 'எனது வாடகைகள்')}
          </TabsTrigger>

          <TabsTrigger value="requests" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <Inbox className="h-4 w-4" />
            {t('Requests', 'கோரிக்கைகள்')}
            {pendingOwnerRequests + pendingTenantRequests > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-4 text-[10px]">
                {pendingOwnerRequests + pendingTenantRequests}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="reports" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <FileText className="h-4 w-4" />
            {t('Reports', 'அறிக்கைகள்')}
          </TabsTrigger>

          <TabsTrigger value="announcements" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <Megaphone className="h-4 w-4" />
            {t('Announcements', 'அறிவிப்புகள்')}
            {announcements.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">
                {announcements.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="settings" className="gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium">
            <Settings className="h-4 w-4" />
            {t('Settings', 'அமைப்புகள்')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified Overview */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          {/* Key Metric Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('properties')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Properties Listed', 'பட்டியலிடப்பட்ட சொத்துக்கள்')}
                </CardTitle>
                <Building className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myProperties.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Manage your listings', 'உங்கள் பட்டியல்களை நிர்வகிக்கவும்')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => setMainTab('rentals')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Active Rentals', 'செயலில் உள்ள வாடகைகள்')}
                </CardTitle>
                <KeyRound className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <span className="text-foreground">View Leases</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Pay rent & maintenance', 'வாடகை & பராமரிப்பு செலுத்தவும்')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => {
                setMainTab('requests');
                setRequestsSubTab('received');
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Received Inquiries', 'பெறப்பட்ட விசாரணைகள்')}
                </CardTitle>
                <Inbox className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingOwnerRequests}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Pending approvals', 'நிலுவையில் உள்ள ஒப்புதல்கள்')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => {
                setMainTab('requests');
                setRequestsSubTab('sent');
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('Sent Applications', 'அனுப்பப்பட்ட விண்ணப்பங்கள்')}
                </CardTitle>
                <Send className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingTenantRequests}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Awaiting landlord response', 'உரிமையாளர் பதிலுக்காக காத்திருக்கிறது')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dual Action Launchpads */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Landlord & Property Owner Launchpad */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {t('Landlord & Property Management', 'சொத்து உரிமையாளர் மையம்')}
                    </CardTitle>
                    <CardDescription>
                      {t('List houses, apartments, lands, and manage tenant leases.', 'வீடுகள், மனைகளை பட்டியலிட்டு, குத்தகைதாரர்களை நிர்வகிக்கவும்.')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {myProperties.length === 0
                    ? t(
                        'You have not listed any property yet. You can list a property for rent or sale at any time.',
                        'நீங்கள் இதுவரை எந்த சொத்தையும் பட்டியலிடவில்லை. எந்த நேரத்திலும் சொத்தை வாடகைக்கு அல்லது விற்பனைக்கு பட்டியலிடலாம்.'
                      )
                    : t(
                        `You have ${myProperties.length} active property listing(s) under management.`,
                        `உங்களிடம் ${myProperties.length} செயலில் உள்ள சொத்து பட்டியல்கள் உள்ளன.`
                      )}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={() => setIsPropertyFormOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t('Add New Property', 'புதிய சொத்து சேர்க்க')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMainTab('properties')}
                    className="gap-1.5"
                  >
                    {t('View My Properties', 'என் சொத்துக்களை பார்க்க')}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                  {pendingOwnerRequests > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMainTab('requests');
                        setRequestsSubTab('received');
                      }}
                      className="gap-1.5"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      {pendingOwnerRequests} {t('Pending Inquiries', 'நிலுவை விசாரணைகள்')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tenant & Renter Launchpad */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {t('Tenant & Rental Activities', 'வாடகைதாரர் மையம்')}
                    </CardTitle>
                    <CardDescription>
                      {t('Manage active rental agreements, pay rent online, and submit maintenance tickets.', 'வாடகை ஒப்பந்தங்கள், ஆன்லைன் கட்டணங்கள் மற்றும் பராமரிப்பை நிர்வகிக்கவும்.')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Track monthly dues, upload payment receipts, and request repairs directly from your property owner.',
                    'மாதாந்திர நிலுவைகளைக் கண்காணிக்கவும், கட்டண ரசீதுகளைப் பதிவேற்றவும், பழுதுபார்ப்புகளைக் கோரவும்.'
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setMainTab('rentals')}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <KeyRound className="h-4 w-4" />
                    {t('Open Rental Portal', 'வாடகை போர்டலைத் திறக்க')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onBrowseProperties?.('rent')}
                    className="gap-1.5"
                  >
                    <Home className="h-3.5 w-3.5 text-primary" />
                    {t('Find Rental Properties', 'வாடகை சொத்துக்களை தேட')}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMainTab('requests');
                      setRequestsSubTab('sent');
                    }}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    {t('Track My Applications', 'என் விண்ணப்பங்கள்')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Notice about Multi-Activity */}
          <div className="bg-muted/40 border border-border/60 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">
                {t('Unified Account Architecture: ', 'ஒருங்கிணைந்த கணக்கு கட்டமைப்பு: ')}
              </span>
              {t(
                'You no longer need separate accounts for owning and renting. With your verified USER account, you can list properties, rent houses, manage tenants, and pay rent simultaneously from this dashboard.',
                'சொத்துரிமை மற்றும் வாடகைக்கு தனித்தனி கணக்குகள் இனி தேவையில்லை. உங்கள் பயனர் கணக்கின் மூலம், நீங்கள் ஒரே நேரத்தில் சொத்துக்களை பட்டியலிடலாம், வாடகைக்கு எடுக்கலாம், மற்றும் வாடகை செலுத்தலாம்.'
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: My Properties (Landlord management from OwnerDashboard) */}
        <TabsContent value="properties" className="mt-0">
          <OwnerDashboard
            initialTab="properties"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>

        {/* Tab 3: My Rentals (Tenant management from CustomerDashboard) */}
        <TabsContent value="rentals" className="mt-0">
          <CustomerDashboard
            initialTab="rentals"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>

        {/* Tab 4: Unified Requests Hub */}
        <TabsContent value="requests" className="space-y-4 mt-0">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Button
                variant={requestsSubTab === 'received' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRequestsSubTab('received')}
                className="gap-1.5"
              >
                <Inbox className="h-4 w-4" />
                {t('Received on My Properties', 'என் சொத்துக்களுக்கு வந்த கோரிக்கைகள்')}
                {pendingOwnerRequests > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">
                    {pendingOwnerRequests}
                  </Badge>
                )}
              </Button>
              <Button
                variant={requestsSubTab === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRequestsSubTab('sent')}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                {t('Sent by Me to Other Properties', 'நான் அனுப்பிய கோரிக்கைகள்')}
                {pendingTenantRequests > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">
                    {pendingTenantRequests}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {requestsSubTab === 'received' ? (
            <OwnerDashboard
              initialTab="requests"
              hideHeaderActions={true}
              onBrowseProperties={onBrowseProperties}
            />
          ) : (
            <CustomerDashboard
              initialTab="requests"
              hideHeaderActions={true}
              onBrowseProperties={onBrowseProperties}
            />
          )}
        </TabsContent>

        {/* Tab 5: Unified Reports Hub */}
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

        {/* Tab 6: Announcements */}
        <TabsContent value="announcements" className="mt-0">
          <OwnerDashboard
            initialTab="announcements"
            hideHeaderActions={true}
            onBrowseProperties={onBrowseProperties}
          />
        </TabsContent>

        {/* Tab 7: Profile & Settings */}
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
    </div>
  );
}
