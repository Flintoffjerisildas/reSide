import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Property } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  KeyRound,
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
  LogOut,
  Mic,
  MicOff,
  Upload,
  Download,
  Info,
  ShieldCheck,
  Check,
  Clock,
  X,
  Maximize2,
  Images,
  ShoppingBag
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
import api, { translateText } from '../lib/api';
import {
  useGetOwnerRequests,
  useGetTenantRequests,
  useApproveRequest,
  useRejectRequest,
  useCounterOfferRequest,
  useAcceptCounterOffer,
  useConfirmRequestTerms,
  useSubmitRequestPayment,
  useVerifyRequestPayment,
  useRejectRequestPayment,
  useCancelRequest,
  useCompleteTransaction,
  useUpdateListingStatus,
  useDeleteProperty,
  useGetVacateRequestsForProperty,
  useApproveVacateRequest,
  useRejectVacateRequest,
  useCompleteVacateRequest,
  useCreateVacateRequest,
  useCancelVacateRequest,
  useGetMyVacateRequests,
} from '../hooks/useQueries';
import PropertyForm from './PropertyForm';
import AgreementDialog from './AgreementDialog';
import ListingControlDialog from './ListingControlDialog';
import RequestDetailsModal from './RequestDetailsModal';
import PropertyHorizontalSelector, { PropertySelectorItem } from './PropertyHorizontalSelector';
import PaymentDialog from './PaymentDialog';
import { generateReceipt } from '../utils/receiptGenerator';

