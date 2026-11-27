
import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useGetCallerUserProfile,
  useGetMyProperties,
  useGetOwnerRequests,
  useApproveRequest,
  useRejectRequest,
  useDeleteProperty,
  useGetOwnerRentHistory,
  useOwnerRentReport,
  useOwnerOccupancyReport,
  useOwnerMaintenanceReport,
  useAnnouncements,
  useUpdateListingStatus
} from '../hooks/useQueries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Home,
  Users,
  IndianRupee,
  Plus,
  Settings,
  Building,
  User,
  Inbox,
  MapPin,
  Wrench,
  CreditCard,
  FileText,
  Download,
  Printer,
  Loader2,
  Calendar,
  Megaphone,
  RefreshCcw,
  Filter,
  MessageSquare
} from 'lucide-react';
import { useMessenger } from '../hooks/useMessenger';
import PropertyForm from './PropertyForm';
import PropertyCard from './PropertyCard';
import PropertyFullScreenView from './PropertyFullScreenView';
import ListingControlDialog from './ListingControlDialog';
import RequestDetailsModal from './RequestDetailsModal';
import { PropertyStatus, Property } from '../types';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
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
import api, { translateText } from '../lib/api';
import ProfileSettingsView from './ProfileSettingsView';
import { RentStatusGraph } from './RentStatusGraph';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface OwnerDashboardProps {
  onBrowseProperties?: (transactionType: 'rent' | 'buy') => void;
  initialTab?: string;
  hideHeaderActions?: boolean;
  selectedPropertyId?: string | null;
  onSelectProperty?: (propertyId: string | null) => void;
}

