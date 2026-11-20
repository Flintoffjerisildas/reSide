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
  AlertCircle,
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
  ShoppingBag,
  UserCheck,
  Plus,
  Car,
  Wifi,
  Droplets,
  Layers,
  Wallet,
  TrendingUp,
  Phone,
  Mail,
  Bell,
  ExternalLink
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import socket from '../lib/socket';
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
  useGetSelfManagedRentals,
  useDeleteRecordedPayment,
  useAttachRentalDocument,
  useDeleteRentalDocument,
  useUpdateMaintenanceEntry,
  useDeleteMaintenanceEntry,
  useUpdateVacatePlan,
  useDeleteSelfManagedRental,
  useGetCallerUserProfile,
} from '../hooks/useQueries';
import PropertyForm from './PropertyForm';
import AgreementDialog from './AgreementDialog';
import ListingControlDialog from './ListingControlDialog';
import RequestDetailsModal from './RequestDetailsModal';
import { PropertySelectorItem } from './PropertyHorizontalSelector';
import PaymentDialog from './PaymentDialog';
import RecordRentPaymentDialog from './RecordRentPaymentDialog';
import LogMaintenanceDialog from './LogMaintenanceDialog';
import ConnectLandlordDialog from './ConnectLandlordDialog';
import { generateReceipt } from '../utils/receiptGenerator';

export type PropertySectionKey =
  | 'overview'
  | 'edit'
  | 'listing'
  | 'requests'
  | 'tenancy'
  | 'payments'
  | 'agreements'
  | 'maintenance'
  | 'vacate';