interface PropertyFullScreenViewProps {
  property: Property | null;
  onBack?: () => void;
  initialTab?: string;
  properties?: any[];
  selectedPropertyId?: string;
  onSelectProperty?: (property: any) => void;
  isTenantView?: boolean;
  isBuyerView?: boolean;
  tenantAgreement?: any;
  activeRequest?: any;
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

export default function PropertyFullScreenView({
  property,
  onBack,
  initialTab,
  properties = [],
  selectedPropertyId,
  onSelectProperty,
  isTenantView = false,
  isBuyerView = false,
  tenantAgreement,
  activeRequest,
}: PropertyFullScreenViewProps) {
  const { t, language } = useLanguage();

  const resolveInitialSection = (tab?: string): PropertySectionKey => {
    if (!tab) return 'overview';
    if (tab === 'tenant') return 'tenancy';
    if (tab === 'vacate') return 'vacate';
    if (tab === 'requests' || tab === 'timeline') return 'requests';
    if ((isTenantView || isBuyerView) && ['edit', 'listing'].includes(tab)) {
      return 'overview';
    }
    if (['overview', 'edit', 'listing', 'requests', 'tenancy', 'payments', 'agreements', 'maintenance', 'vacate'].includes(tab)) {
      return tab as PropertySectionKey;
    }
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState<PropertySectionKey>(resolveInitialSection(initialTab));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
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

  // Tenant-specific states
  const [tenantRentRecords, setTenantRentRecords] = useState<any[]>([]);
  const [selectedRentRecordToPay, setSelectedRentRecordToPay] = useState<any | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [tenantMaintenanceCategory, setTenantMaintenanceCategory] = useState<'Plumbing' | 'Electrical' | 'Appliance' | 'Structural' | 'Cleaning' | 'Other'>('Plumbing');
  const [tenantMaintenancePriority, setTenantMaintenancePriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [tenantMaintenanceIssue, setTenantMaintenanceIssue] = useState('');
  const [tenantMaintenanceDescription, setTenantMaintenanceDescription] = useState('');
  const [isReportingMaintenance, setIsReportingMaintenance] = useState(false);
  const [isListeningIssue, setIsListeningIssue] = useState(false);
  const [isListeningDescription, setIsListeningDescription] = useState(false);
  const [tenantVacateDate, setTenantVacateDate] = useState('');
  const [tenantVacateReason, setTenantVacateReason] = useState('');
  const [isSubmittingVacate, setIsSubmittingVacate] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const tenantDocInputRef = useRef<HTMLInputElement>(null);

  // Listing Management
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const [listingDefaultAction, setListingDefaultAction] = useState<'sale' | 'rent' | 'edit'>('sale');
  const updateListingStatusMutation = useUpdateListingStatus();

  // Requests & Transactions - Owner Queries & Mutations
  const { data: allOwnerRequests = [], refetch: refetchOwnerRequests } = useGetOwnerRequests();
  const approveRequestMutation = useApproveRequest();
  const rejectRequestMutation = useRejectRequest();
  const counterOfferMutation = useCounterOfferRequest();
  const acceptCounterMutation = useAcceptCounterOffer();
  const confirmTermsMutation = useConfirmRequestTerms();
  const submitPaymentMutation = useSubmitRequestPayment();
  const verifyPaymentMutation = useVerifyRequestPayment();
  const rejectPaymentMutation = useRejectRequestPayment();
  const cancelRequestMutation = useCancelRequest();
  const completeTransactionMutation = useCompleteTransaction();

  // Requests & Transactions - Tenant / Buyer Queries
  const { data: allTenantRequests = [], refetch: refetchTenantRequests } = useGetTenantRequests();
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

  // Tenant / Buyer request for this property
  const activeTenantRequest = useMemo(() => {
    if (activeRequest) return activeRequest;
    if (!propertyId || !Array.isArray(allTenantRequests)) return null;
    return allTenantRequests.find((r: any) => getId(r?.property) === propertyId) || null;
  }, [activeRequest, allTenantRequests, propertyId]);

  // Overall active transaction for this property
  const activeTx = useMemo(() => {
    if (isTenantView || isBuyerView) {
      return activeTenantRequest;
    }
    const actionable = propertyRequests.find((r: any) => 
      ['pending', 'counteroffer', 'payment_pending', 'accepted', 'approved', 'terms_confirmed'].includes(r.status)
    );
    return actionable || propertyRequests[0] || null;
  }, [isTenantView, isBuyerView, activeTenantRequest, propertyRequests]);

  // Helpers for Status Badge & Timeline Stages
  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px]">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending Owner Review', 'உரிமையாளர் ஆய்வுக்கு காத்திருக்கிறது')}
          </Badge>
        );
      case 'counteroffer':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-300 text-[10px]">
            <IndianRupee className="w-3 h-3 mr-1 inline" />
            {t('Counteroffer Received', 'எதிர் சலுகை பெறப்பட்டது')}
          </Badge>
        );
      case 'accepted':
      case 'approved':
      case 'terms_confirmed':
        return (
          <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-300 text-[10px]">
            <CreditCard className="w-3 h-3 mr-1 inline" />
            {t('Accepted — Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது — கட்டணம் செலுத்தவும்')}
          </Badge>
        );
      case 'payment_pending':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-300 text-[10px]">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Payment Verification Pending', 'கட்டண சரிபார்ப்பு நிலுவையில் உள்ளது')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-emerald-600 text-white text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {isBuyerView ? t('Ownership Confirmed', 'விற்பனை முடிந்தது') : t('Lease Active', 'குத்தகை செயலில் உள்ளது')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="w-3 h-3 mr-1 inline" />
            {t('Declined', 'நிராகரிக்கப்பட்டது')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="text-[10px]">
            {t('Withdrawn', 'திரும்பப் பெறப்பட்டது')}
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[10px]">{st}</Badge>;
    }
  };

  const getTimelineStages = (tx: any) => {
    const isCompleted = tx.status === 'completed';
    const isPayPending = tx.status === 'payment_pending';
    const isAccepted = ['accepted', 'approved', 'terms_confirmed'].includes(tx.status);
    const isCounter = tx.status === 'counteroffer';
    const isDeclined = ['rejected', 'cancelled'].includes(tx.status);

    return [
      {
        id: 1,
        title: t('Request Submitted', 'கோரிக்கை சமர்ப்பிக்கப்பட்டது'),
        status: 'done',
        desc: `${new Date(tx.createdAt).toLocaleDateString()}`
      },
      {
        id: 2,
        title: t('Owner Review', 'உரிமையாளர் ஆய்வு'),
        status: isDeclined ? 'failed' : (isAccepted || isPayPending || isCompleted) ? 'done' : isCounter ? 'warning' : 'current',
        desc: isDeclined ? t('Declined', 'நிராகரிக்கப்பட்டது') : isCounter ? t('Counteroffer', 'எதிர் சலுகை') : (isAccepted || isPayPending || isCompleted) ? t('Accepted', 'ஏற்கப்பட்டது') : t('Under Review', 'ஆய்வில்')
      },
      {
        id: 3,
        title: t('Payment Initiation', 'கட்டணம் செலுத்துதல்'),
        status: (isPayPending || isCompleted) ? 'done' : isAccepted ? 'current' : 'pending',
        desc: (isPayPending || isCompleted) ? t('Paid', 'செலுத்தப்பட்டது') : isAccepted ? t('Action Required', 'கட்டணம் தேவை') : t('Awaiting Approval', 'ஒப்புதலுக்கு பின்')
      },
      {
        id: 4,
        title: t('Payment Verification', 'கட்டண சரிபார்ப்பு'),
        status: isCompleted ? 'done' : isPayPending ? 'current' : 'pending',
        desc: isCompleted ? t('Verified', 'சரிபார்க்கப்பட்டது') : isPayPending ? t('Pending Verification', 'சரிபார்ப்பு நிலுவை') : t('Pending Payment', 'கட்டணத்திற்கு பின்')
      },
      {
        id: 5,
        title: (tx.type === 'buy' || isBuyerView) ? t('Ownership Transferred', 'உரிமை மாற்றம்') : t('Tenancy Finalized', 'குத்தகை உறுதி'),
        status: isCompleted ? 'done' : 'pending',
        desc: isCompleted ? t('Active', 'செயலில்') : t('Pending Completion', 'முடிவுக்கு பின்')
      }
    ];
  };

  // Status flags
  const isAcquired = (property as any)?.saleStatus === 'sold' || !!property?.buyer || (Array.isArray((property as any)?.previousOwners) && (property as any).previousOwners.length > 0);
  const isCurrentlyListed = property?.listingStatus === 'listed' || (property?.isListed && property?.listingStatus !== 'unlisted');
  const isOccupied = property?.occupancyStatus === 'occupied' || !!property?.tenant;
  const isUnderContract = (property as any)?.saleStatus === 'under_contract';

  // Vacate requests (Owner queries - only run in owner view)
  const {
    data: vacateRequests = [],
    isLoading: loadingVacateRequests,
    refetch: refetchVacateRequests,
  } = useGetVacateRequestsForProperty((isTenantView || isBuyerView) ? null : propertyId);
  const approveVacateRequest = useApproveVacateRequest();
  const rejectVacateRequest = useRejectVacateRequest();
  const completeVacateRequest = useCompleteVacateRequest();

  // Vacate requests (Tenant queries & mutations)
  const createVacateRequest = useCreateVacateRequest();
  const cancelVacateRequest = useCancelVacateRequest();
  const { data: myAllVacateRequests = [], refetch: refetchTenantVacate } = useGetMyVacateRequests();

  const tenantVacateRequests = useMemo(() => {
    if (!propertyId || !Array.isArray(myAllVacateRequests)) return [];
    return myAllVacateRequests.filter((r: any) => {
      const pId = getId(r?.property);
      return pId === propertyId;
    });
  }, [myAllVacateRequests, propertyId]);

  // Map properties into selector items
  const selectorItems = useMemo<PropertySelectorItem[]>(() => {
    const list = properties && properties.length > 0 ? properties : property ? [property] : [];
    return list.map((item: any) => {
      const propObj = item?.property && typeof item.property === 'object' ? item.property : item;
      const itemId = getId(propObj) || getId(item);
      const itemTitle = String(propObj?.title || item?.propertyTitle || t('Untitled Property', 'சொத்து')).trim();
      const itemLoc = String(propObj?.location || item?.location || '').trim();
      const itemPrice = item?.rentAmount || propObj?.price || item?.price;
      const itemTxType = (isTenantView || isBuyerView) ? (isBuyerView || item?._request?.type === 'buy' ? 'buy' : 'rent') : (propObj?.transactionType || item?.transactionType || 'sale');
      const itemImages = Array.isArray(propObj?.images) ? propObj.images : Array.isArray(item?.images) ? item.images : [];
      const itemGeo = propObj?.geoLocatedImage || item?.geoLocatedImage;

      let statusText = '';
      let statusVariant: PropertySelectorItem['statusVariant'] = 'default';
      let badgeCount = 0;

      if (isTenantView || isBuyerView) {
        const itemReq = item?._request;
        if (itemReq) {
          if (itemReq.status === 'pending') {
            statusText = t('Pending Approval', 'ஒப்புதல் நிலுவையில்');
            statusVariant = 'pending';
          } else if (['accepted', 'approved', 'terms_confirmed'].includes(itemReq.status)) {
            statusText = t('Pay Advance', 'கட்டணம் நிலுவை');
            statusVariant = 'warning';
          } else if (itemReq.status === 'payment_pending') {
            statusText = t('Verifying Payment', 'சரிபார்ப்பு நிலுவையில்');
            statusVariant = 'pending';
          } else if (itemReq.status === 'counteroffer') {
            statusText = t('Counteroffer', 'எதிர் சலுகை');
            statusVariant = 'warning';
          } else if (itemReq.status === 'completed') {
            statusText = isBuyerView ? t('Purchased', 'வாங்கப்பட்டது') : t('Active Lease', 'குத்தகை');
            statusVariant = 'active';
          } else {
            statusText = itemReq.status;
            statusVariant = 'default';
          }
        } else {
          statusText = t('Active Lease', 'குத்தகை');
          statusVariant = 'active';
        }
      } else {
        const isOcc = propObj?.occupancyStatus === 'occupied' || !!propObj?.tenant;
        const isLst = propObj?.listingStatus === 'listed' || (propObj?.isListed && propObj?.listingStatus !== 'unlisted');
        
        // Count pending inquiries for this property
        const thisPropPending = Array.isArray(allOwnerRequests) 
          ? allOwnerRequests.filter((r: any) => getId(r?.property) === itemId && (r.status === 'pending' || r.status === 'payment_pending'))
          : [];
        badgeCount = thisPropPending.length;

        if (isOcc) {
          statusText = t('Occupied', 'குடியேற்றப்பட்டது');
          statusVariant = 'occupied';
        } else if (isLst) {
          statusText = propObj?.transactionType === 'rent' ? t('Listed: Rent', 'வாடகைக்கு') : t('Listed: Sale', 'விற்பனைக்கு');
          statusVariant = 'listed';
        } else {
          statusText = t('Private', 'தனிப்பட்டது');
          statusVariant = 'private';
        }
      }

      return {
        id: itemId,
        title: itemTitle,
        location: itemLoc,
        price: itemPrice,
        transactionType: itemTxType,
        images: itemImages,
        geoLocatedImage: itemGeo,
        statusText,
        statusVariant,
        badgeCount: badgeCount > 0 ? badgeCount : undefined,
        raw: item,
      };
    });
  }, [properties, property, isTenantView, isBuyerView, allOwnerRequests, t]);

  const currentActiveId = getId(property) || selectedPropertyId || (selectorItems.length > 0 ? selectorItems[0].id : null);

  // Speech Recognition for reporting maintenance
  const voiceModeRef = useRef<'issue' | 'description' | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) {
        if (voiceModeRef.current === 'issue') {
          setTenantMaintenanceIssue((prev) => {
            const current = String(prev || '').trim();
            return current ? `${current} ${transcript}` : transcript;
          });
        } else if (voiceModeRef.current === 'description') {
          setTenantMaintenanceDescription((prev) => {
            const current = String(prev || '').trim();
            return current ? `${current}\n${transcript}` : transcript;
          });
        }
      }
    };
    recognition.onerror = (event: any) => {
      const error = event?.error;
      const msg =
        error === 'not-allowed' || error === 'service-not-allowed'
          ? t('Microphone permission denied', 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது')
          : t('Voice input failed', 'குரல் உள்ளீடு தோல்வியடைந்தது');
      toast.error(msg);
    };
    recognition.onend = () => {
      setIsListeningIssue(false);
      setIsListeningDescription(false);
      voiceModeRef.current = null;
    };
    recognitionRef.current = recognition;
  }, [t]);

  const toggleListening = (mode: 'issue' | 'description') => {
    if (!recognitionRef.current) {
      toast.error(t('Speech recognition not supported in this browser', 'இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை'));
      return;
    }
    if ((mode === 'issue' && isListeningIssue) || (mode === 'description' && isListeningDescription)) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListeningIssue(false);
      setIsListeningDescription(false);
      voiceModeRef.current = null;
      return;
    }
    voiceModeRef.current = mode;
    if (mode === 'issue') {
      setIsListeningIssue(true);
      setIsListeningDescription(false);
    } else {
      setIsListeningDescription(true);
      setIsListeningIssue(false);
    }
    try {
      recognitionRef.current.start();
    } catch {
      setIsListeningIssue(false);
      setIsListeningDescription(false);
      voiceModeRef.current = null;
    }
  };

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

  // Clean data reset on property change so previous property's data is never displayed
  useEffect(() => {
    setPaymentDetails([]);
    setTenantRentRecords([]);
    setMaintenanceRequests([]);
    setAgreements([]);
    setPropertyPaymentRequests([]);
    setTenantDetails(null);
    setCurrentImageIndex(0);
    setLightboxIndex(0);
    setIsLightboxOpen(false);

    if (property) {
      if (isTenantView) {
        fetchTenantPaymentDetails();
        fetchTenantMaintenanceRequests();
        fetchTenantAgreements();
      } else {
        fetchPaymentDetails();
        fetchMaintenanceRequests();
        fetchAgreements();
      }
    }
  }, [propertyId, isTenantView]);

  useEffect(() => {
    if (initialTab) {
      setActiveSection(resolveInitialSection(initialTab));
    }
  }, [initialTab]);

  // Ensure activeSection resets to overview if tenant view is active and section is owner-only
  useEffect(() => {
    if (isTenantView && ['edit', 'listing', 'requests'].includes(activeSection)) {
      setActiveSection('overview');
    }
  }, [isTenantView, activeSection]);

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

  // Tenant API fetchers
  const fetchTenantPaymentDetails = async () => {
    try {
      setLoadingPayments(true);
      const res = await api.get('/payments/tenant/records');
      const records = Array.isArray(res.data) ? res.data : [];
      const filtered = records.filter((r: any) => {
        const pId = getId(r?.property) || getId(r?.propertyId);
        return pId === propertyId;
      });
      setTenantRentRecords(filtered);
    } catch (err) {
      console.error('Error fetching tenant rent records:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchTenantMaintenanceRequests = async () => {
    try {
      setLoadingMaintenance(true);
      const res = await api.get('/requests/maintenance/tenant');
      const reqs = Array.isArray(res.data) ? res.data : [];
      const filtered = reqs.filter((m: any) => {
        const pId = getId(m?.property);
        return pId === propertyId;
      });
      setMaintenanceRequests(filtered);
    } catch (err) {
      console.error('Error fetching tenant maintenance requests:', err);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const fetchTenantAgreements = async () => {
    try {
      setLoadingAgreements(true);
      const res = await api.get('/agreements/tenant');
      const agrs = Array.isArray(res.data) ? res.data : [];
      const filtered = agrs.filter((a: any) => {
        const pId = getId(a?.property);
        return pId === propertyId;
      });
      setAgreements(filtered);
    } catch (err) {
      console.error('Error fetching tenant agreements:', err);
    } finally {
      setLoadingAgreements(false);
    }
  };

  // Tenant action handlers
  const handleTenantSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantMaintenanceIssue.trim()) {
      toast.error(t('Please enter the maintenance issue', 'பராமரிப்பு சிக்கலை உள்ளிடவும்'));
      return;
    }
    try {
      setIsReportingMaintenance(true);
      await api.post('/requests/maintenance', {
        propertyId,
        property: propertyId,
        issue: tenantMaintenanceIssue.trim(),
        description: tenantMaintenanceDescription.trim() || undefined,
        category: tenantMaintenanceCategory,
        priority: tenantMaintenancePriority,
      });
      toast.success(t('Maintenance request submitted successfully', 'பராமரிப்பு கோரிக்கை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது'));
      setTenantMaintenanceIssue('');
      setTenantMaintenanceDescription('');
      fetchTenantMaintenanceRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to submit maintenance request', 'கோரிக்கையை சமர்ப்பிக்க முடியவில்லை'));
    } finally {
      setIsReportingMaintenance(false);
    }
  };

  const handleTenantSubmitVacate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantVacateDate) {
      toast.error(t('Please select a move-out date', 'வெளியேறும் தேதியை தேர்ந்தெடுக்கவும்'));
      return;
    }
    try {
      setIsSubmittingVacate(true);
      await createVacateRequest.mutateAsync({
        propertyId,
        requestedVacateDate: tenantVacateDate,
        reason: tenantVacateReason.trim() || undefined,
      });
      toast.success(t('Notice to vacate submitted to owner', 'வெளியேறும் அறிவிப்பு உரிமையாளருக்கு அனுப்பப்பட்டது'));
      setTenantVacateDate('');
      setTenantVacateReason('');
      refetchTenantVacate();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to submit vacate request', 'வெளியேறும் கோரிக்கையை சமர்ப்பிக்க முடியவில்லை'));
    } finally {
      setIsSubmittingVacate(false);
    }
  };

  const handleTenantCancelVacate = async (vacateId: string) => {
    try {
      await cancelVacateRequest.mutateAsync(vacateId);
      toast.success(t('Vacate notice cancelled', 'வெளியேறும் அறிவிப்பு ரத்து செய்யப்பட்டது'));
      refetchTenantVacate();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to cancel vacate notice', 'ரத்து செய்ய முடியவில்லை'));
    }
  };

  const handleTenantUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const activeAgrId = getId(agreements[0]) || getId(tenantAgreement);
    if (!activeAgrId) {
      toast.error(t('No active agreement found to attach document to', 'செயலில் உள்ள ஒப்பந்தம் கிடைக்கவில்லை'));
      return;
    }
    try {
      setUploadingDoc(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await api.post(`/agreements/${activeAgrId}/documents`, {
            name: file.name,
            data: reader.result as string,
          });
          toast.success(t('Document uploaded successfully', 'ஆவணம் வெற்றிகரமாக பதிவேற்றப்பட்டது'));
          fetchTenantAgreements();
        } catch (err: any) {
          toast.error(err?.response?.data?.msg || t('Failed to upload document', 'பதிவேற்ற முடியவில்லை'));
        } finally {
          setUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingDoc(false);
    }
  };

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
      await rejectRequestMutation.mutateAsync({ requestId });
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
      onBack?.();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to delete property', 'சொத்தை நீக்க முடியவில்லை');
      toast.error(msg);
      setShowDeleteConfirm(false);
    }
  };

  if (!property) return null;

  const tenant = typeof property.tenant === 'object' ? property.tenant : null;
  const tenantProfile: any = tenantDetails || tenant;
  const images = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(property.images)) {
      list.push(...property.images.filter(Boolean));
    }
    if ((property as any).image && !list.includes((property as any).image)) {
      list.push((property as any).image);
    }
    if (property.geoLocatedImage && !list.includes(property.geoLocatedImage)) {
      list.push(property.geoLocatedImage);
    }
    return list;
  }, [property]);
  const hasImages = images.length > 0;
  const displayTitle = language === 'ta' ? (titleTa || property.title) : property.title;
  const displayLocation = language === 'ta' ? (locationTa || property.location) : property.location;

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const openLightbox = (index: number = currentImageIndex) => {
    if (!hasImages) return;
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // Keyboard navigation & body scroll lock for fullscreen lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setLightboxIndex((prev) => (prev + 1) % images.length);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, images.length]);

  // Responsive Navigation Item Config - omit owner-only sections in tenant/buyer view
  const allNavItems: { key: PropertySectionKey; label: string; icon: any; badge?: number; ownerOnly?: boolean; hidden?: boolean }[] = [
    { key: 'overview', label: t('Overview', 'மேலோட்டம்'), icon: Home },
    { key: 'edit', label: t('Edit Details', 'திருத்து'), icon: Edit, ownerOnly: true },
    { key: 'listing', label: t('Listing', 'பட்டியல்'), icon: Globe, ownerOnly: true },
    { 
      key: 'requests', 
      label: (isTenantView || isBuyerView) ? t('Transaction & Timeline', 'பரிவர்த்தனை & காலவரிசை') : t('Requests & Offers', 'கோரிக்கைகள்'), 
      icon: Inbox, 
      badge: (isTenantView || isBuyerView) 
        ? (activeTenantRequest && ['counteroffer', 'accepted', 'approved', 'terms_confirmed'].includes(activeTenantRequest.status) ? 1 : 0)
        : propertyRequests.filter(r => r.status === 'pending' || r.status === 'payment_pending').length, 
      ownerOnly: false,
      hidden: (isTenantView || isBuyerView) && !activeTenantRequest && !property?.tenant && !tenantAgreement
    },
    { key: 'tenancy', label: t('Tenancy', 'குத்தகை'), icon: Users, hidden: isBuyerView },
    { 
      key: 'payments', 
      label: t('Rent & Payments', 'கட்டணங்கள்'), 
      icon: CreditCard, 
      badge: isTenantView 
        ? tenantRentRecords.filter((r: any) => r.status === 'pending' || r.status === 'overdue').length 
        : propertyPaymentRequests.length,
      hidden: isBuyerView
    },
    { key: 'agreements', label: t('Agreements', 'ஒப்பந்தங்கள்'), icon: FileText, hidden: isBuyerView },
    { key: 'maintenance', label: t('Maintenance', 'பராமரிப்பு'), icon: Wrench, badge: maintenanceRequests.filter(m => m.status === 'pending').length, hidden: isBuyerView },
    { 
      key: 'vacate', 
      label: t('Vacate', 'வெளியேறு'), 
      icon: LogOut, 
      badge: isTenantView 
        ? tenantVacateRequests.filter((r: any) => r.status === 'pending').length 
        : vacateRequests.filter((r: any) => r.status === 'pending').length,
      hidden: isBuyerView
    },
  ];

  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.hidden) return false;
      if (isTenantView || isBuyerView) {
        return !item.ownerOnly;
      }
      return true;
    });
  }, [isTenantView, isBuyerView, allNavItems]);

  return (
    <>
      <div className="w-full space-y-4">
        {/* Compact Single-Row Property Selector replacing oversized summary */}
        {selectorItems.length > 0 && (
          <div className="w-full">
            <PropertyHorizontalSelector
              items={selectorItems}
              selectedId={currentActiveId}
              onSelect={(item) => {
                if (onSelectProperty) {
                  onSelectProperty(item.raw);
                }
              }}
            />
          </div>
        )}

        {/* Mobile Navigation Bar (Adaptive compact horizontal scrollable strip with badges) */}
        <div className="md:hidden w-full overflow-x-auto no-scrollbar p-1.5 rounded-2xl glass-panel bg-card/85 backdrop-blur-md border border-border/70 shadow-xs sticky top-[76px] z-30">
          <div className="flex items-center gap-1.5 min-w-max">
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
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
        </div>

        {/* Responsive Workspace Layout: Fixed-width Sidebar + minmax(0, 1fr) Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)] items-start gap-5 lg:gap-6 w-full">
          {/* Desktop Left Sidebar Navigation (Enlarged, sticky below header, clear active states) */}
          <aside className="hidden md:flex flex-col w-full p-2 rounded-2xl glass-panel bg-card/85 backdrop-blur-md border border-border/70 shadow-sm sticky top-[88px] self-start space-y-1 z-20">
            <div className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center justify-between">
              <span>{t('Management Sections', 'நிர்வாகப் பிரிவுகள்')}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {navItems.findIndex(i => i.key === activeSection) + 1} / {navItems.length}
              </span>
            </div>
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`h-5 min-w-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-primary'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Right Section Content Area: Uses 100% of remaining width */}
          <div className="min-w-0 w-full space-y-5">
            {/* SECTION 1: OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="w-full space-y-5">
                {/* Balanced Responsive Two-Column Overview Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 w-full items-start">
                  {/* Left Container — Substantial Property Image and Summary */}
                  <div className="lg:col-span-6 flex flex-col gap-4">
                    {/* 1. Substantially Larger Property Image Card */}
                    <Card className="border border-border/70 shadow-sm overflow-hidden bg-card/90 backdrop-blur-sm rounded-2xl group">
                      {hasImages ? (
                        <div
                          onClick={() => openLightbox(currentImageIndex)}
                          className="relative rounded-t-2xl overflow-hidden aspect-[16/10] w-full bg-muted/40 cursor-pointer select-none group"
                          title={t('Click to open image viewer', 'படத்தொகுப்பைத் திறக்க கிளிக் செய்யவும்')}
                        >
                          <img
                            src={images[currentImageIndex]}
                            alt={`${displayTitle} - ${currentImageIndex + 1}`}
                            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                          />
                          {/* View Gallery Hover Badge */}
                          <div className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md opacity-90 group-hover:opacity-100 transition-all">
                            <Maximize2 className="h-3.5 w-3.5" />
                            <span className="font-medium">{t('View Gallery', 'படத்தொகுப்பு')}</span>
                          </div>

                          {/* In-Card Prev/Next Navigation (if multiple images) */}
                          {images.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={prevImage}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/85 transition-all shadow-md hover:scale-110 active:scale-95 cursor-pointer"
                                aria-label="Previous image"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={nextImage}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/85 transition-all shadow-md hover:scale-110 active:scale-95 cursor-pointer"
                                aria-label="Next image"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <div className="absolute bottom-3 left-3 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-xs font-mono font-medium flex items-center gap-1.5 shadow-md">
                                <Images className="h-3.5 w-3.5 text-white/80" />
                                <span>{currentImageIndex + 1} / {images.length}</span>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[16/10] rounded-t-2xl bg-muted/30 border-b border-border/50 flex flex-col items-center justify-center text-muted-foreground/40 gap-2 p-6">
                          <Home className="h-10 w-10 text-muted-foreground/30" />
                          <span className="text-sm font-medium">{t('No images uploaded', 'படங்கள் எதுவும் இல்லை')}</span>
                        </div>
                      )}

                      {/* Property Summary Area (immediately below the image) */}
                      <div className="p-4 sm:p-5 space-y-4">
                        {/* Title, Location & Contextual Edit Action */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="text-lg sm:text-xl font-bold text-foreground leading-tight" title={displayTitle}>
                              {displayTitle}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              <span className="truncate">{displayLocation}</span>
                            </div>
                          </div>

                          {!isTenantView && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shrink-0 rounded-xl"
                              onClick={() => setActiveSection('edit')}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              {t('Edit', 'திருத்து')}
                            </Button>
                          )}
                        </div>

                        {/* Price & Transaction */}
                        <div className="flex items-baseline gap-2 flex-wrap pt-1 border-t border-border/40">
                          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                            ₹{Number(property.price || 0).toLocaleString('en-IN')}
                          </span>
                          {property.transactionType?.toLowerCase() === 'rent' && (
                            <span className="text-sm text-muted-foreground font-medium">/month</span>
                          )}
                          <Badge variant="secondary" className="ml-1 text-xs px-2 py-0.5 font-semibold uppercase tracking-wider">
                            {property.transactionType || 'Sale'}
                          </Badge>
                        </div>

                        {/* Badges: Ownership, Occupancy, Listing */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTenantView ? (
                            <>
                              <Badge className="bg-emerald-600/90 text-white text-xs px-2.5 py-1 font-semibold shrink-0 flex items-center gap-1.5 shadow-2xs">
                                <KeyRound className="h-3 w-3" />
                                {t('Rented / Tenant', 'வாடகைதாரர்')}
                              </Badge>
                              <Badge className="bg-purple-600 text-white text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('Active Lease', 'செயலில் உள்ள குத்தகை')}
                              </Badge>
                            </>
                          ) : (
                            <>
                              {isAcquired ? (
                                <Badge className="bg-emerald-600/90 text-white text-xs px-2.5 py-1 font-semibold shrink-0">
                                  ✓ {t('Acquired', 'வாங்கப்பட்டது')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs px-2.5 py-1 shrink-0 font-medium">
                                  {t('Owned', 'உரிமையாளர்')}
                                </Badge>
                              )}

                              {isOccupied ? (
                                <Badge className="bg-purple-600 text-white text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs">
                                  <Users className="h-3 w-3" />
                                  {t('Occupied', 'குடியேற்றப்பட்டது')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs px-2.5 py-1 shrink-0 font-medium">
                                  {t('Vacant', 'காலியாக')}
                                </Badge>
                              )}

                              {isUnderContract ? (
                                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs">
                                  <Lock className="h-3 w-3" />
                                  {t('Under Contract', 'ஒப்பந்தத்தில்')}
                                </Badge>
                              ) : isCurrentlyListed ? (
                                <Badge className={`text-white text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs ${
                                  property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                                }`}>
                                  <Globe className="h-3 w-3" />
                                  {property.transactionType?.toLowerCase() === 'rent'
                                    ? t('Listed: Rent', 'வாடகைக்கு')
                                    : t('Listed: Sale', 'விற்பனைக்கு')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shrink-0">
                                  <EyeOff className="h-3 w-3" />
                                  {t('Private', 'தனிப்பட்டது')}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>

                        {/* GPS Location Row */}
                        {property.geoLocation?.latitude && property.geoLocation?.longitude && (
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-xl border border-border/50">
                            <div className="flex items-center gap-2 truncate">
                              <Compass className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-mono text-xs truncate">
                                GPS: {Number(property.geoLocation.latitude).toFixed(4)}°, {Number(property.geoLocation.longitude).toFixed(4)}°
                              </span>
                            </div>
                            <a
                              href={`https://maps.google.com/?q=${property.geoLocation.latitude},${property.geoLocation.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-semibold text-xs shrink-0 flex items-center gap-1"
                            >
                              <span>{t('Open in Maps', 'வரைபடத்தில் திற')}</span>
                              <span className="text-xs">↗</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Right Container — Specifications & Details */}
                  <div className="lg:col-span-6 flex flex-col gap-4">
                    <Card className="border border-border/70 shadow-sm bg-card/90 backdrop-blur-sm rounded-2xl">
                      <CardHeader className="py-3.5 px-4 sm:px-5 border-b border-border/40">
                        <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                          <Building2 className="h-4.5 w-4.5 text-primary" />
                          {t('Specifications & Details', 'விவரங்கள் மற்றும் விவரக்குறிப்புகள்')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        {/* Dense Responsive Specifications Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {/* Property Type */}
                          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                              {t('Property Type', 'சொத்து வகை')}
                            </span>
                            <span className="text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                              {property.propertyType}
                            </span>
                          </div>

                          {/* Total Area */}
                          {property.totalArea ? (
                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                {t('Total Area', 'மொத்த பரப்பளவு')}
                              </span>
                              <span className="text-sm font-semibold text-foreground mt-0.5 block truncate">
                                {property.totalArea.toLocaleString()} sq.ft
                                {property.cent !== undefined && property.cent !== null && (
                                  <span className="text-xs text-muted-foreground ml-1 font-normal">({property.cent} cent)</span>
                                )}
                              </span>
                            </div>
                          ) : null}

                          {/* Bedrooms (non-land) */}
                          {property.propertyType?.toLowerCase() !== 'land' && property.bedrooms ? (
                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                {t('Bedrooms', 'படுக்கையறைகள்')}
                              </span>
                              <span className="text-sm font-semibold text-foreground mt-0.5 block truncate">
                                {property.bedrooms} BHK
                              </span>
                            </div>
                          ) : null}

                          {/* Bathrooms if present */}
                          {(property as any).bathrooms ? (
                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                {t('Bathrooms', 'குளியலறைகள்')}
                              </span>
                              <span className="text-sm font-semibold text-foreground mt-0.5 block truncate">
                                {(property as any).bathrooms}
                              </span>
                            </div>
                          ) : null}

                          {/* Facing */}
                          {property.facing ? (
                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                {t('Facing', 'நோக்கு நிலை')}
                              </span>
                              <span className="text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                                {property.facing}
                              </span>
                            </div>
                          ) : null}

                          {/* Transaction Type */}
                          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                              {t('Transaction', 'பரிவர்த்தனை')}
                            </span>
                            <span className="text-sm font-semibold capitalize text-foreground mt-0.5 block truncate">
                              {property.transactionType || 'Sale'}
                            </span>
                          </div>
                        </div>

                        {/* Land Boundary Dimensions (if applicable) */}
                        {property.propertyType?.toLowerCase() === 'land' && property.landDimensions && (
                          <div className="pt-3 border-t border-border/40 space-y-2">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                              <Compass className="h-3.5 w-3.5 text-primary" />
                              {t('Boundary Dimensions (ft)', 'எல்லை பரிமாணங்கள் (அடி)')}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                                <span className="text-muted-foreground block text-[10px]">A → B</span>
                                <span className="font-semibold text-xs text-foreground">{property.landDimensions.ab ?? '-'} ft</span>
                              </div>
                              <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                                <span className="text-muted-foreground block text-[10px]">B → C</span>
                                <span className="font-semibold text-xs text-foreground">{property.landDimensions.bc ?? '-'} ft</span>
                              </div>
                              <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                                <span className="text-muted-foreground block text-[10px]">C → D</span>
                                <span className="font-semibold text-xs text-foreground">{property.landDimensions.cd ?? '-'} ft</span>
                              </div>
                              <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                                <span className="text-muted-foreground block text-[10px]">D → A</span>
                                <span className="font-semibold text-xs text-foreground">{property.landDimensions.da ?? '-'} ft</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Amenities & Features as Compact Chips */}
                        {property.amenities && property.amenities.length > 0 && (
                          <div className="pt-3 border-t border-border/40 space-y-2">
                            <span className="text-xs font-semibold text-muted-foreground block">
                              {t('Amenities & Features', 'வசதிகள்')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {property.amenities.map((amenity, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium"
                                >
                                  ✓ {amenity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {property.description && (
                          <div className="pt-3 border-t border-border/40 space-y-1.5">
                            <span className="text-xs font-semibold text-muted-foreground block">
                              {t('Description', 'விளக்கம்')}
                            </span>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {property.description}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Full-Width Bottom Action Area: Restrained Danger Zone OR Tenant Quick Actions */}
                {!isTenantView ? (
                  <div className="w-full rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-400">
                        {t('Danger Zone', 'அபாய பகுதி')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('Permanently remove this property from your account. This action cannot be undone.', 'இந்த சொத்தை நிரந்தரமாக நீக்கவும். இந்த செயலை மாற்ற முடியாது.')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-rose-600 border-rose-300 dark:border-rose-900/60 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 shrink-0 rounded-xl"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t('Delete Property', 'சொத்தை நீக்கு')}
                    </Button>
                  </div>
                ) : (
                  <div className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3.5 glass-panel">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                        <span className="text-sm font-bold text-foreground">{t('Tenant Quick Actions', 'வாடகைதாரர் விரைவுச் செயல்கள்')}</span>
                      </div>
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        {t('Active Lease', 'செயலில் உள்ள குத்தகை')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        size="sm"
                        className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 justify-center rounded-xl shadow-xs"
                        onClick={() => setActiveSection('payments')}
                      >
                        <CreditCard className="h-4 w-4" />
                        {t('Pay Rent', 'வாடகை செலுத்த')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs font-semibold gap-2 justify-center rounded-xl"
                        onClick={() => setActiveSection('maintenance')}
                      >
                        <Wrench className="h-4 w-4 text-amber-500" />
                        {t('Report Issue', 'சிக்கலைப் புகாரளிக்க')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs font-semibold gap-2 justify-center text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                        onClick={() => setActiveSection('vacate')}
                      >
                        <LogOut className="h-4 w-4" />
                        {t('Notice to Vacate', 'வெளியேறும் அறிவிப்பு')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: EDIT DETAILS */}
            {activeSection === 'edit' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-primary" />
                      {isTenantView ? t('Property Specifications', 'சொத்து விவரங்கள்') : t('Edit Property Details', 'சொத்து விவரங்களைத் திருத்து')}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {isTenantView ? t('Tenant View (Read Only)', 'வாடகைதாரர் பார்வை') : property.propertyType}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isTenantView
                      ? t('Property specifications and configurations are managed exclusively by the property owner.', 'சொத்து விவரங்கள் உரிமையாளரால் நிர்வகிக்கப்படுகின்றன.')
                      : t('Update specifications, pricing, amenities, images, or GPS coordinates.', 'விவரங்கள், விலை, வசதிகள், படங்கள் அல்லது வரைபட இருப்பிடத்தை புதுப்பிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {isTenantView ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-3">
                        <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-semibold text-sm">{t('Owner-Managed Property', 'உரிமையாளரால் நிர்வகிக்கப்படும் சொத்து')}</p>
                          <p className="mt-1 leading-relaxed">
                            {t('As a tenant, you have full visibility of this property and its tenancy records. Modifications to physical specifications, transaction pricing, or listing details must be performed by the registered owner.', 'வாடகைதாரராக, நீங்கள் சொத்து விவரங்களைப் பார்க்கலாம். விவரக்குறிப்புகளில் மாற்றங்கள் உரிமையாளரால் மட்டுமே செய்ய முடியும்.')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Property Type', 'சொத்து வகை')}</span>
                          <span className="text-sm font-semibold capitalize mt-1 block">{property.propertyType}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Total Area', 'மொத்த பரப்பளவு')}</span>
                          <span className="text-sm font-semibold mt-1 block">{property.totalArea ? `${property.totalArea} sq.ft` : '-'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Bedrooms', 'படுக்கையறைகள்')}</span>
                          <span className="text-sm font-semibold mt-1 block">{property.bedrooms ? `${property.bedrooms} BHK` : '-'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Facing', 'நோக்கு நிலை')}</span>
                          <span className="text-sm font-semibold capitalize mt-1 block">{property.facing || '-'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Furnishing', 'தளவாடங்கள்')}</span>
                          <span className="text-sm font-semibold capitalize mt-1 block">{(property as any).furnishing || (property as any).furnishingStatus || 'Unspecified'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Location', 'இடம்')}</span>
                          <span className="text-sm font-semibold mt-1 block truncate">{displayLocation}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PropertyForm
                      inline={true}
                      open={true}
                      initialData={property}
                      onOpenChange={() => {}}
                      onSaved={() => {
                        setActiveSection('overview');
                      }}
                    />
                  )}
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
                  {isTenantView ? (
                    <div className="p-4 rounded-xl border border-muted bg-card/60 space-y-3">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold text-sm">{t('Listing Controls Restricted for Tenants', 'பட்டியல் கட்டுப்பாடுகள் உரிமையாளருக்கு மட்டுமே')}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('Public marketplace visibility and search publishing are controlled exclusively by the owner. While your lease is active, this rental property remains occupied and private.', 'பொது சந்தை தெரிவுநிலை உரிமையாளரால் மட்டுமே கட்டுப்படுத்தப்படுகிறது. உங்கள் குத்தகை செயலில் உள்ள வரை, இந்த சொத்து தனிப்பட்டதாகவே இருக்கும்.')}
                      </p>
                      <div className="pt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t('Current Status', 'தற்போதைய நிலை')}:</span>
                        <Badge className="bg-purple-600 text-white text-[10px]">
                          <Users className="h-2.5 w-2.5 mr-1" />
                          {t('Occupied (Tenant Active)', 'குடியேற்றப்பட்டது')}
                        </Badge>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                      {(isTenantView || isBuyerView)
                        ? t('Transaction & Application Details', 'பரிவர்த்தனை & விண்ணப்ப விவரங்கள்')
                        : t('Requests & Offers', 'கோரிக்கைகள் மற்றும் சலுகைகள்')}
                      {(!isTenantView && !isBuyerView) && (
                        <Badge variant="secondary" className="ml-1.5 text-xs font-semibold">
                          {propertyRequests.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {(isTenantView || isBuyerView)
                        ? t('Follow and complete every transaction step: terms, counteroffers, advance payment, and verified confirmation.', 'விதிமுறைகள், முன்பணம் மற்றும் கட்டண சரிபார்ப்பு உள்ளிட்ட அனைத்து நிலைகளையும் முடிக்கவும்.')
                        : t('Manage buyer purchase offers and tenant rental applications following the verified transaction workflow.', 'வாங்குபவர் சலுகைகள் மற்றும் குத்தகைதாரர் விண்ணப்பங்களை நிர்வகிக்கவும்.')}
                    </CardDescription>
                  </div>
                  {(!isTenantView && !isBuyerView) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchOwnerRequests()}
                      className="h-7 text-xs gap-1 self-start sm:self-auto"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {t('Refresh', 'புதுப்பி')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchTenantRequests()}
                      className="h-7 text-xs gap-1 self-start sm:self-auto"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {t('Refresh', 'புதுப்பி')}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {(isTenantView || isBuyerView) ? (
                    activeTenantRequest ? (
                      <div className="space-y-4">
                        {/* Customer Request / Offer Card */}
                        <div className="border rounded-2xl p-4 sm:p-5 bg-card/70 border-border/70 shadow-2xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={(activeTenantRequest.type === 'buy' || isBuyerView) ? 'default' : 'secondary'} className="text-xs font-semibold uppercase">
                                {(activeTenantRequest.type === 'buy' || isBuyerView) ? t('Purchase Offer', 'கொள்முதல் சலுகை') : t('Rental Application', 'வாடகை விண்ணப்பம்')}
                              </Badge>
                              {getStatusBadge(activeTenantRequest.status)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {t('Submitted on', 'சமர்ப்பிக்கப்பட்டது')}: {new Date(activeTenantRequest.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>

                          {/* Visual 5-Stage Step Timeline */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                            {getTimelineStages(activeTenantRequest).map((stage) => (
                              <div key={stage.id} className="flex flex-col items-start gap-1 p-2 rounded-xl bg-background/70 border border-border/50 text-xs">
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    stage.status === 'done'
                                      ? 'bg-emerald-600 text-white'
                                      : stage.status === 'current'
                                      ? 'bg-blue-600 text-white animate-pulse'
                                      : stage.status === 'warning'
                                      ? 'bg-purple-600 text-white'
                                      : stage.status === 'failed'
                                      ? 'bg-destructive text-white'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {stage.status === 'done' ? '✓' : stage.status === 'failed' ? '✕' : stage.id}
                                  </span>
                                  <span className="font-semibold text-foreground truncate text-[11px]">{stage.title}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground ml-6 truncate">{stage.desc}</span>
                              </div>
                            ))}
                          </div>

                          {/* Transaction Terms & Offer Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3.5 rounded-xl bg-muted/20 border border-border/40">
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Your Offered Price', 'நீங்கள் வழங்கிய தொகை')}</p>
                              <p className="font-bold text-foreground text-sm text-green-600 dark:text-green-400">
                                ₹{Number(activeTenantRequest.proposedPrice || activeTenantRequest.offeredPrice || activeTenantRequest.rentAmount || activeTenantRequest.price || 0).toLocaleString()}
                                {activeTenantRequest.type === 'rent' && <span className="text-[10px] text-muted-foreground font-normal"> /mo</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Agreed Deal Value', 'ஒப்புக்கொள்ளப்பட்ட மதிப்பு')}</p>
                              <p className="font-bold text-foreground text-sm">
                                ₹{Number(activeTenantRequest.agreedAmount || activeTenantRequest.proposedPrice || activeTenantRequest.price || 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Property Owner / Seller', 'சொத்து உரிமையாளர்')}</p>
                              <p className="font-semibold text-foreground text-sm">
                                {(property.owner as any)?.name || t('Property Owner', 'உரிமையாளர்')}
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                {(property.owner as any)?.email || (property.owner as any)?.phone || '-'}
                              </p>
                            </div>
                          </div>

                          {activeTenantRequest.message && (
                            <div className="text-xs p-3 rounded-xl bg-muted/15 border border-border/30">
                              <span className="text-muted-foreground font-medium block text-[11px]">{t('Application Note:', 'விண்ணப்ப குறிப்பு:')}</span>
                              <p className="italic text-foreground mt-0.5">"{activeTenantRequest.message}"</p>
                            </div>
                          )}

                          {activeTenantRequest.counterOfferAmount && (
                            <div className="text-xs p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                              <span className="text-purple-600 font-bold block text-xs">
                                {t('Owner Counteroffer:', 'உரிமையாளர் எதிர் சலுகை:')} ₹{Number(activeTenantRequest.counterOfferAmount).toLocaleString('en-IN')}
                              </span>
                              {activeTenantRequest.counterOfferNote && (
                                <p className="text-muted-foreground italic">"{activeTenantRequest.counterOfferNote}"</p>
                              )}
                            </div>
                          )}

                          {/* Available Authorized Actions */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => {
                                setSelectedRequest(activeTenantRequest);
                                setIsRequestModalOpen(true);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {t('Open Full Transaction Modal', 'முழு பரிவர்த்தனை விவரங்கள்')}
                            </Button>

                            <div className="flex items-center gap-2 flex-wrap ml-auto">
                              {activeTenantRequest.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800"
                                  onClick={() => {
                                    cancelRequestMutation.mutate(
                                      { requestId: activeTenantRequest._id || activeTenantRequest.id },
                                      {
                                        onSuccess: () => {
                                          toast.success(t('Request withdrawn successfully', 'கோரிக்கை திரும்பப் பெறப்பட்டது'));
                                          refetchTenantRequests();
                                        },
                                        onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to withdraw request', 'பிழை'))
                                      }
                                    );
                                  }}
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  {t('Withdraw Request', 'கோரிக்கையை திரும்பப்பெறு')}
                                </Button>
                              )}

                              {activeTenantRequest.status === 'counteroffer' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => {
                                      acceptCounterMutation.mutate(activeTenantRequest._id || activeTenantRequest.id, {
                                        onSuccess: () => {
                                          toast.success(t('Counteroffer accepted!', 'எதிர் சலுகை ஏற்கப்பட்டது!'));
                                          refetchTenantRequests();
                                        },
                                        onError: (err: any) => toast.error(err?.response?.data?.msg || t('Failed to accept counteroffer', 'பிழை'))
                                      });
                                    }}
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    {t('Accept Counteroffer', 'எதிர் சலுகையை ஏற்றுக்கொள்')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => {
                                      setSelectedRequest(activeTenantRequest);
                                      setIsRequestModalOpen(true);
                                    }}
                                  >
                                    {t('Respond', 'பதிலளி')}
                                  </Button>
                                </>
                              )}

                              {['accepted', 'approved', 'terms_confirmed'].includes(activeTenantRequest.status) && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                  onClick={() => {
                                    setSelectedRequest(activeTenantRequest);
                                    setIsRequestModalOpen(true);
                                  }}
                                >
                                  <CreditCard className="w-3.5 h-3.5 mr-1" />
                                  {t('Submit Payment Now', 'கட்டணத்தை செலுத்தவும்')}
                                </Button>
                              )}

                              {activeTenantRequest.status === 'payment_pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1.5"
                                  onClick={() => {
                                    setSelectedRequest(activeTenantRequest);
                                    setIsRequestModalOpen(true);
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {t('View Payment Submission', 'கட்டண ரசீதை பார்க்க')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <Inbox className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm text-muted-foreground font-medium">
                          {t('No active requests or transactions found for this property.', 'இந்த சொத்திற்கான பரிவர்த்தனை எதுவும் இல்லை.')}
                        </p>
                      </div>
                    )
                  ) : propertyRequests.length === 0 ? (
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
                {isTenantView ? (
                  <div className="space-y-3">
                    <Card className="border border-border/80 shadow-xs">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {t('Your Tenancy & Landlord Details', 'உங்கள் குத்தகை மற்றும் உரிமையாளர் விவரங்கள்')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Active rental lease overview and registered landlord contact information.', 'செயலில் உள்ள வாடகை ஒப்பந்தம் மற்றும் உரிமையாளர் தொடர்பு விவரங்கள்.')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        {/* Landlord Contact Info */}
                        <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 space-y-2">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">{t('Property Owner / Landlord', 'சொத்து உரிமையாளர்')}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Name', 'பெயர்')}</p>
                              <p className="text-sm font-semibold">{tenantAgreement?.owner?.name || tenantAgreement?.ownerId?.name || (property.owner as any)?.name || t('Landlord', 'உரிமையாளர்')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Email', 'மின்னஞ்சல்')}</p>
                              <p className="text-sm font-medium truncate">{tenantAgreement?.owner?.email || tenantAgreement?.ownerId?.email || (property.owner as any)?.email || '-'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Phone', 'தொலைபேசி')}</p>
                              <p className="text-sm font-medium">{tenantAgreement?.owner?.phone || tenantAgreement?.ownerId?.phone || (property.owner as any)?.phone || '-'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Lease Terms */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 rounded-xl bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Monthly Rent', 'மாத வாடகை')}</span>
                            <span className="text-base font-bold text-green-600 dark:text-green-400 mt-0.5 block">
                              ₹{Number(tenantAgreement?.rentAmount || property.price || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Security Deposit', 'முன்பணம்')}</span>
                            <span className="text-base font-bold text-foreground mt-0.5 block">
                              ₹{Number(tenantAgreement?.securityDeposit || (property.price ? Number(property.price) * 2 : 0)).toLocaleString()}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Lease Start', 'தொடக்க தேதி')}</span>
                            <span className="text-sm font-medium text-foreground mt-0.5 block">
                              {tenantAgreement?.startDate ? new Date(tenantAgreement.startDate).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">{t('Lease End', 'முடிவு தேதி')}</span>
                            <span className="text-sm font-medium text-foreground mt-0.5 block">
                              {tenantAgreement?.endDate ? new Date(tenantAgreement.endDate).toLocaleDateString() : t('12 Months', '12 மாதங்கள்')}
                            </span>
                          </div>
                        </div>

                        {/* Quick Tenant Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                            onClick={() => setActiveSection('payments')}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {t('Pay Rent', 'வாடகை செலுத்து')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setActiveSection('maintenance')}
                          >
                            <Wrench className="h-3.5 w-3.5 text-primary" />
                            {t('Report Maintenance Issue', 'சிக்கலைப் புகாரளிக்கவும்')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setActiveSection('vacate')}
                          >
                            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                            {t('Notice to Vacate', 'வெளியேறும் அறிவிப்பு')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : tenantProfile ? (
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
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {isTenantView ? t('My Rent Payments & Dues', 'என் வாடகை கட்டணங்கள் & நிலுவைகள்') : t('Rent & Payment Breakdown', 'வாடகை மற்றும் கட்டண விவரங்கள்')}
                    </span>
                    {isTenantView && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTenantPaymentDetails}
                        className="h-7 text-xs gap-1"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {t('Refresh', 'புதுப்பி')}
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isTenantView
                      ? t('View your monthly billing records, submit rent payments, and download payment receipts.', 'மாதாந்திர கட்டண பதிவுகள், கட்டணம் செலுத்துதல் மற்றும் ரசீது பதிவிறக்கம்.')
                      : t('Track payment history, tenant payment verifications, and monthly balances.', 'கட்டண வரலாறு மற்றும் ஒப்புதல்களை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {isTenantView ? (
                    loadingPayments ? (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        {t('Loading rent records...', 'கட்டண பதிவுகளை ஏற்றுகிறது...')}
                      </div>
                    ) : tenantRentRecords.length > 0 ? (
                      <div className="space-y-3">
                        {tenantRentRecords.map((record: any) => {
                          const isPaid = record.status === 'paid';
                          const isOverdue = record.status === 'overdue';
                          const isPendingVerification = record.status === 'verification_pending' || record.status === 'processing';
                          return (
                            <div
                              key={record._id || record.id}
                              className="border rounded-xl p-3.5 bg-card/60 hover:bg-card/90 transition-all border-border/60 shadow-2xs space-y-2.5"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`text-[10px] ${
                                      isPaid
                                        ? 'bg-emerald-600 text-white'
                                        : isOverdue
                                        ? 'bg-rose-600 text-white'
                                        : isPendingVerification
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-blue-600 text-white'
                                    }`}
                                  >
                                    {isPaid
                                      ? t('PAID', 'செலுத்தப்பட்டது')
                                      : isPendingVerification
                                      ? t('VERIFICATION PENDING', 'சரிபார்ப்பு நிலுவையில்')
                                      : isOverdue
                                      ? t('OVERDUE', 'தவணை கடந்தது')
                                      : t('DUE', 'செலுத்த வேண்டியது')}
                                  </Badge>
                                  <span className="text-xs font-semibold text-foreground">
                                    {record.month ? new Date(record.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : t('Current Month', 'இந்த மாதம்')}
                                  </span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {t('Due Date', 'கடைசி தேதி')}: {record.dueDate ? new Date(record.dueDate).toLocaleDateString() : '-'}
                                </span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div>
                                  <p className="text-[11px] text-muted-foreground">{t('Amount Due', 'செலுத்த வேண்டிய தொகை')}</p>
                                  <p className="text-base font-bold text-green-600 dark:text-green-400">
                                    ₹{Number(record.rentAmount || record.balance || 0).toLocaleString()}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isPaid ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs gap-1.5"
                                      onClick={() => {
                                        const paymentObj = (record.payments && record.payments[0]) || {
                                          amount: record.rentAmount || record.balance,
                                          mode: 'Online',
                                          date: record.updatedAt || new Date()
                                        };
                                        generateReceipt(paymentObj, record);
                                      }}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      {t('Download Receipt', 'ரசீது பதிவிறக்கம்')}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                      onClick={() => {
                                        setSelectedRentRecordToPay(record);
                                        setIsPaymentDialogOpen(true);
                                      }}
                                    >
                                      <CreditCard className="h-3.5 w-3.5" />
                                      {t('Pay Rent Now', 'இப்போது செலுத்தவும்')}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <CreditCard className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-semibold text-foreground">
                          {t('No billing records found for this property', 'கட்டண பதிவுகள் எதுவும் இல்லை')}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          {t('New invoices and payment schedules are generated automatically for your lease cycle.', 'உங்கள் குத்தகை சுழற்சிக்கான இன்வாய்ஸ்கள் தானாகவே உருவாக்கப்படும்.')}
                        </p>
                      </div>
                    )
                  ) : loadingPayments ? (
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
                    {isTenantView ? t('Rental Agreement & Documents', 'வாடகை ஒப்பந்தம் & ஆவணங்கள்') : t('Rental Agreements', 'வாடகை ஒப்பந்தங்கள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isTenantView
                      ? t('Access your registered rental agreement and upload required KYC documents.', 'உங்கள் பதிவுசெய்யப்பட்ட வாடகை ஒப்பந்தம் மற்றும் KYC ஆவணங்கள்.')
                      : t('Manage active and past rental contracts for this property.', 'இந்த சொத்திற்கான வாடகை ஒப்பந்தங்களை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {loadingAgreements ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading agreements...', 'ஒப்பந்தங்களை ஏற்றுகிறது...')}
                    </div>
                  ) : agreements.length > 0 || (isTenantView && tenantAgreement) ? (
                    <div className="space-y-3">
                      {(agreements.length > 0 ? agreements : [tenantAgreement].filter(Boolean)).map((agreement: any) => (
                        <div 
                          key={agreement._id || agreement.id} 
                          className="p-3.5 border rounded-xl bg-card/60 hover:bg-muted/50 transition-colors space-y-2.5"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-sm">{agreement.property?.title || title}</h3>
                              <p className="text-xs text-muted-foreground">{agreement.property?.location || loc}</p>
                            </div>
                            <Badge variant={agreement.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                              {(agreement.status || 'ACTIVE').toUpperCase()}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">{isTenantView ? t('Landlord', 'உரிமையாளர்') : t('Tenant', 'குத்தகைதாரர்')}</p>
                              <p className="font-medium">{isTenantView ? (agreement.owner?.name || agreement.ownerId?.name || t('Owner', 'உரிமையாளர்')) : agreement.tenant?.name}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t('Rent Amount', 'வாடகை தொகை')}</p>
                              <p className="font-bold text-green-600">₹{Number(agreement.rentAmount || property.price || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t('Valid Period', 'செல்லுபடியாகும் காலம்')}</p>
                              <p className="font-medium text-foreground">
                                {agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : '-'} – {agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '-'}
                              </p>
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

                  {/* Tenant Document Upload Section */}
                  {isTenantView && (
                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2 mt-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Upload className="h-3.5 w-3.5 text-primary" />
                            {t('Upload Tenant Document / ID Proof', 'ஆவணம் / அடையாளச் சான்று பதிவேற்றவும்')}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Supported formats: PDF, JPG, PNG (Max 5MB)', 'ஆதரிக்கப்படும் வடிவங்கள்: PDF, JPG, PNG')}
                          </p>
                        </div>
                        <div>
                          <input
                            type="file"
                            ref={tenantDocInputRef}
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleTenantUploadDocument}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            disabled={uploadingDoc}
                            onClick={() => tenantDocInputRef.current?.click()}
                          >
                            <Upload className="h-3 w-3" />
                            {uploadingDoc ? t('Uploading...', 'பதிவேற்றுகிறது...') : t('Upload File', 'கோப்பை ஏற்று')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 8: MAINTENANCE */}
            {activeSection === 'maintenance' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      {isTenantView ? t('Maintenance & Service Requests', 'பராமரிப்பு மற்றும் சேவை கோரிக்கைகள்') : t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}
                    </span>
                    {isTenantView && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTenantMaintenanceRequests}
                        className="h-7 text-xs gap-1"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {t('Refresh', 'புதுப்பி')}
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isTenantView
                      ? t('Submit repair requests with optional voice notes and track service status in real-time.', 'பழுதுபார்ப்பு கோரிக்கைகளை சமர்ப்பித்து நிலையை கண்காணிக்கவும்.')
                      : t('Review and complete maintenance issues reported for this property.', 'பராமரிப்பு சிக்கல்களை மதிப்பாய்வு செய்து தீர்க்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Tenant: Report Issue Form */}
                  {isTenantView && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                        {t('Report a New Maintenance Issue', 'புதிய பராமரிப்பு சிக்கலைப் புகாரளிக்கவும்')}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">{t('Issue Title', 'சிக்கலின் தலைப்பு')}</label>
                          <div className="relative">
                            <Input
                              value={tenantMaintenanceIssue}
                              onChange={(e) => setTenantMaintenanceIssue(e.target.value)}
                              placeholder={t('e.g. Water leak under sink', 'எ.கா. குழாய் கசிவு')}
                              className="h-8 text-xs pr-8"
                            />
                            <button
                              type="button"
                              onClick={() => toggleListening('issue')}
                              aria-label="Toggle voice input for issue title"
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                                isListeningIssue ? 'text-red-600 bg-red-100 animate-pulse' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {isListeningIssue ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">{t('Category', 'வகை')}</label>
                            <select
                              value={tenantMaintenanceCategory}
                              onChange={(e) => setTenantMaintenanceCategory(e.target.value as any)}
                              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                            >
                              <option value="Plumbing">Plumbing</option>
                              <option value="Electrical">Electrical</option>
                              <option value="Carpentry">Carpentry</option>
                              <option value="Painting">Painting</option>
                              <option value="Appliance">Appliance</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">{t('Priority', 'முன்னுரிமை')}</label>
                            <select
                              value={tenantMaintenancePriority}
                              onChange={(e) => setTenantMaintenancePriority(e.target.value as any)}
                              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">{t('Description / Details', 'விவரம்')}</label>
                        <div className="relative">
                          <Textarea
                            value={tenantMaintenanceDescription}
                            onChange={(e) => setTenantMaintenanceDescription(e.target.value)}
                            placeholder={t('Describe the issue in detail...', 'சிக்கலை விரிவாக விவரிக்கவும்...')}
                            className="text-xs min-h-[60px] pr-8"
                          />
                          <button
                            type="button"
                            onClick={() => toggleListening('description')}
                            aria-label="Toggle voice input for issue description"
                            className={`absolute right-2 top-2 p-1 rounded-md transition-colors ${
                              isListeningDescription ? 'text-red-600 bg-red-100 animate-pulse' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {isListeningDescription ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-primary text-primary-foreground gap-1.5"
                          disabled={isReportingMaintenance || !tenantMaintenanceIssue.trim()}
                          onClick={handleTenantSubmitMaintenance}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {isReportingMaintenance ? t('Submitting...', 'சமர்ப்பிக்கிறது...') : t('Submit Request', 'கோரிக்கையை அனுப்பு')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Maintenance Requests List */}
                  {loadingMaintenance ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading maintenance requests...', 'பராமரிப்பு கோரிக்கைகளை ஏற்றுகிறது...')}
                    </div>
                  ) : maintenanceRequests.length > 0 ? (
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-foreground">
                        {isTenantView ? t('Submitted Service Requests', 'சமர்ப்பிக்கப்பட்ட கோரிக்கைகள்') : t('Active Maintenance Requests', 'செயலில் உள்ள கோரிக்கைகள்')}
                      </p>
                      {maintenanceRequests.map((request) => (
                        <div
                          key={request._id}
                          className="border rounded-xl p-3 bg-card/60 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-xs sm:text-sm">{request.issue}</p>
                                {request.priority && (
                                  <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                    {request.priority}
                                  </Badge>
                                )}
                              </div>
                              {request.description && (
                                <p className="text-xs text-muted-foreground">{request.description}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {isTenantView ? (request.category || 'General') : (request.tenant?.name || t('Tenant', 'குத்தகைதாரர்'))} • {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <Badge className={`text-[10px] ${
                                request.status === 'completed'
                                  ? 'bg-green-600 text-white'
                                  : (request.status as string) === 'in-progress' || (request.status as string) === 'in_progress'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}>
                                {request.status}
                              </Badge>
                              {!isTenantView && request.status !== 'completed' && (
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

            {/* SECTION 9: VACATE */}
            {activeSection === 'vacate' && (
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LogOut className="h-4 w-4 text-primary" />
                    {isTenantView ? t('Notice to Vacate & Move-Out', 'வெளியேறும் அறிவிப்பு & நகர்வு') : t('Vacate Requests & Move-Outs', 'வெளியேறும் கோரிக்கைகள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isTenantView
                      ? t('Submit your formal notice of intent to vacate or monitor your current move-out clearance status.', 'வெளியேறும் அறிவிப்பைச் சமர்ப்பிக்கவும் அல்லது நிலையை கண்காணிக்கவும்.')
                      : t('Review and manage tenant vacate notices and move-out confirmations.', 'குத்தகைதாரர் வெளியேறும் அறிவிப்புகளை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {isTenantView ? (
                    (() => {
                      const myVacateRequest = tenantVacateRequests.find((r: any) => String(r.property?._id || r.property) === String(propertyId));
                      if (myVacateRequest && myVacateRequest.status !== 'rejected') {
                        return (
                          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">{t('Active Vacate Request', 'செயலில் உள்ள வெளியேறும் கோரிக்கை')}</span>
                              <Badge
                                className={`text-[10px] ${
                                  myVacateRequest.status === 'completed'
                                    ? 'bg-emerald-600 text-white'
                                    : myVacateRequest.status === 'approved'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-amber-600 text-white'
                                }`}
                              >
                                {myVacateRequest.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground text-[11px]">{t('Requested Move-Out Date', 'வெளியேறும் தேதி')}</p>
                                <p className="font-semibold text-foreground text-sm">
                                  {myVacateRequest.requestedVacateDate ? new Date(myVacateRequest.requestedVacateDate).toLocaleDateString() : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[11px]">{t('Reason', 'காரணம்')}</p>
                                <p className="font-medium text-foreground">{myVacateRequest.reason || '-'}</p>
                              </div>
                            </div>

                            {myVacateRequest.status === 'pending' && (
                              <div className="pt-2 border-t border-border/40 flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800"
                                  onClick={() => handleTenantCancelVacate(myVacateRequest._id || myVacateRequest.id)}
                                >
                                  {t('Cancel Vacate Notice', 'அறிவிப்பை ரத்துசெய்')}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                          <p className="text-xs font-semibold text-foreground">
                            {t('Submit Notice to Vacate', 'வெளியேறும் அறிவிப்பை சமர்ப்பிக்கவும்')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('Please submit your planned move-out date and reason at least 30 days prior to departure according to your lease agreement terms.', 'குத்தகை விதிமுறைகளின்படி குறைந்தது 30 நாட்களுக்கு முன் தெரிவிக்கவும்.')}
                          </p>

                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {t('Planned Move-Out Date', 'திட்டமிட்ட வெளியேறும் தேதி')}
                              </label>
                              <Input
                                type="date"
                                value={tenantVacateDate}
                                onChange={(e) => setTenantVacateDate(e.target.value)}
                                className="h-8 text-xs sm:w-64"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {t('Reason for Move-Out', 'வெளியேறுவதற்கான காரணம்')}
                              </label>
                              <Textarea
                                value={tenantVacateReason}
                                onChange={(e) => setTenantVacateReason(e.target.value)}
                                placeholder={t('Job relocation, lease expiry, purchasing own home, etc.', 'வேலை மாற்றம், ஒப்பந்த முடிவு போன்றவை...')}
                                className="text-xs min-h-[60px]"
                              />
                            </div>

                            <div className="flex justify-end pt-1">
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                                disabled={isSubmittingVacate || !tenantVacateDate}
                                onClick={handleTenantSubmitVacate}
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                {isSubmittingVacate ? t('Submitting Notice...', 'அனுப்புகிறது...') : t('Submit Notice to Vacate', 'அறிவிப்பை சமர்ப்பி')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : loadingVacateRequests ? (
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

      {/* Fullscreen Lightbox / Image Viewer Overlay */}
      {isLightboxOpen && hasImages && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Property Image Viewer', 'சொத்து படத்தொகுப்பு')}
          onClick={(e) => {
            // Close only when clicking backdrop itself
            if (e.target === e.currentTarget) {
              setIsLightboxOpen(false);
            }
          }}
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/92 backdrop-blur-md p-3 sm:p-6 select-none animate-in fade-in duration-200"
        >
          {/* Top Bar: Title, Counter, Close */}
          <div className="w-full flex items-center justify-between gap-3 text-white z-10 shrink-0">
            <div className="min-w-0 flex items-center gap-2 truncate">
              <span className="font-semibold text-sm sm:text-base truncate">{displayTitle}</span>
              <span className="hidden sm:inline-block text-xs text-white/60">•</span>
              <span className="hidden sm:inline-block text-xs text-white/70 truncate">{displayLocation}</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-medium text-white/90">
                {lightboxIndex + 1} / {images.length}
              </div>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close image viewer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Center Stage: Prev, Main Image, Next */}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsLightboxOpen(false);
              }
            }}
            className="flex-1 w-full flex items-center justify-between gap-2 sm:gap-4 my-auto relative min-h-0"
          >
            {/* Prev Button */}
            {images.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
                }}
                className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                aria-label="Previous image"
                title="Previous (Left arrow)"
              >
                <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            ) : (
              <div className="w-11 sm:w-14" />
            )}

            {/* Main Image Container */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsLightboxOpen(false);
                }
              }}
              className="flex-1 flex items-center justify-center h-full max-h-[76vh] overflow-hidden p-1"
            >
              <img
                key={lightboxIndex}
                src={images[lightboxIndex]}
                alt={`${displayTitle} - ${lightboxIndex + 1}`}
                className="max-h-[76vh] max-w-[85vw] object-contain rounded-xl shadow-2xl transition-all duration-200 select-none animate-in fade-in zoom-in-95 duration-150"
              />
            </div>

            {/* Next Button */}
            {images.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % images.length);
                }}
                className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                aria-label="Next image"
                title="Next (Right arrow)"
              >
                <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            ) : (
              <div className="w-11 sm:w-14" />
            )}
          </div>

          {/* Bottom Thumbnails Strip (if > 1 image) */}
          {images.length > 1 && (
            <div className="w-full flex justify-center py-2 z-10 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full px-2 py-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative h-12 w-16 sm:h-14 sm:w-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === lightboxIndex
                        ? 'border-primary ring-2 ring-primary/40 scale-105'
                        : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tenant Payment Dialog */}
      {isPaymentDialogOpen && selectedRentRecordToPay && (
        <PaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          rentRecord={selectedRentRecordToPay}
          onSuccess={() => {
            fetchTenantPaymentDetails();
            toast.success(t('Payment submitted successfully!', 'கட்டணம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!'));
          }}
        />
      )}

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
