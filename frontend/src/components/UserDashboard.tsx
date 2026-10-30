import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  useRejectRequest,
  useVerifyRequestPayment,
  useGetTenantAgreements,
  useGetSelfManagedRentals
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
  ArrowRight,
  LayoutGrid,
  User,
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
  MapPin,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Link2
} from 'lucide-react';
import OwnerDashboard from './OwnerDashboard';
import CustomerDashboard from './CustomerDashboard';
import PropertyFullScreenView from './PropertyFullScreenView';
import PropertyForm from './PropertyForm';
import RequestDetailsModal from './RequestDetailsModal';
import AddExistingRentalDialog from './AddExistingRentalDialog';
import ListingControlsDialog from './ListingControlsDialog';
import SubmitPaymentModal from './SubmitPaymentModal';
import RejectPaymentModal from './RejectPaymentModal';
import { PropertyRequest, Property } from '../types';

interface UserDashboardProps {
  onBrowseProperties?: (transactionType: 'rent' | 'buy') => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedPropertyId?: string | null;
  onSelectProperty?: (propertyId: string | null) => void;
  initialPropertySection?: 'owned' | 'rents';
}

export type UserDashboardTab =
  | 'overview'
  | 'properties'
  | 'my-requests'
  | 'incoming-requests'
  | 'transactions'
  | 'notifications'
  | 'reports'
  | 'announcements'
  | 'settings';

