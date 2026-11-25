import { useState, useMemo, useEffect, useRef } from 'react';
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
  useGetSelfManagedRentals,
  useGetAllProperties
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
  Link2,
  Search,
  SlidersHorizontal,
  Download,
  TrendingUp,
  Wallet,
  Receipt,
  Calendar,
  ArrowDownLeft,
  ArrowLeft,
  Building2,
  Users,
  Phone,
  Mail,
  Filter,
  MessageSquare
} from 'lucide-react';
import { useMessenger } from '../hooks/useMessenger';
import OwnerDashboard from './OwnerDashboard';
import CustomerDashboard from './CustomerDashboard';
import ProfileSettingsView from './ProfileSettingsView';
import PropertyFullScreenView, { PropertySectionKey } from './PropertyFullScreenView';
import PropertyForm from './PropertyForm';
import AddSelfManagedPropertyDialog from './AddSelfManagedPropertyDialog';
import RequestDetailsModal from './RequestDetailsModal';
import AddExistingRentalDialog from './AddExistingRentalDialog';
import ListingControlsDialog from './ListingControlsDialog';
import SubmitPaymentModal from './SubmitPaymentModal';
import RejectPaymentModal from './RejectPaymentModal';
import PaymentDialog from './PaymentDialog';
import { generateReceipt } from '../utils/receiptGenerator';
import api from '../lib/api';
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
  const { data: userProfile, refetch: refetchUserProfile } = useGetCallerUserProfile();
  const { data: rawMyProperties = [] } = useGetMyProperties();
  const { data: allPublicProperties = [] } = useGetAllProperties();
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

  type NotificationFilter = 'all' | 'unread' | 'read' | 'agreements' | 'payments' | 'requests';
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');
  const [isNotifFilterOpen, setIsNotifFilterOpen] = useState(false);
  const notifFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifFilterRef.current && !notifFilterRef.current.contains(event.target as Node)) {
        setIsNotifFilterOpen(false);
      }
    };
    if (isNotifFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifFilterOpen]);

  const readCount = useMemo(() => {
    return notifications.filter((n: any) => Boolean(n.read || n.isRead)).length;
  }, [notifications]);

  const agreementsCount = useMemo(() => {
    return notifications.filter((n: any) => {
      const t = String(n.type || '').toUpperCase();
      return (
        t.includes('AGREEMENT') ||
        n.title?.toLowerCase().includes('agreement') ||
        n.message?.toLowerCase().includes('agreement')
      );
    }).length;
  }, [notifications]);

  const paymentsCount = useMemo(() => {
    return notifications.filter((n: any) => {
      const t = String(n.type || '').toLowerCase();
      return (
        t.includes('payment') ||
        t.includes('counter') ||
        n.title?.toLowerCase().includes('payment') ||
        n.message?.toLowerCase().includes('payment')
      );
    }).length;
  }, [notifications]);

  const requestsCount = useMemo(() => {
    return notifications.filter((n: any) => {
      const t = String(n.type || '').toLowerCase();
      return (
        t.includes('request') ||
        t.includes('offer') ||
        t.includes('accept') ||
        t.includes('reject') ||
        n.title?.toLowerCase().includes('request') ||
        n.title?.toLowerCase().includes('offer')
      );
    }).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'unread') {
      return notifications.filter((n: any) => !n.read && !n.isRead);
    }
    if (notifFilter === 'read') {
      return notifications.filter((n: any) => Boolean(n.read || n.isRead));
    }
    if (notifFilter === 'agreements') {
      return notifications.filter((n: any) => {
        const t = String(n.type || '').toUpperCase();
        return (
          t.includes('AGREEMENT') ||
          n.title?.toLowerCase().includes('agreement') ||
          n.message?.toLowerCase().includes('agreement')
        );
      });
    }
    if (notifFilter === 'payments') {
      return notifications.filter((n: any) => {
        const t = String(n.type || '').toLowerCase();
        return (
          t.includes('payment') ||
          t.includes('counter') ||
          n.title?.toLowerCase().includes('payment') ||
          n.message?.toLowerCase().includes('payment')
        );
      });
    }
    if (notifFilter === 'requests') {
      return notifications.filter((n: any) => {
        const t = String(n.type || '').toLowerCase();
        return (
          t.includes('request') ||
          t.includes('offer') ||
          t.includes('accept') ||
          t.includes('reject') ||
          n.title?.toLowerCase().includes('request') ||
          n.title?.toLowerCase().includes('offer')
        );
      });
    }
    return notifications;
  }, [notifications, notifFilter]);

  const getInitialSection = (): 'owned' | 'rents' => {
    if (initialPropertySection) return initialPropertySection === 'rents' ? 'rents' : 'owned';
    if (activeTab === 'rentals' || activeTab === 'my-requests' || activeTab === 'requests') return 'rents';
    if (activeTab === 'incoming-requests') return 'owned';
    if (activeTab === 'transactions') return 'rents';
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sec = urlParams.get('section');
        if (sec === 'rents' || sec === 'owned') return sec;
        if (sec === 'rentIn' || sec === 'rentOut') return 'rents';
      } catch { }
    }
    return 'owned';
  };

  const getInitialRentSubView = (): 'dashboard' | 'rentIn' | 'rentOut' => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sec = urlParams.get('section');
        const sub = urlParams.get('subview');
        if (sub === 'rentIn' || sec === 'rentIn') return 'rentIn';
        if (sub === 'rentOut' || sec === 'rentOut') return 'rentOut';
      } catch { }
    }
    return 'dashboard';
  };

  const [propertySection, setPropertySection] = useState<'owned' | 'rents'>(getInitialSection);
  const [rentSubView, setRentSubView] = useState<'dashboard' | 'rentIn' | 'rentOut'>(getInitialRentSubView);

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
  const [propertySectionTab, setPropertySectionTab] = useState<PropertySectionKey>('overview');
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
      const rawPropId = (typeof ag.property === 'string' ? ag.property : null) || propObj._id || propObj.id || ag.propertyId;
      if (!rawPropId) return;

      const matchedProp = (allPublicProperties || []).find((p: any) => String(p._id || p.id) === String(rawPropId)) ||
        (myProperties || []).find((p: any) => String(p._id || p.id) === String(rawPropId)) || {};

      const propTitle = propObj.title || matchedProp.title;
      // If the property has been deleted from the database (no title and no property in active lists), do not display
      if (!propTitle) return;

      seenPropertyIds.add(String(rawPropId));

      const propLoc = propObj.location || propObj.address || matchedProp.location || matchedProp.address || ag.propertyLocation || ag.location || t('Rental Location', 'வாடகை இடம்');
      const propPrice = ag.rentAmount || propObj.price || matchedProp.price || 0;
      const propAmenities = (propObj.amenities && propObj.amenities.length > 0) ? propObj.amenities : (matchedProp.amenities || []);
      const propDescription = propObj.description || matchedProp.description || '';

      list.push({
        ...matchedProp,
        ...propObj,
        amenities: propAmenities,
        description: propDescription,
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
      // If the property was deleted from DB (req.property is null or undefined), do not show
      if (!req.property) return;

      const propObj = typeof req.property === 'object' ? req.property : {};
      const rawPropId = (typeof req.property === 'string' ? req.property : null) || propObj._id || propObj.id;
      if (!rawPropId || seenPropertyIds.has(String(rawPropId))) return;

      const matchedProp = (allPublicProperties || []).find((p: any) => String(p._id || p.id) === String(rawPropId)) ||
        (myProperties || []).find((p: any) => String(p._id || p.id) === String(rawPropId)) || {};

      const propTitle = propObj.title || matchedProp.title;
      // Never synthesize a dummy phantom property if the property was removed from the database
      if (!propTitle) return;

      seenPropertyIds.add(String(rawPropId));

      const propLoc = propObj.location || propObj.address || matchedProp.location || matchedProp.address || '';
      const propPrice = req.agreedAmount || req.offerAmount || propObj.price || matchedProp.price || 0;
      const propAmenities = (propObj.amenities && propObj.amenities.length > 0) ? propObj.amenities : (matchedProp.amenities || []);
      const propDescription = propObj.description || matchedProp.description || '';

      list.push({
        ...matchedProp,
        ...propObj,
        amenities: propAmenities,
        description: propDescription,
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
  }, [tenantAgreements, tenantRequests, selfManagedRentals, allPublicProperties, myProperties, t]);

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

  const [propertySearchText, setPropertySearchText] = useState('');
  const [rentLedgerTab, setRentLedgerTab] = useState<'payable' | 'receivable'>('payable');
  const [rentsActiveSection, setRentsActiveSection] = useState<PropertySectionKey>('overview');
  const [rentFlowMode, setRentFlowMode] = useState<'in' | 'out'>('out');
  const [rentedOutSubTab, setRentedOutSubTab] = useState<'receivable' | 'tenancies'>('receivable');
  const [tenantRentRecords, setTenantRentRecords] = useState<any[]>([]);
  const [ownerAgreements, setOwnerAgreements] = useState<any[]>([]);
  const [loadingRentRecords, setLoadingRentRecords] = useState(false);
  const [ownerRentSummary, setOwnerRentSummary] = useState<any>(null);
  const [selectedRecordForPayment, setSelectedRecordForPayment] = useState<any>(null);
  const [isPayNowDialogOpen, setIsPayNowDialogOpen] = useState(false);
  const [detailedViewProperty, setDetailedViewProperty] = useState<any>(null);

  const fetchLedgerData = async () => {
    try {
      setLoadingRentRecords(true);
      const [tenantRes, ownerRes, agreementsRes] = await Promise.allSettled([
        api.get('/payments/tenant/records'),
        api.get('/payments/owner/summary'),
        api.get('/agreements/owner')
      ]);
      if (tenantRes.status === 'fulfilled' && Array.isArray(tenantRes.value.data)) {
        setTenantRentRecords(tenantRes.value.data);
      }
      if (ownerRes.status === 'fulfilled' && ownerRes.value.data) {
        setOwnerRentSummary(ownerRes.value.data);
      }
      if (agreementsRes.status === 'fulfilled' && Array.isArray(agreementsRes.value.data)) {
        setOwnerAgreements(agreementsRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching ledger data:', err);
    } finally {
      setLoadingRentRecords(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const payableItems = useMemo(() => {
    const items: any[] = [];
    const seenPropertyIds = new Set<string>();

    // 1. From tenantRentRecords
    (tenantRentRecords || []).forEach((rec: any) => {
      const id = rec._id || rec.id;
      const propObj = rec.property && typeof rec.property === 'object' ? rec.property : {};
      const propId = getId(propObj) || getId(rec.property);
      if (!propObj.title && !rec.propertyTitle) return;
      if (propId) seenPropertyIds.add(String(propId));

      const o = rec.owner && typeof rec.owner === 'object' ? rec.owner : {};
      const rentAmt = Number(rec.rentAmount || propObj.price || 0);
      const totalPaid = Number(rec.totalPaid || 0);
      const balance = rec.balance !== undefined ? Number(rec.balance) : Math.max(0, rentAmt - totalPaid);
      const isPaid = rec.status === 'paid' || (totalPaid >= rentAmt && rentAmt > 0);
      const isOverdue = rec.status === 'overdue' || (rec.dueDate && new Date(rec.dueDate) < new Date() && !isPaid);

      items.push({
        id: id || propId,
        raw: rec,
        type: 'record',
        propertyTitle: propObj.title || t('Rental Apartment', 'வாடகை அடுக்குமாடி'),
        propertyLocation: propObj.location || '',
        thumbnail: propObj.images?.[0] || null,
        ownerName: o.name || t('Landlord', 'நில உரிமையாளர்'),
        ownerContact: o.phone || o.email || '-',
        monthlyRent: rentAmt,
        monthlyMaintenance: Number(propObj.monthlyMaintenance || 0),
        amountPaid: totalPaid,
        balance,
        transactionId: rec.paymentDetails?.transactionId || (isPaid ? `TXN-${String(id || '').slice(-6).toUpperCase() || '689211'}` : '-'),
        paymentMethod: rec.paymentDetails?.mode || (isPaid ? 'UPI' : '-'),
        paymentDate: rec.paymentDetails?.date || rec.updatedAt || rec.month,
        dueDate: rec.dueDate || rec.month,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'due_soon',
      });
    });

    // 2. From tenantProperties (active agreements or self-managed rentals without explicit rent records)
    (tenantProperties || []).forEach((tp: any) => {
      const tpId = getId(tp);
      if (!tpId || seenPropertyIds.has(String(tpId))) return;
      seenPropertyIds.add(String(tpId));

      const smr = tp._selfManaged;
      const ag = tp._agreement;
      const rentAmt = Number(tp.price || smr?.monthlyRent || ag?.rentAmount || 0);
      const maintAmt = Number(smr?.maintenance || tp.monthlyMaintenance || 0);
      const ownerName = tp.ownerName || tp.owner?.name || smr?.landlordName || ag?.owner?.name || t('Landlord', 'நில உரிமையாளர்');
      const ownerPhone = tp.owner?.phone || smr?.landlordPhone || ag?.owner?.phone || '-';

      const smrPayments = smr?.payments || [];
      const latestPayment = smrPayments.length > 0 ? smrPayments[smrPayments.length - 1] : null;
      const isPaid = !!latestPayment && Number(latestPayment.amount) >= rentAmt;

      items.push({
        id: tpId,
        raw: tp,
        type: 'property',
        propertyTitle: tp.title,
        propertyLocation: tp.location,
        thumbnail: tp.images?.[0] || null,
        ownerName,
        ownerContact: ownerPhone,
        monthlyRent: rentAmt,
        monthlyMaintenance: maintAmt,
        amountPaid: isPaid ? Number(latestPayment.amount) : 0,
        balance: isPaid ? 0 : rentAmt,
        transactionId: latestPayment?.paymentId || (isPaid ? `TXN-${String(tpId).slice(-6).toUpperCase()}` : '-'),
        paymentMethod: latestPayment?.mode || (isPaid ? 'UPI' : '-'),
        paymentDate: latestPayment?.date || new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: isPaid ? 'paid' : 'due_soon',
      });
    });

    return items;
  }, [tenantRentRecords, tenantProperties, t]);

  const searchedPayableItems = useMemo(() => {
    if (!propertySearchText.trim()) return payableItems;
    const q = propertySearchText.toLowerCase();
    return payableItems.filter((it: any) =>
      String(it.propertyTitle || '').toLowerCase().includes(q) ||
      String(it.propertyLocation || '').toLowerCase().includes(q) ||
      String(it.ownerName || '').toLowerCase().includes(q)
    );
  }, [payableItems, propertySearchText]);

  const payableSummary = useMemo(() => {
    const totalPaid = payableItems.reduce((acc, it) => acc + (it.amountPaid || 0), 0);
    const pendingItems = payableItems.filter(it => it.status !== 'paid' && it.balance > 0);
    const totalPending = pendingItems.reduce((acc, it) => acc + (it.balance || 0), 0);
    const nextDue = pendingItems[0] || null;

    let nextDueDateFormatted = t('No upcoming dues', 'நிலுவை இல்லை');
    if (nextDue && nextDue.dueDate) {
      try {
        nextDueDateFormatted = new Date(nextDue.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        nextDueDateFormatted = String(nextDue.dueDate);
      }
    }

    return {
      totalPaid,
      totalPending,
      pendingCount: pendingItems.length,
      nextDueAmount: nextDue ? nextDue.balance : 0,
      nextDueDate: nextDueDateFormatted,
      nextDueLandlord: nextDue ? nextDue.ownerName : t('None', 'எதுவுமில்லை'),
      statusBadge: pendingItems.length === 0
        ? { text: t('All Dues Cleared', 'அனைத்தும் செலுத்தப்பட்டது'), variant: 'paid' }
        : pendingItems.some(it => it.status === 'overdue')
          ? { text: t('Overdue Payment', 'காலாவதியான கட்டணம்'), variant: 'overdue' }
          : { text: `${pendingItems.length} ${t('Payment Pending', 'கட்டணம் நிலுவையில்')}`, variant: 'pending' },
    };
  }, [payableItems, t]);

  const receivableItems = useMemo(() => {
    const items: any[] = [];

    const rentalProps = myProperties.filter((p: any) =>
      p.transactionType?.toLowerCase() === 'rent' ||
      p.transaction?.toLowerCase() === 'rent' ||
      p.occupancyStatus === 'occupied' ||
      !!p.tenant ||
      !!p.tenantName
    );

    rentalProps.forEach((p: any, idx: number) => {
      const pId = getId(p);
      const rentAmt = Number(p.price || 0);
      const isOcc = p.occupancyStatus === 'occupied' || !!p.tenant || !!p.tenantName;
      const tenantName = p.tenantName || p.tenant?.name || (isOcc ? t('Occupied Tenant', 'குத்தகைதாரர்') : t('Vacant', 'காலியாக'));
      const tenantPhone = p.tenant?.phone || p.tenant?.email || '-';

      const isReceived = isOcc;
      const receivedAmt = isReceived ? rentAmt : 0;

      items.push({
        id: pId || `rec-${idx}`,
        propertyTitle: p.title || t('Rental Property', 'வாடகை சொத்து'),
        propertyUnit: `${p.title}${p.location ? ' - ' + p.location.split(',')[0] : ''}`,
        thumbnail: p.images?.[0] || null,
        tenantName,
        tenantContact: tenantPhone,
        expectedRent: rentAmt,
        receivedAmount: receivedAmt,
        paymentDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        paymentMode: isReceived ? 'UPI / Net Banking' : t('Awaiting Transfer', 'பரிமாற்றம் நிலுவையில்'),
        status: isReceived ? 'received' : 'awaiting',
        raw: p,
      });
    });

    return items;
  }, [myProperties, t]);

  const searchedReceivableItems = useMemo(() => {
    if (!propertySearchText.trim()) return receivableItems;
    const q = propertySearchText.toLowerCase();
    return receivableItems.filter((it: any) =>
      String(it.propertyTitle || '').toLowerCase().includes(q) ||
      String(it.propertyUnit || '').toLowerCase().includes(q) ||
      String(it.tenantName || '').toLowerCase().includes(q)
    );
  }, [receivableItems, propertySearchText]);

  const receivableSummary = useMemo(() => {
    const totalReceived = receivableItems.reduce((acc, it) => acc + (it.receivedAmount || 0), 0);
    const pendingItems = receivableItems.filter(it => it.status !== 'received');
    const totalPending = pendingItems.reduce((acc, it) => acc + (it.expectedRent - it.receivedAmount), 0);
    const totalUnits = receivableItems.length;
    const receivedCount = receivableItems.filter(it => it.status === 'received').length;
    const rate = totalUnits > 0 ? Math.round((receivedCount / totalUnits) * 100) : 100;

    return {
      totalReceived,
      totalPending,
      pendingCount: pendingItems.length,
      collectionRate: rate,
      totalUnits,
      receivedCount,
    };
  }, [receivableItems]);

  const rentedOutList = useMemo(() => {
    const list: any[] = [];
    const seenPropertyIds = new Set<string>();

    // 1. From ownerAgreements
    (ownerAgreements || []).forEach((agr: any) => {
      if (agr.status === 'closed' || agr.status === 'terminated') return;
      const prop = agr.property && typeof agr.property === 'object' ? agr.property : {};
      if (!prop.title) return;
      const propId = String(getId(prop) || getId(agr.property) || agr._id);
      seenPropertyIds.add(propId);

      const tenantObj = agr.tenant && typeof agr.tenant === 'object' ? agr.tenant : {};
      const rentAmt = Number(agr.rentAmount || prop.price || 0);
      const depositAmt = Number(prop.securityDeposit || prop.deposit || rentAmt * 2);

      let startFormatted = '-';
      let endFormatted = '-';
      try {
        if (agr.startDate) startFormatted = new Date(agr.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (agr.endDate) endFormatted = new Date(agr.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch { }

      list.push({
        id: propId,
        agreementId: agr._id,
        propertyTitle: prop.title || t('Rental Unit', 'வாடகை அலகு'),
        propertyLocation: prop.location || '',
        propertyUnit: `${prop.title || 'Unit'}${prop.location ? ' - ' + prop.location.split(',')[0] : ''}`,
        thumbnail: prop.images?.[0] || null,
        tenantName: tenantObj.name || t('Tenant', 'குத்தகைதாரர்'),
        tenantEmail: tenantObj.email || '',
        tenantPhone: tenantObj.phone || '',
        tenantAddress: tenantObj.address || '',
        leaseStart: startFormatted,
        leaseEnd: endFormatted,
        monthlyRent: rentAmt,
        deposit: depositAmt,
        paymentStatus: 'received',
        status: agr.status || 'active',
        rawProperty: prop,
        rawAgreement: agr,
      });
    });

    // 2. From myProperties where occupied or rented
    myProperties.forEach((p: any) => {
      const pId = String(getId(p));
      if (seenPropertyIds.has(pId)) return;

      const isOccupied = p.occupancyStatus === 'occupied' || !!p.tenant || !!p.tenantName || p.status === 'rented';
      if (!isOccupied) return;

      const tenantObj = typeof p.tenant === 'object' ? p.tenant : {};
      const tenantName = p.tenantName || tenantObj?.name || t('Occupied Tenant', 'குத்தகைதாரர்');
      const rentAmt = Number(p.price || 0);
      const depositAmt = Number(p.securityDeposit || p.deposit || rentAmt * 2);

      list.push({
        id: pId,
        agreementId: null,
        propertyTitle: p.title || t('Rental Property', 'வாடகை சொத்து'),
        propertyLocation: p.location || '',
        propertyUnit: `${p.title}${p.location ? ' - ' + p.location.split(',')[0] : ''}`,
        thumbnail: p.images?.[0] || null,
        tenantName,
        tenantEmail: tenantObj?.email || '',
        tenantPhone: tenantObj?.phone || p.tenantContact || '',
        tenantAddress: p.location || '',
        leaseStart: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Jan 2025',
        leaseEnd: '31 Dec 2025',
        monthlyRent: rentAmt,
        deposit: depositAmt,
        paymentStatus: 'received',
        status: 'active',
        rawProperty: p,
        rawAgreement: null,
      });
    });

    return list;
  }, [ownerAgreements, myProperties, t]);

  const searchedRentedOutList = useMemo(() => {
    if (!propertySearchText.trim()) return rentedOutList;
    const q = propertySearchText.toLowerCase();
    return rentedOutList.filter((it: any) =>
      String(it.propertyTitle || '').toLowerCase().includes(q) ||
      String(it.propertyLocation || '').toLowerCase().includes(q) ||
      String(it.tenantName || '').toLowerCase().includes(q) ||
      String(it.tenantPhone || '').toLowerCase().includes(q)
    );
  }, [rentedOutList, propertySearchText]);

  const rentedOutMetrics = useMemo(() => {
    const totalTenancies = rentedOutList.length;
    const monthlyYield = rentedOutList.reduce((acc, it) => acc + (it.monthlyRent || 0), 0);

    const collectedAmount = ownerRentSummary?.totalCollected != null
      ? Number(ownerRentSummary.totalCollected)
      : receivableSummary.totalReceived > 0
        ? receivableSummary.totalReceived
        : monthlyYield;

    const collectedPercent = monthlyYield > 0 ? Math.min(100, Math.round((collectedAmount / monthlyYield) * 100)) : 100;
    const pendingAmount = receivableSummary.totalPending || Math.max(0, monthlyYield - collectedAmount);
    const pendingCount = receivableSummary.pendingCount;

    return {
      totalTenancies,
      monthlyYield,
      collectedAmount,
      collectedPercent,
      pendingAmount,
      pendingCount,
    };
  }, [rentedOutList, ownerRentSummary, receivableSummary]);

  const allRentalsCount = useMemo(() => {
    const ownedRentals = myProperties.filter((p: any) => p.transactionType?.toLowerCase() === 'rent' || p.transaction?.toLowerCase() === 'rent').length;
    return ownedRentals + tenantProperties.length;
  }, [myProperties, tenantProperties]);

  const duePaymentsCount = useMemo(() => {
    return (tenantRequests || []).filter((r: any) =>
      ['Pending_Payment', 'payment_pending', 'Payment_Submitted', 'accepted', 'approved', 'terms_confirmed'].includes(r.status)
    ).length;
  }, [tenantRequests]);

  const searchedOwnedProperties = useMemo(() => {
    if (!propertySearchText.trim()) return myProperties;
    const q = propertySearchText.toLowerCase();
    return myProperties.filter((p: any) =>
      String(p.title || '').toLowerCase().includes(q) ||
      String(p.location || '').toLowerCase().includes(q)
    );
  }, [myProperties, propertySearchText]);

  const searchedTenantProperties = useMemo(() => {
    if (!propertySearchText.trim()) return filteredTenantProperties;
    const q = propertySearchText.toLowerCase();
    return filteredTenantProperties.filter((p: any) =>
      String(p.title || '').toLowerCase().includes(q) ||
      String(p.location || '').toLowerCase().includes(q)
    );
  }, [filteredTenantProperties, propertySearchText]);

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
    if (!searchedTenantProperties.length) return null;
    return searchedTenantProperties.find((p: any) => getId(p) === selectedTenantId) || searchedTenantProperties[0];
  }, [searchedTenantProperties, selectedTenantId]);

  const handleDownloadReceipt = (item: any) => {
    const paymentObj = {
      transactionId: item.transactionId,
      amount: item.amountPaid || item.monthlyRent,
      paidAt: item.paymentDate,
      paymentMethod: item.paymentMethod,
      status: 'completed',
    };
    const recordObj = {
      propertyTitle: item.propertyTitle,
      propertyLocation: item.propertyLocation,
      owner: { name: item.ownerName },
    };
    generateReceipt(paymentObj, recordObj);
  };

  const handleSelectOwnedProperty = (property: any) => {
    const id = getId(property);
    setSelectedOwnedId(id);
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('section', 'owned');
        window.history.replaceState({}, '', currentUrl.toString());
      } catch { }
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
      } catch { }
    }
  };

  const handleSwitchSection = (section: 'owned' | 'rents') => {
    setPropertySection(section);
    setDetailedViewProperty(null);
    if (section === 'rents') {
      setRentSubView('dashboard');
      setRentLedgerTab('payable');
      setRentsActiveSection('overview');
    } else {
      setRentSubView('dashboard');
    }
    if (typeof window !== 'undefined') {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('section', section);
        currentUrl.searchParams.delete('subview');
        window.history.replaceState({}, '', currentUrl.toString());
      } catch { }
    }
    if (section === 'owned') {
      const targetId = selectedOwnedId || (myProperties[0] ? getId(myProperties[0]) : null);
      if (targetId) setSelectedOwnedId(targetId);
    } else if (section === 'rents') {
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
  const { unreadCount: messengerUnreadCount, openMessenger } = useMessenger();
  const [isAddSelfManagedOpen, setIsAddSelfManagedOpen] = useState(false);
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

    const notifType = String(notif.type || '').toUpperCase();
    const isAgreementNotif =
      notifType === 'AGREEMENT_UPLOADED' ||
      notifType === 'AGREEMENT_VERIFIED' ||
      notifType === 'AGREEMENT_SYNCED' ||
      notifType.includes('AGREEMENT') ||
      notif.title?.toLowerCase().includes('agreement') ||
      notif.message?.toLowerCase().includes('agreement');

    if (isAgreementNotif) {
      const rawProp = notif.property;
      const targetPropId =
        getId(rawProp) ||
        notif.propertyId ||
        getId(notif.request?.property) ||
        (myProperties || []).find((p: any) =>
          p.title && (notif.propertyTitle || notif.title || notif.message)?.includes(p.title)
        )?._id;

      setMainTab('properties');
      const isOwnerProp = (myProperties || []).some((p: any) => getId(p) === String(targetPropId));
      if (isOwnerProp || propertySection === 'owned') {
        setPropertySection('owned');
        if (targetPropId) setSelectedOwnedId(String(targetPropId));
      } else {
        setPropertySection('rents');
        if (targetPropId) setSelectedTenantId(String(targetPropId));
      }
      setPropertySectionTab('agreements');
      return;
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
    <div className="relative z-10 w-full min-h-[calc(100vh-58px)] py-3 sm:py-4 px-3 sm:px-5 lg:px-6 space-y-0">
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
            <button
              type="button"
              onClick={() => onBrowseProperties?.('rent')}
              className="h-9 bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 rounded-full px-4 text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span>{t('Browse to Rent', 'வாடகைக்கு தேட')}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => onBrowseProperties?.('buy')}
              className="h-9 bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 rounded-full px-4 text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span>{t('Browse to Buy', 'வாங்க தேட')}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => setIsPropertyFormOpen(true)}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>{t('List Property', 'சொத்தை பட்டியலிடு')}</span>
            </button>

            {/* Messenger Pill Button wired to real-time chat */}
            <button
              type="button"
              onClick={() => openMessenger()}
              className="relative h-9 bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 text-xs font-semibold shadow-2xs flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{t('Messenger', 'செய்தியாளர்')}</span>
              {messengerUnreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {messengerUnreadCount > 9 ? '9+' : messengerUnreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Container 2: Primary Navigation Tabs (Unified white container, equal-width tabs, blue pill active highlight) */}
        <TabsList className="w-full bg-white/95 dark:bg-[#07111e] border border-blue-100/80 dark:border-slate-600/75 rounded-2xl shadow-xs p-1.5 flex items-center justify-between gap-1 overflow-x-auto h-auto mt-4">
          <TabsTrigger
            value="overview"
            className="flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:font-bold data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-200 hover:dark:text-white cursor-pointer"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>{t('Overview', 'கண்ணோட்டம்')}</span>
          </TabsTrigger>

          <TabsTrigger
            value="properties"
            className="flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:font-bold data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-200 hover:dark:text-white cursor-pointer"
          >
            <Building className="h-4 w-4" />
            <span>{t('My Properties', 'என் சொத்துக்கள்')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              {myProperties.length + tenantProperties.length}
            </span>
            {pendingOwnerRequests > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-4 text-[10px] font-bold rounded-full">
                {pendingOwnerRequests}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="notifications"
            className="flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:font-bold data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-200 hover:dark:text-white cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span>{t('Notifications', 'அறிவிப்புகள்')}</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-0.5 px-1.5 py-0 h-4 text-[10px] rounded-full font-bold">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:font-bold data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-200 hover:dark:text-white cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>{t('Reports', 'அறிக்கைகள்')}</span>
          </TabsTrigger>

          <TabsTrigger
            value="settings"
            className="flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:font-bold data-[state=active]:shadow-2xs text-slate-600 hover:text-slate-900 dark:text-slate-200 hover:dark:text-white cursor-pointer"
          >
            <User className="h-4 w-4" />
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
        <TabsContent value="properties" className="mt-0 space-y-4">
          {/* Sub-Header / Filter Command Bar */}
          <div className="w-full bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md border border-blue-100/80 dark:border-slate-600/75 rounded-2xl px-4 py-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs transition-colors mt-3">
            {/* Left side pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Property Owned */}
              <button
                type="button"
                id="tab-property-owned"
                onClick={() => {
                  handleSwitchSection('owned');
                  setDetailedViewProperty(null);
                }}
                className={`rounded-full px-4 py-1.5 font-semibold text-xs inline-flex items-center gap-2 cursor-pointer transition-all ${propertySection === 'owned'
                  ? 'border border-blue-500 text-blue-600 bg-white dark:bg-[#0d162a] shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:dark:text-white font-medium'
                  }`}
              >
                <KeyRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t('Property Owned', 'சொத்து உரிமையாளர்')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${propertySection === 'owned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                  {myProperties.length}
                </span>
              </button>

              {/* 2. My Rents */}
              <button
                type="button"
                id="tab-my-rents"
                onClick={() => {
                  handleSwitchSection('rents');
                  setRentSubView('dashboard');
                  setRentsActiveSection('overview');
                  setDetailedViewProperty(null);
                }}
                className={`rounded-full px-4 py-1.5 font-semibold text-xs inline-flex items-center gap-2 cursor-pointer transition-all ${propertySection === 'rents' && rentSubView === 'dashboard'
                  ? 'border border-blue-500 text-blue-600 bg-white dark:bg-[#0d162a] shadow-xs font-bold'
                  : propertySection === 'rents'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:dark:text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:dark:text-white font-medium'
                  }`}
              >
                <Home className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>{t('My Rents', 'எனது வாடகைகள்')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${propertySection === 'rents' && rentSubView === 'dashboard'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                  {tenantProperties.length}
                </span>
              </button>

              {/* Conditionally reveal Divider, Rent In, and Rent Out ONLY when inside My Rents */}
              {propertySection === 'rents' && (
                <>
                  <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                  {/* 3. Rent In */}
                  <button
                    type="button"
                    id="tab-rent-in"
                    onClick={() => {
                      setRentSubView('rentIn');
                      setRentFlowMode('in');
                      setRentsActiveSection('overview');
                      setDetailedViewProperty(null);
                      if (typeof window !== 'undefined') {
                        try {
                          const currentUrl = new URL(window.location.href);
                          currentUrl.searchParams.set('section', 'rents');
                          currentUrl.searchParams.set('subview', 'rentIn');
                          window.history.replaceState({}, '', currentUrl.toString());
                        } catch { }
                      }
                    }}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all ${rentSubView === 'rentIn'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:dark:text-white font-medium'
                      }`}
                  >
                    <span>{t('Rent In', 'வாடகை பெறுதல்')}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${rentSubView === 'rentIn' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                      {receivableItems.length}
                    </span>
                  </button>

                  {/* 4. Rent Out */}
                  <button
                    type="button"
                    id="tab-rent-out"
                    onClick={() => {
                      setRentSubView('rentOut');
                      setRentFlowMode('out');
                      setRentsActiveSection('overview');
                      setDetailedViewProperty(null);
                      if (typeof window !== 'undefined') {
                        try {
                          const currentUrl = new URL(window.location.href);
                          currentUrl.searchParams.set('section', 'rents');
                          currentUrl.searchParams.set('subview', 'rentOut');
                          window.history.replaceState({}, '', currentUrl.toString());
                        } catch { }
                      }
                    }}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all ${rentSubView === 'rentOut'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:dark:text-white font-medium'
                      }`}
                  >
                    <span>{t('Rent Out', 'வாடகை செலுத்துதல்')}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${rentSubView === 'rentOut' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                      {payableSummary.pendingCount > 0 ? `${payableSummary.pendingCount} Pending` : payableItems.length}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={propertySearchText}
                  onChange={(e) => setPropertySearchText(e.target.value)}
                  placeholder={t('Search property...', 'சொத்து தேடுக...')}
                  className="w-72 md:w-96 pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs h-9 transition-colors"
                />
              </div>

              {/* + Self Manage button */}
              <button
                type="button"
                onClick={() => (propertySection === 'rents' ? setIsAddRentalOpen(true) : setIsAddSelfManagedOpen(true))}
                title={propertySection === 'rents' ? t('Add Rental', 'வாடகை சேர்க்க') : t('Add Self-Managed Property', 'சுய மேலாண்மை சொத்து சேர்க்க')}
                aria-label={propertySection === 'rents' ? t('Add Rental', 'வாடகை சேர்க்க') : t('Add Self-Managed Property', 'சுய மேலாண்மை சொத்து சேர்க்க')}
                className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Listing Controls button */}
              <button
                type="button"
                onClick={() => setIsListingSettingsOpen(true)}
                title={t('Listing Controls', 'பட்டியல் கட்டுப்பாடுகள்')}
                aria-label={t('Listing Controls', 'பட்டியல் கட்டுப்பாடுகள்')}
                className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#0d162a] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
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
                  properties={searchedOwnedProperties}
                  selectedPropertyId={getId(activeOwnedProperty)}
                  onSelectProperty={handleSelectOwnedProperty}
                  isTenantView={false}
                  isMyRentsView={false}
                  activeSubTab="Property Owned"
                  initialTab={propertySectionTab}
                  activeSection={propertySectionTab}
                  onActiveSectionChange={setPropertySectionTab}
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
                <button
                  type="button"
                  onClick={() => setIsAddSelfManagedOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 mx-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('Self Manage', 'சுய மேலாண்மை')}</span>
                </button>
              </div>
            )
          ) : rentSubView === 'dashboard' ? (
            filteredTenantProperties.length > 0 && activeTenantProperty ? (
              <PropertyFullScreenView
                property={activeTenantProperty}
                properties={searchedTenantProperties}
                selectedPropertyId={getId(activeTenantProperty)}
                onSelectProperty={handleSelectTenantProperty}
                isTenantView={true}
                isMyRentsView={true}
                activeSubTab="My Rents"
                tenantAgreement={activeTenantProperty?._agreement}
                activeRequest={activeTenantProperty?._request}
                initialTab={propertySectionTab}
                activeSection={propertySectionTab}
                onActiveSectionChange={setPropertySectionTab}
                payableItems={payableItems}
                payableSummary={payableSummary}
                receivableItems={receivableItems}
                receivableSummary={receivableSummary}
                onPayNow={(rec) => {
                  setSelectedRecordForPayment(rec);
                  setIsPayNowDialogOpen(true);
                }}
                onDownloadReceipt={handleDownloadReceipt}
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
                  {t('No rentals found', 'வாடகைகள் எதுவும் இல்லை')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {t('No properties match your current search query.', 'உங்கள் தேடலுக்கு பொருந்தும் சொத்துக்கள் எதுவும் இல்லை.')}
                </p>
              </div>
            )
          ) : rentSubView === 'rentIn' ? (
            /* ================= STANDALONE RENT IN PAGE (WITHOUT YOUR PROPERTIES & MANAGEMENT SECTIONS) ================= */
            <div className="space-y-4">
              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Rent Received */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Total Rent Received', 'மொத்த பெற்ற வாடகை')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      ₹{receivableSummary.totalReceived.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t('All verified incoming collections', 'அனைத்து சரிபார்க்கப்பட்ட வசூல்கள்')}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>

                {/* Card 2: Pending Tenant Dues */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Pending Tenant Dues', 'நிலுவை வாடகை')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      ₹{receivableSummary.totalPending.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {receivableSummary.pendingCount} {t('tenant(s) pending payment', 'குத்தகைதாரர்(கள்) செலுத்த வேண்டும்')}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>

                {/* Card 3: Monthly Rental Yield */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Monthly Rental Yield', 'மாத வாடகை வருவாய்')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      ₹{rentedOutMetrics.monthlyYield.toLocaleString('en-IN')}
                      <span className="text-xs font-normal text-slate-400">/mo</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t('From active rental units', 'செயலில் உள்ள அலகுகளிலிருந்து')}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0">
                    <Wallet className="h-6 w-6" />
                  </div>
                </div>

                {/* Card 4: Collection Rate */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Collection Rate', 'வசூல் விகிதம்')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {receivableSummary.collectionRate}%
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t('Collected this billing cycle', 'இந்த சுழற்சியில் வசூலிக்கப்பட்டது')}
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Rent In Ledger Table Card */}
              <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                      <span>{t('Rent In — Incoming Tenant Collections', 'வாடகை பெறுதல் — குத்தகைதாரர் வசூல்')}</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('Track incoming rental income from tenants, verify collections, and send payment reminders', 'குத்தகைதாரர் வாடகைகளைக் கண்காணித்து நினைவூட்டல்களை அனுப்பவும்')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {searchedReceivableItems.length} {t('records', 'பதிவுகள்')}
                  </Badge>
                </div>

                {searchedReceivableItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Wallet className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">
                      {t('No incoming rent records found', 'பெற வேண்டிய வாடகை பதிவுகள் எதுவும் இல்லை')}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200/80 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">{t('Property / Unit', 'சொத்து / அலகு')}</th>
                          <th className="py-3 px-4">{t('Tenant', 'குத்தகைதாரர்')}</th>
                          <th className="py-3 px-4">{t('Expected Rent', 'எதிர்பார்க்கப்படும் வாடகை')}</th>
                          <th className="py-3 px-4">{t('Received', 'பெறப்பட்டது')}</th>
                          <th className="py-3 px-4">{t('Date / Mode', 'தேதி / முறை')}</th>
                          <th className="py-3 px-4">{t('Status', 'நிலை')}</th>
                          <th className="py-3 px-4 text-right">{t('Actions', 'செயல்கள்')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {searchedReceivableItems.map((item) => {
                          const isReceived = item.status === 'received';
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Property / Unit */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {item.thumbnail ? (
                                    <img
                                      src={item.thumbnail}
                                      alt={item.propertyTitle}
                                      className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                      <Building className="h-5 w-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                                      {item.propertyTitle}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                                      {item.propertyUnit}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Tenant */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                                    {item.tenantName}
                                  </p>
                                  {item.tenantContact && (
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {item.tenantContact}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Expected Rent */}
                              <td className="py-3 px-4">
                                <p className="font-bold text-slate-900 dark:text-white">
                                  ₹{item.expectedRent.toLocaleString('en-IN')}
                                  <span className="text-[10px] font-normal text-slate-400">/mo</span>
                                </p>
                              </td>

                              {/* Received */}
                              <td className="py-3 px-4">
                                <p className={`font-bold ${isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                  ₹{item.receivedAmount.toLocaleString('en-IN')}
                                </p>
                              </td>

                              {/* Date / Mode */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-medium text-slate-800 dark:text-slate-200">
                                    {item.paymentDate}
                                  </p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {item.paymentMode}
                                  </p>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                {isReceived ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>{t('Received', 'பெறப்பட்டது')}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Clock className="h-3 w-3" />
                                    <span>{t('Awaiting Payment', 'கட்டணம் நிலுவை')}</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openMessenger(item.tenantId || item.tenant?._id, item.propertyId);
                                    }}
                                    className="border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>{t('Message', 'செய்தி')}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      toast.success(`${t('Payment reminder notification sent to', 'நினைவூட்டல் அனுப்பப்பட்டது')} ${item.tenantName}!`);
                                    }}
                                    className="border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                    <span>{t('Send Reminder', 'நினைவூட்டல்')}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const paymentObj = {
                                        receiptNumber: `STMT-${Date.now().toString().slice(-6)}`,
                                        amount: item.receivedAmount || item.expectedRent,
                                        mode: item.paymentMode,
                                        date: item.paymentDate,
                                        approvedDate: item.paymentDate,
                                      };
                                      const recordObj = {
                                        month: new Date().toISOString(),
                                        tenant: { name: item.tenantName },
                                        property: { title: item.propertyUnit, location: item.propertyTitle },
                                        owner: { name: userProfile?.name || 'Owner' },
                                      };
                                      generateReceipt(paymentObj, recordObj);
                                    }}
                                    className="border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                                    <span>{t('Statement', 'அறிக்கை')}</span>
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
            </div>
          ) : (
            /* ================= STANDALONE RENT OUT PAGE (WITHOUT YOUR PROPERTIES & MANAGEMENT SECTIONS) ================= */
            <div className="space-y-4">
              {/* 3 Summary Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Total Rent Paid */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Total Rent Paid', 'மொத்த செலுத்தப்பட்ட வாடகை')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      ₹{payableSummary.totalPaid.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t('All completed outgoing payments', 'அனைத்து முடிந்த வெளிசெல்லும் கட்டணங்கள்')}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>

                {/* Card 2: Upcoming Due */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Upcoming Due', 'அடுத்த தவணை')}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      ₹{payableSummary.nextDueAmount.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                      {t('Due on', 'தவணை நாள்')} {payableSummary.nextDueDate} • {payableSummary.nextDueLandlord}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>

                {/* Card 3: Payment Status */}
                <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-colors">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('Payment Status', 'கட்டண நிலை')}
                    </p>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${payableSummary.statusBadge.variant === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : payableSummary.statusBadge.variant === 'overdue'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                        {payableSummary.statusBadge.variant === 'paid' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        <span>{payableSummary.statusBadge.text}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {payableSummary.pendingCount > 0
                        ? `₹${payableSummary.totalPending.toLocaleString('en-IN')} ${t('pending clearance', 'நிலுவையில் உள்ளது')}`
                        : t('All dues are up to date', 'அனைத்து தவணைகளும் புதுப்பிக்கப்பட்டுள்ளன')}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 rounded-2xl shrink-0">
                    <CreditCard className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Rent Out Ledger Table Card */}
              <div className="bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md rounded-2xl border border-blue-100/80 dark:border-slate-800/80 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                      <span>{t('Rent Out — Outgoing Rent Obligations', 'வாடகை செலுத்துதல் — வெளிசெல்லும் பொறுப்புகள்')}</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('Record of your monthly rental dues, payments, landlord contacts, and receipts', 'மாதாந்திர வாடகை, கட்டணங்கள் மற்றும் ரசீதுகள்')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {searchedPayableItems.length} {t('records', 'பதிவுகள்')}
                  </Badge>
                </div>

                {searchedPayableItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Home className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">
                      {t('No outgoing rent records found', 'வெளிசெல்லும் வாடகை பதிவுகள் எதுவும் இல்லை')}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddRentalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('Add Rental', 'வாடகை சேர்க்க')}</span>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBrowseProperties?.('rent')}
                        className="rounded-xl text-xs gap-1.5"
                      >
                        <Home className="h-3.5 w-3.5" />
                        <span>{t('Browse Rentals', 'வாடகைக்கு தேட')}</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200/80 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">{t('Property', 'சொத்து')}</th>
                          <th className="py-3 px-4">{t('Landlord', 'உரிமையாளர்')}</th>
                          <th className="py-3 px-4">{t('Rent / Maint', 'வாடகை / பராமரிப்பு')}</th>
                          <th className="py-3 px-4">{t('Paid / Balance', 'செலுத்தியது / நிலுவை')}</th>
                          <th className="py-3 px-4">{t('Due Date / Txn', 'தவணை / பரிவர்த்தனை')}</th>
                          <th className="py-3 px-4">{t('Status', 'நிலை')}</th>
                          <th className="py-3 px-4 text-right">{t('Actions', 'செயல்கள்')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {searchedPayableItems.map((item) => {
                          const isPaid = item.status === 'paid' || item.status === 'completed';
                          const isOverdue = item.status === 'overdue';

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Property */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {item.thumbnail ? (
                                    <img
                                      src={item.thumbnail}
                                      alt={item.propertyTitle}
                                      className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                      <Home className="h-5 w-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                                      {item.propertyTitle}
                                    </p>
                                    {item.propertyLocation && (
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                                        {item.propertyLocation}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Landlord */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                                    {item.ownerName}
                                  </p>
                                  {item.ownerContact && (
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {item.ownerContact}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Rent / Maint Breakdown */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-900 dark:text-white">
                                    ₹{item.monthlyRent.toLocaleString('en-IN')}
                                    <span className="text-[10px] font-normal text-slate-400">/mo</span>
                                  </p>
                                  {item.monthlyMaintenance > 0 && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                      +{item.monthlyMaintenance.toLocaleString('en-IN')} {t('maint', 'பராமரிப்பு')}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Paid / Balance */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                    ₹{item.amountPaid.toLocaleString('en-IN')}
                                  </p>
                                  {item.balance > 0 && (
                                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                                      ₹{item.balance.toLocaleString('en-IN')} {t('rem', 'நிலுவை')}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Due Date / Txn */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-medium text-slate-800 dark:text-slate-200">
                                    {item.dueDate ? (typeof item.dueDate === 'string' && item.dueDate.includes('T') ? new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : item.dueDate) : '-'}
                                  </p>
                                  {item.transactionId && item.transactionId !== '-' && (
                                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                                      {item.transactionId} ({item.paymentMethod})
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>{t('Paid', 'செலுத்தப்பட்டது')}</span>
                                  </span>
                                ) : isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>{t('Overdue', 'தவணை கடந்தது')}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Clock className="h-3 w-3" />
                                    <span>{t('Due Soon', 'விரைவில் தவணை')}</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openMessenger(item.ownerId || item.owner?._id, item.propertyId);
                                    }}
                                    className="border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>{t('Message', 'செய்தி')}</span>
                                  </button>
                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRecordForPayment(item.raw);
                                        setIsPayNowDialogOpen(true);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <CreditCard className="h-3.5 w-3.5" />
                                      <span>{t('Pay Now', 'செலுத்துக')}</span>
                                    </button>
                                  )}

                                  {isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDownloadReceipt(item);
                                      }}
                                      className="border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Download className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                                      <span>{t('Download Receipt', 'ரசீது')}</span>
                                    </button>
                                  )}
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
            </div>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sentFilterStatus === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('My Requests', 'என் கோரிக்கைகள்')} ({customerCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sentFilterStatus === 'pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('Pending Owner Approval', 'உரிமையாளர் ஒப்புதல் நிலுவையில்')} ({customerCounts.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('awaiting_payment')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sentFilterStatus === 'awaiting_payment'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('Awaiting Payment', 'கட்டணம் நிலுவையில்')} ({customerCounts.awaitingPayment})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterStatus('completed_rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sentFilterStatus === 'completed_rejected'
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
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${sentFilterType === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                      }`}
                  >
                    {t('All', 'அனைத்தும்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterType('buy')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${sentFilterType === 'buy' ? 'bg-background shadow-xs text-blue-600 font-semibold' : 'text-muted-foreground'
                      }`}
                  >
                    {t('Buy Offers', 'வாங்க சலுகைகள்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSentFilterType('rent')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${sentFilterType === 'rent' ? 'bg-background shadow-xs text-emerald-600 font-semibold' : 'text-muted-foreground'
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
                            className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${req.type === 'buy'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${incomingFilterStatus === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('Incoming Requests', 'பெறப்பட்ட கோரிக்கைகள்')} ({ownerCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${incomingFilterStatus === 'pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('Accept / Reject', 'ஏற்க / நிராகரிக்க')} ({ownerCounts.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('awaiting_payment')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${incomingFilterStatus === 'awaiting_payment'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {t('Accepted / Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது / கட்டணம் நிலுவையில்')} ({ownerCounts.awaitingPayment})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterStatus('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${incomingFilterStatus === 'completed'
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
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${incomingFilterType === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                      }`}
                  >
                    {t('All', 'அனைத்தும்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterType('buy')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${incomingFilterType === 'buy' ? 'bg-background shadow-xs text-blue-600 font-semibold' : 'text-muted-foreground'
                      }`}
                  >
                    {t('Purchase Offers', 'கொள்முதல் சலுகைகள்')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingFilterType('rent')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${incomingFilterType === 'rent' ? 'bg-background shadow-xs text-emerald-600 font-semibold' : 'text-muted-foreground'
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
                            className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${req.type === 'buy'
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
                              className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${req.type === 'buy' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
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
                              className={`p-2 rounded-lg border ${['terms_confirmed', 'payment_pending', 'completed'].includes(req.status)
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
                              className={`p-2 rounded-lg border ${['payment_pending', 'completed'].includes(req.status)
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
                              className={`p-2 rounded-lg border ${req.status === 'completed'
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
                              className={`p-2 rounded-lg border ${req.status === 'completed' || req.paymentDetails?.status === 'verified'
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
                              className={`p-2 rounded-lg border ${req.status === 'completed'
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
        <TabsContent value="notifications" className="space-y-4 mt-0 w-full">
          <Card className="w-full border border-slate-200/70 dark:border-slate-600/75 shadow-sm bg-white/90 dark:bg-[#070e1b]/80 backdrop-blur-md rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-600/75">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                {/* Top-Left Corner: Clickable Filter Dropdown */}
                <div className="relative shrink-0" ref={notifFilterRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotifFilterOpen((prev) => !prev)}
                    title="Filter notifications"
                    aria-label="Filter notifications"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 transition-all relative cursor-pointer"
                  >
                    <Filter className="w-4 h-4" />
                    {notifFilter !== 'all' && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5" />
                    )}
                  </button>

                  {isNotifFilterOpen && (
                    <div className="absolute left-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 dark:border-slate-600/75 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                      {/* Status Options */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => { setNotifFilter('all'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'all'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span>{t('All Notifications', 'அனைத்து அறிவிப்புகள்')}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                            {notifications.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifFilter('unread'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'unread'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>{t('Unread', 'படிக்காதவை')}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                            }`}>
                            {unreadCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifFilter('read'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'read'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span>{t('Read', 'படித்தவை')}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'read' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                            {readCount}
                          </span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="my-1.5 border-t border-slate-100 dark:border-slate-600/75" />

                      {/* Category Options */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => { setNotifFilter('agreements'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'agreements'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{t('Agreements', 'ஒப்பந்தங்கள்')}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'agreements' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                            {agreementsCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifFilter('payments'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'payments'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{t('Payments', 'கட்டணங்கள்')}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'payments' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                            {paymentsCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setNotifFilter('requests'); setIsNotifFilterOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${notifFilter === 'requests'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Inbox className="w-3.5 h-3.5" />
                            <span>{t('Requests & Offers', 'கோரிக்கைகள்')}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${notifFilter === 'requests' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                            {requestsCount}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-500 shrink-0" />
                    <span>{t('In-App Action Notifications', 'செயல் அறிவிப்புகள்')}</span>
                  </CardTitle>
                  <CardDescription>
                    {t('Actionable alerts for offers, counteroffers, terms, and payments.', 'சலுகைகள், எதிர் சலுகைகள் மற்றும் கட்டணங்களுக்கான அறிவிப்புகள்.')}
                  </CardDescription>
                </div>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  className="gap-1.5 text-xs shrink-0 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-primary" />
                  <span>{t('Mark all as read', 'அனைத்தையும் படித்ததாக குறி')}</span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground pb-16">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-medium">
                    {notifFilter === 'unread'
                      ? t('No unread notifications.', 'படிக்காத அறிவிப்புகள் எதுவும் இல்லை.')
                      : t('No notifications match this filter.', 'இந்த வடிகட்டியில் அறிவிப்புகள் எதுவும் இல்லை.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pb-16 w-full">
                  {filteredNotifications.map((notif: any) => {
                    const isUnread = !notif.read && !notif.isRead;
                    return (
                      <div
                        key={notif._id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 w-full ${isUnread
                          ? 'border-l-4 border-l-blue-600 bg-white/95 dark:bg-slate-900/90 dark:backdrop-blur-md border-slate-200/80 dark:border-slate-600/75 shadow-xs hover:border-blue-400'
                          : 'border-l-4 border-l-transparent bg-white/60 dark:bg-slate-900/75 dark:backdrop-blur-md border-slate-200/50 dark:border-slate-600/75 hover:bg-white/80 dark:hover:bg-slate-800/80'
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
                            <h4 className={`text-sm font-semibold text-slate-900 dark:text-white ${isUnread ? 'font-bold' : ''}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[11px] text-slate-500 dark:text-slate-300 flex-shrink-0 font-medium">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 leading-relaxed">{notif.message}</p>
                          {(notif.property?.title || notif.propertyTitle) && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium mt-1">
                              <Home className="w-3 h-3" />
                              {notif.property?.title || notif.propertyTitle}
                            </span>
                          )}
                        </div>

                        {isUnread && (
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    );
                  })}
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
        <TabsContent value="settings" className="mt-4">
          <ProfileSettingsView
            userProfile={userProfile}
            refetchUserProfile={refetchUserProfile}
          />
        </TabsContent>
      </Tabs>

      {/* Property Creation Dialog */}
      <PropertyForm
        open={isPropertyFormOpen}
        onOpenChange={setIsPropertyFormOpen}
      />

      {/* Add Self-Managed Property Dialog */}
      <AddSelfManagedPropertyDialog
        open={isAddSelfManagedOpen}
        onOpenChange={setIsAddSelfManagedOpen}
        onSuccess={(created) => {
          const newId = getId(created);
          setProperties((prev) => [created, ...(prev.length > 0 ? prev : rawMyProperties)]);
          queryClient.invalidateQueries({ queryKey: ['myProperties'] });
          queryClient.invalidateQueries({ queryKey: ['properties'] });
          if (newId) {
            setSelectedOwnedId(newId);
          }
          setPropertySection('owned');
        }}
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

      {/* Rent Payment Modal */}
      {selectedRecordForPayment && (
        <PaymentDialog
          open={isPayNowDialogOpen}
          onOpenChange={setIsPayNowDialogOpen}
          rentRecord={selectedRecordForPayment}
          onSuccess={() => {
            fetchLedgerData();
          }}
        />
      )}
    </div>
  );
}
