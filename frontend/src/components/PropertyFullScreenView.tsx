import { useState, useEffect } from 'react';
import axios from 'axios';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Mail, 
  Phone, 
  Home, 
  MapPin, 
  IndianRupee,
  Wrench,
  CreditCard,
  FileText,
  ArrowLeft,
  Calendar,
  Users,
  Heart,
  Briefcase
} from 'lucide-react';
import { Eye, EyeOff, Globe, Lock, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { translateText } from '../lib/api';
import {
  useGetVacateRequestsForProperty,
  useApproveVacateRequest,
  useRejectVacateRequest,
  useCompleteVacateRequest,
} from '../hooks/useQueries';
import AgreementDialog from './AgreementDialog';
import ListingControlDialog from './ListingControlDialog';

interface PropertyFullScreenViewProps {
  property: Property | null;
  onBack: () => void;
  initialTab?: 'tenant' | 'payments' | 'maintenance' | 'agreements' | 'vacate';
}

interface PaymentSummary {
  _id: string;
  rentAmount: number;
  month: string;
  dueDate: string;
  status: string;
  totalPaid: number;
  balance: number;
  tenant?: {
    _id: string;
    name: string;
    email: string;
  };
}

interface MaintenanceRequest {
  _id: string;
  property: string;
  tenant: {
    name: string;
    phone?: string;
  };
  issue: string;
  description?: string;
  category?: 'Plumbing' | 'Electrical' | 'Appliance' | 'Structural' | 'Cleaning' | 'Other';
  priority?: 'High' | 'Medium' | 'Low';
  summary?: string;
  status: 'pending' | 'completed' | 'in-progress';
  createdAt: string;
  completedAt?: string;
}

interface AgreementDocument {
  name: string;
  data: string;
  uploadedAt?: string;
}

interface Agreement {
  _id: string;
  property?: {
    title: string;
    location: string;
  };
  tenant?: {
    _id: string;
    name: string;
    email: string;
  };
  owner?: {
    _id: string;
    name: string;
  };
  rentAmount?: number;
  startDate: string;
  endDate?: string;
  status: string;
  terms?: string;
  documents?: AgreementDocument[];
}

type PropertyTabKey = 'tenant' | 'payments' | 'maintenance' | 'agreements' | 'vacate';

export default function PropertyFullScreenView({ property, onBack, initialTab }: PropertyFullScreenViewProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<PropertyTabKey>(initialTab || 'tenant');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentSummary[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any | null>(null);
  const [propertyPaymentRequests, setPropertyPaymentRequests] = useState<any[]>([]);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const propertyId = (property as any)?._id || property?.id || null;
  const title = String(property?.title || '').trim();
  const loc = String(property?.location || '').trim();

  useEffect(() => {
    if (language !== 'ta' || !property) {
      setTitleTa(null);
      setLocationTa(null);
      return;
    }

    (async () => {
      try {
        if (title) {
          const res = await translateText(title, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setTitleTa(out && out.trim() ? out : null);
        } else {
          setTitleTa(null);
        }

        if (loc) {
          const res = await translateText(loc, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setLocationTa(out && out.trim() ? out : null);
        } else {
          setLocationTa(null);
        }
      } catch {
        setTitleTa(null);
        setLocationTa(null);
      }
    })();
  }, [language, property, title, loc]);
  const {
    data: vacateRequests = [],
    isLoading: loadingVacateRequests,
    refetch: refetchVacateRequests,
  } = useGetVacateRequestsForProperty(propertyId);
  const approveVacateRequest = useApproveVacateRequest();
  const rejectVacateRequest = useRejectVacateRequest();
  const completeVacateRequest = useCompleteVacateRequest();

  useEffect(() => {
    if (property) {
      fetchPaymentDetails();
      fetchMaintenanceRequests();
      fetchAgreements();
      setCurrentImageIndex(0);
    }
  }, [property]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!property || !property.tenant) {
      setTenantDetails(null);
      return;
    }

    if (typeof property.tenant === 'string') {
      setTenantDetails(null);
      return;
    }

    setTenantDetails(property.tenant);
  }, [property]);

  const fetchPaymentDetails = async () => {
    try {
      setLoadingPayments(true);
      const token = localStorage.getItem('token');
      if (!property) return;

      const res = await axios.get('http://localhost:5000/api/payments/owner/summary', {
        headers: { 'x-auth-token': token }
      });

      const data = res.data;
      const currentMonth = data.currentMonth;
      const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];

      const summaries: PaymentSummary[] = breakdown
        .filter((item: any) => {
          const propId =
            item.propertyId ||
            item.property?._id ||
            item.property?.id;
          const thisId = (property as any)._id || property.id;
          return propId && thisId && String(propId) === String(thisId);
        })
        .map((item: any) => {
          const monthDate = new Date(currentMonth);
          const dueDate = new Date(currentMonth);
          dueDate.setDate(5);

          return {
            _id: item.propertyId || ((property as any)._id || property.id),
            rentAmount: item.rentAmount,
            month: monthDate.toISOString(),
            dueDate: dueDate.toISOString(),
            status: item.status,
            totalPaid: item.totalPaid,
            balance: item.balance,
            tenant: {
              _id: '',
              name: '',
              email: ''
            }
          };
        });

      setPaymentDetails(summaries);

      const requestsRes = await axios.get('http://localhost:5000/api/payments/owner/requests', {
        headers: { 'x-auth-token': token }
      });

      const allRequests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
      const thisId = (property as any)._id || property.id;
      const propertyRequests = allRequests.filter((p: any) => {
        const propId =
          p.rentRecord?.property?._id ||
          p.rentRecord?.property?.id ||
          p.rentRecord?.property;
        return propId && thisId && String(propId) === String(thisId);
      });

      setPropertyPaymentRequests(propertyRequests);
    } catch (err) {
      console.error('Error fetching owner payment summary:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchMaintenanceRequests = async () => {
    try {
      setLoadingMaintenance(true);
      const token = localStorage.getItem('token');
      if (!property) return;

      const res = await axios.get(
        `http://localhost:5000/api/requests/property/${property.id}/maintenance`,
        { headers: { 'x-auth-token': token } }
      );
      setMaintenanceRequests(res.data);
    } catch (err) {
      console.error('Error fetching maintenance requests:', err);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      setLoadingAgreements(true);
      const token = localStorage.getItem('token');
      if (!property) return;

      const res = await axios.get(
        `http://localhost:5000/api/agreements/property/${(property as any)._id || property.id}`,
        { headers: { 'x-auth-token': token } }
      );
      setAgreements(res.data);
    } catch (err) {
      console.error('Error fetching agreements:', err);
    } finally {
      setLoadingAgreements(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      const token = localStorage.getItem('token');
      setApprovingPaymentId(paymentId);
      await axios.put(
        `http://localhost:5000/api/payments/${paymentId}/approve`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      toast.success(
        t('Payment approved successfully', 'கட்டணம் வெற்றிகரமாக அங்கீகரிக்கப்பட்டது')
      );
      fetchPaymentDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.msg ||
        t('Failed to approve payment', 'கட்டணத்தை அங்கீகரிக்க முடியவில்லை');
      toast.error(msg);
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    try {
      const token = localStorage.getItem('token');
      setRejectingPaymentId(paymentId);
      await axios.put(
        `http://localhost:5000/api/payments/${paymentId}/reject`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      toast.success(t('Payment rejected', 'கட்டணம் நிராகரிக்கப்பட்டது'));
      fetchPaymentDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.msg ||
        t('Failed to reject payment', 'கட்டணத்தை நிராகரிக்க முடியவில்லை');
      toast.error(msg);
    } finally {
      setRejectingPaymentId(null);
    }
  };

  const handleViewAgreement = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setAgreementDialogOpen(true);
  };

  const handleDownloadAgreement = (agreement: Agreement) => {
    const today = new Date();
    const start = new Date(agreement.startDate);
    const content = `
      <div style="padding:32px;font-family:'Times New Roman',Times,serif;line-height:1.6;color:#000;">
        <h1 style="text-align:center;text-decoration:underline;margin-bottom:24px;font-size:24px;font-weight:bold;">RENTAL AGREEMENT</h1>
        <p style="margin-bottom:16px;">
          This Rental Agreement is made and executed on this <strong style="border-bottom:1px solid #000;padding:0 5px;">${today.getDate()}</strong> day of 
          <strong style="border-bottom:1px solid #000;padding:0 5px;">${today.toLocaleString('default', { month: 'long' })}</strong>, 
          20<strong style="border-bottom:1px solid #000;padding:0 5px;">${today.getFullYear().toString().slice(-2)}</strong>
        </p>
        <div style="margin-bottom:16px;">
          <p><strong>Between:</strong></p>
          <div style="margin-left:16px;margin-top:8px;">
            <p><strong>Owner / Landlord:</strong></p>
            <p>Name: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:200px;display:inline-block;">${agreement.owner?.name || ''}</span></p>
            <p>Address: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:300px;display:inline-block;">${(agreement as any).owner?.address || ''}</span></p>
            <p>Phone: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:200px;display:inline-block;">${(agreement as any).owner?.phone || ''}</span></p>
          </div>
          <div style="margin-left:16px;margin-top:8px;">
            <p><strong>Tenant:</strong></p>
            <p>Name: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:200px;display:inline-block;">${agreement.tenant?.name || ''}</span></p>
            <p>Address: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:300px;display:inline-block;">${(agreement as any).tenant?.address || ''}</span></p>
            <p>Phone: <span style="border-bottom:1px solid #000;padding:0 5px;min-width:200px;display:inline-block;">${(agreement as any).tenant?.phone || ''}</span></p>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">1. Property Details</h3>
          <p>The Landlord hereby agrees to rent the residential property located at:</p>
          <p>Address: <span style="border-bottom:1px solid #000;padding:0 5px;display:inline-block;width:100%;">${agreement.property?.location || ''}</span></p>
        </div>
        <div style="margin-bottom:16px;">
          <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">2. Rental Period</h3>
          <p>
            The rental agreement shall commence from <strong style="border-bottom:1px solid #000;padding:0 5px;">${start.getDate()}</strong> / 
            <strong style="border-bottom:1px solid #000;padding:0 5px;">${start.getMonth() + 1}</strong> / 
            20<strong style="border-bottom:1px solid #000;padding:0 5px;">${start.getFullYear().toString().slice(-2)}</strong> and shall be valid for a period of 
            <strong style="border-bottom:1px solid #000;padding:0 5px;">11</strong> months.
          </p>
        </div>
        <div style="margin-bottom:16px;">
          <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">3. Monthly Rent</h3>
          <p>The Tenant agrees to pay a monthly rent of ₹<strong style="border-bottom:1px solid #000;padding:0 5px;">${agreement.rentAmount?.toLocaleString() || ''}</strong></p>
        </div>
        <div style="margin-top:32px;display:flex;justify-content:space-between;">
          <div style="width:48%;">
            <p style="margin-bottom:24px;">Landlord Signature: _________________________</p>
            <p>Name: <strong style="border-bottom:1px solid #000;padding:0 5px;min-width:150px;display:inline-block;">${agreement.owner?.name || ''}</strong></p>
            <p>Date: _________________________</p>
          </div>
          <div style="width:48%;">
            <p style="margin-bottom:24px;">Tenant Signature: _________________________</p>
            <p>Name: <strong style="border-bottom:1px solid #000;padding:0 5px;min-width:150px;display:inline-block;">${agreement.tenant?.name || ''}</strong></p>
            <p>Date: _________________________</p>
          </div>
        </div>
      </div>
    `;
    const w = window.open('', 'PrintAgreement');
    if (!w) return;
    w.document.write(`<html><head><title>Rental Agreement</title></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  const handleDownloadAgreementDocument = (doc: AgreementDocument) => {
    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateMaintenanceStatus = async (requestId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/requests/${requestId}`,
        { status: newStatus },
        { headers: { 'x-auth-token': token } }
      );
      toast.success(t('Status updated successfully', 'நிலை வெற்றிகரமாக புதுப்பிக்கப்பட்டது'));
      fetchMaintenanceRequests();
    } catch (err) {
      console.error(err);
      toast.error(t('Failed to update status', 'நிலை புதுப்பிக்க முடியவில்லை'));
    }
  };

  if (!property) return null;

  const tenant = typeof property.tenant === 'object' ? property.tenant : null;
  const tenantProfile: any = tenantDetails || tenant;
  const images = property.images || [];
  const hasImages = images.length > 0;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
    <div className="min-h-screen bg-background/80 dark:bg-background/80 backdrop-blur-xs relative z-10">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b glass-nav">
        <div className="container mx-auto px-4 py-2.5 sm:py-3 max-w-4xl flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="gap-1.5 h-8 px-2.5 text-xs sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Back', 'பின்னால்')}
          </Button>
          <h1 className="text-lg sm:text-xl font-bold flex-1 text-center truncate px-2">
            {t('Property Details', 'சொத்து விவரங்கள்')}
          </h1>
          <div className="w-16 sm:w-20" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-4 sm:py-5 max-w-4xl space-y-3.5">
        {/* Image Carousel */}
        <div className="relative bg-muted/40 rounded-xl overflow-hidden aspect-[16/9] max-h-[260px] sm:max-h-[320px] md:max-h-[340px] w-full border border-border/60 shadow-xs">
          {hasImages ? (
            <>
              <img
                src={images[currentImageIndex]}
                alt={`${language === 'ta' ? (titleTa || property.title) : property.title} - ${currentImageIndex + 1}`}
                className="object-cover w-full h-full"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 px-2.5 py-0.5 rounded-full text-white text-xs">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Home className="h-10 w-10 text-muted-foreground/20" />
            </div>
          )}
        </div>

        {/* Property Details Containing Box */}
        <div className="rounded-xl p-3.5 sm:p-4 md:p-5 bg-card/95 dark:bg-card/95 border border-border/80 shadow-xs backdrop-blur-md space-y-2.5 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Home className="h-3 w-3" />
                <span>{t('Property Details', 'சொத்து விவரங்கள்')}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                {language === 'ta' ? (titleTa || property.title) : property.title}
              </h1>
              <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                <span className="truncate">
                  {language === 'ta' ? (locationTa || property.location) : property.location}
                </span>
              </div>

              {/* Ownership & Listing Visibility Status Row */}
              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                {((property as any)?.saleStatus === 'sold' || !!property.buyer || ((property as any)?.previousOwners && (property as any).previousOwners.length > 0)) && (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-medium">
                    ✓ {t('Acquired / Owned', 'வாங்கப்பட்டது')}
                  </Badge>
                )}
                {(property.occupancyStatus === 'occupied' || property.tenant) && (
                  <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t('Occupied', 'குடியேற்றப்பட்டது')}
                  </Badge>
                )}
                {property.listingStatus === 'listed' || (property.isListed && property.listingStatus !== 'unlisted') ? (
                  <Badge className={`text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 ${
                    property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}>
                    <Globe className="h-3 w-3" />
                    {property.transactionType?.toLowerCase() === 'rent'
                      ? t('Listed for Rent', 'வாடகைக்கு வெளியிடப்பட்டது')
                      : t('Listed for Sale', 'விற்பனைக்கு வெளியிடப்பட்டது')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                    <EyeOff className="h-3 w-3" />
                    {t('Private / Unlisted', 'பட்டியலிடப்படவில்லை')}
                  </Badge>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10 ml-auto"
                  onClick={() => setIsListingDialogOpen(true)}
                >
                  <Share2 className="h-2.5 w-2.5" />
                  {property.listingStatus === 'listed' || (property.isListed && property.listingStatus !== 'unlisted')
                    ? t('Edit Listing', 'பட்டியலைத் திருத்து')
                    : t('Listing Visibility', 'பட்டியல் தெரிவுநிலை')}
                </Button>
              </div>
            </div>

            {property.price !== undefined && property.price !== null && (
              <div className="sm:text-right shrink-0">
                <div className="flex items-center text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  <IndianRupee className="h-5 w-5 mr-0.5 shrink-0" />
                  <span>{typeof property.price === 'number' ? property.price.toLocaleString() : property.price}</span>
                  {property.transactionType && (
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1.5 capitalize">
                      / {property.transactionType}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {property.description && (
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed border-t border-border/50 pt-2 mt-1">
              {property.description}
            </p>
          )}
        </div>

        {/* Tabs for Tenant, Payments, Maintenance, Agreements and Vacate */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PropertyTabKey)} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-9 sm:h-10 p-1 bg-muted/60 dark:bg-muted/40">
            <TabsTrigger value="tenant" className="text-xs sm:text-sm py-1">{t('Tenant', 'குத்தகைதாரர்')}</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm py-1">{t('Payments', 'கட்டணங்கள்')}</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs sm:text-sm py-1">{t('Maintenance', 'பராமரிப்பு')}</TabsTrigger>
            <TabsTrigger value="agreements" className="text-xs sm:text-sm py-1">{t('Agreements', 'ஒப்பந்தங்கள்')}</TabsTrigger>
            <TabsTrigger value="vacate" className="text-xs sm:text-sm py-1">{t('Vacate', 'வெளியேறு')}</TabsTrigger>
          </TabsList>

          {/* Tenant Tab */}
          <TabsContent value="tenant" className="space-y-3 mt-3 sm:mt-3.5">
            {tenantProfile ? (
              <div className="space-y-4">
                {/* Basic Tenant Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('Tenant Information', 'குத்தகைதாரர் தகவல்')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('Name', 'பெயர்')}</p>
                        <p className="text-base font-semibold">{tenantProfile.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('Email', 'மின்னஞ்சல்')}</p>
                        <p className="text-base break-all flex items-center gap-1">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          {tenantProfile.email}
                        </p>
                      </div>
                    </div>
                    {tenantProfile.phone && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('Phone', 'தொலைபேசி')}</p>
                        <p className="text-base flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {tenantProfile.phone}
                        </p>
                      </div>
                    )}
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 w-fit">
                      {t('Occupied', 'குடியேற்றப்பட்டது')}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Detailed Tenant Information */}
                {tenantProfile && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {t('Detailed Information', 'விரிவான தகவல்')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {typeof tenantProfile.age === 'number' && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{t('Age', 'வயது')}</p>
                            <p className="font-semibold">
                              {tenantProfile.age} {t('years', 'வருடங்கள்')}
                            </p>
                          </div>
                        )}
                        {tenantProfile.gender && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{t('Gender', 'பாலினம்')}</p>
                            <p className="font-semibold">{tenantProfile.gender}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {tenantProfile.dateOfBirth && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Date of Birth', 'பிறந்த தேதி')}
                            </p>
                            <p className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(tenantProfile.dateOfBirth).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {typeof tenantProfile.familyMembers === 'number' && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Family Members', 'குடும்ப உறுப்பினர்கள்')}
                            </p>
                            <p className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {tenantProfile.familyMembers}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {tenantProfile.religion && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Religion', 'மதம்')}
                            </p>
                            <p className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {tenantProfile.religion}
                            </p>
                          </div>
                        )}
                        {tenantProfile.maritalStatus && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Marital Status', 'திருமண நிலை')}
                            </p>
                            <p className="font-semibold">{tenantProfile.maritalStatus}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {tenantProfile.occupation && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Occupation', 'தொழில்')}
                            </p>
                            <p className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {tenantProfile.occupation}
                            </p>
                          </div>
                        )}
                        {tenantProfile.companyName && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Company', 'நிறுவனம்')}
                            </p>
                            <p className="font-semibold">{tenantProfile.companyName}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {typeof tenantProfile.monthlyIncome === 'number' && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Monthly Income', 'மாத வருமானம்')}
                            </p>
                            <p className="font-semibold">
                              ₹{tenantProfile.monthlyIncome.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {tenantProfile.address && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Address', 'முகவரி')}
                            </p>
                            <p className="text-sm break-words">{tenantProfile.address}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {(tenantProfile.idType || tenantProfile.idNumber) && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('ID Proof', 'அடையாள ஆவணம்')}
                            </p>
                            <p className="text-sm">
                              {tenantProfile.idType && <span>{tenantProfile.idType}: </span>}
                              {tenantProfile.idNumber}
                            </p>
                          </div>
                        )}
                        {tenantProfile.aadhar && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {t('Aadhaar Number', 'ஆதார் எண்')}
                            </p>
                            <p className="font-mono text-sm">{tenantProfile.aadhar}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border border-border/70 shadow-xs">
                <CardContent className="py-6 sm:py-7">
                  <div className="text-center space-y-2">
                    <Home className="h-7 w-7 text-muted-foreground/35 mx-auto" />
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                      {t('No tenant assigned to this property.', 'இந்த சொத்திற்கு குத்தகைதாரர் யாரும் நியமிக்கப்படவில்லை.')}
                    </p>
                    <Badge variant="secondary" className="text-[11px] px-2 py-0.5">{t('Vacant', 'காலியாக')}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-3 mt-3 sm:mt-3.5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('Payment Details', 'கட்டண விவரங்கள்')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('Loading payment details...', 'கட்டண விவரங்களை ஏற்றுகிறது...')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {paymentDetails.length > 0 ? (
                      <div className="space-y-4">
                        {paymentDetails.map((payment) => (
                          <div
                            key={payment._id}
                            className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-lg font-bold text-green-600">
                                    ₹{payment.rentAmount.toLocaleString()}
                                  </p>
                                  <Badge
                                    variant={
                                      payment.status === 'paid'
                                        ? 'default'
                                        : payment.status === 'partially_paid'
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                    className={
                                      payment.status === 'paid'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : payment.status === 'overdue'
                                        ? 'border-red-500 text-red-600'
                                        : ''
                                    }
                                  >
                                    {payment.status === 'paid'
                                      ? t('Paid', 'செலுத்தப்பட்டது')
                                      : payment.status === 'partially_paid'
                                      ? t('Partially Paid', 'பகுதியாக செலுத்தப்பட்டது')
                                      : payment.status === 'overdue'
                                      ? t('Overdue', 'காலாவதியானது')
                                      : t('Pending', 'நிலுவையில் உள்ளது')}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t('Tenant', 'குத்தகைதாரர்')}: {payment.tenant?.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t('Month', 'மாதம்')}:{' '}
                                  {new Date(payment.month).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t('Due Date', 'கட்டண கடைசி தேதி')}:{' '}
                                  {new Date(payment.dueDate).toLocaleDateString()}
                                </p>
                                {typeof payment.totalPaid === 'number' && (
                                  <p className="text-xs text-muted-foreground">
                                    {t('Paid', 'செலுத்தப்பட்டது')}:{' '}
                                    ₹{payment.totalPaid.toLocaleString()} |{' '}
                                    {t('Balance', 'இருப்பு')}:{' '}
                                    ₹{payment.balance.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        {t(
                          'No payment records found for this property.',
                          'இந்த சொத்துக்கான கட்டண பதிவுகள் எதுவும் காணப்படவில்லை.'
                        )}
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-medium">
                        {t(
                          'Payment Requests for this Property',
                          'இந்த சொத்துக்கான கட்டண கோரிக்கைகள்'
                        )}
                      </p>
                      {propertyPaymentRequests.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            'No pending payment requests for this property.',
                            'இந்த சொத்துக்கான நிலுவையில் உள்ள கட்டண கோரிக்கைகள் இல்லை.'
                          )}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {propertyPaymentRequests.map((payment) => (
                            <div
                              key={payment._id}
                              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-md px-3 py-2"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">
                                  {payment.tenant?.name ||
                                    t('Unknown Tenant', 'அறியப்படாத குத்தகைதாரர்')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ₹{Number(payment.amount || 0).toLocaleString()}{' '}
                                  •{' '}
                                  {payment.date
                                    ? new Date(payment.date).toLocaleDateString()
                                    : ''}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePayment(payment._id)}
                                  disabled={approvingPaymentId === payment._id}
                                >
                                  {approvingPaymentId === payment._id
                                    ? t('Approving...', 'அங்கீகரிக்கிறது...')
                                    : t('Approve', 'அங்கீகரிக்க')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectPayment(payment._id)}
                                  disabled={rejectingPaymentId === payment._id}
                                >
                                  {rejectingPaymentId === payment._id
                                    ? t('Rejecting...', 'நிராகரிக்கிறது...')
                                    : t('Reject', 'நிராகரிக்க')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-3 mt-3 sm:mt-3.5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  {t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMaintenance ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('Loading maintenance requests...', 'பராமரிப்பு கோரிக்கைகளை ஏற்றுகிறது...')}
                  </div>
                ) : maintenanceRequests.length > 0 ? (
                  <div className="space-y-4">
                    {maintenanceRequests.map((request) => (
                      <div
                        key={request._id}
                        className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-2">
                              <Wrench className="h-5 w-5 mt-1 text-amber-600 flex-shrink-0" />
                              <div>
                                <p className="font-semibold text-base">{request.issue}</p>
                                {request.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">{t('Reported by', 'இதன் மூலம் தெரிவிக்கப்பட்டது')}</p>
                                <p className="font-medium">{request.tenant?.name}</p>
                              </div>
                              {request.tenant?.phone && (
                                <div>
                                  <p className="text-xs text-muted-foreground">{t('Phone', 'தொலைபேசி')}</p>
                                  <p className="font-medium">{request.tenant.phone}</p>
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {t('Reported on', 'இதில் தெரிவிக்கப்பட்டது')}: {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 md:items-end">
                            {(request.category || request.priority) && (
                              <div className="flex gap-2 flex-wrap justify-end">
                                {request.category && (
                                  <Badge variant="outline" className="bg-background/80">
                                    {request.category}
                                  </Badge>
                                )}
                                {request.priority && (
                                  <Badge
                                    variant="secondary"
                                    className={
                                      request.priority === 'High'
                                        ? 'bg-red-100 text-red-800'
                                        : request.priority === 'Medium'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-green-100 text-green-800'
                                    }
                                  >
                                    {request.priority}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <Badge
                              variant={
                                request.status === 'pending'
                                  ? 'secondary'
                                  : request.status === 'in-progress'
                                    ? 'default'
                                    : 'default'
                              }
                              className={
                                request.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : request.status === 'in-progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                              }
                            >
                              {request.status}
                            </Badge>

                            {request.status !== 'completed' && (
                              <div className="flex gap-1 flex-wrap justify-end">
                                {request.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={() => handleUpdateMaintenanceStatus(request._id, 'in-progress')}
                                  >
                                    {t('Start', 'தொடக்கம்')}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="text-xs bg-green-600 hover:bg-green-700"
                                  onClick={() => handleUpdateMaintenanceStatus(request._id, 'completed')}
                                >
                                  {t('Mark Done', 'செய்ததாக குறிக்கவும்')}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('No maintenance requests for this property.', 'இந்த சொத்துக்கான பராமரிப்பு கோரிக்கைகள் எதுவும் இல்லை.')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agreements Tab */}
          <TabsContent value="agreements" className="space-y-3 mt-3 sm:mt-3.5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('Rental Agreements', 'வாடகை ஒப்பந்தங்கள்')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAgreements ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('Loading agreements...', 'ஒப்பந்தங்களை ஏற்றுகிறது...')}
                  </div>
                ) : agreements.length > 0 ? (
                  <div className="space-y-4">
                    {agreements.map((agreement) => (
                      <div 
                        key={agreement._id} 
                        className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{agreement.property?.title || 'Property Title'}</h3>
                            <p className="text-sm text-muted-foreground">{agreement.property?.location || 'Location'}</p>
                          </div>
                          <Badge variant={agreement.status === 'active' ? 'default' : 'secondary'}>
                            {agreement.status?.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{t('Tenant', 'குத்தகைதாரர்')}</p>
                            <p className="font-medium">{agreement.tenant?.name}</p>
                            <p className="text-xs text-muted-foreground">{agreement.tenant?.email}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{t('Rent Amount', 'வாடகை தொகை')}</p>
                            <p className="font-bold text-green-600">₹{agreement.rentAmount?.toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{t('Start Date', 'தொடக்க தேதி')}</p>
                            <p>{new Date(agreement.startDate).toLocaleDateString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{t('End Date', 'முடிவு தேதி')}</p>
                            <p>{agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>

                        {agreement.terms && (
                          <div className="bg-muted/50 p-3 rounded mb-4 text-sm">
                            <p className="font-medium mb-2">
                              {t('Terms & Conditions', 'விதிமுறைகள் மற்றும் நிபந்தனைகள்')}
                            </p>
                            <p className="text-muted-foreground">{agreement.terms}</p>
                          </div>
                        )}

                        {agreement.documents && agreement.documents.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-muted-foreground mb-2">
                              {t('Agreement Documents', 'ஒப்பந்த ஆவணங்கள்')}
                            </p>
                            <div className="border rounded-md divide-y">
                              {agreement.documents.map((doc, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between px-3 py-2 text-sm"
                                >
                                  <span className="truncate max-w-[60%]">{doc.name}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadAgreementDocument(doc)}
                                  >
                                    {t('Download', 'பதிவிறக்கவும்')}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => handleViewAgreement(agreement)}>
                            <FileText className="h-4 w-4 mr-2" />
                            {t('View Details', 'விவரங்களைக் காண்க')}
                          </Button>
                          <Button className="flex-1" onClick={() => handleDownloadAgreement(agreement)}>
                            <FileText className="h-4 w-4 mr-2" />
                            {t('Download PDF', 'PDF ஐப் பதிவிறக்கவும்')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('No agreements found for this property.', 'இந்த சொத்துக்கான ஒப்பந்தங்கள் எதுவும் காணப்படவில்லை.')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vacate Tab */}
          <TabsContent value="vacate" className="space-y-3 mt-3 sm:mt-3.5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('Vacate Requests', 'வெளியேறும் கோரிக்கைகள்')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingVacateRequests ? (
                  <p className="text-sm text-muted-foreground">
                    {t('Loading vacate requests...', 'வெளியேறும் கோரிக்கைகளை ஏற்றுகிறது...')}
                  </p>
                ) : vacateRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'No vacate requests for this property.',
                      'இந்த சொத்திற்கான வெளியேறும் கோரிக்கைகள் இல்லை.'
                    )}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vacateRequests.map((r: any) => (
                      <div
                        key={r._id || r.id}
                        className="border rounded-md p-3 flex flex-col gap-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {r.tenant?.name || t('Tenant', 'குத்தகைதாரர்')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('Requested vacate date', 'வெளியேறும் தேதி')}{' '}
                              {new Date(r.requestedVacateDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              r.status === 'pending'
                                ? 'outline'
                                : r.status === 'approved'
                                ? 'default'
                                : r.status === 'completed'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {r.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.reason}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t('Requested on', 'கோரிக்கப்பட்ட தேதி')}{' '}
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {r.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  approveVacateRequest.mutate(r._id || r.id, {
                                    onSuccess: () => {
                                      toast.success(
                                        t(
                                          'Vacate request approved',
                                          'வெளியேறும் கோரிக்கை அங்கீகரிக்கப்பட்டது'
                                        )
                                      );
                                      refetchVacateRequests();
                                    },
                                    onError: (err: any) => {
                                      const msg =
                                        err?.response?.data?.msg ||
                                        t(
                                          'Failed to approve vacate request',
                                          'வெளியேறும் கோரிக்கையை அங்கீகரிக்க முடியவில்லை'
                                        );
                                      toast.error(msg);
                                    },
                                  });
                                }}
                              >
                                {t('Approve', 'அங்கீகரிக்கவும்')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  rejectVacateRequest.mutate(r._id || r.id, {
                                    onSuccess: () => {
                                      toast.success(
                                        t(
                                          'Vacate request rejected',
                                          'வெளியேறும் கோரிக்கை நிராகரிக்கப்பட்டது'
                                        )
                                      );
                                      refetchVacateRequests();
                                    },
                                    onError: (err: any) => {
                                      const msg =
                                        err?.response?.data?.msg ||
                                        t(
                                          'Failed to reject vacate request',
                                          'வெளியேறும் கோரிக்கையை நிராகரிக்க முடியவில்லை'
                                        );
                                      toast.error(msg);
                                    },
                                  });
                                }}
                              >
                                {t('Reject', 'நிராகரிக்கவும்')}
                              </Button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                completeVacateRequest.mutate(r._id || r.id, {
                                  onSuccess: () => {
                                    toast.success(
                                      t(
                                        'Vacate marked as completed',
                                        'வெளியேறும் செயல்முறை முடிந்ததாக குறிக்கப்பட்டது'
                                      )
                                    );
                                    refetchVacateRequests();
                                  },
                                  onError: (err: any) => {
                                    const msg =
                                      err?.response?.data?.msg ||
                                      t(
                                        'Failed to complete vacate',
                                        'வெளியேறும் செயல்முறையை முடிக்க முடியவில்லை'
                                      );
                                    toast.error(msg);
                                  },
                                });
                              }}
                            >
                              {t('Mark as Vacated', 'வெளியேறியது என குறிக்கவும்')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    <AgreementDialog
      agreement={selectedAgreement}
      open={agreementDialogOpen}
      onOpenChange={(open) => {
        setAgreementDialogOpen(open);
        if (!open) setSelectedAgreement(null);
      }}
      onUpdate={() => fetchAgreements()}
    />

    <ListingControlDialog
      property={property}
      open={isListingDialogOpen}
      onOpenChange={setIsListingDialogOpen}
    />
    </>
  );
}