export default function UserDashboard({
  onBrowseProperties,
  activeTab,
  onTabChange,
  selectedPropertyId,
  onSelectProperty,
  initialPropertySection = 'owned'
}: UserDashboardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: rawMyProperties = [] } = useGetMyProperties();
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (rawMyProperties && rawMyProperties.length > 0) {
      setProperties(rawMyProperties);
    }
  }, [rawMyProperties]);

  const myProperties = properties.length > 0 ? properties : rawMyProperties;

  const onUpdateProperty = (propId: string, updates: Partial<Property>) => {
    setProperties((prev) =>
      prev.map((p) => {
        const id = (p as any)?._id || p?.id;
        return id === propId || p.id === propId ? { ...p, ...updates } : p;
      })
    );

    try {
      const storedKeys = ['myProperties', 'properties', 'reSideAI_properties'];
      storedKeys.forEach((key) => {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((p: any) => {
              const id = p?._id || p?.id;
              return id === propId || p.id === propId ? { ...p, ...updates } : p;
            });
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
      });
    } catch (e) {
      console.warn('localStorage update failed', e);
    }

    queryClient.setQueryData(['myProperties'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((p: any) => {
        const id = p?._id || p?.id;
        return id === propId || p.id === propId ? { ...p, ...updates } : p;
      });
    });
  };
  const { data: tenantAgreements = [] } = useGetTenantAgreements();
  const { data: ownerRequests = [] } = useGetOwnerRequests();
  const { data: tenantRequests = [] } = useGetTenantRequests();
  const { data: selfManagedRentals = [] } = useGetSelfManagedRentals();
  const { data: announcements = [] } = useAnnouncements();
  const { data: notificationData } = useGetNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const approveRequestMutation = useApproveRequest();
  const rejectRequestMutation = useRejectRequest();
  const verifyPaymentMutation = useVerifyRequestPayment();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const notifications = notificationData?.notifications || [];
  const unreadNotifications = notifications.filter((n: any) => !n.isRead && !n.read);
  const unreadCount = notifications.length > 0 ? unreadNotifications.length : 0;

  const getInitialSection = (): 'owned' | 'rents' => {
    if (initialPropertySection) return initialPropertySection;
    if (activeTab === 'rentals' || activeTab === 'my-requests' || activeTab === 'requests') return 'rents';
    if (activeTab === 'incoming-requests') return 'owned';
    if (activeTab === 'transactions') return 'rents';
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sec = urlParams.get('section');
        if (sec === 'rents' || sec === 'owned') return sec as any;
      } catch {}
    }
    return 'owned';
  };

  const [propertySection, setPropertySection] = useState<'owned' | 'rents'>(getInitialSection);

  useEffect(() => {
    if (initialPropertySection) {
      setPropertySection(initialPropertySection);
    }
  }, [initialPropertySection]);

  useEffect(() => {
    if (activeTab === 'rentals' || activeTab === 'my-requests' || activeTab === 'requests') {
      setPropertySection('rents');
    } else if (activeTab === 'incoming-requests') {
      setPropertySection('owned');
    } else if (activeTab === 'transactions') {
      setPropertySection('rents');
    }
  }, [activeTab]);

  const getId = (item: any) => item?._id || item?.id;

  const [selectedOwnedId, setSelectedOwnedId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isAddRentalOpen, setIsAddRentalOpen] = useState(false);
  const [isListingSettingsOpen, setIsListingSettingsOpen] = useState(false);
  const [rentalCategoryFilter, setRentalCategoryFilter] = useState<'all' | 'connected' | 'self_managed'>('all');

  // Derived tenant properties from tenantAgreements + tenantRequests for rent
  const tenantProperties = useMemo(() => {
    const list: any[] = [];
    const seenPropertyIds = new Set<string>();

    // 1. Established active agreements
    (tenantAgreements || []).forEach((ag: any) => {
      if (!ag) return;
      const propObj = ag.property && typeof ag.property === 'object' ? ag.property : {};
      const rawPropId = (typeof ag.property === 'string' ? ag.property : null) || propObj._id || propObj.id || ag._id;
      if (rawPropId) seenPropertyIds.add(String(rawPropId));

      const propTitle = propObj.title || ag.propertyTitle || ag.title || t('Rental Property', 'வாடகை சொத்து');
      const propLoc = propObj.location || propObj.address || ag.propertyLocation || ag.location || t('Rental Location', 'வாடகை இடம்');
      const propPrice = ag.rentAmount || propObj.price || 0;

      list.push({
        ...propObj,
        _id: rawPropId,
        id: rawPropId,
        title: propTitle,
        location: propLoc,
        price: propPrice,
        transactionType: 'rent',
        status: ag.status === 'active' ? 'occupied' : (ag.status || 'occupied'),
        _agreement: ag,
        isPendingRental: false,
      });
    });

    // 2. Pending or active rental requests not yet finalized into active agreements
    (tenantRequests || []).forEach((req: any) => {
      if (!req || req.type !== 'rent') return;
      const propObj = req.property && typeof req.property === 'object' ? req.property : {};
      const rawPropId = (typeof req.property === 'string' ? req.property : null) || propObj._id || propObj.id || req._id;
      if (!rawPropId || seenPropertyIds.has(String(rawPropId))) return;

      seenPropertyIds.add(String(rawPropId));
      const propTitle = propObj.title || t('Rental Application', 'வாடகை விண்ணப்பம்');
      const propLoc = propObj.location || propObj.address || '';
      const propPrice = req.agreedAmount || req.offerAmount || propObj.price || 0;

      list.push({
        ...propObj,
        _id: rawPropId,
        id: rawPropId,
        title: propTitle,
        location: propLoc,
        price: propPrice,
        transactionType: 'rent',
        status: req.status,
        _request: req,
        isPendingRental: true,
        rentalMode: 'connected',
        isSelfManaged: false,
      });
    });

    // 3. Self-managed rentals created directly by current tenant
    (selfManagedRentals || []).forEach((smr: any) => {
      if (!smr) return;
      const smrId = smr._id || smr.id;
      if (!smrId || seenPropertyIds.has(String(smrId))) return;
      seenPropertyIds.add(String(smrId));

      const propTitle = smr.propertyTitle || t('Self-Managed Rental', 'சுய-நிர்வகிக்கப்பட்ட வாடகை');
      const propLoc = `${smr.address || ''}${smr.city ? ', ' + smr.city : ''}${smr.postalCode ? ' - ' + smr.postalCode : ''}`.trim() || t('Self-Managed Rental Location', 'வாடகை இடம்');
      const propPrice = smr.monthlyRent || 0;

      list.push({
        _id: smrId,
        id: smrId,
        title: propTitle,
        location: propLoc,
        price: propPrice,
        transactionType: 'rent',
        propertyType: smr.propertyType,
        images: smr.image ? [smr.image] : [],
        status: smr.status || 'occupied',
        occupancyStatus: 'occupied',
        rentalMode: 'self_managed',
        isSelfManaged: true,
        _selfManaged: smr,
        isPendingRental: false,
      });
    });

    return list;
  }, [tenantAgreements, tenantRequests, selfManagedRentals, t]);

  // Synchronize selection with props or auto-detect section
  useEffect(() => {
    if (selectedPropertyId) {
      if (propertySection === 'owned') {
        const found = myProperties.find((p: any) => getId(p) === selectedPropertyId);
        if (found) {
          setSelectedOwnedId(selectedPropertyId);
          return;
        }
        const foundInTenant = tenantProperties.find((p: any) => getId(p) === selectedPropertyId);
        if (foundInTenant) {
          setPropertySection('rents');
          setSelectedTenantId(selectedPropertyId);
          return;
        }
      } else {
        const found = tenantProperties.find((p: any) => getId(p) === selectedPropertyId);
        if (found) {
          setSelectedTenantId(selectedPropertyId);
          return;
        }
        const foundInOwned = myProperties.find((p: any) => getId(p) === selectedPropertyId);
        if (foundInOwned) {
          setPropertySection('owned');
          setSelectedOwnedId(selectedPropertyId);
          return;
        }
      }
    }
  }, [selectedPropertyId, propertySection, myProperties, tenantProperties]);

  // Auto-select first owned property when entering owned section if nothing selected
  useEffect(() => {
    if (myProperties.length > 0) {
      if (!selectedOwnedId || !myProperties.some((p: any) => getId(p) === selectedOwnedId)) {
        const firstId = getId(myProperties[0]);
        setSelectedOwnedId(firstId);
      }
    } else {
      setSelectedOwnedId(null);
    }
  }, [myProperties, selectedOwnedId]);

  const connectedRentalsCount = useMemo(() => {
    return tenantProperties.filter((p: any) => !p.isSelfManaged).length;
  }, [tenantProperties]);

  const selfManagedRentalsCount = useMemo(() => {
    return tenantProperties.filter((p: any) => !!p.isSelfManaged).length;
  }, [tenantProperties]);

  const filteredTenantProperties = useMemo(() => {
    if (rentalCategoryFilter === 'connected') {
      return tenantProperties.filter((p: any) => !p.isSelfManaged);
    }
    if (rentalCategoryFilter === 'self_managed') {
      return tenantProperties.filter((p: any) => !!p.isSelfManaged);
    }
    return tenantProperties;
  }, [tenantProperties, rentalCategoryFilter]);

  // Auto-select first tenant property when entering rents section if nothing selected
  useEffect(() => {
    if (filteredTenantProperties.length > 0) {
      if (!selectedTenantId || !filteredTenantProperties.some((p: any) => getId(p) === selectedTenantId)) {
        const firstId = getId(filteredTenantProperties[0]);
        setSelectedTenantId(firstId);
      }
    } else {
      setSelectedTenantId(null);
    }
  }, [filteredTenantProperties, selectedTenantId]);

  const activeOwnedProperty = useMemo(() => {
    if (!myProperties.length) return null;
    return myProperties.find((p: any) => getId(p) === selectedOwnedId) || myProperties[0];
  }, [myProperties, selectedOwnedId]);

  const activeTenantProperty = useMemo(() => {
    if (!filteredTenantProperties.length) return null;
    return filteredTenantProperties.find((p: any) => getId(p) === selectedTenantId) || filteredTenantProperties[0];
  }, [filteredTenantProperties, selectedTenantId]);

  const handleSelectOwnedProperty = (property: any) => {
    const id = getId(property);
    setSelectedOwnedId(id);
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('section', 'owned');
        window.history.replaceState({}, '', currentUrl.toString());
      } catch {}
    }
  };

  const handleSelectTenantProperty = (property: any) => {
    const id = getId(property);
    setSelectedTenantId(id);
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('section', 'rents');
        window.history.replaceState({}, '', currentUrl.toString());
      } catch {}
    }
  };

  const handleSwitchSection = (section: 'owned' | 'rents') => {
    setPropertySection(section);
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('section', section);
        window.history.replaceState({}, '', currentUrl.toString());
      } catch {}
    }
    if (section === 'owned') {
      const targetId = selectedOwnedId || (myProperties[0] ? getId(myProperties[0]) : null);
      if (targetId) setSelectedOwnedId(targetId);
    } else {
      const targetId = selectedTenantId || (tenantProperties[0] ? getId(tenantProperties[0]) : null);
      if (targetId) setSelectedTenantId(targetId);
    }
  };

  const normalizeTab = (tab?: string): UserDashboardTab => {
    if (!tab) return 'overview';
    if (tab === 'requests' || tab === 'my-requests') return 'properties';
    if (tab === 'incoming-requests') return 'properties';
    if (tab === 'transactions') return 'properties';
    if (tab === 'rentals') return 'properties';
    if (
      tab === 'properties' ||
      tab === 'notifications' ||
      tab === 'reports' ||
      tab === 'announcements' ||
      tab === 'settings' ||
      tab === 'overview'
    ) {
      return tab as UserDashboardTab;
    }
    return 'overview';
  };

  const [mainTab, setMainTabState] = useState<UserDashboardTab>(() => normalizeTab(activeTab));

  useEffect(() => {
    if (activeTab) {
      setMainTabState(normalizeTab(activeTab));
      if (activeTab === 'my-requests' || activeTab === 'requests') {
        setPropertySection('rents');
      } else if (activeTab === 'incoming-requests') {
        setPropertySection('owned');
      } else if (activeTab === 'transactions') {
        setPropertySection('rents');
      }
    }
  }, [activeTab]);

  const setMainTab = (v: UserDashboardTab) => {
    setMainTabState(v);
    if (onTabChange) {
      const urlTab = v === 'overview' ? '' : v;
      onTabChange(urlTab);
    }
  };

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

  // Pending purchase requests for buyer (Gopi)
  const pendingPurchaseRequests = useMemo(() => {
    return (tenantRequests || []).filter(
      (r: any) =>
        r.type === 'buy' &&
        ['Pending_Payment', 'Payment_Submitted', 'accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(r.status)
    );
  }, [tenantRequests]);

  // Customer category counts (Requirement 6)
  const customerCounts = useMemo(() => {
    const list = tenantRequests || [];
    return {
      all: list.length,
      pending: list.filter((r: any) => ['pending', 'counteroffer'].includes(r.status)).length,
      awaitingPayment: list.filter((r: any) => ['accepted', 'approved', 'terms_confirmed', 'Pending_Payment', 'Payment_Submitted', 'payment_pending'].includes(r.status)).length,
      completedRejected: list.filter((r: any) => ['completed', 'rejected', 'cancelled'].includes(r.status)).length,
    };
  }, [tenantRequests]);

  // Owner category counts (Requirement 6)
  const ownerCounts = useMemo(() => {
    const list = ownerRequests || [];
    return {
      all: list.length,
      pending: list.filter((r: any) => r.status === 'pending').length,
      awaitingPayment: list.filter((r: any) => ['accepted', 'approved', 'terms_confirmed', 'payment_pending', 'Pending_Payment', 'Payment_Submitted'].includes(r.status)).length,
      completed: list.filter((r: any) => r.status === 'completed').length,
    };
  }, [ownerRequests]);

  // Transactions list (accepted, terms_confirmed, payment_pending, completed)
  const activeTransactions = useMemo(() => {
    const list: Array<{ request: any; role: 'buyer' | 'owner' }> = [];
    (tenantRequests || []).forEach((r: any) => {
      if (['accepted', 'approved', 'terms_confirmed', 'payment_pending', 'Pending_Payment', 'Payment_Submitted', 'completed'].includes(r.status)) {
        list.push({ request: r, role: 'buyer' });
      }
    });
    (ownerRequests || []).forEach((r: any) => {
      if (['accepted', 'approved', 'terms_confirmed', 'payment_pending', 'Pending_Payment', 'Payment_Submitted', 'completed'].includes(r.status)) {
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

  const handleVerifyAndTransfer = async (req: any) => {
    try {
      await verifyPaymentMutation.mutateAsync(req._id);
      toast.success(
        req.type === 'buy'
          ? t('Payment verified! Ownership transferred to buyer.', 'கட்டணம் சரிபார்க்கப்பட்டு உரிமை மாற்றப்பட்டது.')
          : t('Payment verified successfully.', 'கட்டணம் சரிபார்க்கப்பட்டது.')
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to verify payment', 'கட்டணத்தை சரிபார்க்க முடியவில்லை'));
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
      case 'Pending_Payment':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 text-[11px] px-2 py-0.5 font-medium">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending Payment', 'கட்டணம் நிலுவையில்')}
          </Badge>
        );
      case 'Payment_Submitted':
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
      const targetReq = fullRequest || (typeof notif.request === 'object' ? notif.request : null);
      if (targetReq) {
        setSelectedRequest(targetReq);
        const isOwner = targetReq.owner === (userProfile as any)?._id || targetReq.owner?._id === (userProfile as any)?._id;

        // If buyer received offer acceptance or payment rejection notification, trigger payment modal directly
        if (!isOwner && (
          notif.type === 'request_accepted' ||
          notif.type === 'payment_rejected' ||
          notif.title?.toLowerCase().includes('payment required') ||
          notif.title?.toLowerCase().includes('offer accepted') ||
          targetReq.status === 'Pending_Payment'
        )) {
          setIsPaymentModalOpen(true);
          return;
        }

        // If owner received payment submitted notification, open incoming requests tab
        if (isOwner && (notif.type === 'payment_submitted' || targetReq.status === 'Payment_Submitted')) {
          setMainTab('incoming-requests');
          return;
        }

        const propId = getId(targetReq.property);
        setMainTab('properties');
        if (isOwner) {
          setPropertySection('owned');
          if (propId) setSelectedOwnedId(propId);
        } else {
          setPropertySection('rents');
          if (propId) setSelectedTenantId(propId);
        }
      }
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-58px)] bg-gradient-to-b from-[#f0f6ff]/60 via-slate-50/50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-3 sm:py-5 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 space-y-0">
      {/* Main Unified Navigation Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="w-full space-y-0">
        {/* Compact Container Architecture: Container 1 (Banner) + Container 2 (Primary Tabs) */}

        {/* Container 1: Welcome Banner (Desktop height approx 140-160px, rounded 16px, soft blue gradient, building image on right) */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 dark:border-blue-900/40 bg-gradient-to-r from-[#d9ebff]/90 via-[#e4f0ff]/80 to-[#eff6ff]/50 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 p-5 sm:p-6 shadow-xs min-h-[145px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Residential Building Background restricted to right portion */}
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[46%] pointer-events-none overflow-hidden select-none">
            <img
              src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80"
              alt="Modern residential building"
              className="w-full h-full object-cover object-center opacity-85 [mask-image:linear-gradient(to_left,black_60%,transparent_100%)]"
            />
            <div className="absolute inset-0 bg-blue-500/10 mix-blend-multiply" />
          </div>

          {/* Left section: Welcome Back, Customer, Badges, Description */}
          <div className="relative z-10 space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>{t('WELCOME BACK', 'மீண்டும் வருக')}</span>
              <span className="w-6 h-0.5 bg-slate-400/60 inline-block rounded-full" />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1736] dark:text-white tracking-tight leading-none">
                {userProfile?.name || 'Customer'}
              </h1>
              <Badge className="bg-blue-500/15 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {getPurposeLabel(registrationPurpose)}
              </Badge>
              <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {t('Unified Account', 'ஒருங்கிணைந்த கணக்கு')}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal leading-relaxed pt-0.5">
              {t(
                'Buy, rent, sell, or lease from one unified hub with complete transaction security and verified payment workflow.',
                'ஒரே மையத்திலிருந்து வாங்கலாம், வாடகைக்கு எடுக்கலாம், விற்கலாம் மற்றும் கட்டணங்களை சரிபார்க்கலாம்.'
              )}
            </p>
          </div>

          {/* Right section: 3 action buttons */}
          <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrowseProperties?.('rent')}
              className="h-10 bg-white/95 hover:bg-white text-[#0B1736] dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 text-xs font-semibold shadow-xs flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <span className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Home className="h-4 w-4" />
              </span>
              <span>{t('Browse to Rent', 'வாடகைக்கு தேட')}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrowseProperties?.('buy')}
              className="h-10 bg-white/95 hover:bg-white text-[#0B1736] dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 text-xs font-semibold shadow-xs flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <span className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Building className="h-4 w-4" />
              </span>
              <span>{t('Browse to Buy', 'வாங்க தேட')}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>

            <Button
              size="sm"
              onClick={() => setIsPropertyFormOpen(true)}
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 text-xs font-semibold shadow-sm flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>{t('List Property', 'சொத்தை பட்டியலிடு')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Container 2: Primary Navigation Tabs (Unified white container, equal-width tabs, pale cyan active highlight) */}
        <TabsList className="w-full border border-slate-200/80 dark:border-sky-500/20 dark:bg-[#07111e]/80 rounded-2xl shadow-xs dark:shadow-xl dark:shadow-black/40 p-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1">
          <TabsTrigger
            value="overview"
            className="h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all duration-200 data-[state=active]:bg-[#e0f2fe]/75 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-300 data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <LayoutGrid className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>{t('Overview', 'கண்ணோட்டம்')}</span>
          </TabsTrigger>

          <TabsTrigger
            value="properties"
            className="h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all duration-200 data-[state=active]:bg-[#e0f2fe]/75 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-300 data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Building className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            <span>{t('My Properties', 'என் சொத்துக்கள்')}</span>
            {(myProperties.length > 0 || tenantProperties.length > 0) && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 h-4 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                {myProperties.length + tenantProperties.length}
              </Badge>
            )}
            {pendingOwnerRequests > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-4 text-[10px] font-bold rounded-full">
                {pendingOwnerRequests}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="notifications"
            className="h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all duration-200 data-[state=active]:bg-[#e0f2fe]/75 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-300 data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span>{t('Notifications', 'அறிவிப்புகள்')}</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-0.5 px-1.5 py-0 h-4 text-[10px] rounded-full font-bold">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all duration-200 data-[state=active]:bg-[#e0f2fe]/75 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-300 data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span>{t('Reports', 'அறிக்கைகள்')}</span>
          </TabsTrigger>

          <TabsTrigger
            value="settings"
            className="h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all duration-200 data-[state=active]:bg-[#e0f2fe]/75 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-300 data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span>{t('My Profile', 'என் சுயவிவரம்')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified Overview */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
              onClick={() => {
                setMainTab('properties');
                setPropertySection('rents');
              }}
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
              onClick={() => {
                setMainTab('properties');
                setPropertySection('owned');
              }}
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
              onClick={() => {
                setMainTab('properties');
                const hasTenantTx = tenantProperties.some(p => p._request);
                if (hasTenantTx) setPropertySection('rents');
                else setPropertySection('owned');
              }}
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
                    onClick={() => {
                      setMainTab('properties');
                      setPropertySection('rents');
                    }}
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
                    onClick={() => {
                      setMainTab('properties');
                      setPropertySection('owned');
                    }}
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
        <TabsContent value="properties" className="mt-0 space-y-3.5">
          {/* Container 3: Property Category Toolbar */}
          <div className="w-full min-h-[52px] glass-panel bg-white/80 dark:bg-[#0a1628]/85 dark:backdrop-blur-xl border border-slate-200/80 dark:border-sky-500/20 rounded-2xl px-3 sm:px-4 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs dark:shadow-xl dark:shadow-black/40 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap self-start md:self-auto">
              <div className="inline-flex p-1 bg-slate-100/80 dark:bg-[#07111e]/80 rounded-xl gap-1 flex-wrap border border-slate-200/50 dark:border-sky-500/20">
                <button
                  type="button"
                  id="tab-property-owned"
                  onClick={() => handleSwitchSection('owned')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    propertySection === 'owned'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/40 font-bold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Home className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{t('Property Owned', 'சொத்து உரிமையாளர்')}</span>
                  {myProperties.length > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                      {myProperties.length}
                    </Badge>
                  )}
                  {pendingOwnerRequests > 0 && (
                    <Badge variant="destructive" className="px-1.5 py-0 h-4 text-[10px] font-bold">
                      {pendingOwnerRequests}
                    </Badge>
                  )}
                </button>

                <button
                  type="button"
                  id="tab-my-rents"
                  onClick={() => handleSwitchSection('rents')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    propertySection === 'rents'
                      ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('My Rents', 'எனது வாடகைகள்')}</span>
                  {tenantProperties.length > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {tenantProperties.length}
                    </Badge>
                  )}
                </button>
              </div>

              {/* Filter Category section - only visible when My Rents is active */}
              {propertySection === 'rents' && (
                <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 border-l border-slate-200 dark:border-sky-500/20">
                  <div
                    id="rental-category-filter"
                    data-testid="rental-category-filter"
                    className="inline-flex p-1 bg-slate-100/80 dark:bg-[#07111e]/80 rounded-xl gap-1 flex-wrap border border-slate-200/50 dark:border-sky-500/20"
                  >
                    <button
                      type="button"
                      onClick={() => setRentalCategoryFilter('all')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        rentalCategoryFilter === 'all'
                          ? 'bg-white text-foreground shadow-xs border border-slate-200/80 dark:bg-[#0f213d] dark:text-slate-100 dark:border-sky-400/20 font-bold'
                          : 'text-slate-600 hover:text-foreground dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <span>{t('All Rentals', 'அனைத்து வாடகைகள்')}</span>
                      <Badge
                        variant="secondary"
                        className={`px-1.5 py-0 h-4 text-[10px] font-bold ${
                          rentalCategoryFilter === 'all'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-muted dark:text-slate-400'
                        }`}
                      >
                        {tenantProperties.length}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRentalCategoryFilter('connected')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        rentalCategoryFilter === 'connected'
                          ? 'bg-white text-blue-700 dark:text-blue-300 shadow-xs border border-blue-200 dark:bg-blue-600/20 dark:border-blue-500/40 font-bold'
                          : 'text-slate-600 hover:text-foreground dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Link2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span>{t('Connected', 'இணைக்கப்பட்டது')}</span>
                      <Badge
                        variant="secondary"
                        className={`px-1.5 py-0 h-4 text-[10px] font-bold ${
                          rentalCategoryFilter === 'connected'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-muted dark:text-slate-400'
                        }`}
                      >
                        {connectedRentalsCount}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRentalCategoryFilter('self_managed')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        rentalCategoryFilter === 'self_managed'
                          ? 'bg-white text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200 dark:bg-emerald-600/20 dark:border-emerald-500/40 font-bold'
                          : 'text-slate-600 hover:text-foreground dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span>{t('Self-Managed', 'சுய-நிர்வகிக்கப்பட்டது')}</span>
                      <Badge
                        variant="secondary"
                        className={`px-1.5 py-0 h-4 text-[10px] font-bold ${
                          rentalCategoryFilter === 'self_managed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-muted dark:text-slate-400'
                        }`}
                      >
                        {selfManagedRentalsCount}
                      </Badge>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {propertySection === 'rents' ? (
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  size="sm"
                  onClick={() => setIsAddRentalOpen(true)}
                  className="gap-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold h-9 px-3.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Add Existing Rental', 'ஏற்கனவே உள்ள வாடகையை சேர்க்க')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsListingSettingsOpen(true)}
                  className="gap-1.5 text-xs rounded-xl border border-slate-200 dark:border-sky-500/20 bg-white dark:bg-[#0f213d]/70 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-sky-300 h-9 px-3.5 font-semibold hover:bg-slate-50 dark:hover:bg-[#132849] shadow-xs cursor-pointer transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  {t('Listing Controls', 'பட்டியல் கட்டுப்பாடுகள்')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  size="sm"
                  onClick={() => setIsPropertyFormOpen(true)}
                  className="gap-1.5 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold h-9 px-3.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Add Property', 'சொத்து சேர்க்க')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsListingSettingsOpen(true)}
                  className="gap-1.5 text-xs rounded-xl border border-slate-200 dark:border-sky-500/20 bg-white dark:bg-[#0f213d]/70 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-sky-300 h-9 px-3.5 font-semibold hover:bg-slate-50 dark:hover:bg-[#132849] shadow-xs cursor-pointer transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  {t('Listing Controls', 'பட்டியல் கட்டுப்பாடுகள்')}
                </Button>
              </div>
            )}
          </div>

          {/* Inline Management Workspace */}
          {propertySection === 'owned' ? (
            activeOwnedProperty ? (
              <div className="space-y-4">
                {pendingPurchaseRequests.length > 0 && (
                  <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                          {t('Pending Purchase Payments', 'நிலுவையில் உள்ள கொள்முதல் கட்டணங்கள்')}
                        </h4>
                        <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.2">
                          {pendingPurchaseRequests.length}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300">
                        {t('Complete payment to transfer deed into your portfolio', 'உரிமை மாற்றத்தை முடிக்க கட்டணத்தை செலுத்துங்கள்')}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {pendingPurchaseRequests.map((req: any) => {
                        const isAwaitingVerification = req.status === 'Payment_Submitted' || req.status === 'payment_pending';
                        const isRejected = req.paymentDetails?.status === 'rejected' || !!req.rejectionReason;

                        return (
                          <div
                            key={req._id}
                            className="p-3 rounded-xl bg-white dark:bg-[#0a1628]/85 dark:backdrop-blur-xl border border-amber-200 dark:border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs dark:shadow-xl dark:shadow-black/40"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-xs sm:text-sm font-bold text-foreground truncate max-w-xs">
                                  {req.property?.title || 'Property'}
                                </h5>
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                  {req.property?.propertyType || 'Purchase'}
                                </Badge>
                                {isAwaitingVerification ? (
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 text-[10px]">
                                    <Clock className="w-2.5 h-2.5 mr-1 inline" />
                                    {t('Payment Submitted (Waiting for Seller Verification)', 'கட்டணம் சமர்ப்பிக்கப்பட்டது')}
                                  </Badge>
                                ) : isRejected ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <XCircle className="w-2.5 h-2.5 mr-1 inline" />
                                    {t('Payment Rejected', 'கட்டணம் நிராகரிக்கப்பட்டது')}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-600 text-white text-[10px]">
                                    <Clock className="w-2.5 h-2.5 mr-1 inline" />
                                    {t('Offer Accepted — Payment Required', 'சலுகை ஏற்கப்பட்டது')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('Seller:', 'விற்பனையாளர்:')} <b>{req.owner?.name || 'Naveen'}</b> • {t('Agreed Price:', 'விலை:')} <b>₹{Number(req.agreedAmount || req.offerAmount || req.property?.price || 0).toLocaleString('en-IN')}</b>
                              </p>
                              {isRejected && (
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium italic">
                                  {t('Reason: ', 'காரணம்: ')}"{req.rejectionReason || req.paymentDetails?.rejectionReason}"
                                </p>
                              )}
                              {isAwaitingVerification && req.paymentDetails?.transactionId && (
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  UTR: <b className="text-indigo-600 dark:text-indigo-400">{req.paymentDetails.transactionId}</b> ({req.paymentDetails.mode || 'UPI'})
                                </p>
                              )}
                            </div>

                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl h-8 px-3.5 shrink-0 shadow-xs"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              {isAwaitingVerification
                                ? t('Update Payment Details', 'கட்டண விவரங்களை மாற்றுக')
                                : isRejected
                                ? t('Re-submit Payment', 'மீண்டும் சமர்ப்பி')
                                : t('Proceed to Payment', 'கட்டணம் செலுத்த தொடரவும்')}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <PropertyFullScreenView
                  property={activeOwnedProperty}
                  properties={myProperties}
                  selectedPropertyId={getId(activeOwnedProperty)}
                  onSelectProperty={handleSelectOwnedProperty}
                  isTenantView={false}
                />
              </div>
            ) : pendingPurchaseRequests.length > 0 ? (
              /* Gopi does NOT see an empty state after offer acceptance */
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-amber-950 dark:text-amber-100">
                          {t('Pending Purchase Payments', 'நிலுவையில் உள்ள கொள்முதல் கட்டணங்கள்')}
                        </h3>
                        <Badge className="bg-amber-600 text-white text-xs px-2 py-0.5">
                          {pendingPurchaseRequests.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90 max-w-xl">
                        {t(
                          'Your purchase offer has been accepted! Submit your payment reference to complete the deed transfer and add the property to your portfolio.',
                          'உங்கள் கொள்முதல் சலுகை ஏற்கப்பட்டது! உரிமை மாற்றத்தை முடித்து உங்கள் போர்ட்ஃபோலியோவில் சொத்தை சேர்க்க கட்டண குறிப்பை சமர்ப்பிக்கவும்.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {pendingPurchaseRequests.map((req: any) => {
                      const isAwaitingVerification = req.status === 'Payment_Submitted' || req.status === 'payment_pending';
                      const isRejected = req.paymentDetails?.status === 'rejected' || !!req.rejectionReason;

                      return (
                        <div
                          key={req._id}
                          className="p-4 rounded-xl bg-white dark:bg-[#0a1628]/85 dark:backdrop-blur-xl border border-amber-200 dark:border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs dark:shadow-xl dark:shadow-black/40"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-foreground truncate max-w-sm">
                                {req.property?.title || 'Property'}
                              </h4>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                {req.property?.propertyType || 'Purchase'}
                              </Badge>
                              {isAwaitingVerification ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 text-xs px-2.5 py-0.5 font-medium">
                                  <Clock className="w-3 h-3 mr-1 inline" />
                                  {t('Payment Submitted (Waiting for Seller Verification)', 'கட்டணம் சமர்ப்பிக்கப்பட்டது')}
                                </Badge>
                              ) : isRejected ? (
                                <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                                  <XCircle className="w-3 h-3 mr-1 inline" />
                                  {t('Payment Rejected', 'கட்டணம் நிராகரிக்கப்பட்டது')}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5 font-semibold">
                                  <Clock className="w-3 h-3 mr-1 inline" />
                                  {t('Offer Accepted — Payment Required', 'சலுகை ஏற்கப்பட்டது')}
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{req.property?.location || '-'}</span>
                            </p>

                            <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                              <span>
                                <span className="text-muted-foreground">{t('Seller:', 'விற்பனையாளர்:')} </span>
                                <b>{req.owner?.name || 'Naveen'}</b>
                              </span>
                              <span>
                                <span className="text-muted-foreground">{t('Agreed Purchase Amount:', 'ஒப்பந்தத் தொகை:')} </span>
                                <b className="text-emerald-700 dark:text-emerald-400">
                                  ₹{Number(req.agreedAmount || req.offerAmount || req.property?.price || 0).toLocaleString('en-IN')}
                                </b>
                              </span>
                            </div>

                            {isRejected && (
                              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                                <div>
                                  <span className="font-semibold">{t('Seller Note: ', 'விற்பனையாளர் குறிப்பு: ')}</span>
                                  <span>"{req.rejectionReason || req.paymentDetails?.rejectionReason}"</span>
                                </div>
                              </div>
                            )}

                            {isAwaitingVerification && req.paymentDetails?.transactionId && (
                              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-mono bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-0.5 rounded inline-block">
                                Bank UTR / UPI Ref: <b>{req.paymentDetails.transactionId}</b> ({req.paymentDetails.mode || 'UPI'})
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl h-9 px-4 shadow-sm"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              {isAwaitingVerification
                                ? t('Update Payment Details', 'கட்டண விவரங்களை மாற்றுக')
                                : isRejected
                                ? t('Re-submit Payment', 'மீண்டும் சமர்ப்பி')
                                : t('Proceed to Payment', 'கட்டணம் செலுத்த தொடரவும்')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl glass-panel bg-card/60 border border-border/60 p-8 sm:p-12 text-center space-y-3">
                <Building className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-base font-semibold text-foreground">
                  {t('No owned properties found', 'சொத்துக்கள் எதுவும் இல்லை')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {t('You have not added any properties to your portfolio yet. Add your first property to start managing listings, tenant agreements, and rent collection.', 'உங்கள் முதல் சொத்தைச் சேர்த்து பட்டியல்கள் மற்றும் குத்தகைதாரர்களை நிர்வகிக்கத் தொடங்குங்கள்.')}
                </p>
                <Button onClick={() => setIsPropertyFormOpen(true)} className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  {t('List New Property', 'புதிய சொத்து சேர்க்க')}
                </Button>
              </div>
            )
          ) : (
            filteredTenantProperties.length > 0 && activeTenantProperty ? (
              <PropertyFullScreenView
                property={activeTenantProperty}
                properties={filteredTenantProperties}
                selectedPropertyId={getId(activeTenantProperty)}
                onSelectProperty={handleSelectTenantProperty}
                isTenantView={true}
                tenantAgreement={activeTenantProperty?._agreement}
                activeRequest={activeTenantProperty?._request}
              />
            ) : tenantProperties.length === 0 ? (
              <div className="rounded-2xl glass-panel bg-card/60 border border-border/60 p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <KeyRound className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {t('Manage Your Rentals in One Place', 'உங்கள் வாடகைகளை ஒரே இடத்தில் நிர்வகிக்கவும்')}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'You can manage your rental information, rent schedule, payment history, receipts, lease dates, and maintenance expenses here — even if your landlord does not use reSide.',
                      'உங்கள் நிலப்பிரபு reSide ஐப் பயன்படுத்தாவிட்டாலும், உங்கள் வாடகை தகவல், கட்டண வரலாறு, ரசீதுகள் மற்றும் பராமரிப்புச் செலவுகளை நீங்கள் இங்கே நிர்வகிக்கலாம்.'
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                  <Button
                    onClick={() => setIsAddRentalOpen(true)}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('Add Existing Rental', 'ஏற்கனவே உள்ள வாடகையை சேர்க்க')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onBrowseProperties?.('rent')}
                    className="gap-1.5 text-xs rounded-xl"
                  >
                    <Home className="h-3.5 w-3.5 text-emerald-600" />
                    {t('Browse Rentals', 'வாடகைக்கு தேட')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl glass-panel bg-card/60 border border-border/60 p-8 text-center space-y-3">
                <KeyRound className="h-9 w-9 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-semibold text-foreground">
                  {t('No rentals in this category', 'இந்த பிரிவில் வாடகைகள் எதுவும் இல்லை')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {rentalCategoryFilter === 'self_managed'
                    ? t('You have not added any self-managed rentals yet. Track your current home independently.', 'சுய-நிர்வகிக்கப்பட்ட வாடகைகள் எதுவும் இல்லை.')
                    : t('You do not have any connected platform rentals.', 'இணைக்கப்பட்ட வாடகைகள் எதுவும் இல்லை.')}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRentalCategoryFilter('all')}
                    className="text-xs rounded-xl"
                  >
                    {t('View All Rentals', 'அனைத்தையும் காட்டு')}
                  </Button>
                  {rentalCategoryFilter === 'self_managed' && (
                    <Button
                      size="sm"
                      onClick={() => setIsAddRentalOpen(true)}
                      className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('Add Existing Rental', 'வாடகையை சேர்க்க')}
                    </Button>
                  )}
                </div>
              </div>
            )
          )}
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
                        {['accepted', 'approved', 'terms_confirmed', 'Pending_Payment'].includes(req.status) && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsPaymentModalOpen(true);
                            }}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {t('Submit Payment Details', 'கட்டண விவரங்களை சமர்ப்பிக்கவும்')}
                          </Button>
                        )}
                        {(req.status === 'Payment_Submitted' || req.status === 'payment_pending') && (
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300 text-xs px-2.5 py-1 font-medium">
                            <Clock className="w-3 h-3 mr-1 inline" />
                            {t('Payment Submitted — Awaiting Verification', 'கட்டணம் சமர்ப்பிக்கப்பட்டது - சரிபார்ப்பு நிலுவையில்')}
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

                        {(req.status === 'Payment_Submitted' || req.status === 'payment_pending') && (
                          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                                <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
                                {t('Payment Submitted by Buyer', 'வாங்குபவர் சமர்ப்பித்த கட்டணம்')}
                              </span>
                              <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.2">
                                {req.paymentDetails?.mode || 'UPI'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                              <div>
                                <span className="text-[11px] text-muted-foreground block">{t('Amount Paid:', 'செலுத்தப்பட்ட தொகை:')}</span>
                                <b className="text-foreground">₹{Number(req.paymentDetails?.amount || req.agreedAmount || req.offerAmount || 0).toLocaleString('en-IN')}</b>
                              </div>
                              <div>
                                <span className="text-[11px] text-muted-foreground block">{t('Bank UTR / UPI Ref:', 'வங்கி UTR / UPI எண்:')}</span>
                                <b className="font-mono text-indigo-700 dark:text-indigo-300">{req.paymentDetails?.transactionId || '-'}</b>
                              </div>
                            </div>
                          </div>
                        )}

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
                        {(req.status === 'Payment_Submitted' || req.status === 'payment_pending') && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                              disabled={verifyPaymentMutation.isPending}
                              onClick={() => handleVerifyAndTransfer(req)}
                            >
                              {verifyPaymentMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              {t('Verify & Accept Payment', 'கட்டணத்தை சரிபார்த்து ஏற்கவும்')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 font-semibold gap-1.5"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsRejectModalOpen(true);
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {t('Reject Payment with Reason', 'காரணத்துடன் நிராகரிக்கவும்')}
                            </Button>
                          </>
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
                                onClick={() => {
                                  setMainTab('properties');
                                  setPropertySection('rents');
                                }}
                                className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                {t('View in My Rents', 'எனது வாடகைகளில் பார்க்க')}
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

        {/* Tab 7: Reports */}
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
        onNavigateToRentals={() => {
          setSelectedRequest(null);
          setMainTab('properties');
          setPropertySection('rents');
        }}
      />

      {/* Add Existing Rental Modal */}
      <AddExistingRentalDialog
        open={isAddRentalOpen}
        onOpenChange={setIsAddRentalOpen}
        onSuccess={(created) => {
          const newId = getId(created);
          if (newId) {
            setSelectedTenantId(newId);
            setPropertySection('rents');
            setRentalCategoryFilter('all');
          }
        }}
      />

      {/* Listing Controls & Tenant Management Modal */}
      <ListingControlsDialog
        open={isListingSettingsOpen}
        onOpenChange={setIsListingSettingsOpen}
        properties={myProperties}
        onUpdateProperty={onUpdateProperty}
      />

      {/* Gopi's Submit Payment Details Modal */}
      <SubmitPaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        request={selectedRequest}
      />

      {/* Naveen's Reject Payment with Reason Modal */}
      <RejectPaymentModal
        open={isRejectModalOpen}
        onOpenChange={setIsRejectModalOpen}
        request={selectedRequest}
      />
    </div>
  );
}
