import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Briefcase,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Share2,
  Building2,
  Ruler,
  BedDouble,
  Compass,
  SlidersHorizontal,
  Edit,
  Trash2,
  Inbox,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCcw,
  Sparkles,
  Send,
  LogOut
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { translateText } from '../lib/api';
import {
  useGetOwnerRequests,
  useApproveRequest,
  useRejectRequest,
  useUpdateListingStatus,
  useDeleteProperty,
  useGetVacateRequestsForProperty,
  useApproveVacateRequest,
  useRejectVacateRequest,
  useCompleteVacateRequest,
} from '../hooks/useQueries';
import PropertyForm from './PropertyForm';
import AgreementDialog from './AgreementDialog';
import ListingControlDialog from './ListingControlDialog';
import RequestDetailsModal from './RequestDetailsModal';

interface PropertyFullScreenViewProps {
  property: Property | null;
  onBack: () => void;
  initialTab?: string;
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

type PropertySectionKey = 
  | 'overview' 
  | 'edit' 
  | 'listing' 
  | 'requests' 
  | 'tenancy' 
  | 'payments' 
  | 'agreements' 
  | 'maintenance'
  | 'vacate';

const getId = (v: any) => String(v?._id || v?.id || v || '');

export default function PropertyFullScreenView({ property, onBack, initialTab }: PropertyFullScreenViewProps) {
  const { t, language } = useLanguage();

  const resolveInitialSection = (tab?: string): PropertySectionKey => {
    if (!tab) return 'overview';
    if (tab === 'tenant') return 'tenancy';
    if (tab === 'vacate') return 'vacate';
    if (['overview', 'edit', 'listing', 'requests', 'tenancy', 'payments', 'agreements', 'maintenance', 'vacate'].includes(tab)) {
      return tab as PropertySectionKey;
    }
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState<PropertySectionKey>(resolveInitialSection(initialTab));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);

  // Payments & Tenancy & Maintenance & Agreements
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

  // Listing Management
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const [listingDefaultAction, setListingDefaultAction] = useState<'sale' | 'rent' | 'edit'>('sale');
  const updateListingStatusMutation = useUpdateListingStatus();

  // Requests & Transactions
  const { data: allOwnerRequests = [], refetch: refetchOwnerRequests } = useGetOwnerRequests();
  const approveRequestMutation = useApproveRequest();
  const rejectRequestMutation = useRejectRequest();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Delete Safeguard
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deletePropertyMutation = useDeleteProperty();

  const propertyId = getId(property);
  const title = String(property?.title || '').trim();
  const loc = String(property?.location || '').trim();

  // Filter requests for this specific property
  const propertyRequests = useMemo(() => {
    if (!propertyId || !Array.isArray(allOwnerRequests)) return [];
    return allOwnerRequests.filter((req: any) => {
      const reqPropId = getId(req?.property);
      return reqPropId === propertyId;
    });
  }, [allOwnerRequests, propertyId]);

  // Status flags
  const isAcquired = (property as any)?.saleStatus === 'sold' || !!property?.buyer || (Array.isArray((property as any)?.previousOwners) && (property as any).previousOwners.length > 0);
  const isCurrentlyListed = property?.listingStatus === 'listed' || (property?.isListed && property?.listingStatus !== 'unlisted');
  const isOccupied = property?.occupancyStatus === 'occupied' || !!property?.tenant;
  const isUnderContract = (property as any)?.saleStatus === 'under_contract';

  // Vacate requests
  const {
    data: vacateRequests = [],
    isLoading: loadingVacateRequests,
    refetch: refetchVacateRequests,
  } = useGetVacateRequestsForProperty(propertyId);
  const approveVacateRequest = useApproveVacateRequest();
  const rejectVacateRequest = useRejectVacateRequest();
  const completeVacateRequest = useCompleteVacateRequest();

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
      setActiveSection(resolveInitialSection(initialTab));
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
          return propId && propertyId && String(propId) === String(propertyId);
        })
        .map((item: any) => {
          const monthDate = new Date(currentMonth);
          const dueDate = new Date(currentMonth);
          dueDate.setDate(5);

          return {
            _id: item.propertyId || propertyId,
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
      const forThisProp = allRequests.filter((item: any) => {
        const propId =
          item.rentRecord?.property?._id ||
          item.rentRecord?.property?.id ||
          item.rentRecord?.property ||
          item.propertyId;
        return propId && propertyId && String(propId) === String(propertyId);
      });

      setPropertyPaymentRequests(forThisProp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchMaintenanceRequests = async () => {
    try {
      setLoadingMaintenance(true);
      const token = localStorage.getItem('token');
      if (!propertyId) return;

      const res = await axios.get(
        `http://localhost:5000/api/requests/property/${propertyId}/maintenance`,
        { headers: { 'x-auth-token': token } }
      );
      setMaintenanceRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      setLoadingAgreements(true);
      const token = localStorage.getItem('token');
      if (!propertyId) return;

      const res = await axios.get(
        `http://localhost:5000/api/agreements/property/${propertyId}`,
        { headers: { 'x-auth-token': token } }
      );
      setAgreements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAgreements(false);
    }
  };

  const handleApprovePayment = async (requestId: string) => {
    try {
      setApprovingPaymentId(requestId);
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/payments/owner/requests/${requestId}/approve`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      toast.success(
        t('Payment approved successfully', 'கட்டணம் வெற்றிகரமாக அங்கீகரிக்கப்பட்டது')
      );
      fetchPaymentDetails();
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.msg ||
        t('Failed to approve payment', 'கட்டணத்தை அங்கீகரிக்க முடியவில்லை');
      toast.error(msg);
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const handleRejectPayment = async (requestId: string) => {
    try {
      setRejectingPaymentId(requestId);
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/payments/owner/requests/${requestId}/reject`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      toast.success(
        t('Payment rejected', 'கட்டணம் நிராகரிக்கப்பட்டது')
      );
      fetchPaymentDetails();
    } catch (err: any) {
      console.error(err);
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

  // Listing controls
  const handleOpenListingDialog = (action: 'sale' | 'rent' | 'edit' = 'sale') => {
    setListingDefaultAction(action);
    setIsListingDialogOpen(true);
  };

  const handleQuickUnlist = async () => {
    if (!propertyId) return;
    try {
      await updateListingStatusMutation.mutateAsync({
        id: propertyId,
        listingStatus: 'unlisted'
      });
      toast.success(t('Property unlisted. Hidden from public listings.', 'சொத்து பட்டியலிலிருந்து நீக்கப்பட்டது.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to unlist property', 'சொத்தை பட்டியலிலிருந்து நீக்க முடியவில்லை'));
    }
  };

  // Request actions
  const handleApproveRequest = async (requestId: string) => {
    try {
      await approveRequestMutation.mutateAsync(requestId);
      toast.success(t('Request accepted. Customer notified to proceed with payment.', 'கோரிக்கை ஏற்கப்பட்டது. வாடிக்கையாளர் கட்டணம் செலுத்த அறிவிக்கப்பட்டது.'));
      refetchOwnerRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to accept request', 'கோரிக்கையை ஏற்க முடியவில்லை'));
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectRequestMutation.mutateAsync({ id: requestId });
      toast.success(t('Request rejected.', 'கோரிக்கை நிராகரிக்கப்பட்டது.'));
      refetchOwnerRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to reject request', 'கோரிக்கையை நிராகரிக்க முடியவில்லை'));
    }
  };

  const handleViewRequestDetails = (req: any) => {
    setSelectedRequest(req);
    setIsRequestModalOpen(true);
  };

  // Delete property
  const handleDeleteProperty = async () => {
    if (!propertyId) return;
    if (isOccupied) {
      toast.error(t('Cannot delete occupied property. Please vacate tenant first.', 'குடியேற்றப்பட்ட சொத்தை நீக்க முடியாது. முதலில் குத்தகைதாரரை வெளியேற்றவும்.'));
      setShowDeleteConfirm(false);
      return;
    }
    if (isUnderContract) {
      toast.error(t('Cannot delete property under active contract.', 'செயலில் உள்ள ஒப்பந்தத்தில் உள்ள சொத்தை நீக்க முடியாது.'));
      setShowDeleteConfirm(false);
      return;
    }

    try {
      await deletePropertyMutation.mutateAsync(propertyId);
      toast.success(t('Property deleted successfully', 'சொத்து வெற்றிகரமாக நீக்கப்பட்டது'));
      setShowDeleteConfirm(false);
      onBack();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to delete property', 'சொத்தை நீக்க முடியவில்லை');
      toast.error(msg);
      setShowDeleteConfirm(false);
    }
  };

  if (!property) return null;

  const tenant = typeof property.tenant === 'object' ? property.tenant : null;
  const tenantProfile: any = tenantDetails || tenant;
  const images = property.images || [];
  const hasImages = images.length > 0;
  const displayTitle = language === 'ta' ? (titleTa || property.title) : property.title;
  const displayLocation = language === 'ta' ? (locationTa || property.location) : property.location;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Responsive Navigation Item Config
  const navItems: { key: PropertySectionKey; label: string; icon: any; badge?: number }[] = [
    { key: 'overview', label: t('Overview', 'மேலோட்டம்'), icon: Home },
    { key: 'edit', label: t('Edit Details', 'திருத்து'), icon: Edit },
    { key: 'listing', label: t('Listing', 'பட்டியல்'), icon: Globe },
    { key: 'requests', label: t('Requests & Offers', 'கோரிக்கைகள்'), icon: Inbox, badge: propertyRequests.length },
    { key: 'tenancy', label: t('Tenancy', 'குத்தகை'), icon: Users },
    { key: 'payments', label: t('Rent & Payments', 'கட்டணங்கள்'), icon: CreditCard, badge: propertyPaymentRequests.length },
    { key: 'agreements', label: t('Agreements', 'ஒப்பந்தங்கள்'), icon: FileText },
    { key: 'maintenance', label: t('Maintenance', 'பராமரிப்பு'), icon: Wrench, badge: maintenanceRequests.filter(m => m.status === 'pending').length },
    { key: 'vacate', label: t('Vacate', 'வெளியேறு'), icon: LogOut, badge: vacateRequests.filter((r: any) => r.status === 'pending').length },
  ];

  return (
    <>
      <div className="w-full space-y-4">
        {/* Compact Property Header */}
        <div className="p-3 sm:p-4 rounded-xl bg-card/85 border border-border/70 shadow-xs backdrop-blur-md space-y-3">
          {/* Top Row: Back to Grid & Status Badges */}
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-7 text-xs px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="font-medium">{t('All Properties', 'அனைத்து சொத்துக்கள்')}</span>
            </Button>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Ownership */}
              {isAcquired ? (
                <Badge className="bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 font-medium shrink-0">
                  ✓ {t('Acquired', 'வாங்கப்பட்டது')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5 shrink-0">
                  {t('Owned', 'உரிமையாளர்')}
                </Badge>
              )}

              {/* Occupancy */}
              {isOccupied ? (
                <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                  <Users className="h-2.5 w-2.5" />
                  {t('Occupied', 'குடியேற்றப்பட்டது')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5 shrink-0">
                  {t('Vacant', 'காலியாக')}
                </Badge>
              )}

              {/* Listing */}
              {isUnderContract ? (
                <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                  <Lock className="h-2.5 w-2.5" />
                  {t('Under Contract', 'ஒப்பந்தத்தில்')}
                </Badge>
              ) : isCurrentlyListed ? (
                <Badge className={`text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0 ${
                  property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                }`}>
                  <Globe className="h-2.5 w-2.5" />
                  {property.transactionType?.toLowerCase() === 'rent'
                    ? t('Listed: Rent', 'வாடகைக்கு')
                    : t('Listed: Sale', 'விற்பனைக்கு')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                  <EyeOff className="h-2.5 w-2.5" />
                  {t('Private', 'தனிப்பட்டது')}
                </Badge>
              )}
            </div>
          </div>

          {/* Header Info Row: Small Thumbnail + Info + Quick Actions */}
          <div className="flex items-center gap-3">
            {/* Small Property Thumbnail */}
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden bg-muted/60 shrink-0 border border-border/60 shadow-2xs">
              {hasImages ? (
                <img
                  src={images[0]}
                  alt={displayTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full w-full text-muted-foreground/40">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              {images.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-xs text-[9px] font-mono font-medium text-white px-1 rounded">
                  {images.length}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">
                {displayTitle}
              </h2>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{displayLocation}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                <span className="font-bold text-green-600 dark:text-green-400">
                  ₹{Number(property.price || 0).toLocaleString()}
                  {property.transactionType?.toLowerCase() === 'rent' ? '/mo' : ''}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="capitalize font-medium text-muted-foreground">{property.propertyType}</span>
                {property.totalArea && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{property.totalArea} sq.ft</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Workspace Layout */}
        <div className="flex flex-col md:flex-row items-start gap-4">
          {/* Mobile 3x3 Grid Navigation Dock */}
          <div className="md:hidden w-full grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-card/75 border border-border/70 shadow-2xs">
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors relative cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-full text-center">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Left Sidebar Navigation */}
          <div className="hidden md:flex flex-col w-52 shrink-0 p-1.5 rounded-xl bg-card/75 border border-border/70 shadow-2xs sticky top-4 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('Management Sections', 'பிரிவுகள்')}
            </div>
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-primary'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Section Content Area */}
          <div className="flex-1 min-w-0 w-full space-y-4">
            {/* SECTION 1: OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-5xl">
                {/* 1. Hero Card: Two-Column on Desktop (Compact Proportional Image Left, Summary Right) */}
                <Card className="border border-border/70 shadow-xs overflow-hidden bg-card/90 backdrop-blur-sm">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 p-3 sm:p-4">
                    {/* Image Column */}
                    <div className="md:col-span-5 flex flex-col justify-center">
                      {hasImages ? (
                        <div className="relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/11] w-full bg-muted/40 border border-border/60 shadow-2xs group">
                          <img
                            src={images[currentImageIndex]}
                            alt={`${displayTitle} - ${currentImageIndex + 1}`}
                            className="object-cover w-full h-full"
                          />
                          {images.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={prevImage}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                                aria-label="Previous image"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={nextImage}
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                                aria-label="Next image"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/65 backdrop-blur-xs px-2 py-0.5 rounded-full text-white text-[10px] font-mono font-medium">
                                {currentImageIndex + 1} / {images.length}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[4/3] rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-muted-foreground/40 gap-1.5">
                          <Home className="h-7 w-7" />
                          <span className="text-xs">{t('No images uploaded', 'படங்கள் எதுவும் இல்லை')}</span>
                        </div>
                      )}
                    </div>

                    {/* Summary Column */}
                    <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Title and Contextual Edit Action */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate" title={displayTitle}>
                              {displayTitle}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate">{displayLocation}</span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                            onClick={() => setActiveSection('edit')}
                          >
                            <Edit className="h-3 w-3" />
                            {t('Edit', 'திருத்து')}
                          </Button>
                        </div>

                        {/* Price and Transaction */}
                        <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                            ₹{Number(property.price || 0).toLocaleString('en-IN')}
                          </span>
                          {property.transactionType?.toLowerCase() === 'rent' && (
                            <span className="text-xs text-muted-foreground font-normal">/mo</span>
                          )}
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0.5 font-medium uppercase tracking-wider">
                            {property.transactionType || 'Sale'}
                          </Badge>
                        </div>

                        {/* Badges: Ownership, Occupancy, Listing */}
                        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                          {isAcquired ? (
                            <Badge className="bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 font-medium shrink-0">
                              ✓ {t('Acquired', 'வாங்கப்பட்டது')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5 shrink-0">
                              {t('Owned', 'உரிமையாளர்')}
                            </Badge>
                          )}

                          {isOccupied ? (
                            <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                              <Users className="h-2.5 w-2.5" />
                              {t('Occupied', 'குடியேற்றப்பட்டது')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5 shrink-0">
                              {t('Vacant', 'காலியாக')}
                            </Badge>
                          )}

                          {isUnderContract ? (
                            <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                              <Lock className="h-2.5 w-2.5" />
                              {t('Under Contract', 'ஒப்பந்தத்தில்')}
                            </Badge>
                          ) : isCurrentlyListed ? (
                            <Badge className={`text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0 ${
                              property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                            }`}>
                              <Globe className="h-2.5 w-2.5" />
                              {property.transactionType?.toLowerCase() === 'rent'
                                ? t('Listed: Rent', 'வாடகைக்கு')
                                : t('Listed: Sale', 'விற்பனைக்கு')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0">
                              <EyeOff className="h-2.5 w-2.5" />
                              {t('Private', 'தனிப்பட்டது')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Slim GPS Location Row */}
                      {property.geoLocation?.latitude && property.geoLocation?.longitude && (
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/50">
                          <div className="flex items-center gap-1.5 truncate">
                            <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-mono truncate">
                              GPS: {Number(property.geoLocation.latitude).toFixed(4)}°, {Number(property.geoLocation.longitude).toFixed(4)}°
                            </span>
                          </div>
                          <a
                            href={`https://maps.google.com/?q=${property.geoLocation.latitude},${property.geoLocation.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline font-medium text-xs shrink-0 flex items-center gap-0.5"
                          >
                            <span>{t('Open in Maps', 'வரைபடத்தில் திற')}</span>
                            <span className="text-[10px]">↗</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 2. Specifications & Details Card */}
                <Card className="border border-border/70 shadow-xs bg-card/90 backdrop-blur-sm">
                  <CardHeader className="py-2.5 px-3.5 sm:px-4 border-b border-border/40">
                    <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      {t('Specifications & Details', 'விவரங்கள் மற்றும் விவரக்குறிப்புகள்')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 sm:p-4 space-y-3.5">
                    {/* Dense Responsive Specifications Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {/* Property Type */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {t('Property Type', 'சொத்து வகை')}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                          {property.propertyType}
                        </span>
                      </div>

                      {/* Total Area */}
                      {property.totalArea ? (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            {t('Total Area', 'மொத்த பரப்பளவு')}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 block truncate">
                            {property.totalArea.toLocaleString()} sq.ft
                            {property.cent !== undefined && property.cent !== null && (
                              <span className="text-[11px] text-muted-foreground ml-1 font-normal">({property.cent} cent)</span>
                            )}
                          </span>
                        </div>
                      ) : null}

                      {/* Bedrooms (non-land) */}
                      {property.propertyType?.toLowerCase() !== 'land' && property.bedrooms ? (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            {t('Bedrooms', 'படுக்கையறைகள்')}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 block truncate">
                            {property.bedrooms} BHK
                          </span>
                        </div>
                      ) : null}

                      {/* Facing */}
                      {property.facing ? (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            {t('Facing', 'நோக்கு நிலை')}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                            {property.facing}
                          </span>
                        </div>
                      ) : null}

                      {/* Transaction Type */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {t('Transaction', 'பரிவர்த்தனை')}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                          {property.transactionType || 'Sale'}
                        </span>
                      </div>

                      {/* Bathrooms if present */}
                      {(property as any).bathrooms ? (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            {t('Bathrooms', 'குளியலறைகள்')}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 block truncate">
                            {(property as any).bathrooms}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Land Boundary Dimensions (if applicable) */}
                    {property.propertyType?.toLowerCase() === 'land' && property.landDimensions && (
                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Compass className="h-3 w-3 text-primary" />
                          {t('Boundary Dimensions (ft)', 'எல்லை பரிமாணங்கள் (அடி)')}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                          <div className="bg-muted/30 p-1.5 rounded-md border border-border/40">
                            <span className="text-muted-foreground block text-[9px]">A → B</span>
                            <span className="font-semibold text-xs text-foreground">{property.landDimensions.ab ?? '-'} ft</span>
                          </div>
                          <div className="bg-muted/30 p-1.5 rounded-md border border-border/40">
                            <span className="text-muted-foreground block text-[9px]">B → C</span>
                            <span className="font-semibold text-xs text-foreground">{property.landDimensions.bc ?? '-'} ft</span>
                          </div>
                          <div className="bg-muted/30 p-1.5 rounded-md border border-border/40">
                            <span className="text-muted-foreground block text-[9px]">C → D</span>
                            <span className="font-semibold text-xs text-foreground">{property.landDimensions.cd ?? '-'} ft</span>
                          </div>
                          <div className="bg-muted/30 p-1.5 rounded-md border border-border/40">
                            <span className="text-muted-foreground block text-[9px]">D → A</span>
                            <span className="font-semibold text-xs text-foreground">{property.landDimensions.da ?? '-'} ft</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Amenities & Features as Compact Chips */}
                    {property.amenities && property.amenities.length > 0 && (
                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground block">
                          {t('Amenities & Features', 'வசதிகள்')}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {property.amenities.map((amenity, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium"
                            >
                              ✓ {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {property.description && (
                      <div className="pt-2 border-t border-border/40 space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground block">
                          {t('Description', 'விளக்கம்')}
                        </span>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {property.description}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Restrained Danger Zone */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 sm:p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {t('Danger Zone', 'அபாய பகுதி')}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t('Permanently remove this property from your account.', 'இந்த சொத்தை நிரந்தரமாக நீக்கவும்.')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-rose-600 border-rose-300 dark:border-rose-900/60 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 shrink-0"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t('Delete Property', 'சொத்தை நீக்கு')}
                  </Button>
                </div>
              </div>
            )}

            {/* SECTION 2: EDIT DETAILS */}
            {activeSection === 'edit' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-primary" />
                      {t('Edit Property Details', 'சொத்து விவரங்களைத் திருத்து')}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {property.propertyType}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('Update specifications, pricing, amenities, images, or GPS coordinates.', 'விவரங்கள், விலை, வசதிகள், படங்கள் அல்லது வரைபட இருப்பிடத்தை புதுப்பிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <PropertyForm
                    inline={true}
                    open={true}
                    initialData={property}
                    onSaved={() => {
                      setActiveSection('overview');
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* SECTION 3: LISTING */}
            {activeSection === 'listing' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {t('Public Listing & Publishing Controls', 'பொது பட்டியல் மற்றும் வெளியீட்டு கட்டுப்பாடுகள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('Manage how your property appears in search results for prospective buyers and tenants.', 'சாத்தியமான வாங்குபவர்கள் மற்றும் குத்தகைதாரர்களுக்கான தேடல் முடிவுகளில் உங்கள் சொத்து எவ்வாறு தோன்றும் என்பதை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Current Listing Visibility', 'தற்போதைய பட்டியல் தெரிவுநிலை')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {isUnderContract ? (
                            <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5 font-medium flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              {t('Under Contract', 'ஒப்பந்தத்தில்')}
                            </Badge>
                          ) : isCurrentlyListed ? (
                            <Badge className={`text-white text-xs px-2.5 py-0.5 font-medium flex items-center gap-1 ${
                              property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                            }`}>
                              <Globe className="h-3 w-3" />
                              {property.transactionType?.toLowerCase() === 'rent'
                                ? t('Listed for Rent (Public)', 'வாடகைக்கு வெளியிடப்பட்டது')
                                : t('Listed for Sale (Public)', 'விற்பனைக்கு வெளியிடப்பட்டது')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-xs px-2.5 py-0.5 font-medium flex items-center gap-1">
                              <EyeOff className="h-3 w-3" />
                              {t('Private (Hidden from Search)', 'தனிப்பட்டது')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {property.price !== undefined && property.price !== null && (
                        <div className="sm:text-right">
                          <p className="text-xs text-muted-foreground">{t('Listed Price', 'பட்டியலிடப்பட்ட விலை')}</p>
                          <p className="text-base font-bold text-green-600 dark:text-green-400">
                            ₹{Number(property.price).toLocaleString()}
                            {property.transactionType?.toLowerCase() === 'rent' ? '/mo' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Occupancy Notice */}
                    {isOccupied && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300">
                        <Users className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{t('Property is currently Occupied', 'சொத்து தற்போது குடியேற்றப்பட்டுள்ளது')}</p>
                          <p className="text-[11px] opacity-90">
                            {t('Per policy, rental listings are disabled while a tenant is actively occupying the property. The tenant must vacate before you can list it for rent again.', 'விதிகளின்படி, குத்தகைதாரர் சொத்தில் இருக்கும் வரை வாடகை பட்டியல் முடக்கப்படும்.')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      <Button
                        variant={property.transactionType?.toLowerCase() === 'purchase' && isCurrentlyListed ? 'secondary' : 'default'}
                        className="h-9 text-xs font-medium justify-center gap-2"
                        onClick={() => handleOpenListingDialog('sale')}
                      >
                        <Building2 className="h-4 w-4" />
                        {property.transactionType?.toLowerCase() === 'purchase' && isCurrentlyListed
                          ? t('Update Sale Listing', 'விற்பனை பட்டியலை மாற்றுக')
                          : t('List for Sale', 'விற்பனைக்கு பட்டியலிடு')}
                      </Button>

                      <Button
                        variant={property.transactionType?.toLowerCase() === 'rent' && isCurrentlyListed ? 'secondary' : 'default'}
                        className="h-9 text-xs font-medium justify-center gap-2"
                        disabled={isOccupied}
                        onClick={() => handleOpenListingDialog('rent')}
                      >
                        <Home className="h-4 w-4" />
                        {property.transactionType?.toLowerCase() === 'rent' && isCurrentlyListed
                          ? t('Update Rent Listing', 'வாடகை பட்டியலை மாற்றுக')
                          : t('List for Rent', 'வாடகைக்கு பட்டியலிடு')}
                      </Button>

                      {isCurrentlyListed ? (
                        <Button
                          variant="outline"
                          className="h-9 text-xs font-medium justify-center gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          onClick={handleQuickUnlist}
                        >
                          <EyeOff className="h-4 w-4" />
                          {t('Unlist from Search', 'பட்டியலில் இருந்து நீக்கு')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-9 text-xs font-medium justify-center gap-2"
                          onClick={() => handleOpenListingDialog('edit')}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          {t('Configure Listing', 'பட்டியலை அமை')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SECTION 4: REQUESTS & OFFERS */}
            {activeSection === 'requests' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-primary" />
                      {t('Incoming Requests & Offers', 'வரும் கோரிக்கைகள் மற்றும் சலுகைகள்')}
                      <Badge variant="secondary" className="ml-1.5 text-xs font-semibold">
                        {propertyRequests.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('Manage buyer purchase offers and tenant rental applications following the simplified transaction workflow.', 'வாங்குபவர் சலுகைகள் மற்றும் குத்தகைதாரர் விண்ணப்பங்களை நிர்வகிக்கவும்.')}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchOwnerRequests()}
                    className="h-7 text-xs gap-1 self-start sm:self-auto"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    {t('Refresh', 'புதுப்பி')}
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  {propertyRequests.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <Inbox className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground font-medium">
                        {t('No incoming requests or offers for this property yet.', 'இந்த சொத்திற்கு இதுவரை கோரிக்கைகள் எதுவும் வரவில்லை.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {propertyRequests.map((req: any) => {
                        const isPending = req.status === 'pending';
                        const isPaymentPending = ['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(req.status);
                        const isCompleted = req.status === 'completed';
                        const reqType = String(req.type || req.transactionType || 'rent').toLowerCase();

                        return (
                          <div
                            key={req._id || req.id}
                            className="border rounded-xl p-3 bg-card/60 hover:bg-card/90 transition-all border-border/60 shadow-2xs space-y-2.5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={reqType === 'rent' ? 'secondary' : 'default'} className="text-[10px] uppercase">
                                  {reqType === 'rent' ? t('Rent Application', 'வாடகை விண்ணப்பம்') : t('Purchase Offer', 'கொள்முதல் சலுகை')}
                                </Badge>
                                <Badge
                                  className={`text-[10px] ${
                                    isCompleted
                                      ? 'bg-emerald-600 text-white'
                                      : isPaymentPending
                                      ? 'bg-blue-600 text-white'
                                      : isPending
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {req.status}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(req.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                              <div>
                                <p className="text-muted-foreground text-[11px]">{t('Applicant / Buyer', 'விண்ணப்பதாரர் / வாங்குபவர்')}</p>
                                <p className="font-semibold text-foreground text-sm">{req.customer?.name || req.sender?.name || t('User', 'பயனர்')}</p>
                                <p className="text-muted-foreground text-[11px]">{req.customer?.email || req.sender?.email || '-'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[11px]">{t('Offered Amount', 'வழங்கப்பட்ட தொகை')}</p>
                                <p className="font-bold text-foreground text-sm text-green-600 dark:text-green-400">
                                  ₹{Number(req.proposedPrice || req.offeredPrice || req.rentAmount || req.price || 0).toLocaleString()}
                                  {reqType === 'rent' && <span className="text-[10px] text-muted-foreground font-normal"> /mo</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[11px]">{t('Message / Notes', 'செய்தி')}</p>
                                <p className="text-muted-foreground line-clamp-2 text-xs italic">
                                  "{req.message || req.notes || t('No message provided', 'செய்தி இல்லை')}"
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleViewRequestDetails(req)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {t('View Details & Timeline', 'விவரங்கள் & காலவரிசை')}
                              </Button>

                              <div className="flex items-center gap-2 ml-auto">
                                {isPending && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                                      onClick={() => handleRejectRequest(req._id || req.id)}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      {t('Reject', 'நிராகரி')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => handleApproveRequest(req._id || req.id)}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {t('Accept Offer', 'சலுகையை ஏற்கவும்')}
                                    </Button>
                                  </>
                                )}
                                {isPaymentPending && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => handleViewRequestDetails(req)}
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {t('Review / Verify Payment', 'கட்டணத்தை சரிபார்க்கவும்')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 5: TENANCY */}
            {activeSection === 'tenancy' && (
              <div className="space-y-4">
                {tenantProfile ? (
                  <div className="space-y-3">
                    <Card className="border border-border/80 shadow-xs">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          {t('Tenant Information', 'குத்தகைதாரர் தகவல்')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground font-medium">{t('Name', 'பெயர்')}</p>
                            <p className="text-sm font-semibold">{tenantProfile.name}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium">{t('Email', 'மின்னஞ்சல்')}</p>
                            <p className="text-sm break-all">{tenantProfile.email}</p>
                          </div>
                          {tenantProfile.phone && (
                            <div>
                              <p className="text-muted-foreground font-medium">{t('Phone', 'தொலைபேசி')}</p>
                              <p className="text-sm">{tenantProfile.phone}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground font-medium">{t('Status', 'நிலை')}</p>
                            <Badge className="bg-green-600 text-white text-[10px] px-2 py-0.5 mt-0.5">
                              {t('Occupied', 'குடியேற்றப்பட்டது')}
                            </Badge>
                          </div>
                        </div>

                        {/* Detailed KYC Info */}
                        <div className="border-t border-border/40 pt-3 space-y-2">
                          <p className="text-xs font-semibold text-foreground">{t('Tenant KYC Details', 'குத்தகைதாரர் KYC விவரங்கள்')}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                            {typeof tenantProfile.age === 'number' && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('Age', 'வயது')}</p>
                                <p className="font-medium">{tenantProfile.age} {t('years', 'வருடங்கள்')}</p>
                              </div>
                            )}
                            {tenantProfile.gender && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('Gender', 'பாலினம்')}</p>
                                <p className="font-medium">{tenantProfile.gender}</p>
                              </div>
                            )}
                            {tenantProfile.occupation && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('Occupation', 'தொழில்')}</p>
                                <p className="font-medium">{tenantProfile.occupation}</p>
                              </div>
                            )}
                            {typeof tenantProfile.monthlyIncome === 'number' && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('Monthly Income', 'மாத வருமானம்')}</p>
                                <p className="font-medium">₹{tenantProfile.monthlyIncome.toLocaleString()}</p>
                              </div>
                            )}
                            {tenantProfile.address && (
                              <div className="col-span-2">
                                <p className="text-[11px] text-muted-foreground">{t('Address', 'முகவரி')}</p>
                                <p className="font-medium break-words">{tenantProfile.address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border border-border/70 shadow-xs">
                    <CardContent className="py-8 text-center space-y-2.5">
                      <Home className="h-7 w-7 text-muted-foreground/35 mx-auto" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t('No tenant currently assigned', 'தற்போது குத்தகைதாரர் யாரும் நியமிக்கப்படவில்லை')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('This property is currently vacant and available for rent or purchase.', 'இந்த சொத்து தற்போது காலியாக உள்ளது.')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs mt-1"
                        onClick={() => setActiveSection('listing')}
                      >
                        {t('Configure Rental Listing', 'வாடகை பட்டியலை அமை')}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* SECTION 6: RENT & PAYMENTS */}
            {activeSection === 'payments' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {t('Rent & Payment Breakdown', 'வாடகை மற்றும் கட்டண விவரங்கள்')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {loadingPayments ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading payment details...', 'கட்டண விவரங்களை ஏற்றுகிறது...')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentDetails.length > 0 ? (
                        <div className="space-y-2.5">
                          {paymentDetails.map((payment) => (
                            <div
                              key={payment._id}
                              className="border rounded-xl p-3 bg-card/60 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <p className="text-base font-bold text-green-600 dark:text-green-400">
                                      ₹{payment.rentAmount.toLocaleString()}
                                    </p>
                                    <Badge
                                      variant={payment.status === 'paid' ? 'default' : 'outline'}
                                      className={`text-[10px] ${
                                        payment.status === 'paid'
                                          ? 'bg-green-600 text-white'
                                          : payment.status === 'overdue'
                                          ? 'border-red-500 text-red-600'
                                          : ''
                                      }`}
                                    >
                                      {payment.status}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {t('Month', 'மாதம்')}: {new Date(payment.month).toLocaleDateString()} | {t('Due Date', 'கடைசி தேதி')}: {new Date(payment.dueDate).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          {t('No payment records found for this property.', 'கட்டண பதிவுகள் எதுவும் இல்லை.')}
                        </div>
                      )}

                      {/* Payment Verification Submissions */}
                      <div className="border-t border-border/40 pt-3 space-y-2.5">
                        <p className="text-xs font-semibold text-foreground">
                          {t('Pending Tenant Payment Approvals', 'நிலுவை கட்டண ஒப்புதல்கள்')}
                        </p>
                        {propertyPaymentRequests.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t('No pending payment requests for this property.', 'நிலுவையில் உள்ள கட்டண கோரிக்கைகள் இல்லை.')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {propertyPaymentRequests.map((payment) => (
                              <div
                                key={payment._id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-xl px-3 py-2 bg-card/60"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-foreground">
                                    {payment.tenant?.name || t('Tenant', 'குத்தகைதாரர்')}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ₹{Number(payment.amount || 0).toLocaleString()} • {payment.date ? new Date(payment.date).toLocaleDateString() : ''}
                                  </p>
                                </div>
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handleApprovePayment(payment._id)}
                                    disabled={approvingPaymentId === payment._id}
                                  >
                                    {approvingPaymentId === payment._id ? t('Approving...', 'அங்கீகரிக்கிறது...') : t('Approve', 'அங்கீகரி')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px]"
                                    onClick={() => handleRejectPayment(payment._id)}
                                    disabled={rejectingPaymentId === payment._id}
                                  >
                                    {rejectingPaymentId === payment._id ? t('Rejecting...', 'நிராகரிக்கிறது...') : t('Reject', 'நிராகரி')}
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
            )}

            {/* SECTION 7: AGREEMENTS */}
            {activeSection === 'agreements' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {t('Rental Agreements', 'வாடகை ஒப்பந்தங்கள்')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {loadingAgreements ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading agreements...', 'ஒப்பந்தங்களை ஏற்றுகிறது...')}
                    </div>
                  ) : agreements.length > 0 ? (
                    <div className="space-y-3">
                      {agreements.map((agreement) => (
                        <div 
                          key={agreement._id} 
                          className="p-3.5 border rounded-xl bg-card/60 hover:bg-muted/50 transition-colors space-y-2.5"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-sm">{agreement.property?.title || title}</h3>
                              <p className="text-xs text-muted-foreground">{agreement.property?.location || loc}</p>
                            </div>
                            <Badge variant={agreement.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                              {agreement.status?.toUpperCase()}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">{t('Tenant', 'குத்தகைதாரர்')}</p>
                              <p className="font-medium">{agreement.tenant?.name}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t('Rent Amount', 'வாடகை தொகை')}</p>
                              <p className="font-bold text-green-600">₹{agreement.rentAmount?.toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-border/40">
                            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => handleViewAgreement(agreement)}>
                              <FileText className="h-3 w-3 mr-1" />
                              {t('View Details', 'விவரங்கள்')}
                            </Button>
                            <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleDownloadAgreement(agreement)}>
                              <FileText className="h-3 w-3 mr-1" />
                              {t('Download PDF', 'PDF')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('No agreements found for this property.', 'ஒப்பந்தங்கள் எதுவும் இல்லை.')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 8: MAINTENANCE */}
            {activeSection === 'maintenance' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-4 w-4 text-primary" />
                    {t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {loadingMaintenance ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading maintenance requests...', 'பராமரிப்பு கோரிக்கைகளை ஏற்றுகிறது...')}
                    </div>
                  ) : maintenanceRequests.length > 0 ? (
                    <div className="space-y-2.5">
                      {maintenanceRequests.map((request) => (
                        <div
                          key={request._id}
                          className="border rounded-xl p-3 bg-card/60 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                            <div className="flex-1 space-y-1">
                              <p className="font-semibold text-xs sm:text-sm">{request.issue}</p>
                              {request.description && (
                                <p className="text-xs text-muted-foreground">{request.description}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {request.tenant?.name} • {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <Badge className={`text-[10px] ${
                                request.status === 'completed' ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
                              }`}>
                                {request.status}
                              </Badge>
                              {request.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleUpdateMaintenanceStatus(request._id, 'completed')}
                                >
                                  {t('Mark Done', 'முடிந்தது')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('No maintenance requests for this property.', 'பராமரிப்பு கோரிக்கைகள் எதுவும் இல்லை.')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 9: VACATE (Dedicated Section!) */}
            {activeSection === 'vacate' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LogOut className="h-4 w-4 text-primary" />
                    {t('Vacate Requests & Move-Outs', 'வெளியேறும் கோரிக்கைகள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('Review and manage tenant vacate notices and move-out confirmations.', 'குத்தகைதாரர் வெளியேறும் அறிவிப்புகளை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {loadingVacateRequests ? (
                    <p className="text-xs text-muted-foreground">{t('Loading vacate requests...', 'வெளியேறும் கோரிக்கைகளை ஏற்றுகிறது...')}</p>
                  ) : vacateRequests.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('No vacate requests for this property.', 'வெளியேறும் கோரிக்கைகள் எதுவும் இல்லை.')}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {vacateRequests.map((r: any) => (
                        <div key={r._id || r.id} className="border rounded-xl p-3 flex flex-col gap-2 text-xs bg-card/60">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{r.tenant?.name || t('Tenant', 'குத்தகைதாரர்')}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('Requested vacate date', 'வெளியேறும் தேதி')}: {new Date(r.requestedVacateDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={r.status === 'pending' ? 'outline' : r.status === 'approved' ? 'default' : 'secondary'} className="text-[10px]">
                              {r.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.reason}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {r.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    approveVacateRequest.mutate(r._id || r.id, {
                                      onSuccess: () => {
                                        toast.success(t('Vacate request approved', 'வெளியேறும் கோரிக்கை அங்கீகரிக்கப்பட்டது'));
                                        refetchVacateRequests();
                                      },
                                      onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to approve vacate request', 'பிழை'))
                                    });
                                  }}
                                >
                                  {t('Approve', 'அங்கீகரிக்கவும்')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    rejectVacateRequest.mutate(r._id || r.id, {
                                      onSuccess: () => {
                                        toast.success(t('Vacate request rejected', 'வெளியேறும் கோரிக்கை நிராகரிக்கப்பட்டது'));
                                        refetchVacateRequests();
                                      },
                                      onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to reject vacate request', 'பிழை'))
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
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => {
                                  completeVacateRequest.mutate(r._id || r.id, {
                                    onSuccess: () => {
                                      toast.success(t('Vacate marked as completed', 'வெளியேறும் செயல்முறை முடிந்தது'));
                                      refetchVacateRequests();
                                    },
                                    onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to complete vacate', 'பிழை'))
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
            )}
          </div>
        </div>
      </div>

      {/* Agreement Details Dialog */}
      <AgreementDialog
        agreement={selectedAgreement}
        open={agreementDialogOpen}
        onOpenChange={(open) => {
          setAgreementDialogOpen(open);
          if (!open) setSelectedAgreement(null);
        }}
        onUpdate={() => fetchAgreements()}
      />

      {/* Listing Control Dialog */}
      <ListingControlDialog
        property={property}
        open={isListingDialogOpen}
        onOpenChange={setIsListingDialogOpen}
        defaultAction={listingDefaultAction}
      />

      {/* Request Details & Timeline Modal */}
      <RequestDetailsModal
        request={selectedRequest}
        open={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      {/* Safe Delete Property Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              {t('Delete Property?', 'சொத்தை நீக்கவா?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t(
                  'Are you sure you want to permanently delete this property? This action cannot be undone.',
                  'இந்தச் சொத்தை நிரந்தரமாக நீக்க விரும்புகிறீர்களா? இந்தச் செயலைத் தவிர்க்க முடியாது.'
                )}
              </p>
              {isOccupied && (
                <p className="text-rose-600 font-medium">
                  {t('Warning: Property is occupied by a tenant and cannot be deleted.', 'எச்சரிக்கை: சொத்தில் குத்தகைதாரர் உள்ளார்.')}
                </p>
              )}
              {isUnderContract && (
                <p className="text-amber-600 font-medium">
                  {t('Warning: Property is under contract.', 'எச்சரிக்கை: சொத்து ஒப்பந்தத்தில் உள்ளது.')}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'ரத்து')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isOccupied || isUnderContract}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {t('Delete Property', 'சொத்தை நீக்கு')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
