
import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import AgreementDialog from './AgreementDialog';
import PaymentDialog from './PaymentDialog';
import { generateReceipt } from '../utils/receiptGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useGetCallerUserProfile,
  useGetMyVacateRequests,
  useGetTenantRequests,
  useGetTenantRentHistory,
  useTenantExpenseSummaryReport,
  useTenantMaintenanceReport,
  useTenantPaymentHistoryReport,
  useAnnouncements
} from '../hooks/useQueries';
import api, { translateText } from '../lib/api';
import FloatingChat from './FloatingChat';
import RequestList from './RequestList';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Home,
  Bell,
  Settings,
  User,
  CheckCircle,
  FileText,
  MapPin,
  Calendar,
  IndianRupee,
  Wrench,
  AlertCircle,
  Download,
  Loader2,
  Megaphone,
  Printer,
  RefreshCcw
} from 'lucide-react';
import RentalDetailsDialog from './RentalDetailsDialog';
import { toast } from 'sonner';
import { RentStatusGraph } from './RentStatusGraph';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CustomerDashboard() {
  const { t, language } = useLanguage();
  const { data: userProfile, refetch: refetchUserProfile } = useGetCallerUserProfile();
  const { data: tenantRequests = [] } = useGetTenantRequests();
  const { data: myVacateRequests = [] } = useGetMyVacateRequests();
  const { data: rentHistory } = useGetTenantRentHistory();
  const {
    data: announcements = [],
    isLoading: announcementsLoading,
    isError: announcementsError,
    refetch: refetchAnnouncements
  } = useAnnouncements();
  const [activeTab, setActiveTab] = useState('overview');
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [idProofImage, setIdProofImage] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [selectedRental, setSelectedRental] = useState<any>(null);
  const [selectedRentalInitialTab, setSelectedRentalInitialTab] = useState<
    'payments' | 'agreements' | 'maintenance' | 'vacate'
  >('payments');
  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [selectedRentRecord, setSelectedRentRecord] = useState<any>(null);
  const [profileFormVersion, setProfileFormVersion] = useState(0);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [requestsModalType, setRequestsModalType] = useState<null | 'maintenance' | 'vacate'>(null);
  const [metricDetailsType, setMetricDetailsType] = useState<
    | null
    | 'activeRentals'
    | 'thisMonthRent'
    | 'thisMonthDue'
    | 'pendingPropertyRequests'
    | 'openMaintenance'
    | 'latestVacate'
  >(null);
  const [taTextMap, setTaTextMap] = useState<Record<string, string>>({});
  const [activeCustomerReport, setActiveCustomerReport] = useState<'paymentHistory' | 'expenseSummary' | 'maintenance'>(
    'paymentHistory'
  );
  const [reportFrom, setReportFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportPropertyId, setReportPropertyId] = useState<string>('all');

  const paymentHistoryChartRef = useRef<HTMLDivElement | null>(null);
  const expenseSummaryChartRef = useRef<HTMLDivElement | null>(null);
  const maintenanceChartRef = useRef<HTMLDivElement | null>(null);

  const reportProperties = useMemo(() => {
    const map = new Map<string, { id: string; title: string; location: string }>();
    (agreements || []).forEach((a: any) => {
      const prop = a?.property;
      const id = prop?._id ? String(prop._id) : null;
      if (!id || map.has(id)) return;
      map.set(id, { id, title: String(prop?.title || ''), location: String(prop?.location || '') });
    });
    return Array.from(map.values());
  }, [agreements]);

  const reportParams = useMemo(() => {
    const params: any = {
      from: reportFrom,
      to: reportTo,
      ai: true,
      locale: language
    };
    if (reportPropertyId && reportPropertyId !== 'all') params.propertyId = reportPropertyId;
    return params;
  }, [reportFrom, reportTo, reportPropertyId, language]);

  const paymentHistoryReportQuery = useTenantPaymentHistoryReport(
    reportParams,
    false
  );
  const expenseSummaryReportQuery = useTenantExpenseSummaryReport(
    reportParams,
    false
  );
  const maintenanceReportQuery = useTenantMaintenanceReport(
    reportParams,
    false
  );

  useEffect(() => {
    if (language !== 'ta') {
      if (Object.keys(taTextMap).length > 0) setTaTextMap({});
      return;
    }

    const texts = new Set<string>();
    (agreements || []).forEach((a: any) => {
      const title = String(a?.property?.title || '').trim();
      const loc = String(a?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });
    (rentRecords || []).forEach((r: any) => {
      const title = String(r?.property?.title || '').trim();
      const loc = String(r?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });
    (tenantRequests || []).forEach((r: any) => {
      const title = String(r?.property?.title || '').trim();
      const loc = String(r?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });
    (maintenanceRequests || []).forEach((r: any) => {
      const title = String(r?.property?.title || '').trim();
      const loc = String(r?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });
    (myVacateRequests || []).forEach((r: any) => {
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
      if (Object.keys(additions).length > 0) setTaTextMap((prev) => ({ ...prev, ...additions }));
    })();

    return () => {
      cancelled = true;
    };
  }, [language, agreements, rentRecords, tenantRequests, maintenanceRequests, myVacateRequests, taTextMap]);

  const displayTa = (text: any) => {
    const raw = typeof text === 'string' ? text : '';
    if (language !== 'ta') return raw || text;
    if (!raw) return raw || text;
    return taTextMap[raw] || raw;
  };

  useEffect(() => {
    const fetchAgreements = async () => {
      try {
        const res = await api.get('/agreements/tenant');
        setAgreements(res.data);
      } catch (err) {
        console.error('Error fetching agreements:', err);
      }
    };

    const fetchRentRecords = async () => {
      try {
        const res = await api.get('/payments/tenant/records');
        setRentRecords(res.data);
      } catch (err) {
        console.error('Error fetching rent records:', err);
      }
    };

    const fetchMaintenanceRequests = async () => {
      try {
        const res = await api.get('/requests/maintenance/tenant');
        setMaintenanceRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching maintenance requests:', err);
      }
    };

    fetchAgreements();
    fetchRentRecords();
    fetchMaintenanceRequests();
  }, []);

  useEffect(() => {
    if (activeTab !== 'settings') return;

    const ids = [
      'name',
      'phone',
      'address',
      'age',
      'dateOfBirth',
      'gender',
      'familyMembers',
      'religion',
      'occupation',
      'companyName',
      'monthlyIncome',
      'maritalStatus',
      'aadhar',
      'idType'
    ];

    const handler = () => {
      setProfileFormVersion((v) => v + 1);
    };

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });

    handler();

    return () => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.removeEventListener('input', handler);
          el.removeEventListener('change', handler);
        }
      });
    };
  }, [activeTab]);

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
        age: formData.get('age') ? parseInt(formData.get('age') as string) : undefined,
        familyMembers: formData.get('familyMembers') ? parseInt(formData.get('familyMembers') as string) : undefined,
        religion: formData.get('religion'),
        occupation: formData.get('occupation'),
        companyName: formData.get('companyName'),
        monthlyIncome: formData.get('monthlyIncome')
          ? parseInt(formData.get('monthlyIncome') as string)
          : undefined,
        maritalStatus: formData.get('maritalStatus'),
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

  const activeAgreements = agreements.filter((a: any) => a?.status === 'active');
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const parseDateSafe = (value: any) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const toId = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return String(value?._id || value?.id || value);
  };

  const isSameMonth = (d: Date | null) => {
    if (!d) return false;
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const rawThisMonthRecords = rentRecords.filter((r: any) => isSameMonth(parseDateSafe(r?.month)));
  
  // Deduplicate records by property ID to avoid showing duplicates
  const thisMonthRecords = Object.values(
    rawThisMonthRecords.reduce((acc: any, curr: any) => {
      const key = curr.property?._id || curr.property?.title || curr._id;
      if (!acc[key]) {
        acc[key] = curr;
      }
      return acc;
    }, {})
  ) as any[];

  const expectedThisMonth = thisMonthRecords.reduce(
    (sum: number, r: any) => sum + Number(r?.rentAmount || 0),
    0
  );
  const pendingThisMonth = thisMonthRecords.reduce(
    (sum: number, r: any) => sum + Number(r?.balance || 0),
    0
  );
  const overdueThisMonth = thisMonthRecords.filter((r: any) => {
    const due = parseDateSafe(r?.dueDate);
    const balance = Number(r?.balance || 0);
    const status = String(r?.status || '').toLowerCase();
    return status === 'overdue' || (balance > 0 && !!due && due.getTime() < now.getTime());
  }).length;

  const nextDue = rentRecords
    .map((r: any) => ({ ...r, __due: parseDateSafe(r?.dueDate) }))
    .filter((r: any) => Number(r?.balance || 0) > 0 && r.__due)
    .sort((a: any, b: any) => a.__due.getTime() - b.__due.getTime())[0];
  const [remindersOpen, setRemindersOpen] = useState(false);

  const formatDate = (d: Date | null) => (d ? d.toLocaleDateString() : '');

  const reminders = useMemo(() => {
    const today = new Date();
    return rentRecords
      .map((r: any) => {
        const due = parseDateSafe(r?.dueDate);
        const balance = Number(r?.balance || 0);
        if (!due || balance <= 0) return null;
        const tenantName = String(userProfile?.name || 'Tenant');
        const propertyName = String(r?.property?.title || 'Property');
        const amount = Number(r?.rentAmount || r?.balance || 0);
        const msg = `Dear ${tenantName}, gentle reminder: Rent ₹${amount.toLocaleString('en-IN')} for ${propertyName} is due on ${formatDate(due)}. Please pay on time to avoid inconvenience. Thank you.`;
        let tone: 'friendly' | 'urgent' | 'warning' = 'friendly';
        const isSameDay =
          due.getFullYear() === today.getFullYear() &&
          due.getMonth() === today.getMonth() &&
          due.getDate() === today.getDate();
        if (due.getTime() < today.getTime() && !isSameDay) tone = 'warning';
        else if (isSameDay) tone = 'urgent';
        else tone = 'friendly';
        return {
          id: String(r._id || r.id || `${propertyName}:${due.toISOString()}`),
          agreementId: toId(r?.agreement),
          propertyId: toId(r?.property),
          propertyTitle: propertyName,
          location: r?.property?.location || '',
          amount,
          due,
          tone,
          message: msg
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.due.getTime() - b.due.getTime()) as Array<{
        id: string;
        agreementId?: string | null;
        propertyId?: string | null;
        propertyTitle: string;
        location: string;
        amount: number;
        due: Date;
        tone: 'friendly' | 'urgent' | 'warning';
        message: string;
      }>;
  }, [rentRecords, userProfile]);
  const pendingRemindersCount = reminders.length;
  const pendingPropertyRequests = tenantRequests.filter((r: any) => r?.status === 'pending').length;
  const pendingMaintenance = maintenanceRequests.filter((r: any) => r?.status === 'pending').length;
  const inProgressMaintenance = maintenanceRequests.filter((r: any) => r?.status === 'in-progress').length;

  const maintenanceProperties = Object.values(
    maintenanceRequests.reduce((acc: Record<string, any>, req: any) => {
      if (!['pending', 'in-progress'].includes(String(req?.status || ''))) return acc;
      const propertyId = toId(req?.property);
      if (!propertyId) return acc;
      if (!acc[propertyId]) {
        acc[propertyId] = {
          propertyId,
          title: req?.property?.title || t('Property', 'சொத்து'),
          location: req?.property?.location || '',
          total: 0,
          pending: 0,
          inProgress: 0,
        };
      }
      acc[propertyId].total += 1;
      if (req?.status === 'pending') acc[propertyId].pending += 1;
      if (req?.status === 'in-progress') acc[propertyId].inProgress += 1;
      return acc;
    }, {})
  ) as Array<{
    propertyId: string;
    title: string;
    location: string;
    total: number;
    pending: number;
    inProgress: number;
  }>;

  const vacateProperties = Object.values(
    myVacateRequests.reduce((acc: Record<string, any>, req: any) => {
      const propertyId = toId(req?.property);
      if (!propertyId) return acc;
      const created =
        parseDateSafe(req?.createdAt) || parseDateSafe(req?.requestedVacateDate) || new Date(0);
      if (!acc[propertyId]) {
        acc[propertyId] = {
          propertyId,
          title: req?.property?.title || t('Property', 'சொத்து'),
          location: req?.property?.location || '',
          total: 0,
          latestStatus: req?.status ? String(req.status) : '',
          latestAt: created,
        };
      }
      acc[propertyId].total += 1;
      if (created.getTime() > acc[propertyId].latestAt.getTime()) {
        acc[propertyId].latestAt = created;
        acc[propertyId].latestStatus = req?.status ? String(req.status) : '';
      }
      return acc;
    }, {})
  ) as Array<{
    propertyId: string;
    title: string;
    location: string;
    total: number;
    latestStatus: string;
    latestAt: Date;
  }>;

  const currentReportQuery =
    activeCustomerReport === 'paymentHistory'
      ? paymentHistoryReportQuery
      : activeCustomerReport === 'expenseSummary'
        ? expenseSummaryReportQuery
        : maintenanceReportQuery;

  const currentReport = (currentReportQuery as any)?.data;
  const reportIsLoading = Boolean((currentReportQuery as any)?.isLoading || (currentReportQuery as any)?.isFetching);

  const money = (value: any) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return '₹0';
    return `₹${n.toLocaleString()}`;
  };

  const formatShortDate = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  };

  const escCsv = (v: any) => {
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const downloadCsv = (fileName: string, lines: string[]) => {
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildReportTitle = () => {
    if (activeCustomerReport === 'paymentHistory') return t('Payment History Report', 'கட்டண வரலாறு அறிக்கை');
    if (activeCustomerReport === 'expenseSummary') return t('Expense Summary Report', 'செலவு சுருக்க அறிக்கை');
    return t('Maintenance Request Report', 'பராமரிப்பு கோரிக்கை அறிக்கை');
  };

  const paymentHistoryDerived = useMemo(() => {
    if (activeCustomerReport !== 'paymentHistory' || !currentReport) return null;
    const rows = Array.isArray(currentReport?.rows) ? currentReport.rows : [];

    const statusCounts = { approved: 0, submitted: 0, rejected: 0 };
    rows.forEach((r: any) => {
      const st = String(r?.status || '');
      if (st === 'approved') statusCounts.approved += 1;
      else if (st === 'submitted') statusCounts.submitted += 1;
      else if (st === 'rejected') statusCounts.rejected += 1;
    });

    const statusData = [
      { name: t('Approved', 'அனுமதிக்கப்பட்டது'), value: statusCounts.approved },
      { name: t('Submitted', 'சமர்ப்பிக்கப்பட்டது'), value: statusCounts.submitted },
      { name: t('Failed', 'தோல்வி'), value: statusCounts.rejected }
    ];

    const monthlyPaid = Array.isArray(currentReport?.monthlyPaid) ? currentReport.monthlyPaid : [];

    const methodData = Array.isArray(currentReport?.paymentMethodBreakdown)
      ? currentReport.paymentMethodBreakdown.map((m: any) => ({
          name: String(m?.name || ''),
          value: Number(m?.value || 0)
        }))
      : [];

    return { statusData, monthlyPaid, methodData };
  }, [activeCustomerReport, currentReport, t]);

  const expenseSummaryDerived = useMemo(() => {
    if (activeCustomerReport !== 'expenseSummary' || !currentReport) return null;
    const rows = Array.isArray(currentReport?.rows) ? currentReport.rows : [];
    const chartData = rows.map((r: any) => ({ name: String(r?.name || r?.key || ''), total: Number(r?.total || 0) }));
    return { chartData };
  }, [activeCustomerReport, currentReport]);

  const maintenanceDerived = useMemo(() => {
    if (activeCustomerReport !== 'maintenance' || !currentReport) return null;
    const summary = currentReport?.summary || {};
    const statusData = [
      { name: t('Completed', 'முடிந்தது'), value: Number(summary?.completed ?? 0) },
      { name: t('In Progress', 'செயலில்'), value: Number(summary?.inProgress ?? 0) },
      { name: t('Pending', 'நிலுவையில்'), value: Number(summary?.pending ?? 0) }
    ];
    const monthlyRequests = Array.isArray(currentReport?.monthlyRequests) ? currentReport.monthlyRequests : [];
    const topCategories = Array.isArray(currentReport?.topCategories) ? currentReport.topCategories : [];
    return { statusData, monthlyRequests, topCategories };
  }, [activeCustomerReport, currentReport, t]);

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
      return canvas.toDataURL('image/png', 0.92);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const buildPdfDoc = async () => {
    if (!currentReport) return;

    const doc = new jsPDF();
    const title = buildReportTitle();
    const tenantName = String(userProfile?.name || 'Customer');
    const generatedAt = currentReport?.generatedAt ? new Date(currentReport.generatedAt) : new Date();

    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(`${t('Customer', 'வாடிக்கையாளர்')}: ${tenantName}`, 14, 22);
    doc.text(`${t('Range', 'காலவரை')}: ${reportFrom} ${t('to', 'வரை')} ${reportTo}`, 14, 27);
    doc.text(`${t('Generated', 'உருவாக்கப்பட்டது')}: ${generatedAt.toLocaleString()}`, 14, 32);

    let y = 38;

    const ai = currentReport?.ai;
    if (ai?.requested) {
      doc.setFontSize(11);
      doc.text(t('Insights', 'உள்ளடக்கம்'), 14, y);
      y += 5;
      doc.setFontSize(9);
      const bullets: string[] = [];
      if (ai?.executiveSummary) bullets.push(String(ai.executiveSummary));
      if (Array.isArray(ai?.insights)) bullets.push(...ai.insights.map((x: any) => String(x)));
      if (bullets.length === 0) bullets.push(ai?.generated ? t('AI insights generated.', 'AI உள்ளடக்கம் உருவாக்கப்பட்டது.') : t('AI insights not available.', 'AI உள்ளடக்கம் இல்லை.'));
      const lines = doc.splitTextToSize(bullets.map((b) => `• ${b}`).join('\n'), 180);
      doc.text(lines, 14, y);
      y += Math.min(40, lines.length * 4 + 2);
    }

    if (activeCustomerReport === 'paymentHistory') {
      const s = currentReport?.summary || {};
      autoTable(doc, {
        startY: y,
        head: [[t('Metric', 'அளவுகோல்'), t('Value', 'மதிப்பு')]],
        body: [
          [t('Total Approved', 'மொத்த அனுமதிக்கப்பட்டது'), money(s?.totalApproved ?? 0)],
          [t('Total Submitted', 'மொத்த சமர்ப்பிக்கப்பட்டது'), money(s?.totalSubmitted ?? 0)],
          [t('Failed Payments', 'தோல்வி கட்டணங்கள்'), String(s?.failedPayments ?? 0)],
          [t('Pending Dues', 'நிலுவைத் தொகை'), money(s?.pendingDueAmount ?? 0)]
        ]
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      const svg = paymentHistoryChartRef.current?.querySelector('svg') as SVGElement | null;
      const png = await svgToPngDataUrl(svg);
      if (png) {
        doc.addImage(png, 'PNG', 14, y, 180, 80);
        y += 88;
      }

      autoTable(doc, {
        startY: y,
        head: [[t('Month', 'மாதம்'), t('Property', 'சொத்து'), t('Amount', 'தொகை'), t('Date', 'தேதி'), t('Method', 'முறை'), t('Status', 'நிலை')]],
        body: (Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any) => [
          formatShortDate(r?.month),
          String(r?.propertyTitle || ''),
          money(r?.amount ?? 0),
          formatShortDate(r?.paymentDate || r?.approvedDate),
          String(r?.mode || ''),
          String(r?.status || '')
        ]),
        styles: { fontSize: 8 }
      });
    }

    if (activeCustomerReport === 'expenseSummary') {
      const s = currentReport?.summary || {};
      autoTable(doc, {
        startY: y,
        head: [[t('Metric', 'அளவுகோல்'), t('Value', 'மதிப்பு')]],
        body: [
          [t('Total Rent', 'மொத்த வாடகை'), money(s?.totalRent ?? 0)],
          [t('Total Maintenance', 'மொத்த பராமரிப்பு'), money(s?.totalMaintenance ?? 0)],
          [t('Total Utilities', 'மொத்த பயன்பாடுகள்'), money(s?.totalUtilities ?? 0)],
          [t('Total Expenses', 'மொத்த செலவுகள்'), money(s?.totalExpenses ?? 0)]
        ]
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      const svg = expenseSummaryChartRef.current?.querySelector('svg') as SVGElement | null;
      const png = await svgToPngDataUrl(svg);
      if (png) {
        doc.addImage(png, 'PNG', 14, y, 180, 80);
        y += 88;
      }

      autoTable(doc, {
        startY: y,
        head: [[t('Month', 'மாதம்'), t('Rent', 'வாடகை'), t('Maintenance', 'பராமரிப்பு'), t('Utilities', 'பயன்பாடுகள்'), t('Total', 'மொத்தம்')]],
        body: (Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any) => [
          String(r?.name || r?.key || ''),
          money(r?.rent ?? 0),
          money(r?.maintenance ?? 0),
          money(r?.utilities ?? 0),
          money(r?.total ?? 0)
        ]),
        styles: { fontSize: 8 }
      });
    }

    if (activeCustomerReport === 'maintenance') {
      const s = currentReport?.summary || {};
      autoTable(doc, {
        startY: y,
        head: [[t('Metric', 'அளவுகோல்'), t('Value', 'மதிப்பு')]],
        body: [
          [t('Total Requests', 'மொத்த கோரிக்கைகள்'), String(s?.totalRequests ?? 0)],
          [t('Pending', 'நிலுவையில்'), String(s?.pending ?? 0)],
          [t('In Progress', 'செயலில்'), String(s?.inProgress ?? 0)],
          [t('Completed', 'முடிந்தது'), String(s?.completed ?? 0)]
        ]
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      const svg = maintenanceChartRef.current?.querySelector('svg') as SVGElement | null;
      const png = await svgToPngDataUrl(svg);
      if (png) {
        doc.addImage(png, 'PNG', 14, y, 180, 80);
        y += 88;
      }

      autoTable(doc, {
        startY: y,
        head: [[t('Property', 'சொத்து'), t('Issue', 'பிரச்சனை'), t('Category', 'வகை'), t('Status', 'நிலை'), t('Request Date', 'கோரிக்கை தேதி'), t('Resolution Date', 'தீர்வு தேதி')]],
        body: (Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any) => [
          String(r?.propertyTitle || ''),
          String(r?.issue || ''),
          String(r?.category || ''),
          String(r?.status || ''),
          formatShortDate(r?.requestDate),
          formatShortDate(r?.resolutionDate)
        ]),
        styles: { fontSize: 8 }
      });
    }

    return doc;
  };

  const handleDownloadPdf = async () => {
    const doc = await buildPdfDoc();
    if (!doc) return;
    doc.save(`reside-${activeCustomerReport}-report.pdf`);
  };

  const handlePrintReport = async () => {
    const doc = await buildPdfDoc();
    if (!doc) return;
    const anyDoc = doc as any;
    if (typeof anyDoc.autoPrint === 'function') anyDoc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  };

  const handleDownloadCsv = () => {
    if (!currentReport) return;
    const lines: string[] = [];
    lines.push(`RESIDE REPORT`);
    lines.push(`${escCsv(buildReportTitle())}`);
    lines.push(`Customer,${escCsv(userProfile?.name || 'Customer')}`);
    lines.push(`Range,${escCsv(reportFrom)} to ${escCsv(reportTo)}`);
    lines.push('');

    if (activeCustomerReport === 'paymentHistory') {
      const s = currentReport?.summary || {};
      lines.push(`Total Approved,${escCsv(s.totalApproved ?? 0)}`);
      lines.push(`Total Submitted,${escCsv(s.totalSubmitted ?? 0)}`);
      lines.push(`Failed Payments,${escCsv(s.failedPayments ?? 0)}`);
      lines.push(`Pending Dues,${escCsv(s.pendingDueAmount ?? 0)}`);
      lines.push('');
      lines.push('Month,Property,Amount,Payment Date,Payment Method,Status,Receipt Number');
      (Array.isArray(currentReport?.rows) ? currentReport.rows : []).forEach((r: any) => {
        lines.push(
          `${escCsv(formatShortDate(r.month))},${escCsv(r.propertyTitle || '')},${escCsv(r.amount ?? 0)},${escCsv(formatShortDate(r.paymentDate || r.approvedDate))},${escCsv(r.mode || '')},${escCsv(r.status || '')},${escCsv(r.receiptNumber || '')}`
        );
      });
    }

    if (activeCustomerReport === 'expenseSummary') {
      const s = currentReport?.summary || {};
      lines.push(`Total Rent,${escCsv(s.totalRent ?? 0)}`);
      lines.push(`Total Maintenance,${escCsv(s.totalMaintenance ?? 0)}`);
      lines.push(`Total Utilities,${escCsv(s.totalUtilities ?? 0)}`);
      lines.push(`Total Expenses,${escCsv(s.totalExpenses ?? 0)}`);
      lines.push('');
      lines.push('Month,Rent,Maintenance,Utilities,Total');
      (Array.isArray(currentReport?.rows) ? currentReport.rows : []).forEach((r: any) => {
        lines.push(
          `${escCsv(r.name || r.key || '')},${escCsv(r.rent ?? 0)},${escCsv(r.maintenance ?? 0)},${escCsv(r.utilities ?? 0)},${escCsv(r.total ?? 0)}`
        );
      });
    }

    if (activeCustomerReport === 'maintenance') {
      const s = currentReport?.summary || {};
      lines.push(`Total Requests,${escCsv(s.totalRequests ?? 0)}`);
      lines.push(`Pending,${escCsv(s.pending ?? 0)}`);
      lines.push(`In Progress,${escCsv(s.inProgress ?? 0)}`);
      lines.push(`Completed,${escCsv(s.completed ?? 0)}`);
      lines.push('');
      lines.push('Property,Issue,Category,Status,Request Date,Resolution Date');
      (Array.isArray(currentReport?.rows) ? currentReport.rows : []).forEach((r: any) => {
        lines.push(
          `${escCsv(r.propertyTitle || '')},${escCsv(r.issue || '')},${escCsv(r.category || '')},${escCsv(r.status || '')},${escCsv(formatShortDate(r.requestDate))},${escCsv(formatShortDate(r.resolutionDate))}`
        );
      });
    }

    downloadCsv(`reside-${activeCustomerReport}-report.csv`, lines);
  };

  const generateReport = async (type: 'paymentHistory' | 'expenseSummary' | 'maintenance') => {
    const query =
      type === 'paymentHistory'
        ? (paymentHistoryReportQuery as any)
        : type === 'expenseSummary'
          ? (expenseSummaryReportQuery as any)
          : (maintenanceReportQuery as any);
    try {
      await query?.refetch?.();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.response?.data || t('Failed to generate report', 'அறிக்கை உருவாக்க முடியவில்லை');
      toast.error(String(msg));
    }
  };

  const openRentalForProperty = (propertyId: string, tab: 'maintenance' | 'vacate') => {
    const match = [...agreements]
      .sort((a: any, b: any) => {
        const ad = parseDateSafe(a?.startDate) || new Date(0);
        const bd = parseDateSafe(b?.startDate) || new Date(0);
        return bd.getTime() - ad.getTime();
      })
      .find((a: any) => {
        const aPropId = toId(a?.property);
        return aPropId && String(aPropId) === String(propertyId);
      });
    if (!match) {
      toast.error(t('Rental not found for this property', 'இந்த சொத்திற்கான வாடகை இல்லை'));
      return;
    }
    setRequestsModalType(null);
    setSelectedRentalInitialTab(tab);
    setSelectedRental(match);
  };

  const latestVacate = [...myVacateRequests]
    .map((r: any) => ({ ...r, __created: parseDateSafe(r?.createdAt) || parseDateSafe(r?.requestedVacateDate) || new Date(0) }))
    .sort((a: any, b: any) => b.__created.getTime() - a.__created.getTime())[0];
  const latestVacateStatus = latestVacate?.status ? String(latestVacate.status) : null;

  return (
    <div className="container py-8 sm:py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('Customer Dashboard', 'வாடிக்கையாளர் கட்டுப்பாட்டு அறை')}
            </h1>
            <p className="text-muted-foreground">
              {t('Welcome back', 'மீண்டும் வருக')}, {userProfile?.name || 'Customer'}!
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRemindersOpen(true)}
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted transition-colors"
              aria-label="Reminders"
              title={t('Reminders', 'நினைவூட்டல்கள்')}
            >
              <Bell className={`${pendingRemindersCount > 0 ? 'bell-animate text-amber-600' : ''} h-6 w-6`} />
              {pendingRemindersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-[10px] h-5 min-w-[20px] flex items-center justify-center px-1">
                  {pendingRemindersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <style>
          {`
            @keyframes bell-shake {
              0% { transform: rotate(0); }
              10% { transform: rotate(15deg); }
              20% { transform: rotate(-15deg); }
              30% { transform: rotate(10deg); }
              40% { transform: rotate(-10deg); }
              50% { transform: rotate(5deg); }
              60% { transform: rotate(-5deg); }
              70% { transform: rotate(2deg); }
              80% { transform: rotate(-2deg); }
              100% { transform: rotate(0); }
            }
            .bell-animate {
              animation: bell-shake 1.2s ease-in-out infinite;
              transform-origin: top center;
            }
          `}
        </style>

        <Dialog open={remindersOpen} onOpenChange={setRemindersOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('Reminders', 'நினைவூட்டல்கள்')}</DialogTitle>
              <DialogDescription>
                {t('Pending rent reminders', 'நிலுவையில் உள்ள வாடகை நினைவூட்டல்கள்')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {pendingRemindersCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('No reminders', 'நினைவூட்டல்கள் இல்லை')}
                </p>
              ) : (
                reminders.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      const match = agreements.find((a: any) => {
                        const aid = String(a?._id || a?.id || '');
                        const pid = String(a?.property?._id || a?.property?.id || '');
                        return (r.agreementId && aid === String(r.agreementId)) || (r.propertyId && pid === String(r.propertyId));
                      });
                      if (match) {
                        setSelectedRental(match);
                        setSelectedRentalInitialTab('payments');
                        setRemindersOpen(false);
                      } else {
                        toast.error(t('Unable to open payment page for this property.', 'இந்த சொத்திற்கான கட்டணப் பக்கத்தைத் திறக்க முடியவில்லை.'));
                      }
                    }}
                    className="border rounded-lg p-3 bg-card text-left hover:bg-muted/50 transition-colors w-full"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.propertyTitle}</p>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{r.location || t('Location not specified', 'இடம் குறிப்பிடப்படவில்லை')}</span>
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" />
                            {r.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(r.due)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={r.tone === 'warning' ? 'destructive' : r.tone === 'urgent' ? 'default' : 'secondary'}>
                        {r.tone}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{r.message}</p>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Navigation Tabs (Navbar) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto gap-2 sm:gap-3 p-1 sm:justify-center sm:flex-wrap">
            <TabsTrigger value="overview" className="flex-shrink-0">
              <Home className="mr-2 h-4 w-4" />
              {t('Overview', 'கண்ணோட்டம்')}
            </TabsTrigger>
            <TabsTrigger value="rentals" className="flex-shrink-0">
              <Home className="mr-2 h-4 w-4" />
              {t('My Rentals', 'எனது வாடகைகள்')}
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-shrink-0">
              <Bell className="mr-2 h-4 w-4" />
              {t('My Requests', 'எனது கோரிக்கைகள்')}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex-shrink-0">
              <Megaphone className="mr-2 h-4 w-4" />
              {t('Announcements', 'அறிவிப்புகள்')}
              {announcements.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {announcements.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-shrink-0">
              <FileText className="mr-2 h-4 w-4" />
              {t('Reports', 'அறிக்கைகள்')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0">
              <Settings className="mr-2 h-4 w-4" />
              {t('Settings', 'அமைப்புகள்')}
            </TabsTrigger>
          </TabsList>

          {/* Overview Content */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('activeRentals')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('Active Rentals', 'செயலில் உள்ள வாடகைகள்')}
                  </CardTitle>
                  <Home className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeAgreements.length}</div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('thisMonthRent')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('This Month Rent', 'இந்த மாத வாடகை')}
                  </CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{expectedThisMonth.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('Month:', 'மாதம்:')} {thisMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('thisMonthDue')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('This Month Due', 'இந்த மாத நிலுவை')}
                  </CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{pendingThisMonth.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {nextDue?.__due
                      ? t('Next due:', 'அடுத்த கடைசி தேதி:') + ' ' + nextDue.__due.toLocaleDateString()
                      : t('No dues right now', 'தற்போது நிலுவை இல்லை')}
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('pendingPropertyRequests')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('Pending Property Requests', 'நிலுவை சொத்து கோரிக்கைகள்')}
                  </CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingPropertyRequests}</div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('openMaintenance')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('Open Maintenance', 'பராமரிப்பு நிலுவை')}
                  </CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {pendingMaintenance + inProgressMaintenance}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('Pending:', 'நிலுவை:')} {pendingMaintenance} • {t('In progress:', 'செயல்பாட்டில்:')} {inProgressMaintenance}
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer" onClick={() => setMetricDetailsType('latestVacate')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('Latest Vacate Status', 'சமீபத்திய வெளியேறு நிலை')}
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {latestVacateStatus ? latestVacateStatus.toUpperCase() : t('NONE', 'இல்லை')}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2 mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>{t('My Requests Overview', 'எனது கோரிக்கைகள் கண்ணோட்டம்')}</CardTitle>
                  <CardDescription>
                    {t(
                      'Quick view of property, maintenance and vacate requests',
                      'சொத்து, பராமரிப்பு மற்றும் வெளியேறு கோரிக்கைகளின் விரைவு கண்ணோட்டம்'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="flex items-center justify-between p-3 rounded-md border cursor-pointer"
                    onClick={() => setActiveTab('requests')}
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{t('Property Requests', 'சொத்து கோரிக்கைகள்')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('Requests you sent to owners', 'உரிமையாளருக்கு அனுப்பிய கோரிக்கைகள்')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{pendingPropertyRequests}</Badge>
                  </div>

                  <div
                    className="flex items-center justify-between p-3 rounded-md border cursor-pointer"
                    onClick={() => setRequestsModalType('maintenance')}
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium">{t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('Issues you reported for your rentals', 'உங்கள் வாடகைக்கான நீங்கள் தெரிவித்த சிக்கல்கள்')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{pendingMaintenance + inProgressMaintenance}</Badge>
                  </div>

                  <div
                    className="flex items-center justify-between p-3 rounded-md border cursor-pointer"
                    onClick={() => setRequestsModalType('vacate')}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="font-medium">{t('Vacate Requests', 'வெளியேறு கோரிக்கைகள்')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('Track your latest vacate status', 'உங்கள் சமீபத்திய வெளியேறு நிலையைப் பின்தொடரவும்')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{vacateProperties.length}</Badge>
                  </div>
                </CardContent>
              </Card>

              <RentStatusGraph 
                data={rentHistory?.graph || []} 
                payments={rentHistory?.lastPayments || []}
                title={t('Rent Status Summary', 'வாடகை நிலை சுருக்கம்')}
                role="tenant"
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

          {/* Announcements Content */}
          <TabsContent value="announcements" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    {t('Platform Announcements', 'தள அறிவிப்புகள்')}
                  </CardTitle>
                  <CardDescription>
                    {t('Important updates and official announcements from property administration.', 'சொத்து நிர்வாகத்திலிருந்து முக்கியமான புதுப்பிப்புகள் மற்றும் அதிகாரப்பூர்வ அறிவிப்புகள்.')}
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
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
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

          {/* My Rentals Content */}
          <TabsContent value="rentals" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {agreements.length > 0 ? (
                agreements.map((agreement) => (
                  <Card
                    key={agreement._id}
                    className="cursor-pointer hover:shadow-lg transition-shadow group relative overflow-hidden"
                    onClick={() => setSelectedRental(agreement)}
                  >
                    {/* Property Image */}
                    <div className="relative h-40 sm:h-48 w-full bg-muted overflow-hidden">
                      {agreement.property?.images && agreement.property.images.length > 0 ? (
                        <img
                          src={agreement.property.images[0]}
                          alt={displayTa(agreement.property?.title || 'Property')}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          {agreement.property?.geoLocatedImage ? (
                            <img
                              src={agreement.property.geoLocatedImage}
                              alt={displayTa(agreement.property?.title || 'Property')}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Home className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge variant={agreement.status === 'active' ? 'default' : 'secondary'} className="mb-2">
                          {agreement.status.toUpperCase()}
                        </Badge>
                      </div>
                      <CardTitle className="line-clamp-1 text-lg">
                        {displayTa(agreement.property?.title || 'Unknown Property')}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{displayTa(agreement.property?.location)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{t('Owner:', 'உரிமையாளர்:')} {agreement.owner?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(agreement.startDate).toLocaleDateString()} - {new Date(agreement.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center">
                          <span className="text-muted-foreground">{t('Rent:', 'வாடகை:')}</span>
                          <span className="font-semibold text-primary">₹{agreement.rentAmount?.toLocaleString()}/mo</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Home className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">{t('No Active Rentals', 'செயலில் உள்ள வாடகைகள் இல்லை')}</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    {t('You do not have any active rental agreements at the moment.', 'தற்போது உங்களிடம் செயலில் உள்ள வாடகை ஒப்பந்தங்கள் எதுவும் இல்லை.')}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* My Requests Content */}
          <TabsContent value="requests" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('My Requests', 'எனது கோரிக்கைகள்')}</CardTitle>
                <CardDescription>{t('Track status of your property requests', 'உங்கள் சொத்து கோரிக்கைகளின் நிலையை கண்காணிக்கவும்')}</CardDescription>
              </CardHeader>
              <CardContent>
                 <RequestList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setActiveCustomerReport('paymentHistory')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('Payment History Report', 'கட்டண வரலாறு அறிக்கை')}
                  </CardTitle>
                  <CardDescription>
                    {t('Monthly rent paid + payment dates/methods + pending/failed.', 'மாதாந்திர கட்டணம் + தேதி/முறை + நிலுவை/தோல்வி.')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant={activeCustomerReport === 'paymentHistory' ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCustomerReport('paymentHistory');
                      void generateReport('paymentHistory');
                    }}
                  >
                    {t('Generate Report', 'அறிக்கை உருவாக்கு')}
                  </Button>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setActiveCustomerReport('expenseSummary')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    {t('Expense Summary Report', 'செலவு சுருக்க அறிக்கை')}
                  </CardTitle>
                  <CardDescription>
                    {t('Rent + maintenance + utilities with month-wise chart.', 'வாடகை + பராமரிப்பு + பயன்பாடுகள் (மாத வாரியாக).')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant={activeCustomerReport === 'expenseSummary' ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCustomerReport('expenseSummary');
                      void generateReport('expenseSummary');
                    }}
                  >
                    {t('Generate Report', 'அறிக்கை உருவாக்கு')}
                  </Button>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setActiveCustomerReport('maintenance')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {t('Maintenance Request Report', 'பராமரிப்பு கோரிக்கை அறிக்கை')}
                  </CardTitle>
                  <CardDescription>
                    {t('Complaints, status, request & resolution dates.', 'பிரச்சனைகள், நிலை, கோரிக்கை & தீர்வு தேதிகள்.')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant={activeCustomerReport === 'maintenance' ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCustomerReport('maintenance');
                      void generateReport('maintenance');
                    }}
                  >
                    {t('Generate Report', 'அறிக்கை உருவாக்கு')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('Filters', 'வடிகட்டிகள்')}</CardTitle>
                <CardDescription>{t('Adjust report range and property', 'காலவரை மற்றும் சொத்தை தேர்வு செய்யவும்')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t('From', 'இருந்து')}</Label>
                    <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('To', 'வரை')}</Label>
                    <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Property', 'சொத்து')}</Label>
                    <Select value={reportPropertyId} onValueChange={setReportPropertyId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('All Properties', 'அனைத்து சொத்துக்கள்')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('All Properties', 'அனைத்து சொத்துக்கள்')}</SelectItem>
                        {reportProperties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {displayTa(p.title || t('Property', 'சொத்து'))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle>{buildReportTitle()}</CardTitle>
                    <CardDescription>{t('Summary on top, detailed table below.', 'மேலே சுருக்கம், கீழே விரிவான அட்டவணை.')}</CardDescription>
                    <div className="pt-3 space-y-1 text-sm text-muted-foreground">
                      <div>
                        {t('Customer Name:', 'வாடிக்கையாளர் பெயர்:')} {String(userProfile?.name || 'Customer')}
                      </div>
                      <div>
                        {t('Report Period:', 'அறிக்கை காலம்:')} {reportFrom} → {reportTo}
                      </div>
                      <div>
                        {t('Generated On:', 'உருவாக்கப்பட்ட தேதி:')}{' '}
                        {currentReport?.generatedAt ? new Date(currentReport.generatedAt).toLocaleDateString() : '-'}
                      </div>
                      <div className="italic">
                        {currentReport?.ai?.requested && currentReport?.ai?.generated
                          ? t('This report is AI-assisted and generated by Reside Management System.', 'இந்த அறிக்கை AI உதவியுடன் Reside Management System மூலம் உருவாக்கப்படுகிறது.')
                          : t('This report is system-generated by Reside Management System.', 'இந்த அறிக்கை Reside Management System மூலம் உருவாக்கப்படுகிறது.')}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void generateReport(activeCustomerReport)} disabled={reportIsLoading}>
                      {t('Generate Report', 'அறிக்கை உருவாக்கு')}
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPdf} disabled={!currentReport || reportIsLoading}>
                      <Download className="mr-2 h-4 w-4" />
                      {t('Download as PDF', 'PDF ஆக பதிவிறக்கம்')}
                    </Button>
                    <Button variant="outline" onClick={handlePrintReport} disabled={!currentReport || reportIsLoading}>
                      <Printer className="mr-2 h-4 w-4" />
                      {t('Print Report', 'அச்சிடு')}
                    </Button>
                    <Button variant="outline" onClick={handleDownloadCsv} disabled={!currentReport || reportIsLoading}>
                      <Download className="mr-2 h-4 w-4" />
                      {t('Export CSV', 'CSV ஏற்றுமதி')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {reportIsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('Generating report...', 'அறிக்கை உருவாக்கப்படுகிறது...')}
                  </div>
                ) : !currentReport ? (
                  <div className="text-sm text-muted-foreground">
                    {t('Click Generate Report to fetch data.', 'அறிக்கை பெற “அறிக்கை உருவாக்கு” ஐ அழுத்தவும்.')}
                  </div>
                ) : (
                  <>
                    {currentReport?.ai?.requested ? (
                      <div className="rounded-lg border p-4">
                        <div className="font-medium mb-2">{t('Insights', 'உள்ளடக்கம்')}</div>
                        {currentReport?.ai?.executiveSummary ? (
                          <div className="text-sm text-muted-foreground mb-2">{String(currentReport.ai.executiveSummary)}</div>
                        ) : null}
                        {Array.isArray(currentReport?.ai?.insights) && currentReport.ai.insights.length > 0 ? (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            {currentReport.ai.insights.slice(0, 6).map((x: any, idx: number) => (
                              <li key={idx}>{String(x)}</li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-3">
                          {currentReport?.ai?.generated
                            ? t('This report is AI-assisted and generated by Reside Management System.', 'இந்த அறிக்கை AI உதவியுடன் Reside Management System மூலம் உருவாக்கப்படுகிறது.')
                            : t('This report is system-generated by Reside Management System.', 'இந்த அறிக்கை Reside Management System மூலம் உருவாக்கப்படுகிறது.')}
                        </div>
                      </div>
                    ) : null}

                    {activeCustomerReport === 'paymentHistory' ? (
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Approved', 'மொத்த அனுமதிக்கப்பட்டது')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.totalApproved ?? 0)}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Pending Dues', 'நிலுவைத் தொகை')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.pendingDueAmount ?? 0)}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Failed Payments', 'தோல்வி கட்டணங்கள்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.failedPayments ?? 0).toLocaleString()}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Payments', 'மொத்த கட்டணங்கள்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.totalPayments ?? 0).toLocaleString()}</CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeCustomerReport === 'expenseSummary' ? (
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Rent', 'மொத்த வாடகை')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.totalRent ?? 0)}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Maintenance', 'மொத்த பராமரிப்பு')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.totalMaintenance ?? 0)}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Utilities', 'மொத்த பயன்பாடுகள்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.totalUtilities ?? 0)}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Expenses', 'மொத்த செலவுகள்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{money(currentReport?.summary?.totalExpenses ?? 0)}</CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeCustomerReport === 'maintenance' ? (
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Total Requests', 'மொத்த கோரிக்கைகள்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.totalRequests ?? 0).toLocaleString()}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Pending', 'நிலுவையில்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.pending ?? 0).toLocaleString()}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('In Progress', 'செயலில்')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.inProgress ?? 0).toLocaleString()}</CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Completed', 'முடிந்தது')}</CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-bold">{Number(currentReport?.summary?.completed ?? 0).toLocaleString()}</CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeCustomerReport === 'paymentHistory' && paymentHistoryDerived ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Monthly Paid', 'மாதாந்திர செலுத்தப்பட்டது')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div ref={paymentHistoryChartRef} className="h-[240px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paymentHistoryDerived.monthlyPaid}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="amount" fill="#16a34a" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Payment Status', 'கட்டண நிலை')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[240px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={paymentHistoryDerived.statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={90} paddingAngle={2}>
                                    <Cell fill="#16a34a" />
                                    <Cell fill="#2563eb" />
                                    <Cell fill="#ef4444" />
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeCustomerReport === 'expenseSummary' && expenseSummaryDerived ? (
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{t('Month-wise Spending', 'மாத வாரியான செலவுகள்')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div ref={expenseSummaryChartRef} className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={expenseSummaryDerived.chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="total" fill="#2563eb" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {activeCustomerReport === 'maintenance' && maintenanceDerived ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Status', 'நிலை')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div ref={maintenanceChartRef} className="h-[240px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={maintenanceDerived.statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={90} paddingAngle={2}>
                                    <Cell fill="#16a34a" />
                                    <Cell fill="#2563eb" />
                                    <Cell fill="#f59e0b" />
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Monthly Requests', 'மாதாந்திர கோரிக்கைகள்')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[240px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={maintenanceDerived.monthlyRequests}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="count" fill="#f59e0b" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}

                    <div className="rounded-lg border overflow-x-auto">
                      {activeCustomerReport === 'paymentHistory' ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('Month', 'மாதம்')}</TableHead>
                              <TableHead>{t('Property', 'சொத்து')}</TableHead>
                              <TableHead>{t('Amount', 'தொகை')}</TableHead>
                              <TableHead>{t('Date', 'தேதி')}</TableHead>
                              <TableHead>{t('Method', 'முறை')}</TableHead>
                              <TableHead>{t('Status', 'நிலை')}</TableHead>
                              <TableHead>{t('Receipt', 'ரசீது')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any, idx: number) => (
                              <TableRow key={String(r?.paymentId || idx)}>
                                <TableCell>{formatShortDate(r?.month)}</TableCell>
                                <TableCell>{displayTa(r?.propertyTitle || '')}</TableCell>
                                <TableCell>{money(r?.amount ?? 0)}</TableCell>
                                <TableCell>{formatShortDate(r?.paymentDate || r?.approvedDate)}</TableCell>
                                <TableCell>{String(r?.mode || '')}</TableCell>
                                <TableCell>{String(r?.status || '')}</TableCell>
                                <TableCell>{String(r?.receiptNumber || '')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : null}

                      {activeCustomerReport === 'expenseSummary' ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('Month', 'மாதம்')}</TableHead>
                              <TableHead>{t('Rent', 'வாடகை')}</TableHead>
                              <TableHead>{t('Maintenance', 'பராமரிப்பு')}</TableHead>
                              <TableHead>{t('Utilities', 'பயன்பாடுகள்')}</TableHead>
                              <TableHead>{t('Total', 'மொத்தம்')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any, idx: number) => (
                              <TableRow key={String(r?.key || r?.name || idx)}>
                                <TableCell>{String(r?.name || r?.key || '')}</TableCell>
                                <TableCell>{money(r?.rent ?? 0)}</TableCell>
                                <TableCell>{money(r?.maintenance ?? 0)}</TableCell>
                                <TableCell>{money(r?.utilities ?? 0)}</TableCell>
                                <TableCell>{money(r?.total ?? 0)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : null}

                      {activeCustomerReport === 'maintenance' ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('Property', 'சொத்து')}</TableHead>
                              <TableHead>{t('Issue', 'பிரச்சனை')}</TableHead>
                              <TableHead>{t('Status', 'நிலை')}</TableHead>
                              <TableHead>{t('Request Date', 'கோரிக்கை தேதி')}</TableHead>
                              <TableHead>{t('Resolution Date', 'தீர்வு தேதி')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(Array.isArray(currentReport?.rows) ? currentReport.rows : []).map((r: any, idx: number) => (
                              <TableRow key={String(r?.requestId || idx)}>
                                <TableCell>{displayTa(r?.propertyTitle || '')}</TableCell>
                                <TableCell>{String(r?.issue || '')}</TableCell>
                                <TableCell>{String(r?.status || '')}</TableCell>
                                <TableCell>{formatShortDate(r?.requestDate)}</TableCell>
                                <TableCell>{formatShortDate(r?.resolutionDate)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agreement Content - Removed as it's now part of My Rentals */}
          
          {/* Settings Content */}
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('Profile Settings', 'சுயவிவர அமைப்புகள்')}</CardTitle>
                <CardDescription>{t('Manage your personal information', 'உங்கள் தனிப்பட்ட தகவல்களை நிர்வகிக்கவும்')}</CardDescription>
              </CardHeader>
              <CardContent>
        {/* Profile Completion Progress */}
        {(() => {
          void profileFormVersion;
          const getCurrentValue = (id: string, fallback: unknown) => {
            if (typeof document === 'undefined') return fallback;
            const el = document.getElementById(id) as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement
              | null;
            if (!el) return fallback;
            const value = (el as HTMLInputElement).value;
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return value;
            }
            return fallback;
          };

          const fields = [
            { key: 'name', label: t('Full Name', 'முழு பெயர்'), value: getCurrentValue('name', userProfile?.name) },
            { key: 'phone', label: t('Phone Number', 'தொலைபேசி எண்'), value: getCurrentValue('phone', userProfile?.phone) },
            { key: 'address', label: t('Address', 'முகவரி'), value: getCurrentValue('address', userProfile?.address) },
            { key: 'age', label: t('Age', 'வயது'), value: getCurrentValue('age', userProfile?.age) },
            { key: 'dateOfBirth', label: t('Date of Birth', 'பிறந்த தேதி'), value: getCurrentValue('dateOfBirth', userProfile?.dateOfBirth) },
            { key: 'gender', label: t('Gender', 'பாலினம்'), value: getCurrentValue('gender', userProfile?.gender) },
            { key: 'familyMembers', label: t('Family Members', 'குடும்ப உறுப்பினர்கள்'), value: getCurrentValue('familyMembers', userProfile?.familyMembers) },
            { key: 'religion', label: t('Religion', 'மதம்'), value: getCurrentValue('religion', userProfile?.religion) },
            { key: 'occupation', label: t('Occupation', 'தொழில்'), value: getCurrentValue('occupation', userProfile?.occupation) },
            { key: 'companyName', label: t('Company Name', 'நிறுவனத்தின் பெயர்'), value: getCurrentValue('companyName', userProfile?.companyName) },
            { key: 'monthlyIncome', label: t('Monthly Income', 'மாத வருமானம்'), value: getCurrentValue('monthlyIncome', userProfile?.monthlyIncome) },
            { key: 'maritalStatus', label: t('Marital Status', 'திருமண நிலை'), value: getCurrentValue('maritalStatus', userProfile?.maritalStatus) },
            { key: 'aadhar', label: t('ID Number', 'அடையாள எண்'), value: getCurrentValue('aadhar', userProfile?.aadhar || userProfile?.idNumber) },
            { key: 'idType', label: t('ID Type', 'அடையாள வகை'), value: getCurrentValue('idType', userProfile?.idType) },
          ];
          const total = fields.length;
          const filled = fields.filter(f => f.value !== undefined && f.value !== null && String(f.value).trim() !== '').length;
          const computedPercent = Math.round((filled / total) * 100);
          const percent = computedPercent;
          const missingFields = fields.filter(f => !(f.value !== undefined && f.value !== null && String(f.value).trim() !== ''));
          const size = 140;
          const stroke = 12;
          const radius = (size - stroke) / 2;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference * (1 - percent / 100);
          const color = percent < 40 ? '#ef4444' : percent < 80 ? '#f97316' : '#16a34a';

          const handleMissingFieldClick = (key: string) => {
            const el = document.getElementById(key);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
              el.classList.add('ring-2', 'ring-red-400', 'border-red-500');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-red-400', 'border-red-500');
              }, 2000);
            }
          };

          return (
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth={stroke}
                    fill="none"
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{percent}%</div>
                    <div className="text-xs text-muted-foreground">{t('Profile Complete', 'சுயவிவரம் நிறைவு')}</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full">
                {percent < 100 && (
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-medium mb-2">{t('Missing Fields', 'இல்லாத புலங்கள்')}</div>
                    <div className="flex flex-wrap gap-2">
                      {missingFields.map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => handleMissingFieldClick(field.key)}
                          className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 focus:outline-none"
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
                <form
                  key={userProfile?.id || userProfile?.email || 'profile-form'}
                  onSubmit={handleUpdateProfile}
                  className="space-y-6 max-w-lg"
                >
                  <div className="space-y-2">
                    <Label>{t('Profile Picture', 'சுயவிவரப் படம்')}</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border">
                        {profilePreview ? (
                          <img src={profilePreview} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('Upload a picture from your local files (JPG, PNG)', 'உங்கள் உள்ளூர் கோப்புகளிலிருந்து ஒரு படத்தை பதிவேற்றவும் (JPG, PNG)')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">{t('Full Name', 'முழு பெயர்')}</Label>
                    <Input id="name" name="name" defaultValue={userProfile?.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('Email Address', 'மின்னஞ்சல் முகவரி')}</Label>
                    <Input id="email" defaultValue={userProfile?.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('Phone Number', 'தொலைபேசி எண்')}</Label>
                    <Input id="phone" name="phone" placeholder="+91 98765 43210" defaultValue={userProfile?.phone} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">{t('Address', 'முகவரி')}</Label>
                    <Textarea id="address" name="address" placeholder="Your permanent address" defaultValue={userProfile?.address} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aadhar">{t('ID Number', 'அடையாள எண்')}</Label>
                    <Input id="aadhar" name="aadhar" placeholder="XXXX XXXX XXXX" defaultValue={userProfile?.aadhar || userProfile?.idNumber} />
                  </div>

                  {/* Tenant Profile Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age">{t('Age', 'வயது')}</Label>
                      <Input
                        id="age"
                        name="age"
                        type="number"
                        min="1"
                        max="120"
                        placeholder={t('e.g., 25', 'எ.கா., 25')}
                        defaultValue={userProfile?.age || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">{t('Date of Birth', 'பிறந்த தேதி')}</Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        defaultValue={userProfile?.dateOfBirth ? new Date(userProfile.dateOfBirth).toISOString().split('T')[0] : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">{t('Gender', 'பாலினம்')}</Label>
                      <select
                        id="gender"
                        name="gender"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        defaultValue={userProfile?.gender || ''}
                      >
                        <option value="">{t('Select Gender', 'பாலினத்தை தேர்வு செய்யவும்')}</option>
                        <option value="Male">{t('Male', 'ஆண்')}</option>
                        <option value="Female">{t('Female', 'பெண்')}</option>
                        <option value="Other">{t('Other', 'மற்றவை')}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="familyMembers">{t('Family Members', 'குடும்ப உறுப்பினர்கள்')}</Label>
                      <Input
                        id="familyMembers"
                        name="familyMembers"
                        type="number"
                        min="1"
                        placeholder={t('e.g., 4', 'எ.கா., 4')}
                        defaultValue={userProfile?.familyMembers || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="religion">{t('Religion', 'மதம்')}</Label>
                      <select
                        id="religion"
                        name="religion"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        defaultValue={userProfile?.religion || ''}
                      >
                        <option value="">{t('Select Religion', 'மதம் தேர்வு செய்யவும்')}</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Muslim">Muslim</option>
                        <option value="Christian">Christian</option>
                        <option value="Sikh">Sikh</option>
                        <option value="Buddhist">Buddhist</option>
                        <option value="Jain">Jain</option>
                        <option value="Other">{t('Other', 'மற்றவை')}</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                      <Label htmlFor="occupation">{t('Occupation', 'தொழில்')}</Label>
                      <Input
                        id="occupation"
                        name="occupation"
                        placeholder={t('e.g., Software Engineer', 'எ.கா., மென்பொருள் பொறியாளர்')}
                        defaultValue={userProfile?.occupation || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyName">{t('Company Name', 'நிறுவனத்தின் பெயர்')}</Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        placeholder={t('e.g., ABC Pvt Ltd', 'எ.கா., ABC Pvt Ltd')}
                        defaultValue={userProfile?.companyName || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monthlyIncome">{t('Monthly Income (Optional)', 'மாத வருமானம் (விருப்பம்)')}</Label>
                      <Input
                        id="monthlyIncome"
                        name="monthlyIncome"
                        type="number"
                        min="0"
                        placeholder={t('e.g., 50000', 'எ.கா., 50000')}
                        defaultValue={userProfile?.monthlyIncome || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maritalStatus">{t('Marital Status', 'திருமண நிலை')}</Label>
                      <select
                        id="maritalStatus"
                        name="maritalStatus"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        defaultValue={userProfile?.maritalStatus || ''}
                      >
                        <option value="">{t('Select Status', 'நிலையை தேர்வு செய்யவும்')}</option>
                        <option value="Single">{t('Single', 'திருமணம் ஆகாதவர்')}</option>
                        <option value="Married">{t('Married', 'திருமணமானவர்')}</option>
                        <option value="Divorced">{t('Divorced', 'விவாகரத்து')}</option>
                        <option value="Widowed">{t('Widowed', 'விதவை')}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="idType">{t('ID Type', 'அடையாள வகை')}</Label>
                      <select
                        id="idType"
                        name="idType"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        defaultValue={userProfile?.idType || ''}
                      >
                        <option value="">{t('Select ID Type', 'அடையாள வகையை தேர்வு செய்யவும்')}</option>
                        <option value="Aadhaar">Aadhaar</option>
                        <option value="PAN">PAN</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="idProof">{t('Upload ID Proof', 'அடையாள ஆதாரத்தை பதிவேற்றவும்')}</Label>
                      <Input
                        id="idProof"
                        type="file"
                        accept="image/*"
                        onChange={handleIdProofChange}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="notificationsEnabled">{t('Notifications', 'அறிவிப்புகள்')}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="notificationsEnabled"
                        name="notificationsEnabled"
                        type="checkbox"
                        defaultChecked={userProfile?.notificationsEnabled ?? true}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-muted-foreground">
                        {t('Receive important updates and alerts', 'முக்கிய புதுப்பிப்புகள் மற்றும் எச்சரிக்கைகளை பெறவும்')}
                      </span>
                    </div>
                  </div>

                  <Button type="submit">{t('Save Changes', 'மாற்றங்களைச் சேமிக்கவும்')}</Button>
                </form>

                <div className="mt-10 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {t('Change Password', 'கடவுச்சொல்லை மாற்றவும்')}
                  </h3>
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">
                        {t('Current Password', 'தற்போதைய கடவுச்சொல்')}
                      </Label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">
                        {t('New Password', 'புதிய கடவுச்சொல்')}
                      </Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        {t('Confirm New Password', 'புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்')}
                      </Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      {t('Update Password', 'கடவுச்சொல்லை புதுப்பிக்கவும்')}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        <RentalDetailsDialog
          open={!!selectedRental}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRental(null);
              setSelectedRentalInitialTab('payments');
            }
          }}
          agreement={selectedRental}
          rentRecords={rentRecords.filter(r => r.agreement === selectedRental?._id || r.agreement?._id === selectedRental?._id)}
          onPayClick={(record) => setSelectedRentRecord(record)}
          onViewAgreement={() => setSelectedAgreement(selectedRental)}
          initialTab={selectedRentalInitialTab}
        />

        <Dialog open={requestsModalType !== null} onOpenChange={(open) => !open && setRequestsModalType(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {requestsModalType === 'maintenance'
                  ? t('Maintenance Requests', 'பராமரிப்பு கோரிக்கைகள்')
                  : t('Vacate Requests', 'வெளியேறு கோரிக்கைகள்')}
              </DialogTitle>
              <DialogDescription>
                {requestsModalType === 'maintenance'
                  ? t(
                      'Select a property to open its Maintenance tab',
                      'Maintenance தாளைத் திறக்க ஒரு சொத்தைத் தேர்ந்தெடுக்கவும்'
                    )
                  : t(
                      'Select a property to open its Vacate tab',
                      'Vacate தாளைத் திறக்க ஒரு சொத்தைத் தேர்ந்தெடுக்கவும்'
                    )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {requestsModalType === 'maintenance' ? (
                maintenanceProperties.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    {t('No maintenance requests found.', 'பராமரிப்பு கோரிக்கைகள் எதுவும் இல்லை.')}
                  </div>
                ) : (
                  maintenanceProperties
                    .sort((a, b) => b.pending - a.pending || b.inProgress - a.inProgress || b.total - a.total)
                    .map((p) => (
                      <button
                        key={p.propertyId}
                        type="button"
                        onClick={() => openRentalForProperty(p.propertyId, 'maintenance')}
                        className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{displayTa(p.title)}</p>
                            {p.location && <p className="text-xs text-muted-foreground truncate">{displayTa(p.location)}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={p.pending > 0 ? 'destructive' : 'secondary'}>
                              {p.pending > 0 ? `${p.pending} ${t('New', 'புதியது')}` : `${p.total}`}
                            </Badge>
                            {p.inProgress > 0 && (
                              <Badge variant="outline" className="bg-background/80">
                                {p.inProgress} {t('In progress', 'செயல்பாட்டில்')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                )
              ) : vacateProperties.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  {t('No vacate requests found.', 'வெளியேறு கோரிக்கைகள் எதுவும் இல்லை.')}
                </div>
              ) : (
                vacateProperties
                  .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
                  .map((p) => (
                    <button
                      key={p.propertyId}
                      type="button"
                      onClick={() => openRentalForProperty(p.propertyId, 'vacate')}
                      className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{displayTa(p.title)}</p>
                          {p.location && <p className="text-xs text-muted-foreground truncate">{displayTa(p.location)}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {p.latestStatus ? (
                            <Badge
                              variant={
                                p.latestStatus === 'approved'
                                  ? 'default'
                                  : p.latestStatus === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {String(p.latestStatus).toUpperCase()}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{p.total}</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <FloatingChat />

        <AgreementDialog
          agreement={selectedAgreement}
          open={!!selectedAgreement}
          onOpenChange={(open) => !open && setSelectedAgreement(null)}
        />
      </div>
      <PaymentDialog
        rentRecord={selectedRentRecord}
        open={!!selectedRentRecord}
        onOpenChange={(open) => !open && setSelectedRentRecord(null)}
        onSuccess={() => {
          // Refetch records
          const fetchRentRecords = async () => {
            const res = await api.get('/payments/tenant/records');
            setRentRecords(res.data);
          };
          fetchRentRecords();
        }}
      />

      <Dialog open={metricDetailsType !== null} onOpenChange={() => setMetricDetailsType(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {metricDetailsType === 'activeRentals'
                ? t('Active Rentals', 'செயலில் உள்ள வாடகைகள்')
                : metricDetailsType === 'thisMonthRent'
                  ? t('This Month Rent Details', 'இந்த மாத வாடகை விவரங்கள்')
                  : metricDetailsType === 'thisMonthDue'
                    ? t('This Month Due Details', 'இந்த மாத நிலுவை விவரங்கள்')
                    : metricDetailsType === 'pendingPropertyRequests'
                      ? t('Pending Property Requests', 'நிலுவை சொத்து கோரிக்கைகள்')
                      : metricDetailsType === 'openMaintenance'
                        ? t('Open Maintenance Requests', 'பராமரிப்பு நிலுவை கோரிக்கைகள்')
                        : t('Latest Vacate Status', 'சமீபத்திய வெளியேறு நிலை')}
            </DialogTitle>
            <DialogDescription>
              {t('Detailed information for this metric.', 'இந்த அளவுக்கான விரிவான தகவல்.')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Active Rentals Content */}
            {metricDetailsType === 'activeRentals' && (
               activeAgreements.length === 0 ? (
                <p className="text-muted-foreground">{t('No active rentals found.', 'செயலில் உள்ள வாடகைகள் எதுவும் இல்லை.')}</p>
              ) : (
                <div className="space-y-4">
                  {activeAgreements.map((agreement: any) => (
                    <div key={agreement._id} className="border p-4 rounded-md">
                      <h4 className="font-semibold">{displayTa(agreement.property?.title || t('Property', 'சொத்து'))}</h4>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                         <p>{t('Owner:', 'உரிமையாளர்:')} {agreement.owner?.name}</p>
                         <p>{t('Rent:', 'வாடகை:')} ₹{agreement.rentAmount}</p>
                         <p>{t('Start Date:', 'தொடக்கம்:')} {new Date(agreement.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* This Month Rent Content */}
            {metricDetailsType === 'thisMonthRent' && (
              thisMonthRecords.length === 0 ? (
                <p className="text-muted-foreground">{t('No rent records for this month.', 'இந்த மாதத்திற்கான வாடகை பதிவுகள் எதுவும் இல்லை.')}</p>
              ) : (
                <div className="space-y-4">
                  {thisMonthRecords.map((record: any) => (
                    <div key={record._id} className="border p-4 rounded-md">
                      <h4 className="font-semibold">{displayTa(record.property?.title || t('Property', 'சொத்து'))}</h4>
                      <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">{t('Rent Amount', 'வாடகை தொகை')}</p>
                          <p className="font-medium">₹{record.rentAmount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('Paid Amount', 'செலுத்தப்பட்ட தொகை')}</p>
                          <p className="font-medium text-green-600">₹{record.amountPaid || (record.rentAmount - record.balance)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('Balance', 'மீதி')}</p>
                          <p className="font-medium text-red-600">₹{record.balance}</p>
                        </div>
                         <div>
                          <p className="text-muted-foreground">{t('Status', 'நிலை')}</p>
                          <Badge variant={record.status === 'paid' ? 'default' : 'destructive'}>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* This Month Due Content */}
             {metricDetailsType === 'thisMonthDue' && (
               thisMonthRecords.filter((r: any) => r.balance > 0).length === 0 ? (
                <p className="text-muted-foreground">{t('No dues pending for this month.', 'இந்த மாதத்திற்கான நிலுவைகள் எதுவும் இல்லை.')}</p>
              ) : (
                <div className="space-y-4">
                  {thisMonthRecords.filter((r: any) => r.balance > 0).map((record: any) => (
                    <div key={record._id} className="border p-4 rounded-md border-l-4 border-l-red-500">
                      <h4 className="font-semibold">{displayTa(record.property?.title || t('Property', 'சொத்து'))}</h4>
                       <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">{t('Due Amount', 'நிலுவை தொகை')}</p>
                          <p className="font-bold text-red-600">₹{record.balance}</p>
                        </div>
                         <div>
                          <p className="text-muted-foreground">{t('Due Date', 'கடைசி தேதி')}</p>
                          <p className="font-medium">{record.dueDate ? new Date(record.dueDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Pending Property Requests */}
             {metricDetailsType === 'pendingPropertyRequests' && (
                tenantRequests.filter((r: any) => r.status === 'pending').length === 0 ? (
                 <p className="text-muted-foreground">{t('No pending property requests.', 'நிலுவையில் உள்ள சொத்து கோரிக்கைகள் இல்லை.')}</p>
               ) : (
                 <div className="space-y-4">
                   {tenantRequests.filter((r: any) => r.status === 'pending').map((req: any) => (
                     <div key={req._id} className="border p-4 rounded-md">
                       <h4 className="font-semibold">{displayTa(req.property?.title || t('Property Request', 'சொத்து கோரிக்கை'))}</h4>
                       <p className="text-sm text-muted-foreground mt-1">
                         {t('Sent on:', 'அனுப்பப்பட்டது:')} {new Date(req.createdAt).toLocaleDateString()}
                       </p>
                       {req.message && (
                         <div className="mt-2 bg-muted p-2 rounded text-sm">
                           "{req.message}"
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )
             )}

            {/* Open Maintenance */}
            {metricDetailsType === 'openMaintenance' && (
                maintenanceRequests.filter((r: any) => ['pending', 'in-progress'].includes(r.status)).length === 0 ? (
                 <p className="text-muted-foreground">{t('No open maintenance requests.', 'திறந்த பராமரிப்பு கோரிக்கைகள் இல்லை.')}</p>
               ) : (
                 <div className="space-y-4">
                   {maintenanceRequests.filter((r: any) => ['pending', 'in-progress'].includes(r.status)).map((req: any) => (
                     <div key={req._id} className="border p-4 rounded-md">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold">{req.title || t('Maintenance Issue', 'பராமரிப்பு சிக்கல்')}</h4>
                           <Badge variant={req.status === 'in-progress' ? 'default' : 'secondary'}>
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{displayTa(req.property?.title)}</p>
                       <p className="text-sm text-muted-foreground mt-1">
                         {t('Reported on:', 'அறிவிக்கப்பட்டது:')} {new Date(req.createdAt).toLocaleDateString()}
                       </p>
                       {req.description && (
                         <div className="mt-2 bg-muted p-2 rounded text-sm">
                           {req.description}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )
             )}

            {/* Latest Vacate Status */}
            {metricDetailsType === 'latestVacate' && (
              !latestVacate ? (
                <p className="text-muted-foreground">{t('No vacate requests found.', 'வெளியேறு கோரிக்கைகள் எதுவும் இல்லை.')}</p>
              ) : (
                <div className="border p-4 rounded-md">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-lg">{t('Vacate Request Details', 'வெளியேறு கோரிக்கை விவரங்கள்')}</h4>
                      <Badge variant={latestVacate.status === 'approved' ? 'default' : latestVacate.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {latestVacate.status?.toUpperCase()}
                      </Badge>
                   </div>
                   
                   <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('Property', 'சொத்து')}</p>
                        <p className="font-medium">{displayTa(latestVacate.property?.title || t('Unknown Property', 'தெரியாத சொத்து'))}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-sm text-muted-foreground">{t('Requested Date', 'கோரப்பட்ட தேதி')}</p>
                            <p className="font-medium">{latestVacate.requestedVacateDate ? new Date(latestVacate.requestedVacateDate).toLocaleDateString() : 'N/A'}</p>
                         </div>
                         <div>
                            <p className="text-sm text-muted-foreground">{t('Created At', 'உருவாக்கப்பட்டது')}</p>
                            <p className="font-medium">{new Date(latestVacate.createdAt).toLocaleDateString()}</p>
                         </div>
                      </div>

                      {latestVacate.reason && (
                        <div>
                          <p className="text-sm text-muted-foreground">{t('Reason', 'காரணம்')}</p>
                          <div className="bg-muted p-2 rounded text-sm mt-1">
                            {latestVacate.reason}
                          </div>
                        </div>
                      )}
                   </div>
                </div>
              )
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