export interface PropertyFullScreenViewProps {
  property: Property | null;
  onBack?: () => void;
  initialTab?: string;
  properties?: any[];
  selectedPropertyId?: string;
  onSelectProperty?: (property: any) => void;
  isTenantView?: boolean;
  isBuyerView?: boolean;
  isMyRentsView?: boolean;
  activeSubTab?: string;
  tenantAgreement?: any;
  activeRequest?: any;
  activeSection?: PropertySectionKey;
  onActiveSectionChange?: (sec: PropertySectionKey) => void;
  rentFlowMode?: 'in' | 'out';
  onRentFlowModeChange?: (mode: 'in' | 'out') => void;
  payableItems?: any[];
  receivableItems?: any[];
  payableSummary?: any;
  receivableSummary?: any;
  onPayNow?: (record: any) => void;
  onDownloadReceipt?: (item: any) => void;
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
  isMyRentsView = false,
  activeSubTab,
  tenantAgreement,
  activeRequest,
  activeSection: controlledActiveSection,
  onActiveSectionChange,
  rentFlowMode: controlledRentFlowMode,
  onRentFlowModeChange,
  payableItems = [],
  receivableItems = [],
  payableSummary,
  receivableSummary,
  onPayNow,
  onDownloadReceipt
}: PropertyFullScreenViewProps) {
  const { t, language } = useLanguage();

  const isMyRents = Boolean(
    activeSubTab === 'My Rents' ||
    (activeSubTab !== 'Property Owned' && (isTenantView || isMyRentsView))
  );

  const resolveInitialSection = (tab?: string): PropertySectionKey => {
    if (!tab) return 'overview';
    if (tab === 'tenant' || tab === 'tenancy') return 'overview';
    if (tab === 'vacate') return 'vacate';
    if (tab === 'requests' || tab === 'timeline') return 'requests';
    if ((isBuyerView || isMyRents) && ['edit', 'listing'].includes(tab)) {
      return 'overview';
    }
    if (['overview', 'edit', 'listing', 'requests', 'payments', 'agreements', 'maintenance', 'vacate'].includes(tab)) {
      return tab as PropertySectionKey;
    }
    return 'overview';
  };

  const [internalActiveSection, setInternalActiveSection] = useState<PropertySectionKey>(resolveInitialSection(initialTab));
  const activeSection = controlledActiveSection !== undefined ? controlledActiveSection : internalActiveSection;

  const setActiveSection = (sec: PropertySectionKey) => {
    setInternalActiveSection(sec);
    if (onActiveSectionChange) {
      onActiveSectionChange(sec);
    }
  };

  const [internalRentFlowMode, setInternalRentFlowMode] = useState<'in' | 'out'>('out');
  const rentFlowMode = controlledRentFlowMode !== undefined ? controlledRentFlowMode : internalRentFlowMode;

  const setRentFlowMode = (mode: 'in' | 'out') => {
    setInternalRentFlowMode(mode);
    if (onRentFlowModeChange) {
      onRentFlowModeChange(mode);
    }
  };
  const { data: userProfile } = useGetCallerUserProfile();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [titleTa, setTitleTa] = useState<string | null>(null);
  const [locationTa, setLocationTa] = useState<string | null>(null);
  const [isOverviewDownloaded, setIsOverviewDownloaded] = useState(false);

  // Payments & Tenancy & Maintenance & Agreements
  const [paymentDetails, setPaymentDetails] = useState<PaymentSummary[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string } | null>(null);
  const [ownerAgreementNotes, setOwnerAgreementNotes] = useState<Record<string, string>>({});
  const [isVerifyingAgreementId, setIsVerifyingAgreementId] = useState<string | null>(null);
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

  // Strict property-isolated agreements: only agreements matching current propertyId
  const validPropertyAgreements = useMemo(() => {
    const curPropId = String(propertyId || getId(property) || '');
    if (!curPropId) return [];
    const base = agreements.length > 0 ? agreements : (isTenantView && tenantAgreement ? [tenantAgreement] : []);
    return base.filter((a: any) => {
      if (!a) return false;
      const aPropId = String(a.propertyId || a.canonicalPropertyId || a.rentalId || getId(a.property) || '');
      return Boolean(aPropId && aPropId === curPropId);
    });
  }, [agreements, isTenantView, tenantAgreement, propertyId, property]);

  // Filter payableItems strictly to the selected property when in "My Rents"
  const isItemForSelectedProperty = useMemo(() => {
    return (item: any): boolean => {
      if (!property) return true;
      const targetIds = [
        propertyId,
        getId((property as any)?.propertyId),
        getId((property as any)?._id),
        getId((property as any)?.id),
        getId((property as any)?.rentalId),
      ].filter(Boolean);

      const targetTitle = String(property?.title || title || '').trim().toLowerCase();

      const raw = item?.raw || {};
      const rawProp = typeof raw.property === 'object' && raw.property !== null ? raw.property : {};

      const itemCandidateIds = [
        getId(item?.id),
        getId(item?._id),
        getId(item?.propertyId),
        getId(raw?._id),
        getId(raw?.id),
        getId(raw?.propertyId),
        getId(raw?.rentalId),
        getId(raw?.property),
        getId(rawProp?._id),
        getId(rawProp?.id),
      ].filter(Boolean);

      if (targetIds.some(tId => itemCandidateIds.includes(tId))) {
        return true;
      }

      const itemCandidateTitles = [
        String(item?.propertyTitle || '').trim().toLowerCase(),
        String(item?.title || '').trim().toLowerCase(),
        String(raw?.propertyTitle || '').trim().toLowerCase(),
        String(raw?.title || '').trim().toLowerCase(),
        String(rawProp?.title || '').trim().toLowerCase(),
      ].filter(Boolean);

      if (targetTitle && itemCandidateTitles.some(t => t === targetTitle || t.includes(targetTitle) || targetTitle.includes(t))) {
        return true;
      }

      return false;
    };
  }, [property, propertyId, title]);

  const displayedPayableItems = useMemo(() => {
    if (!isMyRents) return payableItems;
    const filtered = (payableItems || []).filter(isItemForSelectedProperty);
    return filtered.length > 0 ? filtered : (payableItems || []);
  }, [isMyRents, payableItems, isItemForSelectedProperty]);

  const scopedPayableSummary = useMemo(() => {
    if (!isMyRents) return payableSummary;

    const totalPaid = displayedPayableItems.reduce((acc, it) => acc + (Number(it.amountPaid) || 0), 0);
    const pendingItems = displayedPayableItems.filter(it => it.status !== 'paid' && Number(it.balance) > 0);
    const totalPending = pendingItems.reduce((acc, it) => acc + (Number(it.balance) || 0), 0);
    const nextDue = pendingItems[0] || displayedPayableItems[0] || null;

    let nextDueDateFormatted = t('No upcoming dues', 'நிலுவை இல்லை');
    if (nextDue && nextDue.dueDate) {
      try {
        const d = new Date(nextDue.dueDate);
        nextDueDateFormatted = isNaN(d.getTime()) ? String(nextDue.dueDate) : d.toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        nextDueDateFormatted = String(nextDue.dueDate);
      }
    }

    return {
      totalPaid,
      totalPending,
      pendingCount: pendingItems.length,
      nextDueAmount: nextDue ? (nextDue.balance || nextDue.monthlyRent || (property as any)?.price || 0) : 0,
      nextDueDate: nextDueDateFormatted,
      statusBadge: pendingItems.length === 0
        ? { text: t('All Dues Cleared', 'அனைத்தும் செலுத்தப்பட்டது'), variant: 'paid' }
        : pendingItems.some(it => it.status === 'overdue')
        ? { text: t('Overdue Payment', 'காலாவதியான கட்டணம்'), variant: 'overdue' }
        : { text: `${pendingItems.length} ${t('Payment Pending', 'கட்டணம் நிலுவையில்')}`, variant: 'pending' },
    };
  }, [isMyRents, payableSummary, displayedPayableItems, property, t, language]);

  const activeRentFlowMode = isMyRents ? 'out' : rentFlowMode;
  const activePayableSummary = isMyRents ? scopedPayableSummary : payableSummary;

  const getPropertyTypeLabel = (type?: string) => {
    if (!type) return t('Land', 'நிலம்');
    switch (type.toLowerCase()) {
      case 'flat':
      case 'apartment':
        return t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்');
      case 'house':
        return t('House', 'வீடு');
      case 'villa':
        return t('Villa', 'வில்லா');
      case 'pg':
        return 'PG';
      case 'land':
      case 'plot':
        return t('Land / Plot', 'நிலம் / மனை');
      case 'commercial':
      case 'office':
      case 'shop':
        return t('Commercial', 'வணிக இடம்');
      case 'farmhouse':
        return t('Farm House', 'பண்ணை வீடு');
      default:
        return type;
    }
  };

  // Self-Managed Rental Detection & Reactive State
  const isSelfManaged = !!(property as any)?.isSelfManaged || (property as any)?.rentalMode === 'self_managed';
  const selfManagedPropData = (property as any)?._selfManaged || null;
  const { data: allSelfManagedList = [] } = useGetSelfManagedRentals();

  const currentSelfManaged = useMemo(() => {
    if (!isSelfManaged) return null;
    return allSelfManagedList.find((r: any) => getId(r) === propertyId) || selfManagedPropData;
  }, [isSelfManaged, allSelfManagedList, propertyId, selfManagedPropData]);

  const isRentalUnderMyRents = isTenantView || !!tenantAgreement || (property as any)?.rentalMode === 'self_managed' || (Boolean((property as any)?.isSelfManaged) && (property as any)?.category === 'rents');

  const ownerDisplayName = useMemo(() => {
    // Under "My Rents", the user is the tenant, not the owner
    if (isRentalUnderMyRents) {
      const rawLandlord =
        (property as any)?.ownerName ||
        (property?.owner as any)?.name ||
        (property as any)?.landlordName ||
        (property as any)?.landlord?.name ||
        tenantAgreement?.owner?.name ||
        tenantAgreement?.ownerId?.name ||
        currentSelfManaged?.landlord?.name ||
        (currentSelfManaged as any)?.landlordName;

      if (rawLandlord && typeof rawLandlord === 'string' && rawLandlord.trim() && rawLandlord.trim().toLowerCase() !== userProfile?.name?.toLowerCase()) {
        return rawLandlord.trim();
      }
      return (typeof rawLandlord === 'string' && rawLandlord.trim()) || t('Owner', 'உரிமையாளர்');
    }

    // When the property is under "Property Owned"
    const rawOwner =
      (property as any)?.ownerName ||
      (property?.owner as any)?.name ||
      userProfile?.name;
    if (rawOwner && typeof rawOwner === 'string' && rawOwner.trim()) {
      return rawOwner.trim();
    }
    return userProfile?.name || t('Owner', 'உரிமையாளர்');
  }, [property, tenantAgreement, currentSelfManaged, isRentalUnderMyRents, userProfile, t]);

  const tenantDisplayName = useMemo(() => {
    // Under "My Rents", user is the tenant
    if (isRentalUnderMyRents) {
      const rawTenant =
        (property as any)?.tenantName ||
        (property?.tenant as any)?.name ||
        tenantAgreement?.tenant?.name ||
        tenantAgreement?.tenantId?.name ||
        userProfile?.name;
      if (rawTenant && typeof rawTenant === 'string' && rawTenant.trim()) {
        return rawTenant.trim();
      }
      return userProfile?.name || t('Tenant', 'வாடகைதாரர்');
    }

    // Under "Property Owned", tenant is any assigned customer/tenant
    const assigned =
      (property as any)?.tenantName ||
      (property?.tenant as any)?.name ||
      (property as any)?.customerName ||
      (property as any)?.assignedTenant;
    if (assigned && typeof assigned === 'string' && assigned.trim()) {
      return assigned.trim();
    }
    return '';
  }, [property, tenantAgreement, isRentalUnderMyRents, userProfile, t]);

  // Owner detection: check if current user is the owner viewing their own property
  const isOwnerDashboard = !isTenantView && !isBuyerView;
  const currentUserId = getId((userProfile as any)?._id || userProfile?.id);
  const propertyOwnerId = getId((property as any)?.ownerId || (property as any)?.owner);
  const isOwnerUser = Boolean(
    isOwnerDashboard ||
    (currentUserId && propertyOwnerId && currentUserId === propertyOwnerId) ||
    (userProfile?.name && (property as any)?.ownerName && userProfile.name.toLowerCase() === (property as any).ownerName.toLowerCase() && !isTenantView)
  );
  // Show Owner badge ONLY when a tenant is browsing or viewing their rented property; hide when owner views their own property
  const shouldShowOwnerPill = isTenantView || isBuyerView || (!isOwnerDashboard && !isOwnerUser);

  // Tenant badge visibility:
  // - Hidden in tenancy dashboard ("My Rents" / tenant view)
  // - Shown ONLY in Owner Dashboard ("Property Owned") when viewing a rental property
  const isRentalTransaction =
    property?.transactionType?.toLowerCase() === 'rent' ||
    (property as any)?.transaction?.toLowerCase() === 'rent';
  const shouldShowTenantPill = isOwnerDashboard && isRentalTransaction;

  const tenancyStatus = useMemo(() => {
    const isOcc =
      isTenantView ||
      isSelfManaged ||
      property?.occupancyStatus === 'occupied' ||
      !!property?.tenant ||
      !!(property as any)?.currentTenantId;

    if (isOcc) {
      return t('Occupied', 'குடியேற்றப்பட்டது');
    }
    if (property?.occupancyStatus === 'maintenance') {
      return t('Under Maintenance', 'பராமரிப்பில்');
    }
    return t('Vacant / Available', 'காலியாக / கிடைக்கிறது');
  }, [isTenantView, isSelfManaged, property, t]);

  // Self-Managed Dialog States & Mutations
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isLogMaintenanceOpen, setIsLogMaintenanceOpen] = useState(false);
  const [isConnectLandlordOpen, setIsConnectLandlordOpen] = useState(false);
  const deletePaymentMutation = useDeleteRecordedPayment();
  const attachDocMutation = useAttachRentalDocument();
  const deleteDocMutation = useDeleteRentalDocument();
  const updateMaintenanceMutation = useUpdateMaintenanceEntry();
  const deleteMaintenanceMutation = useDeleteMaintenanceEntry();
  const updateVacateMutation = useUpdateVacatePlan();
  const deleteSelfManagedMutation = useDeleteSelfManagedRental();

  // Self-Managed Document Upload State
  const selfManagedDocInputRef = useRef<HTMLInputElement>(null);
  const [selfManagedDocCategory, setSelfManagedDocCategory] = useState<'agreement' | 'move_in_report' | 'receipt' | 'other'>('agreement');
  const [isUploadingSelfManagedDoc, setIsUploadingSelfManagedDoc] = useState(false);

  // Self-Managed Move-Out Planning State
  const [plannedMoveOutDate, setPlannedMoveOutDate] = useState(() => currentSelfManaged?.vacate?.plannedDate ? new Date(currentSelfManaged.vacate.plannedDate).toISOString().split('T')[0] : '');
  const [noticeGivenDate, setNoticeGivenDate] = useState(() => currentSelfManaged?.vacate?.noticeDate ? new Date(currentSelfManaged.vacate.noticeDate).toISOString().split('T')[0] : '');
  const [moveOutNotes, setMoveOutNotes] = useState(() => currentSelfManaged?.vacate?.notes || '');
  const [moveOutChecklist, setMoveOutChecklist] = useState<Array<{ item: string; done: boolean }>>(() => {
    if (Array.isArray(currentSelfManaged?.vacate?.checklist) && currentSelfManaged.vacate.checklist.length > 0) {
      return currentSelfManaged.vacate.checklist;
    }
    return [
      { item: 'Inform landlord of departure timeline', done: false },
      { item: 'Deep clean all rooms and appliances', done: false },
      { item: 'Settle final utility and electricity bills', done: false },
      { item: 'Inspect property and return all keys', done: false },
      { item: 'Settle and receive security deposit refund', done: false }
    ];
  });

  useEffect(() => {
    if (currentSelfManaged?.vacate) {
      if (currentSelfManaged.vacate.plannedDate) {
        setPlannedMoveOutDate(new Date(currentSelfManaged.vacate.plannedDate).toISOString().split('T')[0]);
      }
      if (currentSelfManaged.vacate.noticeDate) {
        setNoticeGivenDate(new Date(currentSelfManaged.vacate.noticeDate).toISOString().split('T')[0]);
      }
      if (currentSelfManaged.vacate.notes) {
        setMoveOutNotes(currentSelfManaged.vacate.notes);
      }
      if (Array.isArray(currentSelfManaged.vacate.checklist) && currentSelfManaged.vacate.checklist.length > 0) {
        setMoveOutChecklist(currentSelfManaged.vacate.checklist);
      }
    }
  }, [currentSelfManaged]);

  const getNextRentDueDate = (dueDay: number = 1) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const safeDueDay = Math.min(Math.max(1, dueDay), 28);
    let target = new Date(currentYear, currentMonth, safeDueDay);
    if (now > target) {
      target = new Date(currentYear, currentMonth + 1, safeDueDay);
    }
    return target.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

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
    const mapped = list.map((item: any) => {
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
        if (item?.isSelfManaged || item?.rentalMode === 'self_managed') {
          statusText = t('Self-Managed', 'சுய-நிர்வகிக்கப்பட்டது');
          statusVariant = 'self_managed';
        } else {
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

    return mapped;
  }, [properties, property, isTenantView, isBuyerView, allOwnerRequests, t]);

  // Filter & Sort state for "Your Properties" sidebar
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Occupied' | 'Rented' | 'Listed: Sale' | 'Listed: Rent'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'House' | 'Apartment / Flat' | 'Land'>('All');
  const [sortBy, setSortBy] = useState<'default' | 'title_asc' | 'price_desc'>('default');

  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close filter popover on outside click or Escape key
  useEffect(() => {
    if (!isFilterOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen]);

  const isFilterActive = statusFilter !== 'All' || typeFilter !== 'All' || sortBy !== 'default';

  // Compute filtered & sorted properties for "Your Properties" sidebar
  const filteredProperties = useMemo(() => {
    let result = [...selectorItems];

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter((item) => {
        const raw = item.raw || {};
        const prop = raw.property || raw;
        const stText = String(item.statusText || '').toLowerCase();
        const txType = String(prop.transactionType || raw.transactionType || '').toLowerCase();
        const isLst = prop.listingStatus === 'listed' || raw.listingStatus === 'listed' || prop.isListed || raw.isListed;
        const isOcc = prop.occupancyStatus === 'occupied' || raw.occupancyStatus === 'occupied' || !!prop.tenant || !!raw.tenant;

        if (statusFilter === 'Occupied') {
          return item.statusVariant === 'occupied' || isOcc || stText.includes('occupied') || stText.includes('குடியேற்றப்பட்டது');
        }
        if (statusFilter === 'Rented') {
          return (
            item.statusVariant === 'active' ||
            item.statusVariant === 'self_managed' ||
            stText.includes('rented') ||
            stText.includes('active lease') ||
            stText.includes('குத்தகை') ||
            raw.rentalMode === 'self_managed' ||
            raw.isSelfManaged
          );
        }
        if (statusFilter === 'Listed: Sale') {
          return stText.includes('sale') || (isLst && txType === 'sale');
        }
        if (statusFilter === 'Listed: Rent') {
          return stText.includes('rent') || (isLst && txType === 'rent');
        }
        return true;
      });
    }

    // Property Type filter
    if (typeFilter !== 'All') {
      result = result.filter((item) => {
        const raw = item.raw || {};
        const prop = raw.property || raw;
        const pType = String(prop.propertyType || raw.propertyType || prop.type || raw.type || '').toLowerCase();

        if (typeFilter === 'House') {
          return pType.includes('house') || pType.includes('villa') || pType.includes('home') || pType.includes('individual') || pType.includes('வீடு');
        }
        if (typeFilter === 'Apartment / Flat') {
          return pType.includes('apartment') || pType.includes('flat') || pType.includes('condo') || pType.includes('அபார்ட்மெண்ட்');
        }
        if (typeFilter === 'Land') {
          return pType.includes('land') || pType.includes('plot') || pType.includes('நிலம்');
        }
        return true;
      });
    }

    // Sort
    if (sortBy === 'title_asc') {
      result.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }

    return result;
  }, [selectorItems, statusFilter, typeFilter, sortBy]);

  const currentActiveId = getId(property) || selectedPropertyId || (filteredProperties.length > 0 ? filteredProperties[0].id : (selectorItems.length > 0 ? selectorItems[0].id : null));

  // If currently active property is filtered out, auto-select first in filtered list
  useEffect(() => {
    if (filteredProperties.length > 0) {
      const isCurrentInFiltered = filteredProperties.some((p) => p.id === currentActiveId);
      if (!isCurrentInFiltered && onSelectProperty) {
        onSelectProperty(filteredProperties[0].raw);
      }
    }
  }, [filteredProperties, currentActiveId, onSelectProperty]);

  const carouselImages = useMemo(() => {
    if (Array.isArray(property?.images) && property.images.length > 0) {
      return property.images.filter(Boolean);
    }
    return [];
  }, [property?.images]);

  const parsedAmenitiesList = useMemo(() => {
    const raw = property?.amenities || (property as any)?.property?.amenities;
    let list: string[] = [];
    if (Array.isArray(raw)) {
      list = raw.filter((a: any) => typeof a === 'string' && a.trim().length > 0);
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      list = raw.split(/[,\s]+/).filter(Boolean);
    }
    return list;
  }, [property?.amenities]);

  const getAmenityIcon = (name: string) => {
    const s = name.toLowerCase();
    if (s.includes('park') || s.includes('car') || s.includes('garage')) return Car;
    if (s.includes('wifi') || s.includes('wi-fi') || s.includes('internet')) return Wifi;
    if (s.includes('water')) return Droplets;
    if (s.includes('security') || s.includes('guard')) return ShieldCheck;
    return Sparkles;
  };

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
      } catch { }
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

  // Ensure activeSection resets to overview if buyer view or My Rents is active and section is owner-only
  useEffect(() => {
    if ((isBuyerView || isMyRents) && ['edit', 'listing'].includes(activeSection)) {
      setActiveSection('overview');
    }
  }, [isBuyerView, isMyRents, activeSection]);

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
      let filtered = agrs.filter((a: any) => {
        const pId = getId(a?.property) || a?.propertyId || a?.canonicalPropertyId || a?.rentalId;
        return pId === propertyId;
      });
      if (filtered.length === 0 && propertyId) {
        try {
          const directRes = await api.get(`/agreements/property/${propertyId}`);
          if (Array.isArray(directRes.data) && directRes.data.length > 0) {
            filtered = directRes.data;
          }
        } catch (e) {}
      }
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
    const activeAgrId = getId(validPropertyAgreements[0]) || propertyId || getId(property);
    if (!activeAgrId) {
      toast.error(t('No active agreement found to attach document to', 'செயலில் உள்ள ஒப்பந்தம் கிடைக்கவில்லை'));
      return;
    }
    try {
      setUploadingDoc(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const payload = {
            name: file.name,
            fileName: file.name,
            data: reader.result as string,
            fileDataUrl: reader.result as string,
            propertyId,
            rentalId: getId(property) || propertyId,
            propertyTitle: displayTitle,
          };
          await api.post(`/agreements/${activeAgrId}/documents`, payload);
          socket.emit('agreement:upload', payload);

          toast.success(t('Document uploaded successfully', 'ஆவணம் வெற்றிகரமாக பதிவேற்றப்பட்டது'));
          fetchTenantAgreements();
          fetchAgreements();
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
      if (!propertyId) {
        setAgreements([]);
        return;
      }

      const res = await api.get(`/agreements/property/${propertyId}`, {
        headers: token ? { 'x-auth-token': token } : undefined
      });
      const list = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      const curPropId = String(propertyId);
      const strictlyMatching = list.filter((a: any) => {
        const aPropId = String(a.propertyId || a.canonicalPropertyId || getId(a.property) || '');
        return aPropId && aPropId === curPropId;
      });
      setAgreements(strictlyMatching);
    } catch (err) {
      console.error('Error fetching owner agreements:', err);
      setAgreements([]);
    } finally {
      setLoadingAgreements(false);
    }
  };

  useEffect(() => {
    const handleSync = (data: any) => {
      if (!data) return;
      const syncPropId = String(data.propertyId || data.canonicalPropertyId || getId(data.property) || data.rentalId || '');
      const curPropId = String(propertyId || getId(property) || '');
      // Strict guard: NEVER update or render if the event is for a different property!
      if (!syncPropId || !curPropId || syncPropId !== curPropId) {
        return;
      }

      if (isTenantView) {
        fetchTenantAgreements();
      } else {
        fetchAgreements();
      }
    };

    socket.on('agreement:synced', handleSync);
    socket.on('agreement:upload', handleSync);
    socket.on('agreement:verify', handleSync);

    return () => {
      socket.off('agreement:synced', handleSync);
      socket.off('agreement:upload', handleSync);
      socket.off('agreement:verify', handleSync);
    };
  }, [propertyId, isTenantView, property]);

  const handleOwnerVerify = async (agr: any, status: 'APPROVED' | 'REJECTED') => {
    const agrId = agr._id || agr.id;
    const note = ownerAgreementNotes[agrId] || '';
    if (status === 'REJECTED' && !note.trim()) {
      toast.error(t('Please enter a note/reason for rejection', 'நிராகரிப்பதற்கான காரணத்தை உள்ளிடவும்'));
      return;
    }
    try {
      setIsVerifyingAgreementId(agrId);
      const reviewedAt = new Date().toLocaleString();
      const curPropId = String(propertyId || getId(property) || agr.propertyId || '');
      const payload = {
        agreementId: agrId,
        propertyId: curPropId,
        rentalId: agr.rentalId || curPropId,
        status,
        ownerNote: note,
        ownerMessage: note,
        reviewedAt,
      };

      await api.put(`/agreements/${agrId}/verify`, payload);
      socket.emit('agreement:verify', payload);

      setAgreements((prev) =>
        prev.map((a: any) =>
          (a._id === agrId || a.id === agrId)
            ? { ...a, status, verificationStatus: status, ownerMessage: note, ownerNote: note, reviewedAt, propertyId: curPropId }
            : a
        )
      );

      toast.success(
        status === 'APPROVED'
          ? t('Agreement verified and approved successfully', 'ஒப்பந்தம் சரிபார்க்கப்பட்டு அங்கீகரிக்கப்பட்டது')
          : t('Agreement rejected with message', 'ஒப்பந்தம் நிராகரிக்கப்பட்டது')
      );
    } catch (err: any) {
      console.error('Failed to verify agreement:', err);
      toast.error(err?.response?.data?.msg || t('Failed to update agreement status', 'நிலை புதுப்பித்தல் தோல்வி'));
    } finally {
      setIsVerifyingAgreementId(null);
    }
  };

  const handlePreviewOrDownload = (fileName: string, fileDataUrl: string) => {
    if (!fileDataUrl) {
      toast.error(t('No document content available', 'ஆவண உள்ளடக்கம் இல்லை'));
      return;
    }
    setPreviewDoc({ name: fileName, url: fileDataUrl });
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

  // Delete property or self-managed rental
  const handleDeleteProperty = async () => {
    if (!propertyId) return;

    if (isSelfManaged) {
      try {
        await deleteSelfManagedMutation.mutateAsync(propertyId);
        toast.success(t('Self-managed rental record deleted', 'சுய-நிர்வகிக்கப்பட்ட வாடகை பதிவு நீக்கப்பட்டது'));
        setShowDeleteConfirm(false);
        onBack?.();
      } catch (err: any) {
        const msg = err?.response?.data?.msg || t('Failed to delete rental record', 'பதிவை நீக்க முடியவில்லை');
        toast.error(msg);
        setShowDeleteConfirm(false);
      }
      return;
    }

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

  // Download Property Overview Handler (Printable PDF Brochure & HTML sheet)
  const handleDownloadOverview = () => {
    if (!property) return;

    const prop = property as any;
    const title = displayTitle || prop?.title || 'Property Overview';
    const location = displayLocation || prop?.location || prop?.address || 'Location Not Specified';
    const isRent = prop?.transactionType?.toLowerCase() === 'rent' || prop?.transaction?.toLowerCase() === 'rent' || isRentalTransaction;
    const priceFormatted = `₹${Number(prop?.price || 0).toLocaleString('en-IN')}${isRent ? '/month' : ''}`;
    const modeFormatted = isRent ? 'Rent' : 'Sale';
    const occupancyFormatted = isOccupied ? 'Occupied' : 'Vacant';
    const listingStatusFormatted = isCurrentlyListed ? 'Public (Listed)' : 'Private';
    const propType = getPropertyTypeLabel(prop?.propertyType) || prop?.propertyType || '-';
    const areaFormatted = prop?.totalArea ? `${Number(prop.totalArea).toLocaleString('en-IN')} sq.ft` : (prop?.area ? `${prop.area} sq.ft` : '-');
    const centFormatted = prop?.cent || prop?.landArea || (prop?.totalArea ? (Number(prop.totalArea) / 435.6).toFixed(2) : '');
    const bhkFormatted = prop?.bedrooms || prop?.bhk || '';
    const facingFormatted = prop?.facing || '-';
    const ownershipFormatted = prop?.ownershipType || '-';
    const depositFormatted = prop?.securityDeposit ? `₹${Number(prop.securityDeposit).toLocaleString('en-IN')}` : (depositValue || '-');
    const maintenanceFormatted = prop?.maintenanceDetails || (prop?.monthlyMaintenance ? `₹${Number(prop.monthlyMaintenance).toLocaleString('en-IN')}/mo` : '') || maintenanceValue || '-';
    const reraFormatted = prop?.reraNo || prop?.reraNumber || prop?.pattaNo || prop?.pattaNumber || '';
    const coverImage = (carouselImages && carouselImages[0]) || (prop?.images && prop.images[0]) || '';
    const desc = prop?.description || prop?.property?.description || 'No description provided.';
    const safeFilename = (title || 'Property_Overview').replace(/[^a-zA-Z0-9_-]/g, '_');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Property Overview | reSide AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .sheet-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .no-print-bar {
      background: #1e40af;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .no-print-bar button {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-print { background: #ffffff; color: #1e40af; }
    .btn-print:hover { background: #f1f5f9; }
    .btn-close { background: rgba(255,255,255,0.2); color: #ffffff; margin-left: 8px; }
    .btn-close:hover { background: rgba(255,255,255,0.3); }
    .header-banner {
      padding: 24px 28px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
    }
    .brand-tag {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 700;
      color: #93c5fd;
      margin-bottom: 6px;
    }
    .prop-title {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 6px;
      line-height: 1.2;
    }
    .prop-location {
      font-size: 13px;
      color: #e0e7ff;
      margin-bottom: 16px;
    }
    .badges-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-price { background: #dcfce7; color: #15803d; }
    .badge-mode { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
    .badge-status { background: #3b82f6; color: #ffffff; }
    .badge-occupancy { background: #7c3aed; color: #ffffff; }
    .content-body { padding: 24px 28px; }
    .cover-image-box {
      width: 100%;
      height: 320px;
      border-radius: 12px;
      overflow: hidden;
      background: #f1f5f9;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }
    .cover-image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    .spec-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .spec-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .spec-value {
      font-size: 12px;
      color: #0f172a;
      font-weight: 700;
    }
    .amenities-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }
    .amenity-chip {
      padding: 6px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
    }
    .description-box {
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-line;
      margin-bottom: 24px;
    }
    .footer-stamp {
      border-top: 1px solid #e2e8f0;
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
      background: #fcfdfe;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .sheet-container { border: none; box-shadow: none; border-radius: 0; max-width: 100%; }
      .no-print-bar { display: none !important; }
      .cover-image-box { height: 260px; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="sheet-container">
    <div class="no-print-bar">
      <div>
        <strong>reSide AI</strong> &bull; Property Overview Sheet
      </div>
      <div>
        <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-close" onclick="window.close()">Close</button>
      </div>
    </div>
    
    <div class="header-banner">
      <div class="brand-tag">Verified Property Overview</div>
      <h1 class="prop-title">${title}</h1>
      <div class="prop-location">📍 ${location}</div>
      <div class="badges-row">
        <span class="badge badge-price">${priceFormatted}</span>
        <span class="badge badge-mode">${modeFormatted}</span>
        <span class="badge badge-occupancy">${occupancyFormatted}</span>
        <span class="badge badge-status">${listingStatusFormatted}</span>
      </div>
    </div>

    <div class="content-body">
      ${coverImage ? `
      <div class="cover-image-box">
        <img src="${coverImage}" alt="${title}" onerror="this.parentElement.style.display='none'" />
      </div>` : ''}

      <div class="section-title">Specifications & Details</div>
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Property Type</span>
          <span class="spec-value">${propType}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Total Area</span>
          <span class="spec-value">${areaFormatted}</span>
        </div>
        ${centFormatted ? `
        <div class="spec-item">
          <span class="spec-label">Land Area (Cent)</span>
          <span class="spec-value">${centFormatted} Cent</span>
        </div>` : ''}
        ${bhkFormatted ? `
        <div class="spec-item">
          <span class="spec-label">Bedrooms</span>
          <span class="spec-value">${bhkFormatted} BHK</span>
        </div>` : ''}
        <div class="spec-item">
          <span class="spec-label">Property Facing</span>
          <span class="spec-value">${facingFormatted}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Ownership Type</span>
          <span class="spec-value">${ownershipFormatted}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Security Deposit</span>
          <span class="spec-value">${depositFormatted}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Maintenance</span>
          <span class="spec-value">${maintenanceFormatted}</span>
        </div>
        ${reraFormatted ? `
        <div class="spec-item" style="grid-column: span 2;">
          <span class="spec-label">RERA / Patta No.</span>
          <span class="spec-value">${reraFormatted}</span>
        </div>` : ''}
      </div>

      <div class="section-title">Amenities & Features</div>
      <div class="amenities-wrap">
        ${(parsedAmenitiesList && parsedAmenitiesList.length > 0)
          ? parsedAmenitiesList.map((a: string) => `<span class="amenity-chip">✓ ${a}</span>`).join('')
          : '<span style="font-size:12px; color:#94a3b8; font-style:italic;">No amenities specified</span>'
        }
      </div>

      <div class="section-title">Full Description</div>
      <div class="description-box">
        ${desc}
      </div>
    </div>

    <div class="footer-stamp">
      <span>Generated by reSide AI Property Hub</span>
      <span>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;

    try {
      const printWindow = window.open('', '_blank', 'width=900,height=850');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${safeFilename}_Overview.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err) {
      console.error('Failed to open print preview, downloading blob fallback:', err);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${safeFilename}_Overview.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }

    setIsOverviewDownloaded(true);
    setTimeout(() => {
      setIsOverviewDownloaded(false);
    }, 2000);
  };

  // Responsive Navigation Item Config - omit owner-only sections in tenant/buyer/My Rents view
  const allNavItems: {
    key: PropertySectionKey;
    id: string;
    label: string;
    icon: any;
    badge?: number;
    ownerOnly?: boolean;
    hidden?: boolean;
  }[] = [
    { key: 'overview', id: 'overview', label: t('Overview', 'கண்ணோட்டம்'), icon: Home },
    { key: 'edit', id: 'edit-details', label: t('Edit Details', 'திருத்து'), icon: Edit, ownerOnly: true },
    { key: 'listing', id: 'listing', label: t('Listing', 'பட்டியல்'), icon: Globe, ownerOnly: true },
    {
      key: 'requests',
      id: 'requests',
      label: (isTenantView || isBuyerView) ? t('Transaction & Timeline', 'பரிவர்த்தனை & காலவரிசை') : t('Requests & Offers', 'கோரிக்கைகள்'),
      icon: Inbox,
      badge: (isTenantView || isBuyerView)
        ? (activeTenantRequest && ['counteroffer', 'accepted', 'approved', 'terms_confirmed'].includes(activeTenantRequest.status) ? 1 : 0)
        : propertyRequests.filter(r => r.status === 'pending' || r.status === 'payment_pending').length,
      ownerOnly: false,
      hidden: false
    },
    {
      key: 'payments',
      id: 'payments',
      label: isSelfManaged ? t('Rent & Payments', 'வாடகை & கட்டணங்கள்') : t('Rent & Payments', 'கட்டணங்கள்'),
      icon: CreditCard,
      badge: isTenantView
        ? (isSelfManaged ? (currentSelfManaged?.payments?.length || 0) : tenantRentRecords.filter((r: any) => r.status === 'pending' || r.status === 'overdue').length)
        : propertyPaymentRequests.length,
      hidden: isBuyerView
    },
    { key: 'agreements', id: 'agreements', label: isSelfManaged ? t('Documents', 'ஆவணங்கள்') : t('Agreements', 'ஒப்பந்தங்கள்'), icon: FileText, hidden: isBuyerView },
    {
      key: 'maintenance',
      id: 'maintenance',
      label: isSelfManaged ? t('Maintenance Log', 'பராமரிப்பு பதிவு') : t('Maintenance', 'பராமரிப்பு'),
      icon: Wrench,
      badge: isSelfManaged ? (currentSelfManaged?.maintenance?.filter((m: any) => m.status === 'pending').length || 0) : maintenanceRequests.filter(m => m.status === 'pending').length,
      hidden: isBuyerView
    },
    {
      key: 'vacate',
      id: 'vacate',
      label: isSelfManaged ? t('Move-Out Plan', 'வெளியேறும் திட்டம்') : t('Vacate', 'வெளியேறு'),
      icon: LogOut,
      badge: isTenantView
        ? (isSelfManaged ? 0 : tenantVacateRequests.filter((r: any) => r.status === 'pending').length)
        : vacateRequests.filter((r: any) => r.status === 'pending').length,
      hidden: isBuyerView
    },
  ];

  const navItems = useMemo(() => {
    const filtered = allNavItems.filter((item) => {
      if (item.hidden) return false;
      if (isBuyerView || isMyRents) {
        if (item.ownerOnly || item.key === 'edit' || item.key === 'listing' || item.id === 'edit-details' || item.id === 'listing') {
          return false;
        }
      }
      return true;
    });

    if (isMyRents) {
      const myRentsOrder: PropertySectionKey[] = [
        'overview',
        'agreements',
        'payments',
        'maintenance',
        'requests',
        'vacate',
      ];
      return [...filtered].sort((a, b) => {
        const indexA = myRentsOrder.indexOf(a.key);
        const indexB = myRentsOrder.indexOf(b.key);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      });
    }

    return filtered;
  }, [isBuyerView, isMyRents, allNavItems]);

  const depositValue = useMemo(() => {
    const raw =
      (property as any)?.securityDeposit ??
      (property as any)?.deposit ??
      (currentSelfManaged as any)?.securityDeposit ??
      tenantAgreement?.securityDeposit;
    if (raw !== undefined && raw !== null && Number(raw) > 0) {
      return `₹${Number(raw).toLocaleString('en-IN')}`;
    }
    if (property.price && Number(property.price) > 0) {
      return `₹${Number(Number(property.price) * (Number(property.price) <= 25000 ? 3 : 2)).toLocaleString('en-IN')}`;
    }
    return '-';
  }, [property, currentSelfManaged, tenantAgreement]);

  const maintenanceValue = useMemo(() => {
    const raw =
      (property as any)?.monthlyMaintenance ??
      (property as any)?.maintenance ??
      (currentSelfManaged as any)?.maintenance;
    if (raw !== undefined && raw !== null && Number(raw) > 0) {
      return `₹${Number(raw).toLocaleString('en-IN')}/mo`;
    }
    if (typeof raw === 'string' && raw.trim() && raw.toLowerCase() !== 'included') {
      return raw;
    }
    return t('Included', 'சேர்க்கப்பட்டுள்ளது');
  }, [property, currentSelfManaged, t]);

  return (
    <>
      <div className="w-full space-y-3.5">
        {/* Mobile Navigation Bar (Adaptive compact horizontal scrollable strip with badges) */}
        <div className="lg:hidden w-full overflow-x-auto no-scrollbar p-1.5 rounded-2xl glass-panel bg-white/80 dark:bg-[#0a1628]/85 dark:backdrop-blur-xl border border-slate-200/80 dark:border-sky-500/20 shadow-xs dark:shadow-xl dark:shadow-black/40 sticky top-[60px] z-30">
          <div className="flex items-center gap-1.5 min-w-max">
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-medium transition-all shrink-0 cursor-pointer ${isActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white'
                    }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {((!isTenantView && !isBuyerView) || isSelfManaged) && (
              <>
                <div className="h-5 w-px bg-slate-200 dark:bg-border/60 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all shrink-0 cursor-pointer text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{isSelfManaged ? t('Delete Rental', 'வாடகையை நீக்கு') : t('Delete', 'நீக்கு')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 6. Main Workspace Responsive Layout with Synchronized Heights */}
        <div className="w-full pt-3 grid grid-cols-1 lg:grid-cols-[240px_210px_1fr] gap-5 lg:h-[465px] lg:max-h-[465px] items-stretch">
          {/* A. LEFT COLUMN: "Your Properties" (240px Sidebar) */}
          <div className="w-full h-full flex flex-col justify-between relative bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-3 shadow-xs">
            {/* Floating Filter & Sort Popover */}
            {isFilterOpen && (
              <div
                ref={filterPopoverRef}
                className="absolute right-3 top-11 z-30 w-56 rounded-xl bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2.5"
              >
                {/* Header row */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t('Filter & Sort', 'வடிகட்டி & வரிசைப்படுத்து')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('All');
                      setTypeFilter('All');
                      setSortBy('default');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {t('Reset', 'மீட்டமை')}
                  </button>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    {t('Status', 'நிலை')}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(['All', 'Occupied', 'Rented', 'Listed: Sale', 'Listed: Rent'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-2 py-0.5 text-[10.5px] rounded-md font-medium transition cursor-pointer ${
                          statusFilter === st
                            ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Type Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    {t('Property Type', 'சொத்து வகை')}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(['All', 'House', 'Apartment / Flat', 'Land'] as const).map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => setTypeFilter(tp)}
                        className={`px-2 py-0.5 text-[10.5px] rounded-md font-medium transition cursor-pointer ${
                          typeFilter === tp
                            ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    {t('Sort By', 'வரிசைப்படுத்து')}
                  </label>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: 'default', label: t('Default', 'இயல்புநிலை') },
                      { id: 'title_asc', label: t('Title (A–Z)', 'தலைப்பு (A–Z)') },
                      { id: 'price_desc', label: t('Rent / Price (High–Low)', 'வாடகை / விலை (அதிகம்–குறைவு)') },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortBy(opt.id as any)}
                        className={`w-full text-left px-2 py-1 text-[11px] rounded-md font-medium transition cursor-pointer flex items-center justify-between ${
                          sortBy === opt.id
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-800/60'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {t('Your Properties', 'உங்கள் சொத்துகள்')} ({filteredProperties.length})
                </h3>
                <button
                  ref={filterButtonRef}
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition cursor-pointer relative ${
                    isFilterActive
                      ? 'border border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Filter & Sort"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {isFilterActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-1 ring-white dark:ring-[#070e1b]" />
                  )}
                </button>
              </div>

              {/* Vertical list of selectable property cards with internal scroll (Fixed 4 cards) */}
              <div className="max-h-[370px] overflow-y-auto pr-1 space-y-2.5 pt-2.5 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                {filteredProperties.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      {t('No properties match the selected filters', 'தேர்ந்தெடுத்த வடிப்பான்களுக்கு பொருந்தும் சொத்துக்கள் இல்லை')}
                    </p>
                    {isFilterActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('All');
                          setTypeFilter('All');
                          setSortBy('default');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition cursor-pointer"
                      >
                        {t('Reset Filters', 'வடிப்பான்களை மீட்டமை')}
                      </button>
                    )}
                  </div>
                ) : (
                  filteredProperties.map((item) => {
                    const isSelected = item.id === currentActiveId;
                    const thumbImg = item.images?.[0];
                    const city = item.location?.split(',')?.[0]?.trim() || item.location || '';

                    let statusLabel = item.statusText || 'Active';
                    let statusClass = 'bg-[#dcfce7] text-[#15803d]';
                    if (item.statusVariant === 'occupied' || statusLabel.toLowerCase().includes('occupied')) {
                      statusLabel = 'Occupied';
                      statusClass = 'bg-[#dcfce7] text-[#15803d]';
                    } else if (item.statusVariant === 'active' || statusLabel.toLowerCase().includes('rent') || statusLabel.toLowerCase().includes('lease')) {
                      statusLabel = 'Rented';
                      statusClass = 'bg-[#dcfce7] text-[#15803d]';
                    } else if (item.statusVariant === 'private' || statusLabel.toLowerCase().includes('vacant') || statusLabel.toLowerCase().includes('private')) {
                      statusLabel = 'Vacant';
                      statusClass = 'bg-[#ffedd5] text-[#c2410c]';
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (onSelectProperty) {
                            onSelectProperty(item.raw);
                          }
                        }}
                        className={`w-full text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-blue-500 bg-[#f0f7ff] dark:bg-blue-950/20 rounded-2xl p-2.5 flex items-center gap-2.5 shadow-2xs'
                            : 'border border-slate-200/80 hover:border-blue-200 bg-white dark:bg-slate-900/50 dark:border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2.5'
                        }`}
                      >
                        {thumbImg ? (
                          <img
                            src={thumbImg}
                            alt={item.title}
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 text-slate-400">
                            <Home className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </h4>
                          {city && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="truncate">{city}</span>
                            </div>
                          )}
                          <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusClass}`}>
                              {statusLabel}
                            </span>
                            {Boolean(item.raw?.isSelfManaged || (item.raw as any)?.property?.isSelfManaged || (item.raw as any)?.rentalMode === 'self_managed') && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-md truncate">
                                {t('Self-Managed', 'சுய-நிர்வகிக்கப்பட்டது')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* B. MIDDLE COLUMN: "MANAGEMENT SECTIONS" (210px Sidebar) */}
          <div className="w-full h-full flex flex-col justify-between overflow-hidden bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-3 shadow-xs">
            {/* Top sections */}
            <div className="space-y-1 overflow-y-auto pr-0.5">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('MANAGEMENT SECTIONS', 'நிர்வாகப் பிரிவுகள்')}
              </div>

              {navItems.filter((item) => item.key !== 'vacate').map((item) => {
                const isActive = activeSection === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    title={item.label}
                    className={`w-full text-left px-2.5 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge != null && item.badge > 0 && (
                      <span
                        className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ml-1 ${
                          isActive ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom sections: Vacate + Delete Property */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 shrink-0">
              {navItems.filter((item) => item.key === 'vacate').map((item) => {
                const isActive = activeSection === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {((!isTenantView && !isBuyerView) || isSelfManaged) && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-left px-3.5 py-2.5 bg-[#fef2f2] hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="truncate">{isSelfManaged ? t('Delete Rental', 'வாடகையை நீக்கு') : t('Delete Property', 'சொத்தை நீக்கு')}</span>
                </button>
              )}
            </div>
          </div>

          {/* C. RIGHT COLUMN: PROPERTY MEDIA & SPECIFICATIONS (1fr Workspace) */}
          <div className="w-full min-w-0 h-full max-h-full flex flex-col overflow-hidden">
            {activeSection === 'overview' ? (
              <>
                {/* Top Detail Header Strip */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                  {/* Left: Property thumbnail + Title + Location pin */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 overflow-hidden">
                      {carouselImages[0] ? (
                        <img src={carouselImages[0]} alt={displayTitle} className="w-full h-full object-cover" />
                      ) : (
                        <Home className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                        {displayTitle || t('Untitled Property', 'சொத்து')}
                      </h3>
                      {displayLocation && (
                        <a
                          href={property?.googleMapsLink || (property as any)?.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayLocation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 cursor-pointer group transition-colors"
                          title={t('Open in Google Maps', 'கூகிள் வரைபடத்தில் திற')}
                        >
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="truncate">{displayLocation}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: Price pill + Transaction tag + Status tags + Edit button */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-full text-xs tracking-tight">
                      ₹{Number(property?.price || 0).toLocaleString('en-IN')}{property?.transactionType?.toLowerCase() === 'rent' ? '/mo' : ''}
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full capitalize">
                      {property?.transactionType ? property.transactionType.toLowerCase() : ((property as any)?.transaction || 'Rent')}
                    </span>
                    {isTenantView ? (
                      <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('Rented', 'வாடகைக்கு எடுக்கப்பட்டது')}</span>
                      </span>
                    ) : (property?.status || property?.saleStatus) ? (
                      <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-2xs capitalize">
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {property?.saleStatus === 'sold'
                            ? t('Acquired', 'வாங்கப்பட்டது')
                            : property?.status === 'approved'
                            ? t('Approved', 'ஒப்புதல் அளிக்கப்பட்டது')
                            : (property?.saleStatus || property?.status)}
                        </span>
                      </span>
                    ) : null}
                    <span className="bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-2xs">
                      {isOccupied ? t('Occupied', 'குடியேற்றப்பட்டது') : t('Vacant', 'காலியாக')}
                    </span>
                    {Boolean(isSelfManaged || property?.isSelfManaged || (property as any)?.isSelfManaged) && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                        {t('Self-Managed', 'சுய-நிர்வகிக்கப்பட்டது')}
                      </span>
                    )}
                    {!isCurrentlyListed ? (
                      <span className="bg-[#ffedd5] text-[#c2410c] dark:bg-amber-950/30 text-xs font-semibold px-3 py-1.5 rounded-full">
                        {t('Private', 'தனிப்பட்டது')}
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                        {t('Public', 'பொதுவானது')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadOverview}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        isOverviewDownloaded
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'border-blue-200/80 dark:border-slate-700 bg-blue-50/80 hover:bg-blue-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-blue-600 dark:text-blue-400'
                      }`}
                      title={isOverviewDownloaded ? t('Downloaded', 'பதிவிறக்கப்பட்டது') : t('Download Property Overview', 'சொத்து விவரக்குறிப்பைப் பதிவிறக்கு')}
                    >
                      {isOverviewDownloaded ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('Downloaded', 'பதிவிறக்கப்பட்டது')}</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          <span>{t('Download', 'பதிவிறக்கு')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Nested Grid (Image & Specifications & Details): grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Left Image Container (md:col-span-7) */}
                  <div className="md:col-span-7 h-full w-full relative rounded-2xl overflow-hidden group bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs min-h-[360px]">
                    {carouselImages.length > 0 ? (
                      <>
                        <img
                          src={carouselImages[currentImageIndex % carouselImages.length]}
                          alt={displayTitle}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                          onClick={() => openLightbox(currentImageIndex)}
                        />
                        {/* Counter badge at top-right */}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md z-10">
                          {(currentImageIndex % carouselImages.length) + 1}/{carouselImages.length}
                        </div>

                        {/* Floating navigation buttons */}
                        {carouselImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentImageIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
                              }}
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center transition shadow-md cursor-pointer z-10"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center transition shadow-md cursor-pointer z-10"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 w-full h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-900/50 p-6 text-center">
                        <Images className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {t('No photos uploaded', 'புகைப்படங்கள் எதுவும் பதிவேற்றப்படவில்லை')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right "Specifications & Details" Card (md:col-span-5): h-full flex flex-col justify-between */}
                  <div className="md:col-span-5 h-full flex flex-col justify-between bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-4 shadow-xs">
                    {/* Top Group: Title + 2-Column Grid Specs */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {t('Specifications & Details', 'விவரங்கள் மற்றும் விவரக்குறிப்புகள்')}
                        </h4>
                      </div>

                      {/* 2-column grid specs */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Boolean(property?.isSelfManaged || (property as any)?.isSelfManaged) ? (
                          <>
                            {/* Property Type */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Home className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Property Type', 'சொத்து வகை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {getPropertyTypeLabel(property.propertyType) || '-'}
                              </span>
                            </div>

                            {/* Total Units / Rooms */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Total Units', 'மொத்த அலகுகள்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.totalUnits ? `${property.totalUnits} Units` : '1 Unit'}
                              </span>
                            </div>

                            {/* Deposit */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <IndianRupee className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Deposit', 'முன்பணம்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.securityDeposit ? `₹${Number(property.securityDeposit).toLocaleString('en-IN')}` : depositValue}
                              </span>
                            </div>

                            {/* Maintenance Details */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Wrench className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Maintenance', 'பராமரிப்பு')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.maintenanceDetails || (property.monthlyMaintenance ? `₹${property.monthlyMaintenance.toLocaleString('en-IN')}/mo` : 'Included')}
                              </span>
                            </div>

                            {/* Rent Due Date */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Rent Due Date', 'தவணை நாள்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.rentDueDate || (property.rentDueDay ? `${property.rentDueDay}th of month` : '5th of month')}
                              </span>
                            </div>

                            {/* Property Status */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Status', 'நிலை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {isOccupied ? t('Occupied', 'குடியேற்றப்பட்டது') : t('Vacant', 'காலியாக')}
                              </span>
                            </div>

                            {/* Lease Duration */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition col-span-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Lease Duration', 'குத்தகை காலம்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.leaseStartDate ? new Date(property.leaseStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Jan 2025'} - {property.leaseEndDate ? new Date(property.leaseEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '31 Dec 2025'}
                              </span>
                            </div>

                            {/* Contact Number */}
                            {Boolean(property.contactNumber || (property as any)?.phone) && (
                              <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition col-span-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Phone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    {t('Management Contact', 'தொடர்பு எண்')}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                  {property.contactNumber || (property as any)?.phone}
                                </span>
                              </div>
                            )}
                          </>
                        ) : isRentalTransaction || isTenantView || isSelfManaged ? (
                          <>
                            {/* Property Type */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Home className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Property Type', 'சொத்து வகை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {getPropertyTypeLabel(property.propertyType) || '-'}
                              </span>
                            </div>

                            {/* Deposit */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <IndianRupee className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Deposit', 'முன்பணம்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {depositValue}
                              </span>
                            </div>

                            {/* Maintenance */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Wrench className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Maintenance', 'பராமரிப்பு')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {maintenanceValue}
                              </span>
                            </div>

                            {/* Preferred */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Preferred', 'விருப்பம்')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {(property as any)?.preferredTenant || (property as any)?.preferred || '-'}
                              </span>
                            </div>

                            {/* Available */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Available', 'கிடைக்கும் நிலை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {(property as any)?.availableFrom || (property as any)?.availability || t('Immediate', 'உடனடியாக')}
                              </span>
                            </div>

                            {/* Owner (hidden when owner views their own property) */}
                            {shouldShowOwnerPill && (
                              <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    {t('Owner', 'உரிமையாளர்')}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                  {ownerDisplayName || '-'}
                                </span>
                              </div>
                            )}

                            {/* Tenant (shown only in owner dashboard when rented) */}
                            {shouldShowTenantPill && (
                              <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    {t('Tenant', 'வாடகைதாரர்')}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                  {tenantDisplayName || tenancyStatus || '-'}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Property Type */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Home className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Property Type', 'சொத்து வகை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {getPropertyTypeLabel(property.propertyType) || '-'}
                              </span>
                            </div>

                            {/* Total Area */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Maximize2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Total Area', 'மொத்த பரப்பளவு')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                                {property.totalArea ? `${Number(property.totalArea).toLocaleString()} sq.ft` : '-'}
                              </span>
                            </div>

                            {/* Facing */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Compass className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Facing', 'நோக்கு நிலை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0 capitalize">
                                {property.facing || '-'}
                              </span>
                            </div>

                            {/* Ownership Type */}
                            <div className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-1 shadow-2xs hover:border-blue-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {t('Ownership Type', 'உரிமை வகை')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-900 dark:text-white shrink-0 capitalize">
                                {(property as any)?.ownershipType || '-'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle Group: Amenities & Features */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('Amenities & Features', 'வசதிகள்')}
                      </h5>
                      {parsedAmenitiesList.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {parsedAmenitiesList.map((amenity, idx) => {
                            const IconComponent = getAmenityIcon(amenity);
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-sky-300 border border-blue-200/60 dark:border-blue-800/60 font-medium"
                              >
                                <IconComponent className="h-3 w-3 shrink-0 text-blue-600 dark:text-sky-400" />
                                <span>{amenity}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          {t('No amenities specified', 'வசதிகள் எதுவும் குறிப்பிடப்படவில்லை')}
                        </p>
                      )}
                    </div>

                    {/* Bottom Group: Description */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('Description', 'விளக்கம்')}
                      </h5>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                        {property.description ||
                          (property as any)?.property?.description ||
                          t('No description provided.', 'விளக்கம் எதுவும் வழங்கப்படவில்லை.')}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0 w-full h-full max-h-full flex flex-col overflow-hidden">
                {/* SECTION 2: EDIT DETAILS */}
                {activeSection === 'edit' && (
                  isTenantView ? (
                    <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                      <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Edit className="h-4 w-4 text-primary" />
                            {t('Property Specifications', 'சொத்து விவரங்கள்')}
                          </span>
                          <Badge variant="outline" className="text-xs font-normal">
                            {t('Tenant View (Read Only)', 'வாடகைதாரர் பார்வை')}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Property specifications and configurations are managed exclusively by the property owner.', 'சொத்து விவரங்கள் உரிமையாளரால் நிர்வகிக்கப்படுகின்றன.')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3.5 flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
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
                              <span className="text-sm font-semibold capitalize mt-1 block">{getPropertyTypeLabel(property.propertyType)}</span>
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
                      </CardContent>
                    </Card>
                  ) : (
                    <PropertyForm
                      inline={true}
                      open={true}
                      initialData={property}
                      onOpenChange={() => { }}
                      onSaved={() => {
                        setActiveSection('overview');
                      }}
                      onCancel={() => {
                        setActiveSection('overview');
                      }}
                    />
                  )
                )}

            {/* SECTION 3: LISTING */}
            {activeSection === 'listing' && (
              <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {t('Public Listing & Publishing Controls', 'பொது பட்டியல் மற்றும் வெளியீட்டு கட்டுப்பாடுகள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('Manage how your property appears in search results for prospective buyers and tenants.', 'சாத்தியமான வாங்குபவர்கள் மற்றும் குத்தகைதாரர்களுக்கான தேடல் முடிவுகளில் உங்கள் சொத்து எவ்வாறு தோன்றும் என்பதை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
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
                              <Badge className={`text-white text-xs px-2.5 py-0.5 font-medium flex items-center gap-1 ${property.transactionType?.toLowerCase() === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
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
              <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-primary" />
                      {(isTenantView || isBuyerView)
                        ? (isSelfManaged
                            ? t('Rental Lifecycle & Timeline', 'வாடகை காலவரிசை & விவரங்கள்')
                            : t('Transaction & Application Details', 'பரிவர்த்தனை & விண்ணப்ப விவரங்கள்'))
                        : t('Requests & Offers', 'கோரிக்கைகள் மற்றும் சலுகைகள்')}
                      {(!isTenantView && !isBuyerView) && (
                        <Badge variant="secondary" className="ml-1.5 text-xs font-semibold">
                          {propertyRequests.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {(isTenantView || isBuyerView)
                        ? (isSelfManaged
                            ? t('Track your complete self-managed rental history: agreement terms, payment logs, landlord connection, and move-out plan.', 'வாடகை விதிமுறைகள், கட்டண பதிவு, நிலப்பிரபு இணைப்பு மற்றும் நகர்வு நிலை ஆகியவற்றை கண்காணிக்கவும்.')
                            : t('Follow and complete every transaction step: terms, counteroffers, advance payment, and verified confirmation.', 'விதிமுறைகள், முன்பணம் மற்றும் கட்டண சரிபார்ப்பு உள்ளிட்ட அனைத்து நிலைகளையும் முடிக்கவும்.'))
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
                  ) : !isSelfManaged ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchTenantRequests()}
                      className="h-7 text-xs gap-1 self-start sm:self-auto"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {t('Refresh', 'புதுப்பி')}
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto pr-2">
                  {isSelfManaged ? (
                    /* RENDER SELF-MANAGED RENTAL LIFECYCLE & TIMELINE */
                    <div className="space-y-6">
                      {/* Top Property & Lease Terms Banner */}
                      <div className="border rounded-2xl p-4 sm:p-5 bg-card/70 border-border/70 shadow-2xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-xs font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" />
                              {t('Self-Managed Rental Record', 'சுய-நிர்வகிக்கப்பட்ட வாடகை பதிவு')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getPropertyTypeLabel(currentSelfManaged?.propertyType || property?.propertyType || 'Apartment')}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {t('Started on', 'தொடங்கிய தேதி')}: {currentSelfManaged?.leaseStartDate ? new Date(currentSelfManaged.leaseStartDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : (currentSelfManaged?.createdAt ? new Date(currentSelfManaged.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Active')}
                          </span>
                        </div>

                        {/* 5-Stage Visual Step Timeline for Self-Managed Rental */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                          {[
                            {
                              id: 1,
                              title: t('Rental Created', 'வாடகை உருவாக்கப்பட்டது'),
                              desc: t('Lease terms logged', 'விதிமுறைகள் பதிவாகியது'),
                              status: 'done'
                            },
                            {
                              id: 2,
                              title: t('Active Lease', 'செயலில் உள்ள வாடகை'),
                              desc: `${t('Due', 'கெடு')}: ${currentSelfManaged?.rentDueDay || 5}${t('th of month', 'ஆம் தேதி')}`,
                              status: 'done'
                            },
                            {
                              id: 3,
                              title: t('Payments Tracked', 'கட்டணங்கள் பதிவு'),
                              desc: `${currentSelfManaged?.payments?.length || 0} ${t('payments', 'கட்டணங்கள்')}`,
                              status: (currentSelfManaged?.payments?.length || 0) > 0 ? 'done' : 'current'
                            },
                            {
                              id: 4,
                              title: t('Landlord Link', 'நிலப்பிரபு இணைப்பு'),
                              desc: currentSelfManaged?.landlord?.isConnected ? t('Connected', 'இணைக்கப்பட்டது') : (currentSelfManaged?.landlord?.connectionStatus === 'pending' ? t('Invite Sent', 'அழைப்பு அனுப்பப்பட்டது') : t('Standalone', 'தனித்தியங்கும்')),
                              status: currentSelfManaged?.landlord?.isConnected ? 'done' : (currentSelfManaged?.landlord?.connectionStatus === 'pending' ? 'current' : 'neutral')
                            },
                            {
                              id: 5,
                              title: t('Move-Out Plan', 'வெளியேறும் திட்டம்'),
                              desc: currentSelfManaged?.vacate?.noticeGiven ? t('Notice Active', 'அறிவிப்பு வழங்கப்பட்டது') : t('Ongoing Lease', 'செயலில் உள்ளது'),
                              status: currentSelfManaged?.vacate?.noticeGiven ? 'warning' : 'neutral'
                            }
                          ].map((stage) => (
                            <div key={stage.id} className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-background/70 border border-border/50 text-xs">
                              <div className="flex items-center gap-1.5 w-full">
                                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                  stage.status === 'done'
                                    ? 'bg-emerald-600 text-white'
                                    : stage.status === 'current'
                                      ? 'bg-blue-600 text-white animate-pulse'
                                      : stage.status === 'warning'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                  {stage.status === 'done' ? '✓' : stage.id}
                                </span>
                                <span className="font-semibold text-foreground truncate text-[11px]">{stage.title}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-6 truncate">{stage.desc}</span>
                            </div>
                          ))}
                        </div>

                        {/* Lease Terms Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs p-3.5 rounded-xl bg-muted/20 border border-border/40">
                          <div>
                            <p className="text-muted-foreground text-[11px]">{t('Monthly Rent', 'மாத வாடகை')}</p>
                            <p className="font-bold text-foreground text-sm text-emerald-600 dark:text-emerald-400">
                              ₹{Number(currentSelfManaged?.monthlyRent || property?.price || 0).toLocaleString('en-IN')}
                              <span className="text-[10px] text-muted-foreground font-normal"> /mo</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[11px]">{t('Security Deposit', 'முன்பணம் / வைப்புத்தொகை')}</p>
                            <p className="font-bold text-foreground text-sm">
                              ₹{Number(currentSelfManaged?.securityDeposit || 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[11px]">{t('Rent Due Day', 'வாடகை கெடு நாள்')}</p>
                            <p className="font-semibold text-foreground text-sm">
                              {currentSelfManaged?.rentDueDay || 5}th {t('of each month', 'ஒவ்வொரு மாதமும்')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[11px]">{t('Landlord Status', 'நிலப்பிரபு நிலை')}</p>
                            <p className="font-semibold text-foreground text-sm truncate">
                              {currentSelfManaged?.landlord?.isConnected
                                ? (currentSelfManaged?.landlord?.name || t('Connected Landlord', 'இணைக்கப்பட்ட நிலப்பிரபு'))
                                : (currentSelfManaged?.landlord?.connectionStatus === 'pending'
                                    ? t('Invite Sent', 'அழைப்பு அனுப்பப்பட்டது')
                                    : t('Self-Managed Alone', 'சுய-நிர்வகிக்கப்பட்டது'))}
                            </p>
                          </div>
                        </div>

                        {/* Quick Actions Row */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs"
                              onClick={() => setIsRecordPaymentOpen(true)}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              {t('Record Payment', 'கட்டணத்தை பதிவு செய்')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => setIsLogMaintenanceOpen(true)}
                            >
                              <Wrench className="w-3.5 h-3.5 text-amber-500" />
                              {t('Log Maintenance', 'பராமரிப்பு பதிவு')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => setIsConnectLandlordOpen(true)}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                              {t('Landlord Connection', 'நிலப்பிரபு இணைப்பு')}
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => setActiveSection('vacate')}
                          >
                            <span>{t('Move-Out Planner', 'வெளியேறும் திட்டம்')}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Recent Recorded Payments Summary */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t('Recent Recorded Payments', 'சமீபத்திய பதிவு செய்யப்பட்ட கட்டணங்கள்')} ({currentSelfManaged?.payments?.length || 0})
                          </h4>
                          {(currentSelfManaged?.payments?.length || 0) > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] gap-1 text-primary"
                              onClick={() => setActiveSection('payments')}
                            >
                              {t('View All Payments', 'அனைத்து கட்டணங்களையும் பார்க்க')}
                              <ChevronRight className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {(!currentSelfManaged?.payments || currentSelfManaged.payments.length === 0) ? (
                          <div className="border border-dashed border-border/80 rounded-xl p-5 text-center space-y-2 bg-muted/10">
                            <CreditCard className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                            <p className="text-xs text-muted-foreground">
                              {t('No payments recorded for this rental yet.', 'இந்த வாடகைக்கு இதுவரை கட்டணங்கள் எதுவும் பதிவு செய்யப்படவில்லை.')}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 mt-1"
                              onClick={() => setIsRecordPaymentOpen(true)}
                            >
                              <Plus className="w-3 h-3" />
                              {t('Record First Rent Payment', 'முதல் வாடகையை பதிவு செய்')}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentSelfManaged.payments.slice(0, 3).map((p: any, idx: number) => (
                              <div
                                key={p._id || p.id || idx}
                                className="border rounded-xl p-3 bg-card/60 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
                                    ₹
                                  </div>
                                  <div>
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                      <span>₹{Number(p.amount || 0).toLocaleString('en-IN')}</span>
                                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
                                        {p.status || 'paid'}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recorded'}
                                      {p.paymentMethod ? ` • ${p.paymentMethod.toUpperCase()}` : ''}
                                      {p.referenceNumber || p.reference ? ` • Ref: ${p.referenceNumber || p.reference}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {p.notes ? `"${p.notes}"` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (isTenantView || isBuyerView) ? (
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
                                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${stage.status === 'done'
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
                    ) : (tenantAgreement || property?.tenant) ? (
                      <div className="space-y-4">
                        <div className="border rounded-2xl p-4 sm:p-5 bg-card/70 border-border/70 shadow-2xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                                {t('Active Tenancy Confirmed', 'செயலில் உள்ள குத்தகை சரிபார்க்கப்பட்டது')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {getPropertyTypeLabel(property?.propertyType || 'Apartment')}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {t('Active since', 'செயலில் உள்ள தேதி')}: {tenantAgreement?.startDate ? new Date(tenantAgreement.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : t('Active', 'செயலில்')}
                            </span>
                          </div>

                          {/* 5-Stage Step Timeline for Active Tenancy */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                            {[
                              { id: 1, title: t('Application', 'விண்ணப்பம்'), desc: t('Accepted & Confirmed', 'ஏற்கப்பட்டது'), status: 'done' },
                              { id: 2, title: t('Deposit / Advance', 'முன்பணம்'), desc: t('Payment Verified', 'சரிபார்க்கப்பட்டது'), status: 'done' },
                              { id: 3, title: t('Agreement', 'ஒப்பந்தம்'), desc: t('Signed & Stored', 'கையொப்பமிடப்பட்டது'), status: 'done' },
                              { id: 4, title: t('Move-In', 'குடியேற்றம்'), desc: t('Key Handover Done', 'சாவி ஒப்படைக்கப்பட்டது'), status: 'done' },
                              { id: 5, title: t('Lease Period', 'குத்தகை காலம்'), desc: t('Monthly Payments Active', 'வாடகை நிலுவை'), status: 'current' },
                            ].map((stage) => (
                              <div key={stage.id} className="flex flex-col items-start gap-1 p-2 rounded-xl bg-background/70 border border-border/50 text-xs">
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    stage.status === 'done'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-blue-600 text-white animate-pulse'
                                  }`}>
                                    {stage.status === 'done' ? '✓' : stage.id}
                                  </span>
                                  <span className="font-semibold text-foreground truncate text-[11px]">{stage.title}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground ml-6 truncate">{stage.desc}</span>
                              </div>
                            ))}
                          </div>

                          {/* Tenancy & Payment Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3.5 rounded-xl bg-muted/20 border border-border/40">
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Monthly Rent', 'மாத வாடகை')}</p>
                              <p className="font-bold text-foreground text-sm text-emerald-600 dark:text-emerald-400">
                                ₹{Number(property?.price || tenantAgreement?.monthlyRent || 0).toLocaleString('en-IN')}
                                <span className="text-[10px] text-muted-foreground font-normal"> /mo</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Security Deposit', 'முன்பணம் / வைப்புத்தொகை')}</p>
                              <p className="font-bold text-foreground text-sm">
                                ₹{Number(tenantAgreement?.securityDeposit || (property as any)?.deposit || (property as any)?.securityDeposit || 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[11px]">{t('Property Owner', 'உரிமையாளர்')}</p>
                              <p className="font-semibold text-foreground text-sm truncate">
                                {(property?.owner as any)?.name || t('Landlord', 'நிலப்பிரபு')}
                              </p>
                              <p className="text-muted-foreground text-[11px] truncate">
                                {(property?.owner as any)?.email || (property?.owner as any)?.phone || '-'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                                onClick={() => setActiveSection('payments')}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                {t('Pay / View Rent', 'வாடகை கட்டணம்')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => setActiveSection('agreements')}
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                {t('View Agreement', 'ஒப்பந்தம்')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => setActiveSection('maintenance')}
                              >
                                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                                {t('Maintenance', 'பராமரிப்பு')}
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                              onClick={() => setActiveSection('vacate')}
                            >
                              <span>{t('Notice to Vacate', 'வெளியேறும் அறிவிப்பு')}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm text-muted-foreground font-medium">
                          {t('No active requests or transactions found for this property.', 'இந்த சொத்திற்கான பரிவர்த்தனை எதுவும் இல்லை.')}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          onClick={() => setActiveSection('overview')}
                        >
                          <Home className="w-3.5 h-3.5" />
                          {t('Back to Overview', 'மேலோட்டத்திற்கு திரும்பவும்')}
                        </Button>
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
                                  className={`text-[10px] ${isCompleted
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

            {/* SECTION 5: TENANCY / LANDLORD CONNECTION */}
            {activeSection === 'tenancy' && (
              <div className="space-y-4">
                {isSelfManaged ? (
                  <Card className="border border-border/80 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {t('Landlord Information & Connection', 'நிலப்பிரபு தகவல் & இணைப்பு')}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => setIsConnectLandlordOpen(true)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {currentSelfManaged?.landlord?.connectionStatus === 'invited'
                            ? t('Re-send Invite', 'மீண்டும் அழைக்க')
                            : t('Connect Landlord', 'நிலப்பிரபுவை இணை')}
                        </Button>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t(
                          'Landlord details are optional. You can manage this rental independently without requiring a landlord account.',
                          'நிலப்பிரபு விவரங்கள் விருப்பத்திற்குரியது. கணக்கு இல்லாமலேயே நீங்கள் நிர்வகிக்கலாம்.'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {/* Connection Status Badge & Explanation */}
                      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">{t('Connection Status', 'இணைப்பு நிலை')}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {currentSelfManaged?.landlord?.connectionStatus === 'connected'
                              ? t('Connected to verified reSide landlord.', 'சரிபார்க்கப்பட்ட நிலப்பிரபுவுடன் இணைக்கப்பட்டது.')
                              : currentSelfManaged?.landlord?.connectionStatus === 'invited'
                              ? t('Invitation sent. Awaiting landlord registration and ownership verification.', 'அழைப்பு அனுப்பப்பட்டது.')
                              : t('Unconnected. Independent tenant-managed rental.', 'இணைக்கப்படவில்லை. சுயாதீன வாடகை பதிவு.')}
                          </p>
                        </div>
                        <Badge
                          variant={currentSelfManaged?.landlord?.connectionStatus === 'connected' ? 'default' : 'outline'}
                          className={`text-xs px-2.5 py-1 ${
                            currentSelfManaged?.landlord?.connectionStatus === 'connected'
                              ? 'bg-emerald-600 text-white'
                              : currentSelfManaged?.landlord?.connectionStatus === 'invited'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-300'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {currentSelfManaged?.landlord?.connectionStatus === 'connected'
                            ? t('Connected', 'இணைக்கப்பட்டது')
                            : currentSelfManaged?.landlord?.connectionStatus === 'invited'
                            ? t('Invited / Pending Verification', 'அழைப்பு நிலுவை')
                            : t('Unconnected (Optional)', 'இணைக்கப்படவில்லை')}
                        </Badge>
                      </div>

                      {/* Landlord Contact Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3.5 rounded-xl border border-border/60 bg-card/60">
                        <div>
                          <p className="text-muted-foreground text-[11px]">{t('Landlord Name', 'நிலப்பிரபு பெயர்')}</p>
                          <p className="text-sm font-semibold text-foreground">
                            {currentSelfManaged?.landlord?.name || t('Not specified', 'குறிப்பிடப்படவில்லை')}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px]">{t('Email', 'மின்னஞ்சல்')}</p>
                          <p className="text-sm font-medium text-foreground truncate">
                            {currentSelfManaged?.landlord?.email || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px]">{t('Phone', 'தொலைபேசி')}</p>
                          <p className="text-sm font-medium text-foreground">
                            {currentSelfManaged?.landlord?.phone || '-'}
                          </p>
                        </div>
                      </div>

                      {currentSelfManaged?.landlord?.notes && (
                        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-xs">
                          <p className="text-muted-foreground text-[11px] font-semibold">{t('Landlord Notes:', 'நிலப்பிரபு குறிப்புகள்:')}</p>
                          <p className="italic text-foreground mt-0.5">"{currentSelfManaged.landlord.notes}"</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : isTenantView ? (
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
              (isTenantView || payableItems.length > 0 || receivableItems.length > 0) ? (
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-4 shadow-xs h-full max-h-full flex flex-col overflow-hidden">
                  {/* 1. Header & Rent In / Rent Out Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/40 shrink-0">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {activeRentFlowMode === 'in'
                            ? t('Rent In — Incoming Tenant Collections', 'வாடகை பெறுதல் — குத்தகைதாரர் வசூல்')
                            : t('Rent Out — Outgoing Rent Obligations', 'வாடகை செலுத்துதல் — வெளிசெல்லும் பொறுப்புகள்')}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {activeRentFlowMode === 'in'
                            ? t('Track incoming rental income, tenant payment statuses, and collection records', 'குத்தகைதாரர்களிடமிருந்து பெறப்படும் வாடகையைக் கண்காணிக்கவும்')
                            : t('Track monthly rent payments, upcoming due dates, and payment receipts', 'செலுத்த வேண்டிய வாடகைகள் மற்றும் ரசீதுகளைக் கண்காணிக்கவும்')}
                        </p>
                      </div>
                    </div>

                    {/* Rent In / Rent Out toggle pills */}
                    {!isMyRents && (
                      <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setRentFlowMode('in')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            rentFlowMode === 'in'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          {t('Rent In', 'வாடகை பெறுதல்')} ({receivableItems?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRentFlowMode('out')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            rentFlowMode === 'out'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          {t('Rent Out', 'வாடகை செலுத்துதல்')} ({payableItems?.length || 0})
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 pt-3 space-y-4">

                  {/* 2. Metric Summary Cards */}
                  {activeRentFlowMode === 'in' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Card 1: Total Rent Received */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Total Rent Received', 'மொத்த பெற்ற வாடகை')}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            ₹{Number(receivableSummary?.totalReceived || 0).toLocaleString('en-IN')}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {receivableSummary?.receivedCount || 0} {t('units collected', 'அலகுகள் வசூலிக்கப்பட்டது')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Card 2: Pending Tenant Dues */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Pending Tenant Dues', 'நிலுவை வாடகை')}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            ₹{Number(receivableSummary?.totalPending || 0).toLocaleString('en-IN')}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {receivableSummary?.pendingCount || 0} {t('tenant(s) pending', 'குத்தகைதாரர் நிலுவை')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 shrink-0">
                          <Clock className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Card 3: Collection Rate */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Collection Rate', 'வசூல் விகிதம்')}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            {receivableSummary?.collectionRate || 100}%
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {receivableSummary?.totalUnits || 0} {t('active tenancies', 'செயலில் உள்ள வாடகைகள்')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Card 1: Total Rent Paid */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Total Rent Paid', 'மொத்த செலுத்திய வாடகை')}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            ₹{Number(activePayableSummary?.totalPaid || 0).toLocaleString('en-IN')}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {t('Completed outgoing dues', 'செலுத்தப்பட்ட தவணைகள்')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Card 2: Upcoming Due */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Upcoming Due', 'அடுத்த தவணை')}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            ₹{Number(activePayableSummary?.nextDueAmount || 0).toLocaleString('en-IN')}
                          </h4>
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px] block">
                            {t('Due on', 'தவணை நாள்')} {activePayableSummary?.nextDueDate || '-'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 shrink-0">
                          <Clock className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Card 3: Payment Status */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {t('Payment Status', 'கட்டண நிலை')}
                          </span>
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              activePayableSummary?.statusBadge?.variant === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : activePayableSummary?.statusBadge?.variant === 'overdue'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}>
                              {activePayableSummary?.statusBadge?.text || t('All Dues Cleared', 'அனைத்தும் செலுத்தப்பட்டது')}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {activePayableSummary?.pendingCount > 0
                              ? `₹${Number(activePayableSummary?.totalPending || 0).toLocaleString('en-IN')} ${t('pending', 'நிலுவை')}`
                              : t('0 outstanding payments', 'நிலுவை இல்லை')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
                          <CreditCard className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Ledger Table */}
                  {activeRentFlowMode === 'in' ? (
                    /* Rent In Ledger Table */
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                          {t('Incoming Tenant Ledger', 'வரவேண்டிய வாடகை பேரேடு')}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {receivableItems.length} {receivableItems.length === 1 ? t('Unit', 'அலகு') : t('Units', 'அலகுகள்')}
                        </span>
                      </div>

                      {receivableItems.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {t('No incoming rental units found', 'வாடகை அலகுகள் எதுவும் இல்லை')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50/70 dark:bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <th className="py-2.5 px-3 font-semibold">{t('Tenant / Contact', 'வாடகைதாரர்')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Rental Property', 'வாடகை சொத்து')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Expected Rent', 'எதிர்பார்க்கும் வாடகை')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Received Amount', 'பெற்ற தொகை')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Status', 'நிலை')}</th>
                                <th className="py-2.5 px-3 font-semibold text-right">{t('Actions', 'செயல்கள்')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {receivableItems.map((item: any) => {
                                const isReceived = item.status === 'received';
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                          {item.tenantName?.[0] || 'T'}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{item.tenantName}</p>
                                          <p className="text-[11px] text-slate-400 truncate">{item.tenantContact}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{item.propertyTitle}</p>
                                    </td>
                                    <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                      ₹{Number(item.expectedRent || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                                      ₹{Number(item.receivedAmount || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        isReceived ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {isReceived ? t('Received', 'பெறப்பட்டது') : t('Pending', 'நிலுவையில்')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => toast.success(`${t('Reminder sent to', 'நினைவூட்டல் அனுப்பப்பட்டது')} ${item.tenantName}`)}
                                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-800 cursor-pointer transition-colors"
                                      >
                                        {t('Send Reminder', 'நினைவூட்டல்')}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Rent Out Ledger Table */
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                          {t('Outgoing Rent Obligations', 'வெளிசெல்லும் வாடகை அட்டவணை')}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {displayedPayableItems.length} {displayedPayableItems.length === 1 ? t('Property', 'சொத்து') : t('Properties', 'சொத்துகள்')}
                        </span>
                      </div>

                      {displayedPayableItems.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {t('No outgoing rent obligations found', 'வாடகை பொறுப்புகள் எதுவும் இல்லை')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50/70 dark:bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <th className="py-2.5 px-3 font-semibold">{t('Rented Property', 'வாடகை சொத்து')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Landlord', 'உரிமையாளர்')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Rent / Maint.', 'வாடகை / பராமரிப்பு')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Paid vs Balance', 'செலுத்தியது / நிலுவை')}</th>
                                <th className="py-2.5 px-3 font-semibold">{t('Status', 'நிலை')}</th>
                                <th className="py-2.5 px-3 font-semibold text-right">{t('Actions', 'செயல்கள்')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {displayedPayableItems.map((item: any) => {
                                const isPaid = item.status === 'paid';
                                const isOverdue = item.status === 'overdue';
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                                    <td className="py-3 px-3 min-w-[160px]">
                                      <div className="flex items-center gap-2">
                                        {item.thumbnail ? (
                                          <img src={item.thumbnail} alt={item.propertyTitle} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200" />
                                        ) : (
                                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                                            <Home className="h-5 w-5" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{item.propertyTitle}</p>
                                          <p className="text-[11px] text-slate-400 truncate">{item.propertyLocation || 'Chennai'}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">{item.ownerName}</p>
                                      <p className="text-[11px] text-slate-400">{item.ownerContact}</p>
                                    </td>
                                    <td className="py-3 px-3">
                                      <p className="font-bold text-slate-900 dark:text-white">₹{Number(item.monthlyRent || 0).toLocaleString('en-IN')}</p>
                                      {item.monthlyMaintenance > 0 && (
                                        <p className="text-[10px] text-slate-400">+₹{item.monthlyMaintenance} maint</p>
                                      )}
                                    </td>
                                    <td className="py-3 px-3">
                                      <p className="font-semibold text-emerald-600">₹{Number(item.amountPaid || 0).toLocaleString('en-IN')}</p>
                                      {item.balance > 0 && (
                                        <p className="text-[10px] text-rose-500 font-medium">Bal: ₹{item.balance.toLocaleString('en-IN')}</p>
                                      )}
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        isPaid
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : isOverdue
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {isPaid ? t('Paid', 'செலுத்தப்பட்டது') : isOverdue ? t('Overdue', 'தவணை தாண்டியது') : t('Due Soon', 'விரைவில் செலுத்த வேண்டும்')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <div className="inline-flex items-center gap-1.5">
                                        {!isPaid && onPayNow && (
                                          <button
                                            type="button"
                                            onClick={() => onPayNow(item.raw)}
                                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs"
                                          >
                                            {t('Pay Now', 'செலுத்துக')}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onDownloadReceipt) {
                                              onDownloadReceipt(item);
                                            } else {
                                              generateReceipt(
                                                {
                                                  transactionId: item.transactionId,
                                                  amount: item.amountPaid || item.monthlyRent,
                                                  paidAt: item.paymentDate,
                                                  paymentMethod: item.paymentMethod,
                                                  status: 'completed',
                                                },
                                                {
                                                  propertyTitle: item.propertyTitle,
                                                  propertyLocation: item.propertyLocation,
                                                  owner: { name: item.ownerName },
                                                }
                                              );
                                            }
                                          }}
                                          className="p-1.5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                          title={t('Download Receipt', 'ரசீது பதிவிறக்கம்')}
                                        >
                                          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              ) : (
                <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {isSelfManaged ? t('Rent & Payment Tracking (Self-Managed)', 'வாடகை மற்றும் கட்டண பதிவு') : isTenantView ? t('My Rent Payments & Dues', 'என் வாடகை கட்டணங்கள் & நிலுவைகள்') : t('Rent & Payment Breakdown', 'வாடகை மற்றும் கட்டண விவரங்கள்')}
                    </span>
                    {isSelfManaged ? (
                      <Button
                        size="sm"
                        onClick={() => setIsRecordPaymentOpen(true)}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('Record Rent Payment', 'வாடகை கட்டணத்தை பதிவு செய்')}
                      </Button>
                    ) : isTenantView && (
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
                    {isSelfManaged
                      ? t('Record rent paid outside reSide, track upcoming due dates, and view receipts.', 'வெளியே செலுத்திய வாடகை மற்றும் ரசீதுகளை நிர்வகிக்கவும்.')
                      : isTenantView
                      ? t('View your monthly billing records, submit rent payments, and download payment receipts.', 'மாதாந்திர கட்டண பதிவுகள், கட்டணம் செலுத்துதல் மற்றும் ரசீது பதிவிறக்கம்.')
                      : t('Track payment history, tenant payment verifications, and monthly balances.', 'கட்டண வரலாறு மற்றும் ஒப்புதல்களை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                  {isSelfManaged ? (
                    <div className="space-y-4">
                      {/* Banners: Manual tracking ledger & Online payment unavailable */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>{t('Tenant-Recorded External Payments', 'குத்தகைதாரர் பதிவு செய்த கட்டணங்கள்')}</span>
                          </div>
                          <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                            {t(
                              'Records logged here reflect external payments made outside reSide (Cash, Bank Transfer, UPI, Cheque). They serve as your personal ledger and are not gateway-verified or landlord-confirmed.',
                              'reSide-க்கு வெளியே ரொக்கம் அல்லது வங்கி பரிமாற்றம் மூலம் நீங்கள் செலுத்திய கட்டணங்களை இங்கே பதிவு செய்யலாம். இது உங்கள் தனிப்பட்ட கணக்கு பதிவாகும்.'
                            )}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span>{t('Online Payment Unavailable', 'ஆன்லைன் கட்டணம் கிடைக்கவில்லை')}</span>
                          </div>
                          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                            {t(
                              'Direct online rent payments via reSide are currently unavailable for this self-managed rental without a connected landlord settlement workflow. Please continue recording payments manually.',
                              'இந்த வாடகைக்கு நிலப்பிரபுவுடன் ஆன்லைன் கட்டண இணைப்பு இல்லாததால், ஆன்லைன் செலுத்துதல் கிடைக்கவில்லை. கைமுறை பதிவை தொடரவும்.'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Payment Summary Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">{t('Monthly Rent', 'மாத வாடகை')}</span>
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            ₹{Number(currentSelfManaged?.monthlyRent || property.price || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">{t('Due Day', 'வாடகை நாள்')}</span>
                          <span className="text-base font-bold text-foreground mt-0.5 block">
                            Day {currentSelfManaged?.rentDueDay || 1}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">{t('Total Recorded Paid', 'செலுத்தப்பட்ட மொத்த தொகை')}</span>
                          <span className="text-base font-bold text-foreground mt-0.5 block">
                            ₹{(currentSelfManaged?.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">{t('Next Due Date', 'அடுத்த வாடகை தேதி')}</span>
                          <span className="text-sm font-bold text-primary mt-0.5 block truncate">
                            {getNextRentDueDate(currentSelfManaged?.rentDueDay || 1)}
                          </span>
                        </div>
                      </div>

                      {/* Recorded Payments List */}
                      {Array.isArray(currentSelfManaged?.payments) && currentSelfManaged.payments.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                            {t('Recorded Payment History', 'பதிவு செய்யப்பட்ட கட்டண வரலாறு')} ({currentSelfManaged.payments.length})
                          </p>
                          <div className="space-y-2.5">
                            {currentSelfManaged.payments
                              .slice()
                              .sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                              .map((payment: any) => (
                                <div
                                  key={payment._id || payment.id}
                                  className="border rounded-xl p-3.5 bg-card/60 hover:bg-card/90 transition-all border-border/60 shadow-2xs space-y-2.5"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-semibold">
                                        ✓ {t('Tenant-Recorded', 'குத்தகைதாரர் பதிவு')}
                                      </Badge>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {payment.paymentMethod || 'Other'}
                                      </Badge>
                                      <span className="text-xs font-bold text-foreground">
                                        {payment.rentPeriodMonth || t('Period Payment', 'மாத வாடகை')}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                      {t('Paid on', 'செலுத்தப்பட்ட தேதி')}: {new Date(payment.paymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                    <div className="space-y-0.5">
                                      <p className="text-[11px] text-muted-foreground">{t('Amount Recorded', 'பதிவான தொகை')}</p>
                                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                        ₹{Number(payment.amount || 0).toLocaleString('en-IN')}
                                      </p>
                                      {payment.transactionRef && (
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                          {t('Ref / UTR: ', 'குறிப்பு: ')}{payment.transactionRef}
                                        </p>
                                      )}
                                      {payment.notes && (
                                        <p className="text-xs italic text-muted-foreground mt-1">
                                          "{payment.notes}"
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                      {payment.receipt?.data && (
                                        <a
                                          href={payment.receipt.data}
                                          download={payment.receipt.name || `receipt-${payment.rentPeriodMonth}.png`}
                                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted/70 transition-all"
                                        >
                                          <Download className="h-3.5 w-3.5 text-primary" />
                                          <span>{t('View Receipt', 'ரசீது பார்க்க')}</span>
                                        </a>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                                        onClick={async () => {
                                          if (confirm(t('Are you sure you want to delete this payment record?', 'இந்த கட்டண பதிவை நீக்க விரும்புகிறீர்களா?'))) {
                                            try {
                                              await deletePaymentMutation.mutateAsync({
                                                rentalId: propertyId,
                                                paymentId: payment._id || payment.id,
                                              });
                                              toast.success(t('Payment record deleted', 'கட்டண பதிவு நீக்கப்பட்டது'));
                                            } catch (err: any) {
                                              toast.error(err?.response?.data?.msg || t('Failed to delete payment', 'நீக்க முடியவில்லை'));
                                            }
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        {t('Delete Entry', 'நீக்கு')}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 space-y-3 border rounded-xl bg-muted/10 p-6">
                          <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {t('No payments recorded yet', 'கட்டணங்கள் எதுவும் பதிவு செய்யப்படவில்லை')}
                            </p>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                              {t(
                                'Record offline payments you made to your landlord via UPI, cash, cheque, or bank transfer.',
                                'உங்கள் நிலப்பிரபுவுக்கு நீங்கள் செலுத்திய வாடகையை இங்கே பதிவு செய்யுங்கள்.'
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setIsRecordPaymentOpen(true)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl font-semibold shadow-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('Record Rent Payment', 'வாடகை கட்டணத்தை பதிவு செய்')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : isTenantView ? (
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
                                    className={`text-[10px] ${isPaid
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
                                      className={`text-[10px] ${payment.status === 'paid'
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
            ))}

            {/* SECTION 7: AGREEMENTS / DOCUMENTS */}
            {activeSection === 'agreements' && (
              <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary" />
                        {isSelfManaged ? t('Rental Documents & Agreement Records', 'வாடகை ஆவணங்கள் & பதிவுகள்') : isTenantView ? t('My Rental Agreement', 'என் வாடகை ஒப்பந்தம்') : t('Agreements & Contracts', 'ஒப்பந்தங்கள்')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {isSelfManaged
                          ? t('Store your rental agreement, move-in condition reports, and receipts privately.', 'உங்கள் வாடகை ஒப்பந்தம் மற்றும் ஆவணங்களை பாதுகாப்பாக சேமிக்கவும்.')
                          : isTenantView
                          ? t('View your registered tenancy contract, key terms, and active lease timeline.', 'உங்கள் பதிவு செய்யப்பட்ட குத்தகை ஒப்பந்தம் மற்றும் விதிமுறைகள்.')
                          : t('Manage legal rental agreements, valid lease terms, and uploaded contracts.', 'குத்தகை ஒப்பந்தங்களை நிர்வகிக்கவும்.')}
                      </CardDescription>
                    </div>

                    {(isTenantView || isMyRents) && !isSelfManaged && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const targetAgreement = (validPropertyAgreements.length > 0 ? validPropertyAgreements[0] : null) || {
                              startDate: new Date(),
                              endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
                              rentAmount: property?.price || 0,
                              property: { location: displayLocation || property?.location || '', title: displayTitle || property?.title || '' },
                              owner: { name: ownerDisplayName || 'Landlord' },
                              tenant: { name: userProfile?.name || 'Tenant' }
                            };
                            handleDownloadAgreement(targetAgreement as any);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200/80 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-sm transition-all cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          <span>{t('Agreement Sample PDF', 'மாதிரி ஒப்பந்த PDF')}</span>
                        </button>

                        <input
                          type="file"
                          ref={tenantDocInputRef}
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleTenantUploadDocument}
                          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                        />
                        <button
                          type="button"
                          disabled={uploadingDoc}
                          onClick={() => tenantDocInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingDoc ? t('Uploading...', 'பதிவேற்றுகிறது...') : t('Upload File', 'கோப்பை ஏற்று')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                  {isSelfManaged ? (
                    <div className="space-y-4">
                      {/* Document Privacy Notice */}
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs flex items-start gap-2.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          <b>{t('Private Document Vault: ', 'தனிப்பட்ட ஆவண பெட்டகம்: ')}</b>
                          {t(
                            'Documents uploaded here are stored securely and privately for your personal tracking. Uploading a document does not constitute a digitally signed or legally verified platform contract.',
                            'இங்கே பதிவேற்றப்பட்ட ஆவணங்கள் உங்கள் தனிப்பட்ட பயன்பாட்டிற்கு மட்டுமே. இது சட்டப்பூர்வ ஒப்பந்தமாக கருதப்படாது.'
                          )}
                        </p>
                      </div>

                      {/* Document Upload Bar */}
                      <div className="p-3.5 rounded-xl border border-dashed border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold">{t('Category:', 'வகை:')}</span>
                          <select
                            value={selfManagedDocCategory}
                            onChange={(e) => setSelfManagedDocCategory(e.target.value as any)}
                            className="h-8 text-xs rounded-md border border-input bg-background px-2"
                          >
                            <option value="agreement">{t('Rental Agreement', 'வாடகை ஒப்பந்தம்')}</option>
                            <option value="move_in_report">{t('Move-in Condition Report', 'குடியேற்ற நிலை அறிக்கை')}</option>
                            <option value="receipt">{t('Rent Receipt', 'வாடகை ரசீது')}</option>
                            <option value="other">{t('Other Document', 'பிற ஆவணம்')}</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="file"
                            ref={selfManagedDocInputRef}
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleTenantUploadDocument}
                          />
                          <Button
                            size="sm"
                            disabled={isUploadingSelfManagedDoc}
                            onClick={() => selfManagedDocInputRef.current?.click()}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {isUploadingSelfManagedDoc ? t('Uploading...', 'பதிவேற்றுகிறது...') : t('Upload Document', 'ஆவணத்தை பதிவேற்று')}
                          </Button>
                        </div>
                      </div>

                      {/* Documents List */}
                      {Array.isArray(currentSelfManaged?.documents) && currentSelfManaged.documents.length > 0 ? (
                        <div className="space-y-2.5">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                            {t('Attached Documents', 'இணைக்கப்பட்ட ஆவணங்கள்')} ({currentSelfManaged.documents.length})
                          </p>
                          <div className="space-y-2">
                            {currentSelfManaged.documents.map((doc: any) => (
                              <div
                                key={doc._id || doc.id}
                                className="p-3 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 flex-wrap"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="h-4 w-4 text-primary shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <Badge variant="outline" className="capitalize text-[9px] px-1.5 py-0">
                                        {doc.category ? doc.category.replace('_', ' ') : 'Document'}
                                      </Badge>
                                      <span>{new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {doc.data && (
                                    <a
                                      href={doc.data}
                                      download={doc.name}
                                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/70 transition-all"
                                    >
                                      <Download className="h-3 w-3 text-primary" />
                                      <span>{t('Download', 'பதிவிறக்கு')}</span>
                                    </a>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800"
                                    onClick={async () => {
                                      if (confirm(t('Delete this document?', 'இந்த ஆவணத்தை நீக்கவா?'))) {
                                        try {
                                          await deleteDocMutation.mutateAsync({
                                            rentalId: propertyId,
                                            docId: doc._id || doc.id,
                                          });
                                          toast.success(t('Document removed', 'ஆவணம் நீக்கப்பட்டது'));
                                        } catch (err: any) {
                                          toast.error(err?.response?.data?.msg || t('Failed to remove document', 'நீக்க முடியவில்லை'));
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs border rounded-xl bg-muted/10 p-4">
                          {t('No documents attached yet. Upload a copy of your lease agreement or move-in report for safe keeping.', 'ஆவணங்கள் எதுவும் இணைக்கப்படவில்லை.')}
                        </div>
                      )}
                    </div>
                  ) : loadingAgreements ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {t('Loading agreements...', 'ஒப்பந்தங்களை ஏற்றுகிறது...')}
                    </div>
                  ) : validPropertyAgreements.length > 0 ? (
                    <div className="space-y-3">
                      {validPropertyAgreements.map((agreement: any) => {
                        const docFileName = agreement.fileName || agreement.documents?.[0]?.name || 'edee.pdf';
                        const docFileDataUrl = agreement.fileDataUrl || agreement.documents?.[0]?.data || agreement.fileUrl;
                        const hasDocument = Boolean(agreement.fileName || agreement.fileDataUrl || (agreement.documents && agreement.documents.length > 0));
                        const isVerified = agreement.status === 'APPROVED' || agreement.verificationStatus === 'APPROVED';
                        const isRejected = agreement.status === 'REJECTED' || agreement.verificationStatus === 'REJECTED';
                        const isPending = !isVerified && !isRejected;

                        return (
                          <div key={agreement._id || agreement.id}>
                            {/* Horizontal 3-Step Agreement Verification Progress Bar */}
                            <div className="px-3.5 py-2 mb-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden">
                              {/* Step 1: Tenant Sent File */}
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                                  hasDocument
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : 'border-2 border-blue-600 text-blue-600'
                                }`}>
                                  {hasDocument ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : '1'}
                                </div>
                                <div className="min-w-0 flex flex-col leading-tight">
                                  <span className={`text-[11px] font-bold truncate ${hasDocument ? 'text-slate-800 dark:text-slate-100' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {hasDocument ? t('Step 1: Tenant Sent File', 'படி 1: கோப்பு அனுப்பப்பட்டது') : t('Step 1: Upload Signed File', 'படி 1: கோப்பை பதிவேற்றவும்')}
                                  </span>
                                  <span className={`text-[9px] truncate ${hasDocument ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                                    {hasDocument ? (agreement.uploadedAt || (agreement.createdAt ? new Date(agreement.createdAt).toLocaleDateString() : t('Sent', 'அனுப்பப்பட்டது'))) : t('Awaiting Upload', 'பதிவேற்றம் தேவை')}
                                  </span>
                                </div>
                              </div>

                              {/* Connector Line 1 -> 2 */}
                              <div className={`flex-1 h-[2px] min-w-[12px] sm:min-w-[20px] transition-colors rounded-full ${hasDocument ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />

                              {/* Step 2: Pending Owner Review */}
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                                  isVerified || isRejected
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : hasDocument && isPending
                                    ? 'bg-amber-500 text-white ring-4 ring-amber-500/20 animate-pulse'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium'
                                }`}>
                                  {isVerified || isRejected ? (
                                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  ) : (
                                    '2'
                                  )}
                                </div>
                                <div className="min-w-0 flex flex-col leading-tight">
                                  <span className={`text-[11px] truncate ${
                                    isVerified || isRejected
                                      ? 'font-bold text-slate-800 dark:text-slate-100'
                                      : hasDocument && isPending
                                      ? 'font-bold text-amber-600 dark:text-amber-400'
                                      : 'font-medium text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {isVerified || isRejected
                                      ? t('Step 2: Owner Reviewed', 'படி 2: மதிப்பாய்வு செய்யப்பட்டது')
                                      : t('Step 2: Pending Owner Review', 'படி 2: மதிப்பாய்வு நிலுவையில்')}
                                  </span>
                                  <span className={`text-[9px] truncate ${
                                    isVerified || isRejected
                                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                      : hasDocument && isPending
                                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                                      : 'text-muted-foreground'
                                  }`}>
                                    {isVerified || isRejected
                                      ? t('Reviewed', 'முடிந்தது')
                                      : hasDocument && isPending
                                      ? t('In Review', 'மதிப்பாய்வில்')
                                      : t('Upcoming', 'அடுத்தது')}
                                  </span>
                                </div>
                              </div>

                              {/* Connector Line 2 -> 3 */}
                              <div className={`flex-1 h-[2px] min-w-[12px] sm:min-w-[20px] transition-colors rounded-full ${
                                isVerified
                                  ? 'bg-emerald-500'
                                  : isRejected
                                  ? 'bg-rose-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`} />

                              {/* Step 3: Agreement Status (Verified / Rejected) */}
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                                  isVerified
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : isRejected
                                    ? 'bg-rose-500 text-white shadow-xs'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium'
                                }`}>
                                  {isVerified ? (
                                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  ) : isRejected ? (
                                    <AlertCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                                  ) : (
                                    '3'
                                  )}
                                </div>
                                <div className="min-w-0 flex flex-col leading-tight">
                                  <span className={`text-[11px] truncate ${
                                    isVerified
                                      ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                      : isRejected
                                      ? 'font-bold text-rose-600 dark:text-rose-400'
                                      : 'font-medium text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {isVerified
                                      ? t('Step 3: Agreement Verified', 'படி 3: ஒப்பந்தம் சரிபார்க்கப்பட்டது')
                                      : isRejected
                                      ? t('Step 3: Rejected by Owner', 'படி 3: உரிமையாளரால் நிராகரிக்கப்பட்டது')
                                      : t('Step 3: Final Approval', 'படி 3: இறுதி ஒப்புதல்')}
                                  </span>
                                  <span className={`text-[9px] truncate ${
                                    isVerified
                                      ? 'text-emerald-600/80 dark:text-emerald-400/80 font-medium'
                                      : isRejected
                                      ? 'text-rose-600/80 dark:text-rose-400/80 font-medium'
                                      : 'text-muted-foreground'
                                  }`}>
                                    {isVerified
                                      ? t('Approved', 'அங்கீகரிக்கப்பட்டது')
                                      : isRejected
                                      ? t('Action Needed', 'மறுபதிவேற்றம் தேவை')
                                      : t('Awaiting Review', 'நிலுவையில்')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              className="p-3.5 border rounded-xl bg-card/60 hover:bg-muted/50 transition-colors space-y-3"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold text-sm">{agreement.property?.title || title}</h3>
                                  <p className="text-xs text-muted-foreground">{agreement.property?.location || loc}</p>
                                </div>
                                <Badge
                                  variant={isVerified ? 'default' : isRejected ? 'destructive' : 'secondary'}
                                  className={`text-[10px] ${isVerified ? 'bg-emerald-600 text-white' : isRejected ? 'bg-rose-600 text-white' : ''}`}
                                >
                                  {isVerified
                                    ? t('VERIFIED & APPROVED', 'சரிபார்க்கப்பட்டது')
                                    : isRejected
                                    ? t('REJECTED', 'நிராகரிக்கப்பட்டது')
                                    : (agreement.status || 'PENDING').toUpperCase()}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">{isTenantView ? t('Landlord', 'உரிமையாளர்') : t('Tenant', 'குத்தகைதாரர்')}</p>
                                  <p className="font-medium">{isTenantView ? (agreement.owner?.name || agreement.ownerId?.name || t('Owner', 'உரிமையாளர்')) : (agreement.tenant?.name || agreement.tenantName || t('Tenant', 'குத்தகைதாரர்'))}</p>
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

                              {/* Uploaded Agreement Document Section */}
                            {hasDocument && (
                              <div className="p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-foreground truncate">{docFileName}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {t('Uploaded on', 'பதிவேற்றப்பட்டது')}: {agreement.uploadedAt || new Date(agreement.createdAt || Date.now()).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge className={`text-[10px] ${
                                      isVerified
                                        ? 'bg-emerald-600 text-white'
                                        : isRejected
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-amber-600 text-white'
                                    }`}>
                                      {isVerified
                                        ? t('Verified & Approved', 'சரிபார்க்கப்பட்டு அங்கீகரிக்கப்பட்டது')
                                        : isRejected
                                        ? t('Rejected', 'நிராகரிக்கப்பட்டது')
                                        : t('Pending Owner Review', 'உரிமையாளர் மதிப்பாய்வு நிலுவையில் உள்ளது')}
                                    </Badge>

                                    {docFileDataUrl && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePreviewOrDownload(docFileName, docFileDataUrl)}
                                        className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                                      >
                                        <Eye className="h-3 w-3" />
                                        {t('Preview / Download', 'முன்னோட்டம் / பதிவிறக்கு')}
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Owner Message / Note Banner */}
                                {(agreement.ownerMessage || agreement.ownerNote) && (
                                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-border/50 text-[11px]">
                                    <span className="font-semibold text-foreground">{t('Owner Message:', 'உரிமையாளர் செய்தி:')} </span>
                                    <span className="text-muted-foreground">{agreement.ownerMessage || agreement.ownerNote}</span>
                                  </div>
                                )}

                                {/* Owner Verify / Reject Actions */}
                                {!isTenantView && (
                                  <div className="pt-2 border-t border-border/40 space-y-2">
                                    {isPending ? (
                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <Input
                                          value={ownerAgreementNotes[agreement._id] ?? ''}
                                          onChange={(e) => setOwnerAgreementNotes(prev => ({ ...prev, [agreement._id]: e.target.value }))}
                                          placeholder={t('Optional review note / message for tenant...', 'குத்தகைதாரருக்கான செய்தி...')}
                                          className="h-8 text-xs flex-1"
                                        />
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <Button
                                            size="sm"
                                            disabled={isVerifyingAgreementId === agreement._id}
                                            onClick={() => handleOwnerVerify(agreement, 'APPROVED')}
                                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                            {isVerifyingAgreementId === agreement._id ? t('Verifying...', 'சரிபார்க்கிறது...') : t('Accept & Verify', 'ஏற்று சரிபார்க்கவும்')}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isVerifyingAgreementId === agreement._id}
                                            onClick={() => handleOwnerVerify(agreement, 'REJECTED')}
                                            className="h-8 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 gap-1 font-semibold"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                            {t('Reject with Message', 'செய்தியுடன் நிராகரி')}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span>{t('Decision recorded on', 'முடிவு எடுக்கப்பட்டது')}: {agreement.reviewedAt || new Date().toLocaleString()}</span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOwnerVerify(agreement, isVerified ? 'REJECTED' : 'APPROVED')}
                                          className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                                        >
                                          {isVerified ? t('Change to Reject', 'நிராகரிக்க மாற்று') : t('Change to Approve', 'அங்கீகரிக்க மாற்று')}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}


                          </div>
                        </div>
                      );
                    })}
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
              <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="px-5 pt-3 pb-2 border-b border-border/40 shrink-0">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      {isSelfManaged ? t('Self-Managed Maintenance Log', 'சுய-நிர்வகிக்கப்பட்ட பராமரிப்பு பதிவு') : isTenantView ? t('Maintenance & Service Requests', 'பராமரிப்பு மற்றும் சேவை கோரிக்கைகள்') : t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}
                    </span>
                    {isSelfManaged ? (
                      <Button
                        size="sm"
                        onClick={() => setIsLogMaintenanceOpen(true)}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <Wrench className="h-3 w-3" />
                        {t('+ Log Issue / Expense', '+ சிக்கல் / செலவை பதிவு செய்')}
                      </Button>
                    ) : isTenantView ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTenantMaintenanceRequests}
                        className="h-7 text-xs gap-1"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {t('Refresh', 'புதுப்பி')}
                      </Button>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isSelfManaged
                      ? t('Keep private records of repairs, appliance upkeep, and personal out-of-pocket expenses. (Not sent to landlord)', 'பழுதுபார்ப்பு மற்றும் தனிப்பட்ட செலவுகளின் தனிப்பட்ட பதிவுகள்.')
                      : isTenantView
                        ? t('Submit repair requests with optional voice notes and track service status in real-time.', 'பழுதுபார்ப்பு கோரிக்கைகளை சமர்ப்பித்து நிலையை கண்காணிக்கவும்.')
                        : t('Review and complete maintenance issues reported for this property.', 'பராமரிப்பு சிக்கல்களை மதிப்பாய்வு செய்து தீர்க்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
                  {isSelfManaged ? (
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 pr-2 space-y-4">
                      {/* Notice */}
                      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{t('Personal Maintenance & Expense Ledger', 'தனிப்பட்ட பராமரிப்பு மற்றும் செலவு கணக்கு')}</p>
                          <p className="text-[11px] opacity-90">
                            {t('These records are stored privately in your personal account for expense tracking and tax purposes. They do not generate notifications to your landlord.', 'இந்த பதிவுகள் உங்கள் தனிப்பட்ட கணக்கில் மட்டுமே சேமிக்கப்படுகின்றன.')}
                          </p>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-xl border border-border/60 bg-card/60 text-center">
                          <p className="text-[11px] text-muted-foreground">{t('Total Logged', 'மொத்த பதிவுகள்')}</p>
                          <p className="text-base font-bold text-foreground">
                            {Array.isArray(currentSelfManaged?.maintenance) ? currentSelfManaged.maintenance.length : 0}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl border border-border/60 bg-card/60 text-center">
                          <p className="text-[11px] text-muted-foreground">{t('Total Spent', 'மொத்த செலவு')}</p>
                          <p className="text-base font-bold text-emerald-600">
                            ₹{(Array.isArray(currentSelfManaged?.maintenance)
                              ? currentSelfManaged.maintenance.reduce((sum: number, m: any) => sum + (Number(m.amountSpent) || 0), 0)
                              : 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl border border-border/60 bg-card/60 text-center">
                          <p className="text-[11px] text-muted-foreground">{t('Open / Active', 'செயலில் உள்ளவை')}</p>
                          <p className="text-base font-bold text-amber-600">
                            {Array.isArray(currentSelfManaged?.maintenance)
                              ? currentSelfManaged.maintenance.filter((m: any) => m.status !== 'resolved').length
                              : 0}
                          </p>
                        </div>
                      </div>

                      {/* Maintenance List */}
                      {Array.isArray(currentSelfManaged?.maintenance) && currentSelfManaged.maintenance.length > 0 ? (
                        <div className="space-y-2.5">
                          {currentSelfManaged.maintenance.map((entry: any) => (
                            <div
                              key={entry._id || entry.id}
                              className="border rounded-xl p-3 bg-card/60 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                            >
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-xs sm:text-sm text-foreground">{entry.title}</p>
                                  <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0">
                                    {entry.category || 'General'}
                                  </Badge>
                                  <Badge
                                    className={`text-[9px] px-1.5 py-0 ${
                                      entry.status === 'resolved'
                                        ? 'bg-emerald-600 text-white'
                                        : entry.status === 'in_progress'
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-amber-600 text-white'
                                    }`}
                                  >
                                    {entry.status === 'resolved' ? t('Resolved', 'தீர்க்கப்பட்டது') : entry.status === 'in_progress' ? t('In Progress', 'செயலில்') : t('Reported', 'அறிவிக்கப்பட்டது')}
                                  </Badge>
                                </div>
                                {entry.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                  <span>{t('Date:', 'தேதி:')} {new Date(entry.dateReported || entry.createdAt || Date.now()).toLocaleDateString()}</span>
                                  {Number(entry.amountSpent) > 0 && (
                                    <span className="font-semibold text-emerald-600">
                                      {t('Spent:', 'செலவு:')} ₹{Number(entry.amountSpent).toLocaleString()}
                                    </span>
                                  )}
                                  {entry.receipt && (
                                    <a
                                      href={entry.receipt}
                                      download={`receipt-${entry.title || 'expense'}`}
                                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                    >
                                      <Download className="h-3 w-3" />
                                      {t('Receipt', 'ரசீது')}
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                <select
                                  value={entry.status || 'reported'}
                                  onChange={async (e) => {
                                    try {
                                      await updateMaintenanceMutation.mutateAsync({
                                        rentalId: propertyId,
                                        maintenanceId: entry._id || entry.id,
                                        data: { status: e.target.value as any },
                                      });
                                      toast.success(t('Status updated', 'நிலை புதுப்பிக்கப்பட்டது'));
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.msg || t('Failed to update status', 'பிழை'));
                                    }
                                  }}
                                  className="h-7 text-[11px] rounded-md border border-input bg-background px-2"
                                >
                                  <option value="reported">{t('Reported', 'அறிவிக்கப்பட்டது')}</option>
                                  <option value="in_progress">{t('In Progress', 'செயலில்')}</option>
                                  <option value="resolved">{t('Resolved', 'தீர்க்கப்பட்டது')}</option>
                                </select>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:border-rose-800"
                                  onClick={async () => {
                                    if (confirm(t('Delete this maintenance record?', 'இந்த பதிவை நீக்கவா?'))) {
                                      try {
                                        await deleteMaintenanceMutation.mutateAsync({
                                          rentalId: propertyId,
                                          maintenanceId: entry._id || entry.id,
                                        });
                                        toast.success(t('Maintenance entry removed', 'பதிவு நீக்கப்பட்டது'));
                                      } catch (err: any) {
                                        toast.error(err?.response?.data?.msg || t('Failed to delete entry', 'பிழை'));
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs border rounded-xl bg-muted/10 p-4">
                          {t('No maintenance issues or expenses recorded yet. Click "+ Log Issue / Expense" to track repairs or out-of-pocket costs.', 'பராமரிப்பு செலவுகள் எதுவும் பதிவு செய்யப்படவில்லை.')}
                        </div>
                      )}
                    </div>
                  ) : isTenantView ? (
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 pt-2 pb-3 items-stretch overflow-hidden">
                      {/* LEFT COLUMN: Submitted Service Requests (lg:col-span-7) */}
                      <div className="lg:col-span-7 h-full min-h-0 flex flex-col justify-between p-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xs shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
                          <p className="text-xs font-bold text-foreground">
                            {t('Submitted Service Requests', 'சமர்ப்பிக்கப்பட்ட கோரிக்கைகள்')}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {maintenanceRequests.length}
                          </span>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 mt-2">
                          {loadingMaintenance ? (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                              {t('Loading maintenance requests...', 'பராமரிப்பு கோரிக்கைகளை ஏற்றுகிறது...')}
                            </div>
                          ) : maintenanceRequests.length > 0 ? (
                            maintenanceRequests.map((request) => (
                              <div
                                key={request._id}
                                className="border rounded-xl p-2.5 bg-card/60 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-xs sm:text-sm truncate">{request.issue}</p>
                                      {request.priority && (
                                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                                          {request.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    {request.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{request.description}</p>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                      {request.category || 'General'} • {new Date(request.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                    <Badge className={`text-[10px] ${
                                      request.status === 'completed'
                                        ? 'bg-green-600 text-white'
                                        : (request.status as string) === 'in-progress' || (request.status as string) === 'in_progress'
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-amber-600 text-white'
                                    }`}>
                                      {request.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground text-xs flex flex-col items-center justify-center h-full">
                              <p>{t('No maintenance requests for this property.', 'பராமரிப்பு கோரிக்கைகள் எதுவும் இல்லை.')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT COLUMN: Report a New Maintenance Issue (lg:col-span-5) */}
                      <div className="lg:col-span-5 h-full min-h-0 flex flex-col justify-between p-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xs shadow-xs">
                        <div className="space-y-2.5 flex-1 min-h-0 flex flex-col">
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0">
                            <Wrench className="h-3.5 w-3.5 text-primary" />
                            {t('Report a New Maintenance Issue', 'புதிய பராமரிப்பு சிக்கலைப் புகாரளிக்கவும்')}
                          </p>

                          <div className="space-y-1 shrink-0">
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

                          <div className="grid grid-cols-2 gap-2.5 shrink-0">
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

                          <div className="space-y-0">
                            <label className="text-[11px] font-medium text-muted-foreground">{t('Description / Details', 'விவரம்')}</label>
                            <div className="relative">
                              <Textarea
                                value={tenantMaintenanceDescription}
                                onChange={(e) => setTenantMaintenanceDescription(e.target.value)}
                                placeholder={t('Describe the issue in detail...', 'சிக்கலை விரிவாக விவரிக்கவும்...')}
                                rows={2}
                                className="text-xs h-[48px] w-full pr-9 resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => toggleListening('description')}
                                aria-label="Toggle voice input for issue description"
                                className={`absolute right-2.5 top-2.5 p-1 rounded-md transition-colors ${
                                  isListeningDescription ? 'text-red-600 bg-red-100 animate-pulse' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {isListeningDescription ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-1 flex justify-end shrink-0">
                          <button
                            type="button"
                            disabled={isReportingMaintenance || !tenantMaintenanceIssue.trim()}
                            onClick={handleTenantSubmitMaintenance}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white shadow-sm transition-all cursor-pointer"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>{isReportingMaintenance ? t('Submitting...', 'சமர்ப்பிக்கிறது...') : t('Submit Request', 'கோரிக்கையை அனுப்பு')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 pr-2 space-y-2.5">
                      {loadingMaintenance ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          {t('Loading maintenance requests...', 'பராமரிப்பு கோரிக்கைகளை ஏற்றுகிறது...')}
                        </div>
                      ) : maintenanceRequests.length > 0 ? (
                        <div className="space-y-2.5">
                          <p className="text-xs font-semibold text-foreground">
                            {t('Active Maintenance Requests', 'செயலில் உள்ள கோரிக்கைகள்')}
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
                                    {(request.tenant?.name || t('Tenant', 'குத்தகைதாரர்'))} • {new Date(request.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                  <Badge className={`text-[10px] ${request.status === 'completed'
                                    ? 'bg-green-600 text-white'
                                    : (request.status as string) === 'in-progress' || (request.status as string) === 'in_progress'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-amber-600 text-white'
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
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 9: VACATE */}
            {activeSection === 'vacate' && (
              <Card className="border border-blue-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md shadow-xs h-full max-h-full flex flex-col overflow-hidden rounded-2xl">
                <CardHeader className="pb-2.5 pt-3 px-4 border-b border-border/40 shrink-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LogOut className="h-4 w-4 text-primary" />
                    {isSelfManaged ? t('Move-Out & Vacate Planner', 'வெளியேறும் திட்டமிடல்') : isTenantView ? t('Notice to Vacate & Move-Out', 'வெளியேறும் அறிவிப்பு & நகர்வு') : t('Vacate Requests & Move-Outs', 'வெளியேறும் கோரிக்கைகள்')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isSelfManaged
                      ? t('Plan your move-out schedule, track checklist tasks, and log forwarding notes privately.', 'வெளியேறும் தேதியை திட்டமிட்டு சரிபார்ப்பு பட்டியலை நிர்வகிக்கவும்.')
                      : isTenantView
                        ? t('Submit your formal notice of intent to vacate or monitor your current move-out clearance status.', 'வெளியேறும் அறிவிப்பைச் சமர்ப்பிக்கவும் அல்லது நிலையை கண்காணிக்கவும்.')
                        : t('Review and manage tenant vacate notices and move-out confirmations.', 'குத்தகைதாரர் வெளியேறும் அறிவிப்புகளை நிர்வகிக்கவும்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                  {isSelfManaged ? (
                    <div className="space-y-4">
                      {/* Notice Banner */}
                      <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300 text-xs flex items-start gap-2">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{t('Private Move-Out Planning', 'தனிப்பட்ட வெளியேறும் திட்டம்')}</p>
                          <p className="text-[11px] opacity-90">
                            {t('This workspace helps you prepare for departure and security deposit return. Saving details here does not send formal legal notice to your landlord — please ensure you notify your landlord directly according to your lease agreement terms.', 'இது உங்கள் தனிப்பட்ட திட்டமிடல் மட்டுமே. நிலப்பிரபுவுக்கு அதிகாரப்பூர்வ அறிவிப்பை நேரடியாக வழங்கவும்.')}
                          </p>
                        </div>
                      </div>

                      {/* Dates Form */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground">
                            {t('Planned Move-Out Date', 'திட்டமிட்ட வெளியேறும் தேதி')}
                          </label>
                          <Input
                            type="date"
                            value={plannedMoveOutDate}
                            onChange={(e) => setPlannedMoveOutDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground">
                            {t('Notice Given to Landlord Date (Optional)', 'நிலப்பிரபுக்கு அறிவித்த தேதி')}
                          </label>
                          <Input
                            type="date"
                            value={noticeGivenDate}
                            onChange={(e) => setNoticeGivenDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-semibold text-foreground">
                            {t('Move-Out Notes & Forwarding Details', 'வெளியேறும் குறிப்புகள்')}
                          </label>
                          <Textarea
                            value={moveOutNotes}
                            onChange={(e) => setMoveOutNotes(e.target.value)}
                            placeholder={t('e.g. Forwarding address, key handover arrangement, meter readings at exit, deposit return notes...', 'எ.கா. புதிய முகவரி, சாவி ஒப்படைப்பு, பாதுகாப்பு வைப்புத்தொகை திரும்பப்பெறுதல்...')}
                            className="text-xs min-h-[60px]"
                          />
                        </div>
                      </div>

                      {/* Interactive Checklist */}
                      <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                            {t('Move-Out Checklist', 'வெளியேறும் சரிபார்ப்பு பட்டியல்')} ({moveOutChecklist.filter(c => c.done).length}/{moveOutChecklist.length})
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => {
                              const itemText = prompt(t('Enter new checklist task:', 'புதிய பணியை உள்ளிடவும்:'));
                              if (itemText && itemText.trim()) {
                                setMoveOutChecklist(prev => [...prev, { item: itemText.trim(), done: false }]);
                              }
                            }}
                          >
                            + {t('Add Task', 'பணி சேர்')}
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          {moveOutChecklist.map((task, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                                task.done ? 'bg-emerald-500/10 border-emerald-500/30 line-through text-muted-foreground' : 'bg-background border-border/60 text-foreground'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={task.done}
                                  onChange={() => {
                                    setMoveOutChecklist(prev =>
                                      prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t)
                                    );
                                  }}
                                  className="h-3.5 w-3.5 rounded border-input text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="truncate">{task.item}</span>
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  setMoveOutChecklist(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="text-muted-foreground hover:text-rose-500 p-0.5 rounded"
                                title="Remove task"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          disabled={updateVacateMutation.isPending}
                          onClick={async () => {
                            try {
                              await updateVacateMutation.mutateAsync({
                                rentalId: propertyId,
                                vacateData: {
                                  plannedDate: plannedMoveOutDate || undefined,
                                  noticeDate: noticeGivenDate || undefined,
                                  notes: moveOutNotes,
                                  checklist: moveOutChecklist,
                                }
                              });
                              toast.success(t('Move-out plan saved successfully', 'வெளியேறும் திட்டம் வெற்றிகரமாக சேமிக்கப்பட்டது'));
                            } catch (err: any) {
                              toast.error(err?.response?.data?.msg || t('Failed to save move-out plan', 'சேமிக்க முடியவில்லை'));
                            }
                          }}
                          className="h-8 text-xs bg-primary text-primary-foreground gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {updateVacateMutation.isPending ? t('Saving Plan...', 'சேமிக்கிறது...') : t('Save Move-Out Plan', 'திட்டத்தை சேமி')}
                        </Button>
                      </div>
                    </div>
                  ) : isTenantView ? (
                    (() => {
                      const myVacateRequest = tenantVacateRequests.find((r: any) => String(r.property?._id || r.property) === String(propertyId));
                      if (myVacateRequest && myVacateRequest.status !== 'rejected') {
                        return (
                          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">{t('Active Vacate Request', 'செயலில் உள்ள வெளியேறும் கோரிக்கை')}</span>
                              <Badge
                                className={`text-[10px] ${myVacateRequest.status === 'completed'
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
                    className={`relative h-12 w-16 sm:h-14 sm:w-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${idx === lightboxIndex
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

      {/* Uploaded Document In-App Preview Dialog */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col p-4">
            <DialogHeader className="pb-2 border-b">
              <DialogTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-primary" />
                  {previewDoc.name}
                </span>
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('Download File', 'பதிவிறக்கு')}
                </a>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[400px] max-h-[70vh] bg-muted/20 rounded-xl overflow-hidden mt-2 flex items-center justify-center">
              {previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-full min-h-[500px] border-0 rounded-lg"
                />
              ) : previewDoc.url.startsWith('data:image') || /\.(png|jpg|jpeg|webp)$/i.test(previewDoc.url) ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[65vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-full min-h-[500px] border-0 rounded-lg"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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

      {/* Self-Managed Record Rent Payment Dialog */}
      {isSelfManaged && (
        <RecordRentPaymentDialog
          open={isRecordPaymentOpen}
          onOpenChange={setIsRecordPaymentOpen}
          rentalId={propertyId}
          monthlyRent={currentSelfManaged?.monthlyRent || property?.price || 0}
          rentDueDay={currentSelfManaged?.rentDueDay || 5}
        />
      )}

      {/* Self-Managed Log Maintenance Dialog */}
      {isSelfManaged && (
        <LogMaintenanceDialog
          open={isLogMaintenanceOpen}
          onOpenChange={setIsLogMaintenanceOpen}
          rentalId={propertyId}
        />
      )}

      {/* Self-Managed Connect Landlord Dialog */}
      {isSelfManaged && (
        <ConnectLandlordDialog
          open={isConnectLandlordOpen}
          onOpenChange={setIsConnectLandlordOpen}
          rentalId={propertyId}
          propertyTitle={displayTitle}
          initialLandlord={currentSelfManaged?.landlord}
        />
      )}

      {/* Safe Delete Property Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              {isSelfManaged ? t('Delete Self-Managed Rental?', 'சுய-நிர்வகிக்கப்பட்ட வாடகையை நீக்கவா?') : t('Delete Property?', 'சொத்தை நீக்கவா?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {isSelfManaged
                  ? t(
                      'Are you sure you want to permanently delete this private rental record? Your recorded payments, maintenance entries, and documents will be permanently removed.',
                      'இந்த தனிப்பட்ட வாடகை பதிவை நிரந்தரமாக நீக்க விரும்புகிறீர்களா?'
                    )
                  : t(
                      'Are you sure you want to permanently delete this property? This action cannot be undone.',
                      'இந்தச் சொத்தை நிரந்தரமாக நீக்க விரும்புகிறீர்களா? இந்தச் செயலைத் தவிர்க்க முடியாது.'
                    )}
              </p>
              {!isSelfManaged && isOccupied && (
                <p className="text-rose-600 font-medium">
                  {t('Warning: Property is occupied by a tenant and cannot be deleted.', 'எச்சரிக்கை: சொத்தில் குத்தகைதாரர் உள்ளார்.')}
                </p>
              )}
              {!isSelfManaged && isUnderContract && (
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
              disabled={!isSelfManaged && (isOccupied || isUnderContract)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSelfManaged ? t('Delete Rental Record', 'வாடகை பதிவை நீக்கு') : t('Delete Property', 'சொத்தை நீக்கு')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
