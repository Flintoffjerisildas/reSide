
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { useGetCallerUserProfile, useGetAllProperties } from '../hooks/useQueries';
import PropertyListings from './PropertyListings';
import { 
  Home, 
  Users, 
  IndianRupee, 
  TrendingUp, 
  Briefcase, 
  Plus,
  Phone,
  MessageCircle
} from 'lucide-react';
import PropertyForm from './PropertyForm';

export default function BrokerDashboard() {
  const { t } = useLanguage();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: allProperties = [] } = useGetAllProperties();
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);

  // Mock Data for Broker
  const myListings = allProperties; // In real app: filter by broker
  const totalListings = myListings.length;
  const activeLeads = 24; // Mock
  const closedDeals = 8; // Mock

  const aiInsights = [
    {
      id: 1,
      title: t('Hot Location', 'முக்கிய இடம்'),
      description: t('Anna Nagar is seeing a 15% spike in 3BHK searches.', 'அண்ணா நகரில் 3BHK தேடல்களில் 15% அதிகரிப்பு காணப்படுகிறது.'),
      icon: TrendingUp,
      color: 'text-red-500'
    },
    {
      id: 2,
      title: t('Client Match', 'வாடிக்கையாளர் பொருத்தம்'),
      description: t('3 clients are looking for properties similar to "Green Valley Apt".', '"Green Valley Apt" போன்ற சொத்துக்களை 3 வாடிக்கையாளர்கள் தேடுகிறார்கள்.'),
      icon: Users,
      color: 'text-blue-500'
    }
  ];

  return (
    <div className="container py-8 sm:py-12 lg:py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('Broker/Builder Dashboard', 'தரகர்/கட்டுபவர் கட்டுப்பாட்டு அறை')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('Welcome back', 'மீண்டும் வருக')}, {userProfile?.name || 'Broker'}
            </p>
          </div>
          <Button onClick={() => setIsPropertyFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('Add Property', 'சொத்தைச் சேர்க்கவும்')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('Active Listings', 'செயலில் உள்ள பட்டியல்கள்')}
              </CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalListings}</div>
              <p className="text-xs text-muted-foreground">
                {t('+5 new this week', 'இந்த வாரம் +5 புதியது')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('Active Leads', 'செயலில் உள்ள தடங்கள்')}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeLeads}</div>
              <p className="text-xs text-muted-foreground">
                {t('12 high priority', '12 அதிக முன்னுரிமை')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('Deals Closed', 'ஒப்பந்தங்கள் முடிவடைந்தன')}
              </CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{closedDeals}</div>
              <p className="text-xs text-muted-foreground">
                {t('This month', 'இந்த மாதம்')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t('AI Insights', 'AI நுண்ணறிவு')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {aiInsights.map((insight) => (
              <Card key={insight.id} className="bg-muted/50 border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <insight.icon className={`h-5 w-5 ${insight.color}`} />
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Marketplace / Listings */}
        <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">{t('Your Listings & Marketplace', 'உங்கள் பட்டியல்கள் & சந்தை')}</h2>
            <PropertyListings />
        </div>

        {/* Add Property Modal */}
        <PropertyForm 
          open={isPropertyFormOpen} 
          onOpenChange={setIsPropertyFormOpen} 
        />
      </div>
    </div>
  );
}