export default function OwnerDashboard({
  onBrowseProperties,
  initialTab = 'overview',
  hideHeaderActions = false,
  selectedPropertyId = null,
  onSelectProperty
}: OwnerDashboardProps = {}) {
  const { t, language } = useLanguage();
  const { data: userProfile, refetch: refetchUserProfile } = useGetCallerUserProfile();

  const { data: myProperties = [] } = useGetMyProperties();
  const { data: requests = [] } = useGetOwnerRequests();
  const { data: rentHistory } = useGetOwnerRentHistory();
  const {
    data: announcements = [],
    isLoading: announcementsLoading,
    isError: announcementsError,
    refetch: refetchAnnouncements
  } = useAnnouncements();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const deletePropertyMutation = useDeleteProperty();

  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const { unreadCount: messengerUnreadCount, openMessenger } = useMessenger();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [requestFilterCategory, setRequestFilterCategory] = useState<'all' | 'pending' | 'awaiting_payment' | 'completed'>('all');

  const ownerRequestCounts = useMemo(() => {
    const list = requests || [];
    return {
      all: list.length,
      pending: list.filter((r: any) => r.status === 'pending').length,
      awaitingPayment: list.filter((r: any) => ['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(r.status)).length,
      completed: list.filter((r: any) => r.status === 'completed').length,
    };
  }, [requests]);

  const filteredOwnerRequests = useMemo(() => {
    return (requests || []).filter((req: any) => {
      if (requestFilterCategory === 'pending') {
        return req.status === 'pending';
      }
      if (requestFilterCategory === 'awaiting_payment') {
        return ['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(req.status);
      }
      if (requestFilterCategory === 'completed') {
        return req.status === 'completed';
      }
      return true;
    });
  }, [requests, requestFilterCategory]);

  // Listing control dialog state
  const [listingDialogProperty, setListingDialogProperty] = useState<Property | null>(null);
  const [listingDefaultAction, setListingDefaultAction] = useState<'sale' | 'rent' | 'edit'>('sale');
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const updateListingStatus = useUpdateListingStatus();

  const handleOpenListingDialog = (property: Property, defaultAction: 'sale' | 'rent' | 'edit' = 'sale') => {
    setListingDialogProperty(property);
    setListingDefaultAction(defaultAction);
    setIsListingDialogOpen(true);
  };

  const handleQuickUnlist = async (property: Property) => {
    try {
      await updateListingStatus.mutateAsync({
        id: property.id || (property as any)._id,
        listingStatus: 'unlisted'
      });
      toast.success(t('Property unlisted. Hidden from public listings.', 'சொத்து பட்டியலிலிருந்து நீக்கப்பட்டது. பொதுப் பட்டியலிலிருந்து மறைக்கப்பட்டது.'));
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to unlist property', 'சொத்தை பட்டியலிலிருந்து நீக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const currentTab = hideHeaderActions && initialTab ? initialTab : activeTab;
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [idProofImage, setIdProofImage] = useState<string | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>({
    expected: 0,
    collected: 0,
    pending: 0,
    overdue: 0,
    breakdown: []
  });
  const [rentDetailsType, setRentDetailsType] = useState<
    | null
    | 'totalProperties'
    | 'occupiedProperties'
    | 'vacantProperties'
    | 'totalTenants'
    | 'expectedRent'
    | 'pendingRent'
  >(null);
  const [overviewActiveSection, setOverviewActiveSection] = useState<
    'none' | 'rentRequests' | 'maintenanceRequests' | 'paymentRequests'
  >('none');
  const [maintenanceOverview, setMaintenanceOverview] = useState<any[]>([]);
  const [tenantRequestsModalType, setTenantRequestsModalType] = useState<null | 'rent' | 'maintenance' | 'payment'>(null);
  const [selectedPropertyInitialTab, setSelectedPropertyInitialTab] = useState<string>('overview');
  const [taTextMap, setTaTextMap] = useState<Record<string, string>>({});
  const now = new Date();
  const toYmd = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = toYmd(now);
  const monthStartStr = toYmd(new Date(now.getFullYear(), now.getMonth(), 1));
  const last90DaysStr = toYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
  const last180DaysStr = toYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 179));

  const [reportFrom, setReportFrom] = useState<string>(monthStartStr);
  const [reportTo, setReportTo] = useState<string>(todayStr);
  const [reportPropertyId, setReportPropertyId] = useState<string>('all');
  const [activeReport, setActiveReport] = useState<null | 'rent' | 'occupancy' | 'maintenance'>(null);

  const reportParams = {
    from: reportFrom,
    to: reportTo,
    propertyId: reportPropertyId === 'all' ? undefined : reportPropertyId,
    ai: true,
    locale: language
  };

  const rentReportQuery = useOwnerRentReport(activeReport === 'rent' ? reportParams : undefined, activeReport === 'rent');
  const occupancyReportQuery = useOwnerOccupancyReport(
    activeReport === 'occupancy' ? reportParams : undefined,
    activeReport === 'occupancy'
  );
  const maintenanceReportQuery = useOwnerMaintenanceReport(
    activeReport === 'maintenance' ? reportParams : undefined,
    activeReport === 'maintenance'
  );

  const activeReportQuery =
    activeReport === 'rent'
      ? rentReportQuery
      : activeReport === 'occupancy'
        ? occupancyReportQuery
        : activeReport === 'maintenance'
          ? maintenanceReportQuery
          : null;

  const currentReport = activeReport === 'rent' ? rentReportQuery.data : activeReport === 'occupancy' ? occupancyReportQuery.data : activeReport === 'maintenance' ? maintenanceReportQuery.data : null;
  const isGeneratingReport =
    activeReport === 'rent'
      ? rentReportQuery.isFetching
      : activeReport === 'occupancy'
        ? occupancyReportQuery.isFetching
        : activeReport === 'maintenance'
          ? maintenanceReportQuery.isFetching
          : false;

  const reportAi = (currentReport as any)?.ai;
  const aiIsGenerated = Boolean(reportAi?.generated);
  const aiExecutiveSummary = typeof reportAi?.executiveSummary === 'string' ? reportAi.executiveSummary : '';
  const aiInsights: string[] = Array.isArray(reportAi?.insights) ? reportAi.insights.filter((x: any) => typeof x === 'string') : [];

  const reportError = activeReportQuery && (activeReportQuery as any).isError ? (activeReportQuery as any).error : null;
  const reportErrorMessage = (() => {
    if (!reportError) return '';
    const e: any = reportError as any;
    const status = e?.response?.status;
    const msg = e?.response?.data?.msg || e?.message || '';
    if (status) return `${status}: ${String(msg || 'Failed to generate report')}`;
    return String(msg || 'Failed to generate report');
  })();

  useEffect(() => {
    if (!activeReport) return;
    if (activeReport === 'rent') rentReportQuery.refetch();
    if (activeReport === 'occupancy') occupancyReportQuery.refetch();
    if (activeReport === 'maintenance') maintenanceReportQuery.refetch();
  }, [activeReport, reportFrom, reportTo, reportPropertyId]);

  const money = (value: any) => `₹${Number(value || 0).toLocaleString()}`;

  const formatShortDate = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const parseRangeBounds = (fromStr: string, toStr: string) => {
    const rawFrom = String(fromStr || '').trim().slice(0, 10);
    const rawTo = String(toStr || '').trim().slice(0, 10);
    const start = rawFrom ? new Date(`${rawFrom}T00:00:00`).getTime() : -Infinity;
    const end = rawTo ? new Date(`${rawTo}T23:59:59.999`).getTime() : Infinity;
    return {
      startTime: Number.isNaN(start) ? -Infinity : start,
      endTime: Number.isNaN(end) ? Infinity : end,
    };
  };

  const getRecordTime = (record: any) => {
    const raw =
      record?.paymentDate ||
      record?.paidAt ||
      record?.dueDate ||
      record?.month ||
      record?.requestDate ||
      record?.createdAt ||
      record?.updatedAt;
    if (!raw) return NaN;
    const d = new Date(raw);
    return d.getTime();
  };

  const matchesProperty = (record: any, selectedPropId: string) => {
    if (!selectedPropId || selectedPropId === 'all') return true;
    const pId = String(record?.propertyId || record?.property?._id || record?.property || '');
    const pTitle = String(record?.propertyTitle || record?.property?.title || '');
    return pId === selectedPropId || pTitle === selectedPropId;
  };

  const filteredRows = useMemo(() => {
    if (!currentReport) return [];
    const rawRows: any[] = Array.isArray(currentReport?.rows) ? currentReport.rows : [];
    const { startTime, endTime } = parseRangeBounds(reportFrom, reportTo);

    return rawRows.filter((r) => {
      if (!matchesProperty(r, reportPropertyId)) return false;

      const recordTime = getRecordTime(r);
      if (!Number.isNaN(recordTime)) {
        if (recordTime < startTime || recordTime > endTime) return false;
      }

      return true;
    });
  }, [currentReport, reportFrom, reportTo, reportPropertyId]);

  const filteredSummary = useMemo(() => {
    if (activeReport === 'rent') {
      const distinctProps = new Set(filteredRows.map((r: any) => String(r.propertyId || r.propertyTitle || '')).filter(Boolean));
      let totalRentExpected = 0;
      let totalRentCollected = 0;
      let pendingAmount = 0;
      filteredRows.forEach((r: any) => {
        totalRentExpected += Number(r.rent || 0);
        totalRentCollected += Number(r.paid || 0);
        pendingAmount += Number(r.pending || 0);
      });
      return {
        totalProperties: distinctProps.size,
        totalRentExpected,
        totalRentCollected,
        pendingAmount
      };
    }

    if (activeReport === 'occupancy') {
      const totalProperties = filteredRows.length;
      const occupied = filteredRows.filter((r: any) => {
        const st = String(r.status || '').toLowerCase();
        return st === 'occupied' || Boolean(r.tenantName);
      }).length;
      const vacant = Math.max(0, totalProperties - occupied);
      const occupancyRate = totalProperties > 0 ? Number(((occupied / totalProperties) * 100).toFixed(2)) : 0;
      return {
        totalProperties,
        occupied,
        vacant,
        occupancyRate
      };
    }

    if (activeReport === 'maintenance') {
      const totalRequests = filteredRows.length;
      const completed = filteredRows.filter((r: any) => String(r.status || '') === 'completed').length;
      const pending = filteredRows.filter((r: any) => String(r.status || '') === 'pending' || String(r.status || '') === 'in-progress').length;
      return {
        totalRequests,
        completed,
        pending
      };
    }

    return {};
  }, [activeReport, filteredRows]);

  const rentDerived = useMemo(() => {
    if (activeReport !== 'rent' || !currentReport) return null;
    const s = filteredSummary as any;
    const expected = Number(s?.totalRentExpected ?? 0);
    const collected = Number(s?.totalRentCollected ?? 0);
    const pending = Number(s?.pendingAmount ?? 0);
    const rows = filteredRows;
    const collectedPct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    const pendingPct = Math.max(0, 100 - collectedPct);

    const paymentStatusData = [
      { name: t('Collected', 'வசூலிக்கப்பட்டது'), value: collected, pct: collectedPct },
      { name: t('Pending', 'நிலுவையில்'), value: pending, pct: pendingPct }
    ];

    const byMonth = new Map<string, { key: string; name: string; amount: number }>();
    rows.forEach((r: any) => {
      const raw = r?.paymentDate || r?.paidAt || r?.dueDate || r?.month;
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString(undefined, { month: 'short' });
      const existing = byMonth.get(key) || { key, name, amount: 0 };
      existing.amount += Number(r?.paid ?? 0);
      byMonth.set(key, existing);
    });

    const monthlyCollection = Array.from(byMonth.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((v) => ({ name: v.name, amount: v.amount }));

    const pendingTenants = rows.filter((r: any) => Number(r?.pending ?? 0) > 0).length;
    const defaulters = rows.filter((r: any) => String(r?.status || '') === 'overdue').length;

    return {
      expected,
      collected,
      pending,
      collectedPct,
      pendingPct,
      paymentStatusData,
      monthlyCollection,
      pendingTenants,
      defaulters
    };
  }, [activeReport, currentReport, filteredSummary, filteredRows, t]);

  const occupancyDerived = useMemo(() => {
    if (activeReport !== 'occupancy' || !currentReport) return null;
    const s = filteredSummary as any;
    const total = Number(s?.totalProperties ?? 0);
    const occupied = Number(s?.occupied ?? 0);
    const vacant = Number(s?.vacant ?? 0);
    const occupancyRate = Number(s?.occupancyRate ?? 0);
    const occupiedPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const vacantPct = Math.max(0, 100 - occupiedPct);
    return {
      total,
      occupied,
      vacant,
      occupancyRate,
      occupiedPct,
      vacantPct,
      statusData: [
        { name: t('Occupied', 'குடியேற்றப்பட்டது'), value: occupied, pct: occupiedPct },
        { name: t('Vacant', 'காலி'), value: vacant, pct: vacantPct }
      ],
      breakdownData: [
        { name: t('Occupied', 'குடியேற்றப்பட்டது'), count: occupied },
        { name: t('Vacant', 'காலி'), count: vacant }
      ]
    };
  }, [activeReport, currentReport, filteredSummary, t]);

  const maintenanceDerived = useMemo(() => {
    if (activeReport !== 'maintenance' || !currentReport) return null;
    const s = filteredSummary as any;
    const totalRequests = Number(s?.totalRequests ?? 0);
    const rows = filteredRows;

    const statusCounts = { pending: 0, inProgress: 0, completed: 0 };
    rows.forEach((r: any) => {
      const st = String(r?.status || '');
      if (st === 'completed') statusCounts.completed += 1;
      else if (st === 'in-progress') statusCounts.inProgress += 1;
      else statusCounts.pending += 1;
    });

    const statusData = [
      { name: t('Completed', 'முடிந்தது'), value: statusCounts.completed },
      { name: t('In Progress', 'செயலில்'), value: statusCounts.inProgress },
      { name: t('Pending', 'நிலுவையில்'), value: statusCounts.pending }
    ];

    const normalizeIssueKey = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    const prettyIssueLabel = (norm: string, raw: string) => {
      const hasUpper = raw !== raw.toLowerCase();
      if (hasUpper) return raw.trim();
      return norm
        .split(' ')
        .filter(Boolean)
        .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
    };

    const issueCounts = new Map<string, number>();
    const issueLabels = new Map<string, string>();
    rows.forEach((r: any) => {
      const raw = String(r?.category || r?.issue || '').trim();
      const key = normalizeIssueKey(raw);
      if (!key) return;
      if (!issueLabels.has(key)) issueLabels.set(key, prettyIssueLabel(key, raw));
      issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
    });

    const topIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => ({ name: issueLabels.get(key) || key, count }));

    return {
      totalRequests,
      statusCounts,
      statusData,
      topIssues
    };
  }, [activeReport, currentReport, filteredSummary, filteredRows, t]);

  const downloadCsv = (fileName: string, lines: string[]) => {
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escCsv = (v: any) => {
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const buildReportTitle = () => {
    if (activeReport === 'rent') return t('Rent Collection Report', 'வாடகை வசூல் அறிக்கை');
    if (activeReport === 'occupancy') return t('Property Occupancy Report', 'சொத்து குடியேற்ற அறிக்கை');
    if (activeReport === 'maintenance') return t('Maintenance Report', 'பராமரிப்பு அறிக்கை');
    return t('Report', 'அறிக்கை');
  };

  const paymentStatusChartRef = useRef<HTMLDivElement | null>(null);
  const monthlyCollectionChartRef = useRef<HTMLDivElement | null>(null);
  const occupancyStatusChartRef = useRef<HTMLDivElement | null>(null);
  const occupancyBreakdownChartRef = useRef<HTMLDivElement | null>(null);
  const maintenanceStatusChartRef = useRef<HTMLDivElement | null>(null);
  const maintenanceIssueChartRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadPdf = async () => {
    if (!activeReport || !currentReport) return;

    const doc = new jsPDF();
    const title = buildReportTitle();
    const ownerName = String(userProfile?.name || 'Owner');
    const generatedAt = currentReport?.generatedAt ? new Date(currentReport.generatedAt) : new Date();

    const svgToPngDataUrl = async (svgEl: SVGElement | null) => {
      if (!svgEl) return null;
      const xml = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        const rect = svgEl.getBoundingClientRect();
        const width = Math.max(300, Math.floor(rect.width || 0));
        const height = Math.max(180, Math.floor(rect.height || 0));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    doc.setFontSize(16);
    doc.text('RESIDE REPORT', 14, 16);
    doc.setFontSize(12);
    doc.text(title, 14, 24);
    doc.text(`Owner: ${ownerName}`, 14, 32);
    doc.text(`Date: ${generatedAt.toLocaleString()}`, 14, 40);
    doc.text(`Range: ${reportFrom} to ${reportTo}`, 14, 48);

    if (activeReport === 'rent') {
      const summary = (filteredSummary as any) || {};
      const expected = Number(summary?.totalRentExpected ?? 0);
      const collected = Number(summary?.totalRentCollected ?? 0);
      const pending = Number(summary?.pendingAmount ?? 0);
      const collectionEfficiency = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      const paymentStatusSvg = paymentStatusChartRef.current?.querySelector('svg') || null;
      const monthlySvg = monthlyCollectionChartRef.current?.querySelector('svg') || null;
      const [piePng, barPng] = await Promise.all([svgToPngDataUrl(paymentStatusSvg), svgToPngDataUrl(monthlySvg)]);

      doc.setFontSize(10);
      doc.text(
        aiIsGenerated
          ? 'This report is AI-assisted and generated by Reside Management System.'
          : 'This report is system-generated by Reside Management System.',
        14,
        54
      );

      autoTable(doc, {
        startY: 60,
        head: [['Total Properties', 'Total Rent Expected', 'Total Rent Collected', 'Pending Amount']],
        body: [
          [
            String(summary.totalProperties ?? 0),
            money(summary.totalRentExpected ?? 0),
            money(summary.totalRentCollected ?? 0),
            money(summary.pendingAmount ?? 0)
          ]
        ],
        theme: 'grid',
        styles: { fontSize: 10 }
      });

      const afterSummaryY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 85;
      const contentWidth = doc.internal.pageSize.getWidth() - 28;
      const chartW = (contentWidth - 8) / 2;
      const chartH = 60;

      if (piePng) doc.addImage(piePng, 'PNG', 14, afterSummaryY, chartW, chartH);
      if (barPng) doc.addImage(barPng, 'PNG', 14 + chartW + 8, afterSummaryY, chartW, chartH);

      const afterChartsY = afterSummaryY + chartH + 10;

      const rows = filteredRows;
      autoTable(doc, {
        startY: afterChartsY,
        head: [['Property', 'Tenant', 'Rent', 'Paid', 'Pending', 'Due Date', 'Status']],
        body: rows.map((r: any) => [
          String(r.propertyTitle || r.propertyId || ''),
          String(r.tenantName || ''),
          money(r.rent ?? 0),
          money(r.paid ?? 0),
          money(r.pending ?? 0),
          r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '',
          String(r.status || '')
        ]),
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      const insightsY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : afterChartsY + 70;
      const pendingTenants = rows.filter((r: any) => Number(r?.pending ?? 0) > 0).length;
      const defaulters = rows.filter((r: any) => String(r?.status || '') === 'overdue').length;
      const insightLines =
        aiInsights.length > 0
          ? aiInsights.slice(0, 6)
          : [
            `${pendingTenants} tenant(s) have pending dues`,
            `Collection Efficiency: ${collectionEfficiency}%`,
            `Defaulters identified: ${defaulters}`
          ];
      doc.setFontSize(11);
      doc.text(aiInsights.length ? 'AI Insights' : 'Insights', 14, insightsY);
      doc.setFontSize(10);
      insightLines.forEach((line: string, idx: number) => {
        doc.text(`• ${String(line)}`, 14, insightsY + 6 + idx * 6);
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(10);
      doc.text(aiIsGenerated ? 'This is an AI-assisted report' : 'This is a system-generated report', 14, pageHeight - 10);

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `reside-${activeReport}-report-${stamp}.pdf`;
      doc.save(fileName);
      return;
    }

    if (activeReport === 'occupancy') {
      const summary = (filteredSummary as any) || {};
      const occupied = Number(summary?.occupied ?? 0);
      const vacant = Number(summary?.vacant ?? 0);
      const occupancyRate = Number(summary?.occupancyRate ?? 0);

      const statusSvg = occupancyStatusChartRef.current?.querySelector('svg') || null;
      const breakdownSvg = occupancyBreakdownChartRef.current?.querySelector('svg') || null;
      const [piePng, barPng] = await Promise.all([svgToPngDataUrl(statusSvg), svgToPngDataUrl(breakdownSvg)]);

      doc.setFontSize(10);
      doc.text(
        aiIsGenerated
          ? 'This report is AI-assisted and generated by Reside Management System.'
          : 'This report is system-generated by Reside Management System.',
        14,
        54
      );

      autoTable(doc, {
        startY: 60,
        head: [['Total Properties', 'Occupied', 'Vacant', 'Occupancy Rate']],
        body: [[String(summary.totalProperties ?? 0), String(occupied), String(vacant), `${occupancyRate.toFixed(2)}%`]],
        theme: 'grid',
        styles: { fontSize: 10 }
      });

      const afterSummaryY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 85;
      const contentWidth = doc.internal.pageSize.getWidth() - 28;
      const chartW = (contentWidth - 8) / 2;
      const chartH = 60;

      if (piePng) doc.addImage(piePng, 'PNG', 14, afterSummaryY, chartW, chartH);
      if (barPng) doc.addImage(barPng, 'PNG', 14 + chartW + 8, afterSummaryY, chartW, chartH);

      const afterChartsY = afterSummaryY + chartH + 10;
      const rows = filteredRows;
      autoTable(doc, {
        startY: afterChartsY,
        head: [['Property', 'Location', 'Status', 'Tenant Name']],
        body: rows.map((r: any) => [
          String(r.propertyTitle || r.propertyId || ''),
          String(r.location || ''),
          String(r.status || ''),
          String(r.tenantName || '')
        ]),
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      const insightsY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : afterChartsY + 70;
      if (aiInsights.length) {
        doc.setFontSize(11);
        doc.text('AI Insights', 14, insightsY);
        doc.setFontSize(10);
        aiInsights.slice(0, 6).forEach((line: string, idx: number) => {
          doc.text(`• ${String(line)}`, 14, insightsY + 6 + idx * 6);
        });
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(10);
      doc.text(aiIsGenerated ? 'This is an AI-assisted report' : 'This is a system-generated report', 14, pageHeight - 10);

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `reside-${activeReport}-report-${stamp}.pdf`;
      doc.save(fileName);
      return;
    }

    if (activeReport === 'maintenance') {
      const summary = (filteredSummary as any) || {};
      const completed = Number(summary?.completed ?? 0);
      const pending = Number(summary?.pending ?? 0);

      const statusSvg = maintenanceStatusChartRef.current?.querySelector('svg') || null;
      const issueSvg = maintenanceIssueChartRef.current?.querySelector('svg') || null;
      const [piePng, barPng] = await Promise.all([svgToPngDataUrl(statusSvg), svgToPngDataUrl(issueSvg)]);

      doc.setFontSize(10);
      doc.text(
        aiIsGenerated
          ? 'This report is AI-assisted and generated by Reside Management System.'
          : 'This report is system-generated by Reside Management System.',
        14,
        54
      );

      autoTable(doc, {
        startY: 60,
        head: [['Total Requests', 'Completed', 'Pending']],
        body: [[String(summary.totalRequests ?? 0), String(completed), String(pending)]],
        theme: 'grid',
        styles: { fontSize: 10 }
      });

      const afterSummaryY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 85;
      const contentWidth = doc.internal.pageSize.getWidth() - 28;
      const chartW = (contentWidth - 8) / 2;
      const chartH = 60;

      if (piePng) doc.addImage(piePng, 'PNG', 14, afterSummaryY, chartW, chartH);
      if (barPng) doc.addImage(barPng, 'PNG', 14 + chartW + 8, afterSummaryY, chartW, chartH);

      const afterChartsY = afterSummaryY + chartH + 10;
      const rows = filteredRows;
      autoTable(doc, {
        startY: afterChartsY,
        head: [['Maintenance Name', 'Property', 'Status']],
        body: rows.map((r: any) => [String(r.issue || ''), String(r.propertyTitle || ''), String(r.status || '')]),
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      const insightsY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : afterChartsY + 70;
      if (aiInsights.length) {
        doc.setFontSize(11);
        doc.text('AI Insights', 14, insightsY);
        doc.setFontSize(10);
        aiInsights.slice(0, 6).forEach((line: string, idx: number) => {
          doc.text(`• ${String(line)}`, 14, insightsY + 6 + idx * 6);
        });
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(10);
      doc.text(aiIsGenerated ? 'This is an AI-assisted report' : 'This is a system-generated report', 14, pageHeight - 10);

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `reside-${activeReport}-report-${stamp}.pdf`;
      doc.save(fileName);
      return;
    }

    const summaryPairs: Array<[string, string]> = [];
    if (activeReport === 'occupancy') {
      const s = (filteredSummary as any) || {};
      summaryPairs.push(
        ['Total Properties', String(s.totalProperties ?? 0)],
        ['Occupied', String(s.occupied ?? 0)],
        ['Vacant', String(s.vacant ?? 0)],
        ['Occupancy Rate', `${Number(s.occupancyRate ?? 0).toFixed(2)}%`]
      );
    }
    if (activeReport === 'maintenance') {
      const s = (filteredSummary as any) || {};
      summaryPairs.push(
        ['Total Requests', String(s.totalRequests ?? 0)],
        ['Completed', String(s.completed ?? 0)],
        ['Pending', String(s.pending ?? 0)]
      );
    }

    autoTable(doc, {
      startY: 56,
      head: [['Summary', 'Value']],
      body: summaryPairs.map(([k, v]) => [k, v]),
      theme: 'grid',
      styles: { fontSize: 10 }
    });

    const afterSummaryY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 80;

    if (activeReport === 'occupancy') {
      const rows = filteredRows;
      autoTable(doc, {
        startY: afterSummaryY,
        head: [['Property', 'Location', 'Status', 'Tenant Name']],
        body: rows.map((r: any) => [
          String(r.propertyTitle || r.propertyId || ''),
          String(r.location || ''),
          String(r.status || ''),
          String(r.tenantName || '')
        ]),
        theme: 'grid',
        styles: { fontSize: 9 }
      });
    }

    if (activeReport === 'maintenance') {
      const rows = filteredRows;
      autoTable(doc, {
        startY: afterSummaryY,
        head: [['Maintenance Name', 'Property', 'Status']],
        body: rows.map((r: any) => [String(r.issue || ''), String(r.propertyTitle || ''), String(r.status || '')]),
        theme: 'grid',
        styles: { fontSize: 9 }
      });
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(10);
    doc.text('This is a system-generated report', 14, pageHeight - 10);

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `reside-${activeReport}-report-${stamp}.pdf`;
    doc.save(fileName);
  };

  const handlePrint = () => {
    if (!activeReport || !currentReport) return;

    const title = buildReportTitle();
    const ownerName = String(userProfile?.name || 'Owner');
    const generatedAt = currentReport?.generatedAt ? new Date(currentReport.generatedAt) : new Date();
    const summary: Array<[string, string]> = [];

    if (activeReport === 'rent') {
      const s = (filteredSummary as any) || {};
      summary.push(
        ['Total Properties', String(s.totalProperties ?? 0)],
        ['Total Rent Expected', money(s.totalRentExpected ?? 0)],
        ['Total Rent Collected', money(s.totalRentCollected ?? 0)],
        ['Pending Amount', money(s.pendingAmount ?? 0)]
      );
    }
    if (activeReport === 'occupancy') {
      const s = (filteredSummary as any) || {};
      summary.push(
        ['Total Properties', String(s.totalProperties ?? 0)],
        ['Occupied', String(s.occupied ?? 0)],
        ['Vacant', String(s.vacant ?? 0)],
        ['Occupancy Rate', `${Number(s.occupancyRate ?? 0).toFixed(2)}%`]
      );
    }
    if (activeReport === 'maintenance') {
      const s = (filteredSummary as any) || {};
      summary.push(['Total Requests', String(s.totalRequests ?? 0)], ['Completed', String(s.completed ?? 0)], ['Pending', String(s.pending ?? 0)]);
    }

    const rows = filteredRows;
    const columns =
      activeReport === 'rent'
        ? ['Property', 'Tenant Name', 'Rent', 'Paid', 'Pending', 'Payment Date', 'Payment Status']
        : activeReport === 'occupancy'
          ? ['Property', 'Location', 'Status', 'Tenant Name']
          : ['Maintenance Name', 'Property', 'Status'];

    const bodyRows =
      activeReport === 'rent'
        ? rows.map((r: any) => [
          r.propertyTitle || r.propertyId,
          r.tenantName,
          money(r.rent ?? 0),
          money(r.paid ?? 0),
          money(r.pending ?? 0),
          formatShortDate(r.dueDate || r.month),
          r.status
        ])
        : activeReport === 'occupancy'
          ? rows.map((r: any) => [r.propertyTitle || r.propertyId, r.location, r.status, r.tenantName])
          : rows.map((r: any) => [r.issue, r.propertyTitle, r.status]);

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 6px; font-size: 20px; }
            h2 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
            .meta { margin: 0 0 12px; font-size: 12px; color: #333; }
            .summary { margin: 12px 0 18px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
            .summary-row { display: flex; border-top: 1px solid #eee; }
            .summary-row:first-child { border-top: none; }
            .summary-key { flex: 1; padding: 10px 12px; background: #fafafa; font-weight: 600; }
            .summary-val { flex: 1; padding: 10px 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            footer { margin-top: 18px; font-size: 11px; color: #555; }
          </style>
        </head>
        <body>
          <h1>RESIDE REPORT</h1>
          <h2>${title}</h2>
          <div class="meta">Owner: ${ownerName}</div>
          <div class="meta">Date: ${generatedAt.toLocaleString()}</div>
          <div class="meta">Range: ${reportFrom} to ${reportTo}</div>
          <div class="summary">
            ${summary.map(([k, v]) => `<div class="summary-row"><div class="summary-key">${k}</div><div class="summary-val">${v}</div></div>`).join('')}
          </div>
          <table>
            <thead>
              <tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${bodyRows
        .map((r: any[]) => `<tr>${r.map((c) => `<td>${String(c ?? '')}</td>`).join('')}</tr>`)
        .join('')}
            </tbody>
          </table>
          <footer>This is a system-generated report</footer>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  useEffect(() => {
    if (language !== 'ta') {
      if (Object.keys(taTextMap).length > 0) setTaTextMap({});
      return;
    }

    const texts = new Set<string>();
    (myProperties || []).forEach((p: any) => {
      const title = String(p?.title || '').trim();
      const loc = String(p?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });
    (requests || []).forEach((r: any) => {
      const title = String(r?.property?.title || '').trim();
      const loc = String(r?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });

    const missing = Array.from(texts).filter((s) => !taTextMap[s]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const additions: Record<string, string> = {};
      for (const s of missing) {
        try {
          const res = await translateText(s, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          if (out && out.trim()) additions[s] = out;
        } catch {
          continue;
        }
      }
      if (cancelled) return;
      if (Object.keys(additions).length > 0) {
        setTaTextMap((prev) => ({ ...prev, ...additions }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [language, myProperties, requests, taTextMap]);

  const displayTa = (text: any) => {
    const raw = typeof text === 'string' ? text : '';
    if (language !== 'ta') return raw || text;
    if (!raw) return raw || text;
    return taTextMap[raw] || raw;
  };

  const getId = (v: any) => String(v?._id || v?.id || v || '');

  // Only include active valid requests whose property still exists
  const pendingRequests = (requests || []).filter(
    (r: any) => r && r.property && r.status === 'pending'
  );
  const pendingRentCount = pendingRequests.filter((r: any) => r.type === 'rent').length;
  const pendingMaintenance = (maintenanceOverview || []).filter(
    (m: any) => m && m.property && m.status === 'pending'
  );
  const pendingMaintenanceCount = pendingMaintenance.length;
  const pendingPayments = (paymentRequests || []).filter(
    (p: any) => p && p.property && (p.status === 'submitted' || p.status === 'pending')
  );
  const pendingPaymentCount = pendingPayments.length;
  const totalPendingRequests = pendingRequests.length + pendingMaintenanceCount + pendingPaymentCount;

  // Notification for pending requests
  useEffect(() => {
    const toastId = 'pending-requests-notification'; // Unique ID to prevent duplicates
    if (pendingRequests && pendingRequests.length > 0) {
      toast.info(
        t(
          `You have ${pendingRequests.length} pending request${pendingRequests.length > 1 ? 's' : ''}`,
          `${pendingRequests.length} நிலுவையில் உள்ள கோரிக்கைகள் உள்ளன`
        ),
        {
          id: toastId,
          duration: 6000,
          description: t('Check the Tenant Requests Overview', 'குத்தகைதாரர் கோரிக்கைகள் கண்ணோட்டத்தைச் சரிபார்க்கவும்'),
          action: {
            label: t('View', 'பார்வை'),
            onClick: () => {
              const element = document.getElementById('tenant-requests-overview');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: Highlight effect
                element.classList.add('ring-2', 'ring-primary');
                setTimeout(() => element.classList.remove('ring-2', 'ring-primary'), 2000);
              }
            }
          }
        }
      );
    } else {
      toast.dismiss(toastId);
    }
  }, [pendingRequests.length, t]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchPaymentRequests = async () => {
      try {
        const res = await api.get('/payments/owner/requests');
        setPaymentRequests(res.data);
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status !== 401 && status !== 403) console.error('Error fetching payment requests:', err);
      }
    };

    const fetchFinancialSummary = async () => {
      try {
        const res = await api.get('/payments/owner/summary');
        setFinancialSummary(res.data);
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status !== 401 && status !== 403) console.error('Error fetching financial summary:', err);
      }
    };

    const fetchMaintenanceOverview = async () => {
      try {
        const res = await api.get('/requests/maintenance/owner');
        setMaintenanceOverview(res.data);
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status !== 401 && status !== 403) console.error('Error fetching maintenance requests overview:', err);
      }
    };

    fetchPaymentRequests();
    fetchFinancialSummary();
    fetchMaintenanceOverview();
  }, []);

  const handleApproveRequest = (requestId: string) => {
    const request = (requests as any[]).find((r) => r._id === requestId);

    if (request && request.status === 'approved') {
      toast.info(t('This request is already approved', 'இந்த கோரிக்கை ஏற்கனவே அங்கீகரிக்கப்பட்டது'));
      return;
    }

    if (request && request.status === 'rejected') {
      toast.info(t('This request has been rejected', 'இந்த கோரிக்கை நிராகரிக்கப்பட்டுவிட்டது'));
      return;
    }

    approveRequest.mutate(requestId, {
      onSuccess: () => toast.success(t('Request approved successfully', 'கோரிக்கை வெற்றிகரமாக அங்கீகரிக்கப்பட்டது')),
      onError: (error: any) => {
        const msg = error?.response?.data?.msg || t('Failed to approve request', 'கோரிக்கையை அங்கீகரிக்க முடியவில்லை');
        toast.error(msg);
      }
    });
  };

  const handleRejectRequest = (requestId: string) => {
    rejectRequest.mutate(requestId, {
      onSuccess: () => toast.success(t('Request rejected', 'கோரிக்கை நிராகரிக்கப்பட்டது')),
      onError: () => toast.error(t('Failed to reject request', 'கோரிக்கையை நிராகரிக்க முடியவில்லை'))
    });
  };

  const handleApprovePayment = async (input: any) => {
    try {
      await api.put(`/payments/${input._id}/approve`, {});
      toast.success('Payment approved! Receipt generated.');
      // Refresh list
      const res = await api.get('/payments/owner/requests');
      setPaymentRequests(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve payment');
    }
  };

  const handleRejectPayment = async (id: string) => {
    try {
      await api.put(`/payments/${id}/reject`, {});
      toast.success('Payment rejected.');
      // Refresh list
      const res = await api.get('/payments/owner/requests');
      setPaymentRequests(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject payment');
    }
  };

  const handleEditProperty = (property: Property) => {
    console.log('Editing property:', property);
    setEditingProperty(property);
    setIsPropertyFormOpen(true);
  };

  const handleDeleteProperty = (property: Property) => {
    setDeletingProperty(property);
  };

  const confirmDeleteProperty = () => {
    if (deletingProperty) {
      deletePropertyMutation.mutate(deletingProperty.id || (deletingProperty as any)._id, {
        onSuccess: () => {
          toast.success(t('Property deleted successfully', 'சொத்து வெற்றிகரமாக நீக்கப்பட்டது'));
          setDeletingProperty(null);
        },
        onError: (error: any) => {
          const msg = error?.response?.data?.msg || t('Failed to delete property', 'சொத்தை நீக்க முடியவில்லை');
          toast.error(msg);
        }
      });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const updateData = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        aadhar: formData.get('aadhar'),
        address: formData.get('address'),
        dateOfBirth: formData.get('dateOfBirth'),
        gender: formData.get('gender'),
        occupation: formData.get('occupation'),
        companyName: formData.get('companyName'),
        monthlyIncome: formData.get('monthlyIncome')
          ? parseInt(formData.get('monthlyIncome') as string)
          : undefined,
        maritalStatus: formData.get('maritalStatus'),
        familyMembers: formData.get('familyMembers')
          ? parseInt(formData.get('familyMembers') as string)
          : undefined,
        idType: formData.get('idType'),
        idNumber: formData.get('idNumber'),
        idProofImage: idProofImage || undefined,
        notificationsEnabled: formData.get('notificationsEnabled') === 'on'
      };

      await api.put('/users/profile', updateData);

      await refetchUserProfile();
      toast.success(t('Profile updated successfully', 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது'));
    } catch (err) {
      console.error('Profile update error:', err);
      toast.error(t('Failed to update profile', 'சுயவிவரத்தைப் புதுப்பிக்க முடியவில்லை'));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const currentPassword = (formData.get('currentPassword') as string) || '';
      const newPassword = (formData.get('newPassword') as string) || '';
      const confirmPassword = (formData.get('confirmPassword') as string) || '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error(
          t('Please fill all password fields', 'கடவுச்சொல் தொடர்பான அனைத்து புலங்களையும் நிரப்பவும்')
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error(
          t('New password and confirm password do not match', 'புதிய கடவுச்சொல் மற்றும் உறுதிப்படுத்தல் கடவுச்சொல் பொருந்தவில்லை')
        );
        return;
      }

      await api.put('/auth/change-password', { currentPassword, newPassword });

      form.reset();
      toast.success(
        t('Password updated successfully', 'கடவுச்சொல் வெற்றிகரமாக புதுப்பிக்கப்பட்டது')
      );
    } catch (err: any) {
      console.error('Change password error:', err);
      const msg =
        err?.response?.data?.msg ||
        t('Failed to update password', 'கடவுச்சொல்லை புதுப்பிக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  const totalProperties = myProperties.length;
  const occupiedProperties = myProperties.filter((p: any) => p.tenant).length;
  const vacantProperties = totalProperties - occupiedProperties;
  const totalTenants = (() => {
    const ids = new Set<string>();
    (myProperties as any[]).forEach((p) => {
      if (!p.tenant) return;
      if (typeof p.tenant === 'string') {
        ids.add(p.tenant);
      } else if (p.tenant._id) {
        ids.add(p.tenant._id);
      } else if (p.tenant.email) {
        ids.add(p.tenant.email);
      } else if (p.tenant.name) {
        ids.add(p.tenant.name);
      }
    });
    return ids.size;
  })();

  const allPropertiesList = myProperties as any[];
  const occupiedPropertiesList = allPropertiesList.filter((p: any) => p.tenant);
  const vacantPropertiesList = allPropertiesList.filter((p: any) => !p.tenant);

  const tenantSummary = (() => {
    const map = new Map<string, any>();
    occupiedPropertiesList.forEach((p: any) => {
      const t = p.tenantDetails || p.tenant;
      if (!t) return;
      let key = '';
      if (typeof t === 'string') {
        key = t;
      } else if (t._id) {
        key = t._id;
      } else if (t.email) {
        key = t.email;
      } else if (t.name) {
        key = t.name;
      }
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: typeof t === 'object' && t.name ? t.name : '',
          email: typeof t === 'object' && t.email ? t.email : '',
          phone: typeof t === 'object' && t.phone ? t.phone : '',
          properties: []
        });
      }
      const entry = map.get(key);
      entry.properties.push(p.title || '');
    });
    return Array.from(map.values());
  })();

  const currentPropertyList =
    rentDetailsType === 'totalProperties'
      ? allPropertiesList
      : rentDetailsType === 'occupiedProperties'
        ? occupiedPropertiesList
        : rentDetailsType === 'vacantProperties'
          ? vacantPropertiesList
          : [];

  const handleSelectProperty = (property: Property, tab: string = 'overview') => {
    const propId = getId(property);
    setSelectedProperty(property);
    setSelectedPropertyInitialTab(tab);

    if (onSelectProperty) {
      onSelectProperty(propId);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('propertyId', propId);
      window.history.pushState({ propertyId: propId }, '', url.toString());
    }
  };

  const handleBackFromProperty = () => {
    setSelectedProperty(null);
    setSelectedPropertyInitialTab('overview');
    if (onSelectProperty) {
      onSelectProperty(null);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('propertyId');
      window.history.pushState({}, '', url.toString());
    }
  };

  const openPropertyForId = (propertyId: string, tab: string = 'overview') => {
    const match = (myProperties as any[]).find((p: any) => getId(p) === propertyId);
    if (!match) {
      toast.error(t('Property not found for this request', 'இந்த கோரிக்கைக்கான சொத்து கிடைக்கவில்லை'));
      return;
    }
    setTenantRequestsModalType(null);
    setActiveTab('properties');
    handleSelectProperty(match, tab);
  };

  useEffect(() => {
    if (selectedPropertyId && myProperties.length > 0) {
      const found = (myProperties as any[]).find((p: any) => getId(p) === selectedPropertyId);
      if (found) {
        setSelectedProperty(found);
      }
    } else if (selectedPropertyId === null && onSelectProperty) {
      setSelectedProperty(null);
    }
  }, [selectedPropertyId, myProperties, onSelectProperty]);

  useEffect(() => {
    if (onSelectProperty) return; // Router handles history when onSelectProperty is provided
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const propId = params.get('propertyId');
      if (propId && myProperties.length > 0) {
        const found = (myProperties as any[]).find((p: any) => getId(p) === propId);
        if (found) {
          setSelectedProperty(found);
        } else {
          setSelectedProperty(null);
        }
      } else {
        setSelectedProperty(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [myProperties, onSelectProperty]);

  useEffect(() => {
    if (onSelectProperty) return; // Router handles history when onSelectProperty is provided
    const params = new URLSearchParams(window.location.search);
    const propId = params.get('propertyId');
    if (propId && myProperties.length > 0 && !selectedProperty) {
      const found = (myProperties as any[]).find((p: any) => getId(p) === propId);
      if (found) {
        setSelectedProperty(found);
      } else {
        toast.error(t('Property not found or unauthorized', 'சொத்து கிடைக்கவில்லை அல்லது அனுமதியில்லை'));
        const url = new URL(window.location.href);
        url.searchParams.delete('propertyId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [myProperties, selectedProperty, onSelectProperty]);

  const currentSelectedProperty = useMemo(() => {
    if (!selectedProperty) return null;
    const currentId = getId(selectedProperty);
    return (myProperties as any[]).find((p: any) => getId(p) === currentId) || selectedProperty;
  }, [myProperties, selectedProperty]);

  const activeOwnerProperty = useMemo(() => {
    if (currentSelectedProperty) return currentSelectedProperty;
    if (myProperties && myProperties.length > 0) return myProperties[0];
    return null;
  }, [currentSelectedProperty, myProperties]);

  return (
    <>
      <div className={hideHeaderActions ? "w-full" : "w-full py-6 sm:py-8 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12"}>
        <div className="w-full space-y-8">

          {/* Header Section */}
          {!hideHeaderActions && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {t('Owner Dashboard', 'உரிமையாளர் கட்டுப்பாட்டு அறை')}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {t('Welcome back', 'மீண்டும் வருக')}, {userProfile?.name || 'Owner'}
                  </p>
                </div>
                <Button onClick={() => setIsPropertyFormOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('Add Property', 'சொத்தைச் சேர்க்கவும்')}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-11 justify-start rounded-xl" onClick={() => onBrowseProperties?.('rent')}>
                  <Home className="mr-2 h-4 w-4" />
                  {t('Rent', 'வாடகை')}
                </Button>
                <Button variant="outline" className="h-11 justify-start rounded-xl" onClick={() => onBrowseProperties?.('buy')}>
                  <Building className="mr-2 h-4 w-4" />
                  {t('Buy', 'வாங்க')}
                </Button>
                <Button className="h-11 justify-start rounded-xl" onClick={() => setIsPropertyFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('List Property', 'சொத்தை பட்டியலிடுங்கள்')}
                </Button>
                <Button
                  variant="outline"
                  className="relative h-11 justify-start rounded-xl border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => openMessenger()}
                >
                  <MessageSquare className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>{t('Messenger', 'செய்தியாளர்')}</span>
                  {messengerUnreadCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                      {messengerUnreadCount > 9 ? '9+' : messengerUnreadCount}
                    </span>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Navigation Tabs */}
          <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
            {!hideHeaderActions && (
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
                <TabsTrigger value="overview">
                  <Home className="w-4 h-4 mr-2" />
                  {t('Overview', 'கண்ணோட்டம்')}
                </TabsTrigger>
                <TabsTrigger value="properties">
                  <Building className="w-4 h-4 mr-2" />
                  {t('My Properties', 'என் சொத்துக்கள்')}
                </TabsTrigger>
                <TabsTrigger value="requests">
                  <Inbox className="w-4 h-4 mr-2" />
                  {t('Requests', 'கோரிக்கைகள்')}
                </TabsTrigger>
                <TabsTrigger value="announcements">
                  <Megaphone className="w-4 h-4 mr-2" />
                  {t('Announcements', 'அறிவிப்புகள்')}
                  {announcements.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                      {announcements.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reports">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('Reports', 'அறிக்கைகள்')}
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <User className="w-4 h-4 mr-2" />
                  {t('My Profile', 'என் சுயவிவரம்')}
                </TabsTrigger>
              </TabsList>
            )}

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6 space-y-8">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('totalProperties')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('Total Properties', 'மொத்த சொத்துக்கள்')}
                    </CardTitle>
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalProperties}</div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('occupiedProperties')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('Occupied Properties', 'குடியேற்றப்பட்ட சொத்துக்கள்')}
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{occupiedProperties}</div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('vacantProperties')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('Vacant Properties', 'காலியாக உள்ள சொத்துக்கள்')}
                    </CardTitle>
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{vacantProperties}</div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('totalTenants')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('Total Tenants', 'மொத்த குத்தகைதாரர்கள்')}
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTenants}</div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('expectedRent')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('This Month Expected Rent', 'இந்த மாத எதிர்பார்க்கப்படும் வாடகை')}
                    </CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{financialSummary.expected.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer"
                  onClick={() => setRentDetailsType('pendingRent')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t('This Month Pending Rent', 'இந்த மாத நிலுவை வாடகை')}
                    </CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{financialSummary.pending.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <Card
                  id="tenant-requests-overview"
                  className={totalPendingRequests > 0 ? "border-amber-500/50 shadow-md transition-all duration-500 relative overflow-hidden" : ""}
                >
                  {totalPendingRequests > 0 && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping -mr-1 -mt-1" />
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {t('Tenant Requests Overview', 'குத்தகைதாரர் கோரிக்கைகள் கண்ணோட்டம்')}
                      {totalPendingRequests > 0 && (
                        <Badge variant="destructive" className="ml-2 animate-pulse">
                          {totalPendingRequests} {t('New', 'புதியது')}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        'Quick view of rent, maintenance and payment requests',
                        'வாடகை, பராமரிப்பு மற்றும் கட்டண கோரிக்கைகளின் விரைவு கண்ணோட்டம்'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted/50 ${overviewActiveSection === 'rentRequests' ? 'bg-muted' : ''
                        } ${pendingRentCount > 0 ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''}`}
                      onClick={() => {
                        setOverviewActiveSection('rentRequests');
                        setTenantRequestsModalType('rent');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${pendingRentCount > 0 ? 'bg-blue-100' : 'bg-muted'}`}>
                          <Home className={`h-4 w-4 ${pendingRentCount > 0 ? 'text-blue-600' : 'text-blue-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {t('Rent Requests', 'வாடகை கோரிக்கைகள்')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              'Incoming rent enquiries from tenants',
                              'குத்தகைதாரர்களிடமிருந்து வரும் வாடகை தொடர்பான கோரிக்கைகள்'
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={pendingRentCount > 0 ? "destructive" : "secondary"} className={pendingRentCount > 0 ? "animate-pulse" : ""}>
                        {pendingRentCount}
                      </Badge>
                    </div>

                    <div
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted/50 ${overviewActiveSection === 'maintenanceRequests' ? 'bg-muted' : ''
                        } ${pendingMaintenanceCount > 0 ? 'border-l-4 border-l-amber-500 bg-amber-50/50' : ''}`}
                      onClick={() => {
                        setOverviewActiveSection('maintenanceRequests');
                        setTenantRequestsModalType('maintenance');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${pendingMaintenanceCount > 0 ? 'bg-amber-100' : 'bg-muted'}`}>
                          <Wrench className={`h-4 w-4 ${pendingMaintenanceCount > 0 ? 'text-amber-600' : 'text-amber-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              'Issues raised by tenants for your properties',
                              'உங்கள் சொத்துகளுக்காக குத்தகைதாரர்கள் எழுப்பிய சிக்கல்கள்'
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={pendingMaintenanceCount > 0 ? "destructive" : "secondary"} className={pendingMaintenanceCount > 0 ? "animate-pulse" : ""}>
                        {pendingMaintenanceCount}
                      </Badge>
                    </div>

                    <div
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted/50 ${overviewActiveSection === 'paymentRequests' ? 'bg-muted' : ''
                        } ${pendingPaymentCount > 0 ? 'border-l-4 border-l-green-500 bg-green-50/50' : ''}`}
                      onClick={() => {
                        setOverviewActiveSection('paymentRequests');
                        setTenantRequestsModalType('payment');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${pendingPaymentCount > 0 ? 'bg-green-100' : 'bg-muted'}`}>
                          <CreditCard className={`h-4 w-4 ${pendingPaymentCount > 0 ? 'text-green-600' : 'text-green-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {t('Payment Requests', 'கட்டண கோரிக்கைகள்')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              'Pending rent payments submitted by tenants',
                              'குத்தகைதாரர்களால் சமர்ப்பிக்கப்பட்ட நிலுவை வாடகை கட்டணங்கள்'
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={pendingPaymentCount > 0 ? "destructive" : "secondary"} className={pendingPaymentCount > 0 ? "animate-pulse" : ""}>
                        {pendingPaymentCount}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <RentStatusGraph
                  data={rentHistory?.graph || []}
                  payments={rentHistory?.lastPayments || []}
                  title={t('Rent Status Summary', 'வாடகை நிலை சுருக்கம்')}
                  role="owner"
                />
              </div>

              {announcements.length > 0 && (
                <Card className="mt-8">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-blue-600" />
                        {t('Recent Announcements', 'சமீபத்திய அறிவிப்புகள்')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t('Official notices from management', 'நிர்வாகத்தின் அதிகாரப்பூர்வ அறிவிப்புகள்')}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('announcements')}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {t('View All', 'அனைத்தையும் பார்க்க')} ({announcements.length})
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {announcements.slice(0, 2).map((ann) => (
                      <div
                        key={ann._id}
                        className="border rounded-xl p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{ann.title}</h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-blue-600" />
                      {t('Platform Announcements', 'தள அறிவிப்புகள்')}
                    </CardTitle>
                    <CardDescription>
                      {t('Important updates and official announcements from administration.', 'நிர்வாகத்திடமிருந்து முக்கியமான அறிவிப்புகள் மற்றும் புதுப்பிப்புகள்.')}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAnnouncements()}
                    disabled={announcementsLoading}
                    className="rounded-xl h-8 text-xs"
                  >
                    <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${announcementsLoading ? 'animate-spin' : ''}`} />
                    {t('Refresh', 'புதுப்பி')}
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  {announcementsLoading ? (
                    <div className="py-16 text-center text-muted-foreground space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm">{t('Loading announcements...', 'அறிவிப்புகள் ஏற்றப்படுகின்றன...')}</p>
                    </div>
                  ) : announcementsError ? (
                    <div className="py-12 text-center space-y-3">
                      <p className="text-sm text-destructive">{t('Failed to load announcements.', 'அறிவிப்புகளை ஏற்ற முடியவில்லை.')}</p>
                      <Button variant="outline" size="sm" onClick={() => refetchAnnouncements()} className="rounded-xl h-8">
                        {t('Retry', 'மீண்டும் முயற்சி')}
                      </Button>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground space-y-3">
                      <Megaphone className="h-12 w-12 mx-auto opacity-30" />
                      <p className="text-base font-medium">{t('No announcements at this time.', 'தற்போது அறிவிப்புகள் எதுவும் இல்லை.')}</p>
                      <p className="text-xs text-muted-foreground">{t('Check back later for updates and news from management.', 'நிர்வாகத்தின் புதுப்பிப்புகள் மற்றும் செய்திகளுக்குப் பின்னர் சரிபார்க்கவும்.')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map((ann) => (
                        <div
                          key={ann._id}
                          className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm hover:shadow transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-base text-foreground">{ann.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{new Date(ann.createdAt).toLocaleString()}</span>
                                <span>•</span>
                                <span>{ann.creatorName || t('Administrator', 'நிர்வாகி')}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="rounded-full text-xs shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                              {t('Announcement', 'அறிவிப்பு')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-xl border">
                            {ann.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Properties Tab */}
            <TabsContent value="properties" className="mt-4 sm:mt-6">
              {activeOwnerProperty ? (
                <PropertyFullScreenView
                  property={activeOwnerProperty}
                  properties={myProperties}
                  selectedPropertyId={getId(activeOwnerProperty)}
                  onSelectProperty={(prop) => {
                    setSelectedProperty(prop);
                    onSelectProperty?.(getId(prop));
                  }}
                  initialTab={selectedPropertyInitialTab}
                  onBack={handleBackFromProperty}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {t('No properties found. Add your first property!', 'சொத்துக்கள் எதுவும் காணப்படவில்லை. உங்கள் முதல் சொத்தைச் சேர்க்கவும்!')}
                </div>
              )}
            </TabsContent>

            {/* Requests Tab */}
            <TabsContent value="requests" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                  <div>
                    <CardTitle>{t('Property Requests', 'சொத்து கோரிக்கைகள்')}</CardTitle>
                    <CardDescription>
                      {t('Manage incoming rent and buy requests from potential tenants and buyers.', 'சாத்தியமான குத்தகைதாரர்கள் மற்றும் வாங்குபவர்களிடமிருந்து வரும் கோரிக்கைகளை நிர்வகிக்கவும்.')}
                    </CardDescription>
                  </div>

                  {/* Requirement 6: Owner Category Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRequestFilterCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${requestFilterCategory === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {t('Incoming Requests', 'பெறப்பட்ட கோரிக்கைகள்')} ({ownerRequestCounts.all})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFilterCategory('pending')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${requestFilterCategory === 'pending'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {t('Accept / Reject', 'ஏற்க / நிராகரிக்க')} ({ownerRequestCounts.pending})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFilterCategory('awaiting_payment')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${requestFilterCategory === 'awaiting_payment'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {t('Accepted / Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது / கட்டணம் நிலுவையில்')} ({ownerRequestCounts.awaitingPayment})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFilterCategory('completed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${requestFilterCategory === 'completed'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {t('Completed Transactions', 'முடிந்த ஒப்பந்தங்கள்')} ({ownerRequestCounts.completed})
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredOwnerRequests.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Inbox className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                      {t('No requests found in this category.', 'இந்த பிரிவில் கோரிக்கைகள் எதுவும் காணப்படவில்லை.')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOwnerRequests.map((request: any) => (
                        <div key={request._id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors gap-4">
                          <div className="space-y-1 mb-2 md:mb-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${request.type === 'rent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                }`}>
                                {request.type === 'rent' ? t('Rent Request', 'வாடகை கோரிக்கை') : t('Buy Request', 'வாங்க கோரிக்கை')}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${request.status === 'pending'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : ['accepted', 'approved', 'terms_confirmed'].includes(request.status)
                                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                  : request.status === 'payment_pending'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                    : request.status === 'completed'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                {request.status === 'pending'
                                  ? t('Pending Review', 'மதிப்பாய்வு நிலுவையில்')
                                  : ['accepted', 'approved', 'terms_confirmed'].includes(request.status)
                                    ? t('Accepted — Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது - கட்டணம் நிலுவை')
                                    : request.status === 'payment_pending'
                                      ? t('Payment Verification Pending', 'கட்டண சரிபார்ப்பு நிலுவையில்')
                                      : request.status === 'completed'
                                        ? t('Completed', 'முடிக்கப்பட்டது')
                                        : t('Declined', 'நிராகரிக்கப்பட்டது')}
                              </span>
                            </div>
                            <h4 className="font-semibold text-lg">{displayTa(request.property?.title)}</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span>{request.tenant?.name || 'Applicant'} ({request.tenant?.email})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                <span>{displayTa(request.property?.location)}</span>
                              </div>
                              {request.offerAmount && (
                                <div className="text-xs pt-1">
                                  <span className="text-muted-foreground">{t('Offer Amount: ', 'சலுகை தொகை: ')}</span>
                                  <b className="text-primary">₹{Number(request.offerAmount).toLocaleString('en-IN')}</b>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium"
                                  disabled={approveRequest.isPending || rejectRequest.isPending}
                                  onClick={() => handleApproveRequest(request._id)}
                                >
                                  {request.type === 'buy' ? t('Accept Offer', 'சலுகையை ஏற்றுக்கொள்') : t('Accept Application', 'விண்ணப்பத்தை ஏற்றுக்கொள்')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 font-medium"
                                  disabled={approveRequest.isPending || rejectRequest.isPending}
                                  onClick={() => handleRejectRequest(request._id)}
                                >
                                  {t('Reject', 'நிராகரி')}
                                </Button>
                              </>
                            )}
                            {request.status === 'payment_pending' && (
                              <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium"
                                onClick={() => setSelectedRequest(request)}
                              >
                                <CreditCard className="w-3.5 h-3.5 mr-1" />
                                {t('Verify Payment', 'கட்டணத்தை சரிபார்')}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRequest(request)}
                            >
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

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-2 pb-24">
              {/* MAIN CONTENT — 2-COLUMN FIT-TO-PAGE GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* LEFT COLUMN (lg:col-span-3): FULL-HEIGHT FROSTED SIDEBAR */}
                <div className="lg:col-span-3 h-full">
                  <div className="h-full flex flex-col justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-600/75 bg-white/85 dark:bg-slate-900/75 backdrop-blur-md p-2.5 shadow-sm">
                    {/* Top Section — Compact Single-Row Filter Strip */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/60 bg-white/90 dark:bg-slate-800/60 p-2 shadow-sm">
                      <div className="grid grid-cols-12 gap-1.5 items-end">
                        <div className="col-span-4">
                          <label className="text-[10px] font-medium text-slate-500 dark:text-slate-300 mb-0.5 block">{t('From', 'இருந்து')}</label>
                          <input
                            type="date"
                            value={reportFrom}
                            onChange={(e) => setReportFrom(e.target.value)}
                            className="w-full px-1.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] font-medium text-slate-500 dark:text-slate-300 mb-0.5 block">{t('To', 'வரை')}</label>
                          <input
                            type="date"
                            value={reportTo}
                            onChange={(e) => setReportTo(e.target.value)}
                            className="w-full px-1.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] font-medium text-slate-500 dark:text-slate-300 mb-0.5 block">{t('Property', 'சொத்து')}</label>
                          <select
                            value={reportPropertyId}
                            onChange={(e) => setReportPropertyId(e.target.value)}
                            className="w-full px-1.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">{t('All Properties', 'அனைத்து சொத்துகள்')}</option>
                            {myProperties.map((p: any) => (
                              <option key={String(p._id || p.id)} value={String(p._id || p.id)}>
                                {displayTa(p.title || t('Property', 'சொத்து'))}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section — The 3 Selector Cards */}
                    <div className="flex flex-col gap-2">
                      <div
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${activeReport === 'rent'
                          ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-400/60 ring-1 ring-blue-500/30'
                          : 'border-slate-200/80 dark:border-slate-600/75 bg-white/85 dark:bg-slate-900/75 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        onClick={() => {
                          setActiveReport('rent');
                          setReportFrom(monthStartStr);
                          setReportTo(todayStr);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                            {t('Generate Rent Report', 'வாடகை அறிக்கை உருவாக்கவும்')}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
                          {t('Summary + detailed rent collection.', 'சுருக்கம் + விரிவான வாடகை வசூல்.')}
                        </p>
                        <Button
                          className="w-full py-1 rounded-full text-xs font-semibold"
                          variant={activeReport === 'rent' ? 'default' : 'outline'}
                          size="sm"
                        >
                          {activeReport === 'rent' ? t('Selected', 'தேர்ந்தெடுக்கப்பட்டது') : t('Generate', 'உருவாக்கு')}
                        </Button>
                      </div>

                      <div
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${activeReport === 'occupancy'
                          ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-400/60 ring-1 ring-blue-500/30'
                          : 'border-slate-200/80 dark:border-slate-600/75 bg-white/85 dark:bg-slate-900/75 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        onClick={() => {
                          setActiveReport('occupancy');
                          setReportFrom(last90DaysStr);
                          setReportTo(todayStr);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                            {t('Generate Occupancy Report', 'குடியேற்ற அறிக்கை உருவாக்கவும்')}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
                          {t('Occupied vs vacant properties.', 'குடியேற்றம் மற்றும் காலி சொத்துகள்.')}
                        </p>
                        <Button
                          className="w-full py-1 rounded-full text-xs font-semibold"
                          variant={activeReport === 'occupancy' ? 'default' : 'outline'}
                          size="sm"
                        >
                          {activeReport === 'occupancy' ? t('Selected', 'தேர்ந்தெடுக்கப்பட்டது') : t('Generate', 'உருவாக்கு')}
                        </Button>
                      </div>

                      <div
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${activeReport === 'maintenance'
                          ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-400/60 ring-1 ring-blue-500/30'
                          : 'border-slate-200/80 dark:border-slate-600/75 bg-white/85 dark:bg-slate-900/75 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        onClick={() => {
                          setActiveReport('maintenance');
                          setReportFrom(last180DaysStr);
                          setReportTo(todayStr);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                            {t('Generate Maintenance Report', 'பராமரிப்பு அறிக்கை உருவாக்கவும்')}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
                          {t('Requests, status, and cost.', 'கோரிக்கைகள், நிலை, மற்றும் செலவு.')}
                        </p>
                        <Button
                          className="w-full py-1 rounded-full text-xs font-semibold"
                          variant={activeReport === 'maintenance' ? 'default' : 'outline'}
                          size="sm"
                        >
                          {activeReport === 'maintenance' ? t('Selected', 'தேர்ந்தெடுக்கப்பட்டது') : t('Generate', 'உருவாக்கு')}
                        </Button>
                      </div>
                    </div>

                    {/* Bottom group: Insights Summary Card */}
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/60 p-2.5 shadow-sm space-y-1.5 mt-auto">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                        {aiInsights.length && filteredRows.length > 0
                          ? t('AI Insights', 'AI உள்ளுணர்வுகள்')
                          : t('Insights', 'உள்ளுணர்வுகள்')}
                      </div>
                      {aiInsights.length && filteredRows.length > 0 ? (
                        <div className="space-y-1">
                          {aiExecutiveSummary ? (
                            <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                              {aiExecutiveSummary}
                            </div>
                          ) : null}
                          <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                            {aiInsights.slice(0, 3).map((ins, idx) => (
                              <li key={`${idx}-${ins.slice(0, 20)}`}>{String(ins)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : activeReport === 'rent' && rentDerived ? (
                        <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                          <li>{t(`${rentDerived.pendingTenants} tenant(s) have pending dues`, `${rentDerived.pendingTenants} குத்தகைதாரர்களுக்கு நிலுவை உள்ளது`)}</li>
                          <li>{t(`Collection Efficiency: ${rentDerived.collectedPct}%`, `வசூல் திறன்: ${rentDerived.collectedPct}%`)}</li>
                          <li>{t(`Defaulters identified: ${rentDerived.defaulters}`, `தவறியவர்கள்: ${rentDerived.defaulters}`)}</li>
                        </ul>
                      ) : activeReport === 'occupancy' && occupancyDerived ? (
                        <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                          <li>{t(`Occupancy Rate: ${occupancyDerived.occupancyRate.toFixed(1)}%`, `குடியேற்ற விகிதம்: ${occupancyDerived.occupancyRate.toFixed(1)}%`)}</li>
                          <li>{t(`Occupied units: ${occupancyDerived.occupied}`, `குடியேற்றப்பட்டவை: ${occupancyDerived.occupied}`)}</li>
                          <li>{t(`Vacant units: ${occupancyDerived.vacant}`, `காலியாக உள்ளவை: ${occupancyDerived.vacant}`)}</li>
                        </ul>
                      ) : activeReport === 'maintenance' ? (
                        <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                          <li>{t(`Total Requests: ${(filteredSummary as any)?.totalRequests ?? 0}`, `மொத்த கோரிக்கைகள்: ${(filteredSummary as any)?.totalRequests ?? 0}`)}</li>
                          <li>{t(`Completed: ${(filteredSummary as any)?.completed ?? 0}`, `முடிந்தது: ${(filteredSummary as any)?.completed ?? 0}`)}</li>
                          <li>{t(`Pending: ${(filteredSummary as any)?.pending ?? 0}`, `நிலுவையில்: ${(filteredSummary as any)?.pending ?? 0}`)}</li>
                        </ul>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          {t('Select filters and click Generate Report.', 'வடிகட்டிகளைத் தேர்ந்தெடுத்து “அறிக்கை உருவாக்கு” ஐ கிளிக் செய்யவும்.')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN (lg:col-span-9): ACTIVE GENERATED REPORT VIEW */}
                <div className="lg:col-span-9 h-full">
                  {activeReport ? (
                    <Card className="h-full flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 m-0">
                        <div className="w-full min-w-0 space-y-0.5">
                          <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">{buildReportTitle()}</CardTitle>
                          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                            {t('Summary on top, detailed table below.', 'மேல் பகுதியில் சுருக்கம், கீழே விரிவான அட்டவணை.')}
                          </CardDescription>
                        </div>

                        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                          <Button
                            className="h-8.5 px-3 py-1.5 text-xs whitespace-nowrap rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm w-full sm:w-auto justify-center"
                            onClick={() => {
                              if (!activeReport) return;
                              if (activeReport === 'rent') rentReportQuery.refetch();
                              if (activeReport === 'occupancy') occupancyReportQuery.refetch();
                              if (activeReport === 'maintenance') maintenanceReportQuery.refetch();
                            }}
                            disabled={isGeneratingReport}
                          >
                            {isGeneratingReport ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            {t('Generate Report', 'அறிக்கை உருவாக்கு')}
                          </Button>
                          <Button variant="outline" className="h-8.5 px-3 py-1.5 text-xs whitespace-nowrap rounded-xl w-full sm:w-auto justify-center" onClick={handleDownloadPdf} disabled={!currentReport || isGeneratingReport}>
                            {isGeneratingReport ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                            {t('Download as PDF', 'PDF ஆக பதிவிறக்கவும்')}
                          </Button>
                          <Button variant="outline" className="h-8.5 px-3 py-1.5 text-xs whitespace-nowrap rounded-xl w-full sm:w-auto justify-center" onClick={handlePrint} disabled={!currentReport || isGeneratingReport}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" />
                            {t('Print Report', 'அறிக்கையை அச்சிடு')}
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8.5 px-3 py-1.5 text-xs whitespace-nowrap rounded-xl w-full sm:w-auto justify-center"
                            onClick={() => {
                              if (!activeReport || !currentReport) return;
                              const nowStamp = new Date().toISOString().slice(0, 10);
                              const lines: string[] = [];
                              lines.push(`RESIDE REPORT`);
                              lines.push(`${escCsv(buildReportTitle())}`);
                              lines.push(`Owner,${escCsv(userProfile?.name || 'Owner')}`);
                              lines.push(`Range,${escCsv(reportFrom)} to ${escCsv(reportTo)}`);
                              lines.push('');

                              if (activeReport === 'rent') {
                                const s = (filteredSummary as any) || {};
                                lines.push(`Total Properties,${escCsv(s.totalProperties ?? 0)}`);
                                lines.push(`Total Rent Expected,${escCsv(s.totalRentExpected ?? 0)}`);
                                lines.push(`Total Rent Collected,${escCsv(s.totalRentCollected ?? 0)}`);
                                lines.push(`Pending Amount,${escCsv(s.pendingAmount ?? 0)}`);
                                lines.push('');
                                lines.push('Property,Tenant Name,Rent,Paid,Pending,Payment Date,Status');
                                filteredRows.forEach((r: any) => {
                                  lines.push(
                                    `${escCsv(r.propertyTitle || r.propertyId || '')},${escCsv(r.tenantName || '')},${escCsv(r.rent ?? 0)},${escCsv(r.paid ?? 0)},${escCsv(r.pending ?? 0)},${escCsv(formatShortDate(r.paymentDate || r.dueDate || r.month))},${escCsv(r.status || '')}`
                                  );
                                });
                              }

                              if (activeReport === 'occupancy') {
                                const s = (filteredSummary as any) || {};
                                lines.push(`Total Properties,${escCsv(s.totalProperties ?? 0)}`);
                                lines.push(`Occupied,${escCsv(s.occupied ?? 0)}`);
                                lines.push(`Vacant,${escCsv(s.vacant ?? 0)}`);
                                lines.push(`Occupancy Rate,${escCsv(s.occupancyRate ?? 0)}`);
                                lines.push('');
                                lines.push('Property,Location,Status,Tenant Name');
                                filteredRows.forEach((r: any) => {
                                  lines.push(
                                    `${escCsv(r.propertyTitle || r.propertyId || '')},${escCsv(r.location || '')},${escCsv(r.status || '')},${escCsv(r.tenantName || '')}`
                                  );
                                });
                              }

                              if (activeReport === 'maintenance') {
                                const s = (filteredSummary as any) || {};
                                lines.push(`Total Requests,${escCsv(s.totalRequests ?? 0)}`);
                                lines.push(`Completed,${escCsv(s.completed ?? 0)}`);
                                lines.push(`Pending,${escCsv(s.pending ?? 0)}`);
                                lines.push('');
                                lines.push('Maintenance Name,Property,Status');
                                filteredRows.forEach((r: any) => {
                                  lines.push(
                                    `${escCsv(r.issue || '')},${escCsv(r.propertyTitle || '')},${escCsv(r.status || '')}`
                                  );
                                });
                              }

                              downloadCsv(`reside-${activeReport}-report-${nowStamp}.csv`, lines);
                            }}
                            disabled={!currentReport || isGeneratingReport}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {t('Export CSV', 'CSV ஏற்றுமதி')}
                          </Button>
                        </div>
                      </div>

                      {activeReport ? (
                        <div className="py-2 my-1 border-y border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{t('Owner Name', 'உரிமையாளர் பெயர்')}:</span>{' '}
                              <span>{String(userProfile?.name || 'Owner')}</span>
                            </div>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{t('Report Period', 'அறிக்கை காலம்')}:</span>{' '}
                              <span>{reportFrom} → {reportTo}</span>
                            </div>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{t('Generated On', 'உருவாக்கப்பட்ட தேதி')}:</span>{' '}
                              <span>{formatShortDate(currentReport?.generatedAt || new Date().toISOString())}</span>
                            </div>
                          </div>
                          <div className="italic text-[11px] text-slate-400 dark:text-slate-400">
                            {aiIsGenerated
                              ? t(
                                'This report is AI-assisted and generated by Reside Management System.',
                                'இந்த அறிக்கை AI உதவியுடன் Reside Management System மூலம் உருவாக்கப்படுகிறது.'
                              )
                              : t('This report is system-generated by Reside Management System.', 'இந்த அறிக்கை Reside Management System மூலம் உருவாக்கப்படுகிறது.')}
                          </div>
                        </div>
                      ) : null}

                      <CardContent className="p-0 space-y-2">
                        {isGeneratingReport ? (
                          <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {t('Generating report...', 'அறிக்கை உருவாக்கப்படுகிறது...')}
                          </div>
                        ) : null}

                        {!isGeneratingReport && !currentReport ? (
                          <div className="py-8 text-center text-muted-foreground">
                            {reportErrorMessage ? (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-red-600">
                                  {t('Failed to generate report.', 'அறிக்கையை உருவாக்க முடியவில்லை.')}
                                </div>
                                <div className="text-xs text-red-600">{reportErrorMessage}</div>
                                <div className="text-xs text-muted-foreground">
                                  {t(
                                    'If you just updated the backend, restart the server and click Generate Report.',
                                    'நீங்கள் இப்போதுதான் backend-ஐ புதுப்பித்திருந்தால், server-ஐ மீண்டும் தொடங்கி “அறிக்கை உருவாக்கு” ஐ கிளிக் செய்யவும்.'
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div>{t('Click Generate Report to load the report.', 'அறிக்கையை பார்க்க “அறிக்கை உருவாக்கு” ஐ கிளிக் செய்யவும்.')}</div>
                                <div className="text-xs">{t('Adjust filters if needed.', 'தேவைப்பட்டால் வடிப்பான்களை மாற்றவும்.')}</div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {!isGeneratingReport && currentReport ? (
                          <>
                            <div className={`grid ${activeReport === 'maintenance' ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'} gap-2 mt-1.5 mb-2`}>
                              {activeReport === 'rent' ? (
                                <>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Total Properties', 'மொத்த சொத்துக்கள்')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.totalProperties ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Total Rent Expected', 'மொத்த எதிர்பார்க்கப்படும் வாடகை')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{money((filteredSummary as any)?.totalRentExpected ?? 0)}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Total Rent Collected', 'மொத்த வசூலிக்கப்பட்ட வாடகை')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{money((filteredSummary as any)?.totalRentCollected ?? 0)}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Pending Amount', 'நிலுவை தொகை')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{money((filteredSummary as any)?.pendingAmount ?? 0)}</div>
                                  </div>
                                </>
                              ) : null}

                              {activeReport === 'occupancy' ? (
                                <>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Total Properties', 'மொத்த சொத்துக்கள்')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.totalProperties ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Occupied', 'குடியேற்றப்பட்டது')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.occupied ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Vacant', 'காலி')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.vacant ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Occupancy Rate', 'குடியேற்ற விகிதம்')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.occupancyRate ?? 0).toFixed(2)}%</div>
                                  </div>
                                </>
                              ) : null}

                              {activeReport === 'maintenance' ? (
                                <>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Total Requests', 'மொத்த கோரிக்கைகள்')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.totalRequests ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Completed', 'முடிந்தது')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.completed ?? 0).toLocaleString()}</div>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/90 dark:bg-slate-900/75 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 leading-tight">{t('Pending', 'நிலுவையில்')}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0 leading-snug">{Number((filteredSummary as any)?.pending ?? 0).toLocaleString()}</div>
                                  </div>
                                </>
                              ) : null}
                            </div>

                            {activeReport === 'rent' && rentDerived ? (
                              <div className="grid gap-2.5 mb-2 md:grid-cols-2">
                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Payment Status', 'கட்டண நிலை')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={paymentStatusChartRef} className="h-32 w-full">
                                      {rentDerived.paymentStatusData.some((d) => Number(d?.value ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie data={rentDerived.paymentStatusData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={48} paddingAngle={2}>
                                              <Cell fill="#16a34a" />
                                              <Cell fill="#ef4444" />
                                            </Pie>
                                            <Tooltip formatter={(v: any) => money(v)} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[11px] px-2 py-0.5">
                                        {t('Collected', 'வசூலிக்கப்பட்டது')} {rentDerived.collectedPct}%
                                      </Badge>
                                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[11px] px-2 py-0.5">
                                        {t('Pending', 'நிலுவையில்')} {rentDerived.pendingPct}%
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Monthly Rent Collection', 'மாதாந்திர வாடகை வசூல்')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={monthlyCollectionChartRef} className="h-32 w-full">
                                      {rentDerived.monthlyCollection.some((d) => Number(d?.amount ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={rentDerived.monthlyCollection}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.35} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} height={20} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v || 0) / 1000}k`} />
                                            <Tooltip formatter={(v: any) => money(v)} />
                                            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44} fill="#2563eb" />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            {activeReport === 'occupancy' && occupancyDerived ? (
                              <div className="grid gap-2.5 mb-2 md:grid-cols-2">
                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Occupancy Status', 'குடியேற்ற நிலை')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={occupancyStatusChartRef} className="h-32 w-full">
                                      {occupancyDerived.statusData.some((d) => Number(d?.value ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie data={occupancyDerived.statusData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={48} paddingAngle={2}>
                                              <Cell fill="#2563eb" />
                                              <Cell fill="#94a3b8" />
                                            </Pie>
                                            <Tooltip />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[11px] px-2 py-0.5">
                                        {t('Occupied', 'குடியேற்றப்பட்டது')} {occupancyDerived.occupiedPct}%
                                      </Badge>
                                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[11px] px-2 py-0.5">
                                        {t('Vacant', 'காலி')} {occupancyDerived.vacantPct}%
                                      </Badge>
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px] px-2 py-0.5">
                                        {t('Rate', 'விகிதம்')} {occupancyDerived.occupancyRate.toFixed(2)}%
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Occupancy Breakdown', 'குடியேற்ற விவரம்')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={occupancyBreakdownChartRef} className="h-32 w-full">
                                      {occupancyDerived.breakdownData.some((d) => Number(d?.count ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={occupancyDerived.breakdownData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.35} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} height={20} />
                                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                              <Cell fill="#2563eb" />
                                              <Cell fill="#94a3b8" />
                                            </Bar>
                                          </BarChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            {activeReport === 'maintenance' && maintenanceDerived ? (
                              <div className="grid gap-2.5 mb-2 md:grid-cols-2">
                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Request Status', 'கோரிக்கை நிலை')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={maintenanceStatusChartRef} className="h-32 w-full">
                                      {maintenanceDerived.statusData.some((d) => Number(d?.value ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie data={maintenanceDerived.statusData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={48} paddingAngle={2}>
                                              <Cell fill="#16a34a" />
                                              <Cell fill="#f59e0b" />
                                              <Cell fill="#ef4444" />
                                            </Pie>
                                            <Tooltip />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="rounded-xl border border-slate-200/80 dark:border-slate-600/75 bg-white/60 dark:bg-slate-800/60 p-2.5">
                                  <CardHeader className="p-0 pb-1">
                                    <CardTitle className="text-xs font-semibold">{t('Top Maintenance Types', 'முக்கிய பராமரிப்பு வகைகள்')}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div ref={maintenanceIssueChartRef} className="h-32 w-full">
                                      {maintenanceDerived.topIssues.some((d) => Number(d?.count ?? 0) > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={maintenanceDerived.topIssues}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.35} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} textAnchor="middle" tick={{ fontSize: 11 }} height={20} />
                                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} fill="#7c3aed" />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                          {t('No data for selected range', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு தரவு இல்லை')}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 shadow-2xs">
                              <Table className="w-full min-w-[540px]">
                                <TableHeader>
                                  <TableRow className="h-8">
                                    {activeReport === 'rent' ? (
                                      <>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Property', 'சொத்து')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Tenant Name', 'குத்தகைதாரர் பெயர்')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs text-right">{t('Rent', 'வாடகை')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs text-right">{t('Paid', 'செலுத்தப்பட்டது')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs text-right">{t('Pending', 'நிலுவை')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Payment Date', 'கட்டண தேதி')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Payment Status', 'கட்டண நிலை')}</TableHead>
                                      </>
                                    ) : null}

                                    {activeReport === 'occupancy' ? (
                                      <>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Property', 'சொத்து')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Location', 'இடம்')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Status', 'நிலை')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Tenant Name', 'குத்தகைதாரர் பெயர்')}</TableHead>
                                      </>
                                    ) : null}

                                    {activeReport === 'maintenance' ? (
                                      <>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Maintenance Name', 'பராமரிப்பு பெயர்')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Property', 'சொத்து')}</TableHead>
                                        <TableHead className="py-1.5 px-2.5 text-xs">{t('Status', 'நிலை')}</TableHead>
                                      </>
                                    ) : null}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredRows.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={activeReport === 'rent' ? 7 : activeReport === 'occupancy' ? 4 : 3}
                                        className="text-center py-6 text-xs text-muted-foreground"
                                      >
                                        {t('No records found for the selected date range and property.', 'தேர்ந்தெடுக்கப்பட்ட தேதி வரம்பு மற்றும் சொத்திற்கு பதிவுகள் எதுவும் இல்லை.')}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredRows.map((r: any) => (
                                      <TableRow key={String(r.rentRecordId || r.propertyId || r.requestId)}>
                                        {activeReport === 'rent' ? (
                                          <>
                                            <TableCell className="py-1.5 px-2.5 text-xs font-medium">{String(r.propertyTitle || r.propertyId || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.tenantName || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs text-right">{money(r.rent ?? 0)}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs text-right">{money(r.paid ?? 0)}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs text-right">{money(r.pending ?? 0)}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{formatShortDate(r.paymentDate || r.dueDate || r.month)}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">
                                              {(() => {
                                                const st = String(r.status || '');
                                                const cls =
                                                  st === 'paid'
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-100 text-[11px] px-2 py-0.5'
                                                    : st === 'partially_paid'
                                                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 text-[11px] px-2 py-0.5'
                                                      : st === 'overdue'
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-100 text-[11px] px-2 py-0.5'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-100 text-[11px] px-2 py-0.5';
                                                return <Badge className={cls}>{st || t('pending', 'நிலுவையில்')}</Badge>;
                                              })()}
                                            </TableCell>
                                          </>
                                        ) : null}

                                        {activeReport === 'occupancy' ? (
                                          <>
                                            <TableCell className="py-1.5 px-2.5 text-xs font-medium">{String(r.propertyTitle || r.propertyId || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.location || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.status || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.tenantName || '')}</TableCell>
                                          </>
                                        ) : null}

                                        {activeReport === 'maintenance' ? (
                                          <>
                                            <TableCell className="py-1.5 px-2.5 text-xs font-medium">{String(r.issue || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.propertyTitle || '')}</TableCell>
                                            <TableCell className="py-1.5 px-2.5 text-xs">{String(r.status || '')}</TableCell>
                                          </>
                                        ) : null}
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="text-[11px] text-muted-foreground pt-1">
                              {aiIsGenerated
                                ? t('This is an AI-assisted report', 'இது AI உதவியுடன் உருவாக்கப்பட்ட அறிக்கை')
                                : t('This is a system-generated report', 'இது அமைப்பால் உருவாக்கப்பட்ட அறிக்கை')}
                            </div>
                          </>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="py-10 text-center text-muted-foreground">
                      {t('Choose a report card above to generate.', 'உருவாக்க மேலே உள்ள அறிக்கை அட்டையைத் தேர்ந்தெடுக்கவும்.')}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4">
              <ProfileSettingsView
                userProfile={userProfile}
                refetchUserProfile={refetchUserProfile}
              />
            </TabsContent>
          </Tabs>

          {/* Add/Edit Property Modal */}
          <PropertyForm
            open={isPropertyFormOpen}
            onOpenChange={(open) => {
              setIsPropertyFormOpen(open);
              if (!open) setEditingProperty(null);
            }}
            initialData={editingProperty}
          />

          {/* Listing Control Dialog */}
          <ListingControlDialog
            property={listingDialogProperty}
            open={isListingDialogOpen}
            onOpenChange={setIsListingDialogOpen}
            defaultAction={listingDefaultAction}
          />

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deletingProperty} onOpenChange={(open) => !open && setDeletingProperty(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Are you sure?', 'நிச்சயமாகவா?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'This action cannot be undone. This will permanently delete the property.',
                    'இந்தச் செயலைத் தவிர்க்க முடியாது. இது சொத்தை நிரந்தரமாக நீக்கும்.'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel', 'ரத்து')}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteProperty} className="bg-red-600 hover:bg-red-700">
                  {t('Delete', 'நீக்கு')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Dialog open={tenantRequestsModalType !== null} onOpenChange={(open) => !open && setTenantRequestsModalType(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {tenantRequestsModalType === 'rent'
                ? t('Rent Requests', 'வாடகை கோரிக்கைகள்')
                : tenantRequestsModalType === 'maintenance'
                  ? t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')
                  : t('Payment Requests', 'கட்டண கோரிக்கைகள்')}
            </DialogTitle>
            <DialogDescription>
              {tenantRequestsModalType === 'rent'
                ? t('Incoming rent enquiries from tenants', 'குத்தகைதாரர்களிடமிருந்து வரும் வாடகை தொடர்பான கோரிக்கைகள்')
                : tenantRequestsModalType === 'maintenance'
                  ? t('Issues raised by tenants for your properties', 'உங்கள் சொத்துகளுக்காக குத்தகைதாரர்கள் எழுப்பிய சிக்கல்கள்')
                  : t('Pending rent payments submitted by tenants', 'குத்தகைதாரர்களால் சமர்ப்பிக்கப்பட்ட நிலுவை வாடகை கட்டணங்கள்')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {tenantRequestsModalType === 'rent' ? (
              requests.filter((r: any) => r.type === 'rent').length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  {t('No rent requests found.', 'வாடகை கோரிக்கைகள் எதுவும் இல்லை.')}
                </div>
              ) : (
                requests
                  .filter((r: any) => r.type === 'rent')
                  .map((r: any) => (
                    <button
                      key={getId(r)}
                      type="button"
                      onClick={() => {
                        setTenantRequestsModalType(null);
                        setSelectedRequest(r);
                        setActiveTab('requests');
                      }}
                      className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{displayTa(r?.property?.title || t('Property', 'சொத்து'))}</p>
                          <p className="text-xs text-muted-foreground truncate">{displayTa(r?.property?.location || '')}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {String(r?.tenant?.name || t('Tenant', 'குத்தகைதாரர்'))}
                          </p>
                        </div>
                        <Badge variant={r?.status === 'pending' ? 'destructive' : 'secondary'}>
                          {String(r?.status || 'pending')}
                        </Badge>
                      </div>
                    </button>
                  ))
              )
            ) : tenantRequestsModalType === 'maintenance' ? (
              maintenanceOverview.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  {t('No maintenance requests found.', 'பராமரிப்பு கோரிக்கைகள் எதுவும் இல்லை.')}
                </div>
              ) : (
                maintenanceOverview.map((m: any) => {
                  const propertyId = getId(m?.property);
                  return (
                    <button
                      key={getId(m)}
                      type="button"
                      onClick={() => {
                        if (!propertyId) return;
                        openPropertyForId(propertyId, 'maintenance');
                      }}
                      className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{displayTa(m?.property?.title || t('Property', 'சொத்து'))}</p>
                          <p className="text-xs text-muted-foreground truncate">{displayTa(m?.property?.location || '')}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {displayTa(m?.issue || t('Maintenance', 'பராமரிப்பு'))}
                          </p>
                        </div>
                        <Badge
                          variant={m?.status === 'pending' ? 'destructive' : m?.status === 'in-progress' ? 'default' : 'secondary'}
                        >
                          {String(m?.status || 'pending')}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )
            ) : paymentRequests.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                {t('No payment requests found.', 'கட்டண கோரிக்கைகள் எதுவும் இல்லை.')}
              </div>
            ) : (
              paymentRequests.map((p: any) => {
                const propertyId = getId(p?.rentRecord?.property);
                const title = p?.rentRecord?.property?.title || t('Property', 'சொத்து');
                const location = p?.rentRecord?.property?.location || '';
                return (
                  <button
                    key={getId(p)}
                    type="button"
                    onClick={() => {
                      if (!propertyId) return;
                      openPropertyForId(propertyId, 'payments');
                    }}
                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{displayTa(title)}</p>
                        <p className="text-xs text-muted-foreground truncate">{displayTa(location)}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {String(p?.tenant?.name || t('Tenant', 'குத்தகைதாரர்'))} • ₹{Number(p?.amount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <Badge variant={p?.status === 'submitted' ? 'destructive' : 'secondary'}>
                        {String(p?.status || 'submitted')}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RequestDetailsModal
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
        isLoading={approveRequest.isPending || rejectRequest.isPending}
      />

      <Dialog open={rentDetailsType !== null} onOpenChange={() => setRentDetailsType(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {rentDetailsType === 'expectedRent'
                ? t('Expected Rent Breakdown', 'எதிர்பார்க்கப்படும் வாடகை விவரம்')
                : rentDetailsType === 'pendingRent'
                  ? t('Pending Rent Breakdown', 'நிலுவை வாடகை விவரம்')
                  : rentDetailsType === 'totalProperties'
                    ? t('All Properties', 'அனைத்து சொத்துக்கள்')
                    : rentDetailsType === 'occupiedProperties'
                      ? t('Occupied Properties', 'குடியேற்றப்பட்ட சொத்துக்கள்')
                      : rentDetailsType === 'vacantProperties'
                        ? t('Vacant Properties', 'காலியாக உள்ள சொத்துக்கள்')
                        : t('Tenants', 'குத்தகைதாரர்கள்')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Detailed information for this metric.',
                'இந்த அளவுக்கான விரிவான தகவல்.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {rentDetailsType === 'expectedRent' || rentDetailsType === 'pendingRent' ? (
              <div className="space-y-4">
                <div className="border rounded-md px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('Expected Rent (this month)', 'இந்த மாத எதிர்பார்க்கப்படும் வாடகை')}</span>
                    <span className="font-medium">
                      ₹{Number(financialSummary.expected || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('Total Paid (this month)', 'இந்த மாதம் செலுத்தப்பட்ட மொத்தம்')}</span>
                    <span className="font-medium">
                      ₹{Number(financialSummary.collected || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('Pending Rent (this month)', 'இந்த மாத நிலுவை வாடகை')}</span>
                    <span className="font-medium">
                      ₹{Number(financialSummary.pending || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(
                      'Pending = Expected Rent - Total Paid for all occupied properties.',
                      'நிலுவை = அனைத்து குடியேற்றப்பட்ட சொத்துகளின் எதிர்பார்க்கப்படும் வாடகை − செலுத்தப்பட்ட மொத்தம்.'
                    )}
                  </div>
                </div>
                {(!financialSummary.breakdown || financialSummary.breakdown.length === 0) ? (
                  <p className="text-sm text-muted-foreground">
                    {t('No occupied properties with rent for this month.', 'இந்த மாதத்திற்கு வாடகையுடன் கூடிய குடியேற்றப்பட்ட சொத்துக்கள் எதுவும் இல்லை.')}
                  </p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-4 gap-2 bg-muted px-4 py-2 text-sm font-medium">
                      <div>{t('Property', 'சொத்து')}</div>
                      <div className="text-right">{t('Monthly Rent', 'மாத வாடகை')}</div>
                      <div className="text-right">{t('Paid This Month', 'இந்த மாதம் செலுத்தப்பட்டது')}</div>
                      <div className="text-right">{t('Pending This Month', 'இந்த மாத நிலுவை')}</div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {financialSummary.breakdown.map((item: any) => (
                        <div
                          key={item.propertyId}
                          className="grid grid-cols-4 gap-2 px-4 py-2 text-sm border-t"
                        >
                          <div>
                            <div className="font-medium">
                              {item.propertyTitle || t('Property', 'சொத்து')}
                            </div>
                            {item.propertyLocation && (
                              <div className="text-xs text-muted-foreground">
                                {item.propertyLocation}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            ₹{Number(item.rentAmount || 0).toLocaleString()}
                          </div>
                          <div className="text-right">
                            ₹{Number(item.totalPaid || 0).toLocaleString()}
                          </div>
                          <div className="text-right">
                            ₹{Number(item.balance || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : rentDetailsType === 'totalProperties' ||
              rentDetailsType === 'occupiedProperties' ||
              rentDetailsType === 'vacantProperties' ? (
              currentPropertyList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('No properties to display.', 'காண்பிக்க சொத்துக்கள் இல்லை.')}
                </p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 bg-muted px-4 py-2 text-sm font-medium">
                    <div>{t('Property', 'சொத்து')}</div>
                    <div>{t('Location', 'இடம்')}</div>
                    <div className="text-right">{t('Status', 'நிலை')}</div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {currentPropertyList.map((p: any) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-3 gap-2 px-4 py-2 text-sm border-t"
                      >
                        <div className="font-medium">{displayTa(p.title)}</div>
                        <div>{displayTa(p.location)}</div>
                        <div className="text-right">
                          {p.tenant
                            ? t('Occupied', 'குடியேற்றப்பட்டுள்ளது')
                            : t('Vacant', 'காலியாக உள்ளது')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : rentDetailsType === 'totalTenants' ? (
              tenantSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('No tenants to display.', 'காண்பிக்க குத்தகைதாரர்கள் இல்லை.')}
                </p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 bg-muted px-4 py-2 text-sm font-medium">
                    <div>{t('Tenant', 'குத்தகைதாரர்')}</div>
                    <div>{t('Contact', 'தொடர்பு')}</div>
                    <div className="text-right">{t('Properties', 'சொத்துக்கள்')}</div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {tenantSummary.map((tenant: any) => (
                      <div
                        key={tenant.id}
                        className="grid grid-cols-3 gap-2 px-4 py-2 text-sm border-t"
                      >
                        <div className="font-medium">
                          {tenant.name || t('Tenant', 'குத்தகைதாரர்')}
                        </div>
                        <div className="text-xs">
                          {tenant.email && <div>{tenant.email}</div>}
                          {tenant.phone && <div>{tenant.phone}</div>}
                        </div>
                        <div className="text-right">
                          {tenant.properties.length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
