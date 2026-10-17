import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Building,
  CreditCard,
  Download,
  Home,
  LineChart as LineChartIcon,
  Plus,
  RefreshCcw,
  Search,
  TriangleAlert,
  Users,
  Wrench
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminAnalytics,
  useAdminApproveUser,
  useAdminAssignUserRole,
  useAdminAssignUserTamilRole,
  useAdminBlockUser,
  useAdminCreateProperty,
  useAdminCreateUser,
  useAdminDeleteProperty,
  useAdminMaintenance,
  useAdminOverview,
  useAdminOverduePayments,
  useAdminPayments,
  useAdminProperties,
  useAdminSendAnnouncement,
  useAdminPaymentStatusReport,
  useAdminPropertyPerformanceReport,
  useAdminOccupancyReport,
  useAdminMaintenanceReport,
  useAdminRevenueReport,
  useAdminUpdateMaintenance,
  useAdminUpdateProperty,
  useAdminUsers,
  useGetCallerUserProfile
} from '../hooks/useQueries';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

type Section =
  | 'overview'
  | 'properties'
  | 'users'
  | 'maintenance'
  | 'payments'
  | 'analytics'
  | 'notifications';

type SummaryModal = 'properties' | 'tenants' | 'revenue' | 'maintenance';

const OCCUPANCY_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

const ADMIN_STATUS_LABELS: Record<string, { en: string; ta: string }> = {
  pendingUsers: { en: 'Pending Users', ta: 'நிலுவையில் உள்ள பயனர்கள்' },
  pendingMaintenance: { en: 'Pending Maintenance', ta: 'நிலுவை பராமரிப்பு' },
  overduePayments: { en: 'Overdue Payments', ta: 'காலாவதி கட்டணங்கள்' },
  submittedPayments: { en: 'Submitted Payments', ta: 'சமர்ப்பிக்கப்பட்ட கட்டணங்கள்' },
  pendingPropertyRequests: { en: 'Pending Property Requests', ta: 'நிலுவையில் உள்ள சொத்து கோரிக்கைகள்' }
};

function formatAdminKey(t: (en: string, ta: string) => string, key: unknown) {
  const k = String(key || '');
  const mapped = ADMIN_STATUS_LABELS[k];
  if (mapped) return t(mapped.en, mapped.ta);
  const spaced = k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function AdminDashboardModern() {
  const { t } = useLanguage();

  const { data: overview } = useAdminOverview();
  const { data: analytics } = useAdminAnalytics();
  const { data: properties = [] } = useAdminProperties();
  const { data: users = [] } = useAdminUsers();
  const { data: maintenance = [] } = useAdminMaintenance();
  const { data: payments = [] } = useAdminPayments();

  const createProperty = useAdminCreateProperty();
  const createUser = useAdminCreateUser();
  const sendAnnouncement = useAdminSendAnnouncement();
  const updateMaintenance = useAdminUpdateMaintenance();

  const [query, setQuery] = useState('');
  const [summaryModal, setSummaryModal] = useState<SummaryModal | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [selectedTenantRow, setSelectedTenantRow] = useState<any | null>(null);
  const [selectedMaintenanceRow, setSelectedMaintenanceRow] = useState<any | null>(null);
  const [createPropertyOpen, setCreatePropertyOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<null | { email: string; password: string; name: string; tamilRole: string }>(null);
  const [userDraft, setUserDraft] = useState({ name: '', email: '', phone: '', tamilRole: 'customers' });
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState({ title: '', message: '' });
  const [manualActivities, setManualActivities] = useState<Array<{ id: string; title: string; subtitle: string; icon: any; ts: number }>>([]);
  const [maintenanceStatusDraft, setMaintenanceStatusDraft] = useState('pending');
  const [propertyDraft, setPropertyDraft] = useState({
    ownerId: '',
    title: '',
    propertyType: 'Apartment',
    location: '',
    price: ''
  });

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const s = String(selectedMaintenanceRow?.status || 'pending');
    setMaintenanceStatusDraft(s);
  }, [selectedMaintenanceRow]);

  const owners = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return list
      .filter((u: any) => String(u?.tamilRole || u?.role || '').toLowerCase().includes('owner'))
      .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [users]);

  const totals = useMemo(() => {
    const isTenant = (u: any) => {
      const r = String(u?.tamilRole || u?.role || '').toLowerCase();
      return r.includes('tenant') || r.includes('customer');
    };

    const pendingMaintenance = Number(overview?.totals?.pendingMaintenance || 0);
    const monthlyRevenue = Number(overview?.totals?.revenueThisMonth || 0);
    const totalProperties = Number(overview?.totals?.properties || (Array.isArray(properties) ? properties.length : 0));

    return {
      totalProperties,
      totalTenants: (Array.isArray(users) ? users : []).filter(isTenant).length,
      monthlyRevenue,
      openMaintenance:
        pendingMaintenance || (Array.isArray(maintenance) ? maintenance.filter((m: any) => String(m?.status) !== 'completed').length : 0)
    };
  }, [maintenance, overview?.totals?.pendingMaintenance, overview?.totals?.properties, overview?.totals?.revenueThisMonth, properties, users]);

  const revenueByMonth = Array.isArray(analytics?.revenueByMonth) ? analytics.revenueByMonth : [];
  const occupancyObj = analytics?.occupancy || {};
  const occupancyRows = Object.keys(occupancyObj).map((k) => ({ name: k, value: Number(occupancyObj[k] || 0) }));
  const occupancyColors = ['#2563eb', '#60a5fa', '#94a3b8', '#e2e8f0'];

  const filteredProps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(properties) ? properties : [];
    if (!q) return list;
    return list.filter((p: any) => {
      return (
        String(p?.title || '').toLowerCase().includes(q) ||
        String(p?.location || '').toLowerCase().includes(q) ||
        String(p?.owner?.name || '').toLowerCase().includes(q) ||
        String(p?.owner?.email || '').toLowerCase().includes(q) ||
        String(p?.status || '').toLowerCase().includes(q) ||
        String(p?.occupancyStatus || '').toLowerCase().includes(q) ||
        String(p?.propertyType || '').toLowerCase().includes(q) ||
        String(p?.transactionType || '').toLowerCase().includes(q) ||
        String(p?.price ?? '').toLowerCase().includes(q)
      );
    });
  }, [properties, query]);

  const filteredMaintenance = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(maintenance) ? maintenance : [];
    if (!q) return list;
    return list.filter((m: any) => {
      return (
        String(m?.issue || '').toLowerCase().includes(q) ||
        String(m?.property?.title || '').toLowerCase().includes(q) ||
        String(m?.property?.location || '').toLowerCase().includes(q) ||
        String(m?.tenant?.name || m?.tenant?.email || '').toLowerCase().includes(q) ||
        String(m?.status || '').toLowerCase().includes(q) ||
        String(m?.priority || '').toLowerCase().includes(q) ||
        String(m?.category || '').toLowerCase().includes(q)
      );
    });
  }, [maintenance, query]);

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(payments) ? payments : [];
    if (!q) return list;
    return list.filter((p: any) => {
      return (
        String(p?.tenant?.name || p?.tenant?.email || '').toLowerCase().includes(q) ||
        String(p?.tenant?.email || '').toLowerCase().includes(q) ||
        String(p?.owner?.name || p?.owner?.email || '').toLowerCase().includes(q) ||
        String(p?.owner?.email || '').toLowerCase().includes(q) ||
        String(p?.rentRecord?.property?.title || '').toLowerCase().includes(q) ||
        String(p?.rentRecord?.property?.location || '').toLowerCase().includes(q) ||
        String(p?.status || '').toLowerCase().includes(q) ||
        String(p?.amount ?? '').toLowerCase().includes(q)
      );
    });
  }, [payments, query]);

  const filteredTenantUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(users) ? users : [];
    const isTenant = (u: any) => {
      const r = String(u?.tamilRole || u?.role || '').toLowerCase();
      return r.includes('tenant') || r.includes('customer');
    };
    const tenants = list.filter(isTenant);
    if (!q) return tenants;
    return tenants.filter((u: any) => {
      return (
        String(u?.name || '').toLowerCase().includes(q) ||
        String(u?.email || '').toLowerCase().includes(q) ||
        String(u?.phone || '').toLowerCase().includes(q)
      );
    });
  }, [query, users]);

  const openMaintenanceRows = useMemo(() => {
    const list = Array.isArray(filteredMaintenance) ? filteredMaintenance : [];
    return list.filter((m: any) => String(m?.status || '').toLowerCase() !== 'completed');
  }, [filteredMaintenance]);

  const revenueSummaryRows = useMemo(() => {
    const list = Array.isArray(revenueByMonth) ? revenueByMonth : [];
    return list.slice(-6).reverse();
  }, [revenueByMonth]);

  const recentTenants = useMemo(() => {
    const list = Array.isArray(filteredPayments) ? filteredPayments : [];
    return list.slice(0, 8).map((p: any) => {
      const status = String(p?.status || '').toLowerCase();
      const paid = status === 'approved' || status === 'paid';
      return {
        id: String(p?._id || p?.id || `${p?.tenant?._id || p?.tenant?.id}-${p?.date || ''}`),
        tenantName: String(p?.tenant?.name || p?.tenant?.email || '-'),
        propertyTitle: String(p?.rentRecord?.property?.title || '-'),
        unit: '-',
        rentAmount: Number(p?.amount || 0),
        paymentStatus: paid ? 'Paid' : 'Pending'
      };
    });
  }, [filteredPayments]);

  const recentActivity = useMemo(() => {
    const pick = (x: any) => {
      const d = x?.updatedAt || x?.createdAt || x?.date;
      const ms = d ? new Date(d).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };
    const items: Array<{ id: string; title: string; subtitle: string; icon: any; ts: number }> = [];
    (Array.isArray(filteredPayments) ? filteredPayments : []).slice(0, 20).forEach((p: any) => {
      items.push({
        id: `pay-${String(p?._id || p?.id)}`,
        title: t('Payment recorded', 'கட்டணம் பதிவு செய்யப்பட்டது'),
        subtitle: `${String(p?.tenant?.email || p?.tenant?.name || '')} • ₹${Number(p?.amount || 0).toLocaleString()}`,
        icon: CreditCard,
        ts: pick(p)
      });
    });
    (Array.isArray(filteredMaintenance) ? filteredMaintenance : []).slice(0, 20).forEach((m: any) => {
      items.push({
        id: `mnt-${String(m?._id || m?.id)}`,
        title: t('Maintenance request', 'பராமரிப்பு கோரிக்கை'),
        subtitle: `${String(m?.property?.title || '')} • ${String(m?.issue || '')}`,
        icon: Wrench,
        ts: pick(m)
      });
    });
    (Array.isArray(filteredProps) ? filteredProps : []).slice(0, 20).forEach((p: any) => {
      items.push({
        id: `prop-${String(p?._id || p?.id)}`,
        title: t('Property updated', 'சொத்து புதுப்பிக்கப்பட்டது'),
        subtitle: String(p?.title || ''),
        icon: Building,
        ts: pick(p)
      });
    });
    return [...manualActivities, ...items].sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [filteredMaintenance, filteredPayments, filteredProps, manualActivities, t]);

  const statusBadge = (active: boolean) =>
    active ? (
      <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">Active</Badge>
    ) : (
      <Badge variant="secondary" className="rounded-full">
        Inactive
      </Badge>
    );

  const paymentBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    return s === 'paid' ? (
      <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
    ) : (
      <Badge variant="secondary" className="rounded-full">
        Pending
      </Badge>
    );
  };

  const maintenanceBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">Completed</Badge>;
    if (s === 'in-progress') return <Badge className="rounded-full bg-blue-600 hover:bg-blue-600">In Progress</Badge>;
    return (
      <Badge variant="secondary" className="rounded-full">
        Pending
      </Badge>
    );
  };

  const downloadCsv = useCallback((fileName: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const onCreateUser = async () => {
    const name = userDraft.name.trim();
    const email = userDraft.email.trim().toLowerCase();
    const phone = userDraft.phone.trim();
    const tamilRole = userDraft.tamilRole;

    if (!name || !email) {
      toast.error(t('Please fill in name and email', 'பெயரும் மின்னஞ்சலும் நிரப்பவும்'));
      return;
    }

    try {
      const res = await createUser.mutateAsync({ name, email, phone: phone || undefined, tamilRole });
      setCreateUserOpen(false);
      setCreatedCredentials({ email: res.tempPassword ? email : email, password: res.tempPassword, name, tamilRole });
      setUserDraft({ name: '', email: '', phone: '', tamilRole: 'customers' });
      setManualActivities((prev) => [
        {
          id: `user-${Date.now()}`,
          title: t('User created', 'பயனர் உருவாக்கப்பட்டது'),
          subtitle: `${name} • ${email}`,
          icon: Users,
          ts: Date.now()
        },
        ...prev
      ]);
      toast.success(t('User created', 'பயனர் உருவாக்கப்பட்டது'));
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || e?.message || t('Failed to create user', 'பயனரை உருவாக்க முடியவில்லை'));
    }
  };

  const onSendAnnouncement = async () => {
    const title = announcementDraft.title.trim();
    const message = announcementDraft.message.trim();
    if (!title || !message) {
      toast.error(t('Please fill title and message', 'தலைப்பும் செய்தியும் நிரப்பவும்'));
      return;
    }
    try {
      await sendAnnouncement.mutateAsync({ title, message });
      setAnnouncementOpen(false);
      setAnnouncementDraft({ title: '', message: '' });
      setManualActivities((prev) => [
        { id: `ann-${Date.now()}`, title: t('Announcement sent', 'அறிவிப்பு அனுப்பப்பட்டது'), subtitle: title, icon: Bell, ts: Date.now() },
        ...prev
      ]);
      toast.success(t('Announcement sent', 'அறிவிப்பு அனுப்பப்பட்டது'));
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || e?.message || t('Failed to send announcement', 'அறிவிப்பை அனுப்ப முடியவில்லை'));
    }
  };

  const onCreateProperty = async () => {
    const ownerId = propertyDraft.ownerId.trim();
    const title = propertyDraft.title.trim();
    const location = propertyDraft.location.trim();
    const price = Number(propertyDraft.price);
    if (!ownerId || !title || !location || !Number.isFinite(price) || price <= 0) {
      toast.error(t('Please fill in all required fields', 'அனைத்து கட்டாய புலங்களையும் நிரப்பவும்'));
      return;
    }
    try {
      await createProperty.mutateAsync({
        ownerId,
        title,
        propertyType: propertyDraft.propertyType,
        location,
        price,
        transactionType: 'Rent',
        status: 'approved',
        occupancyStatus: 'vacant'
      });
      setCreatePropertyOpen(false);
      setPropertyDraft({ ownerId: '', title: '', propertyType: 'Apartment', location: '', price: '' });
      toast.success(t('Property created', 'சொத்து உருவாக்கப்பட்டது'));
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || e?.message || t('Failed to create property', 'சொத்தை உருவாக்க முடியவில்லை'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_380px] sm:px-6">
        <main className="space-y-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search properties, tenants, requests...', 'சொத்துகள், வாடகையாளர்கள், கோரிக்கைகள்...')}
              className="h-10 rounded-2xl border-slate-200 bg-white pl-10 shadow-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              className="cursor-pointer rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              onClick={() => setSummaryModal('properties')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-slate-500">{t('Total Properties', 'மொத்த சொத்துகள்')}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{Number(totals.totalProperties).toLocaleString()}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Building className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              onClick={() => setSummaryModal('tenants')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-slate-500">{t('Total Tenants', 'மொத்த வாடகையாளர்கள்')}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{Number(totals.totalTenants).toLocaleString()}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              onClick={() => setSummaryModal('revenue')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-slate-500">{t('Monthly Rent Collection', 'மாதாந்திர வாடகை வசூல்')}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">₹{Number(totals.monthlyRevenue).toLocaleString()}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <CreditCard className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              onClick={() => setSummaryModal('maintenance')}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm text-slate-500">{t('Open Maintenance Requests', 'திறந்த பராமரிப்பு கோரிக்கைகள்')}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{Number(totals.openMaintenance).toLocaleString()}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Wrench className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div id="admin-charts-section" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">{t('Rent Collection Trend', 'வாடகை வசூல் போக்கு')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`₹${Number(value || 0).toLocaleString()}`, t('Revenue', 'வருமானம்')]} />
                    <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">{t('Property Occupancy Rate', 'சொத்து குடியேற்ற விகிதம்')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={occupancyRows} dataKey="value" nameKey="name" outerRadius={110} label>
                      {occupancyRows.map((_: any, index: number) => (
                        <Cell key={index} fill={occupancyColors[index % occupancyColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card id="admin-properties-section" className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">{t('Property Management', 'சொத்து நிர்வாகம்')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Property Name', 'சொத்து பெயர்')}</TableHead>
                    <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                    <TableHead>{t('Units', 'அலகுகள்')}</TableHead>
                    <TableHead>{t('Occupied', 'குடியிருப்பு')}</TableHead>
                    <TableHead>{t('Vacant', 'காலி')}</TableHead>
                    <TableHead>{t('Status', 'நிலை')}</TableHead>
                    <TableHead className="text-right">{t('Action', 'செயல்')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-sm text-slate-500">
                        {t('No properties found', 'சொத்துகள் இல்லை')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProps.slice(0, 10).map((p: any) => {
                      const occupancy = String(p?.occupancyStatus || (p?.tenant ? 'occupied' : 'vacant')).toLowerCase();
                      const occupied = occupancy === 'occupied' ? 1 : 0;
                      const units = 1;
                      const vacant = Math.max(0, units - occupied);
                      const active = String(p?.status || '').toLowerCase() === 'approved';
                      return (
                        <TableRow key={String(p?._id || p?.id)} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{String(p?.title || '-')}</TableCell>
                          <TableCell>{String(p?.owner?.name || '-')}</TableCell>
                          <TableCell>{units}</TableCell>
                          <TableCell>{occupied}</TableCell>
                          <TableCell>{vacant}</TableCell>
                          <TableCell>{statusBadge(active)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" className="h-9 rounded-2xl border-slate-200 bg-white px-3" onClick={() => setSelectedProperty(p)}>
                              {t('View', 'பார்')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card id="admin-tenants-section" className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">{t('Recent Tenants', 'சமீபத்திய வாடகையாளர்கள்')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Tenant Name', 'வாடகையாளர் பெயர்')}</TableHead>
                    <TableHead>{t('Property', 'சொத்து')}</TableHead>
                    <TableHead>{t('Unit', 'அலகு')}</TableHead>
                    <TableHead>{t('Rent Amount', 'வாடகை தொகை')}</TableHead>
                    <TableHead>{t('Payment Status', 'கட்டண நிலை')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-slate-500">
                        {t('No tenant activity found', 'வாடகையாளர் செயல்பாடு இல்லை')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTenants.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedTenantRow(r)}
                      >
                        <TableCell className="font-medium">{r.tenantName}</TableCell>
                        <TableCell>{r.propertyTitle}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell>₹{Number(r.rentAmount).toLocaleString()}</TableCell>
                        <TableCell>{paymentBadge(r.paymentStatus)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card id="admin-maintenance-section" className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">{t('Maintenance Overview', 'பராமரிப்பு மேலோட்டம்')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Issue Title', 'பிரச்சனை தலைப்பு')}</TableHead>
                    <TableHead>{t('Property', 'சொத்து')}</TableHead>
                    <TableHead>{t('Raised By', 'யார்')}</TableHead>
                    <TableHead>{t('Priority', 'முன்னுரிமை')}</TableHead>
                    <TableHead>{t('Status', 'நிலை')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaintenance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-slate-500">
                        {t('No maintenance requests', 'பராமரிப்பு கோரிக்கைகள் இல்லை')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMaintenance.slice(0, 10).map((m: any) => (
                      <TableRow
                        key={String(m?._id || m?.id)}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedMaintenanceRow(m)}
                      >
                        <TableCell className="font-medium">{String(m?.issue || '-')}</TableCell>
                        <TableCell>{String(m?.property?.title || '-')}</TableCell>
                        <TableCell>{String(m?.tenant?.name || m?.tenant?.email || '-')}</TableCell>
                        <TableCell>{String(m?.priority || '-')}</TableCell>
                        <TableCell>{maintenanceBadge(String(m?.status || 'pending'))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        <aside className="h-fit space-y-5 xl:sticky xl:top-4">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">{t('Quick Actions', 'விரைவு செயல்கள்')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {/* Removed Add Property button because of failed logical implementation */}
              {/* <Button className="h-10 justify-start rounded-2xl bg-blue-600 px-4 hover:bg-blue-700" onClick={() => setCreatePropertyOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('Add Property', 'சொத்து சேர்க்க')}
              </Button> */}
              <Button
                variant="outline"
                className="h-10 justify-start rounded-2xl border-slate-200 bg-white px-4"
                onClick={() => {
                  setUserDraft({ name: '', email: '', phone: '', tamilRole: 'customers' });
                  setCreateUserOpen(true);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                {t('Add Tenant', 'வாடகையாளர் சேர்க்க')}
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start rounded-2xl border-slate-200 bg-white px-4"
                onClick={() => {
                  setUserDraft({ name: '', email: '', phone: '', tamilRole: 'owners' });
                  setCreateUserOpen(true);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                {t('Add Owner', 'உரிமையாளர் சேர்க்க')}
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start rounded-2xl border-slate-200 bg-white px-4"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Bell className="mr-2 h-4 w-4" />
                {t('Send Announcement', 'அறிவிப்பு அனுப்பு')}
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start rounded-2xl border-slate-200 bg-white px-4"
                onClick={() => {
                  downloadCsv(
                    'properties-report.csv',
                    ['Property Name', 'Owner', 'Location', 'Status', 'Occupancy'],
                    filteredProps.map((p: any) => [
                      p.title || '',
                      p.owner?.name || '',
                      p.location || '',
                      p.status || '',
                      p.occupancyStatus || ''
                    ])
                  );
                  toast.success(t('Report generated', 'அறிக்கை உருவாக்கப்பட்டது'));
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('Generate Report', 'அறிக்கை உருவாக்கு')}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">{t('Recent Activity', 'சமீப செயல்பாடு')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-slate-500">{t('No recent activity', 'சமீப செயல்பாடு இல்லை')}</div>
              ) : (
                recentActivity.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm transition hover:border-slate-200"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{a.title}</div>
                        <div className="truncate text-xs text-slate-500">{a.subtitle}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!summaryModal} onOpenChange={(open) => (!open ? setSummaryModal(null) : null)}>
        <DialogContent className="max-h-[85vh] overflow-auto rounded-3xl sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>
              {summaryModal === 'properties'
                ? t('Properties', 'சொத்துகள்')
                : summaryModal === 'tenants'
                  ? t('Tenants', 'வாடகையாளர்கள்')
                  : summaryModal === 'revenue'
                    ? t('Monthly Rent Collection', 'மாதாந்திர வாடகை வசூல்')
                    : t('Maintenance', 'பராமரிப்பு')}
            </DialogTitle>
            <DialogDescription>
              {summaryModal === 'properties'
                ? t('Quick snapshot of properties.', 'சொத்துகளின் விரைவு விவரம்.')
                : summaryModal === 'tenants'
                  ? t('Quick snapshot of tenants.', 'வாடகையாளர்களின் விரைவு விவரம்.')
                  : summaryModal === 'revenue'
                    ? t('Recent months revenue summary.', 'சமீப மாத வருமான சுருக்கம்.')
                    : t('Open maintenance requests.', 'திறந்த பராமரிப்பு கோரிக்கைகள்.')}
            </DialogDescription>
          </DialogHeader>

          {summaryModal === 'properties' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">{t('Showing', 'காட்டப்படுகிறது')} {Math.min(filteredProps.length, 12)} / {filteredProps.length}</div>
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={() => {
                    setSummaryModal(null);
                    scrollTo('admin-properties-section');
                  }}
                >
                  {t('Open section', 'பகுதி திற')}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <Table className="min-w-[780px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Property', 'சொத்து')}</TableHead>
                      <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                      <TableHead>{t('Location', 'இடம்')}</TableHead>
                      <TableHead>{t('Status', 'நிலை')}</TableHead>
                      <TableHead>{t('Occupancy', 'குடியேற்றம்')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProps.slice(0, 12).map((p: any) => {
                      const occupancy = String(p?.occupancyStatus || (p?.tenant ? 'occupied' : 'vacant'));
                      const active = String(p?.status || '').toLowerCase() === 'approved';
                      return (
                        <TableRow key={String(p?._id || p?.id)} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{String(p?.title || '-')}</TableCell>
                          <TableCell>{String(p?.owner?.name || p?.owner?.email || '-')}</TableCell>
                          <TableCell>{String(p?.location || '-')}</TableCell>
                          <TableCell>{statusBadge(active)}</TableCell>
                          <TableCell className="whitespace-nowrap">{occupancy}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {summaryModal === 'tenants' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">{t('Showing', 'காட்டப்படுகிறது')} {Math.min(filteredTenantUsers.length, 12)} / {filteredTenantUsers.length}</div>
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={() => {
                    setSummaryModal(null);
                    scrollTo('admin-tenants-section');
                  }}
                >
                  {t('Open section', 'பகுதி திற')}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Name', 'பெயர்')}</TableHead>
                      <TableHead>{t('Email', 'மின்னஞ்சல்')}</TableHead>
                      <TableHead>{t('Phone', 'தொலைபேசி')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenantUsers.slice(0, 12).map((u: any) => (
                      <TableRow key={String(u?._id || u?.id || u?.email)} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{String(u?.name || '-')}</TableCell>
                        <TableCell>{String(u?.email || '-')}</TableCell>
                        <TableCell>{String(u?.phone || '-')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {summaryModal === 'revenue' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{t('This month', 'இந்த மாதம்')}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">₹{Number(totals.monthlyRevenue).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{t('Months shown', 'காட்டப்படும் மாதங்கள்')}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{Number(revenueSummaryRows.length).toLocaleString()}</div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Month', 'மாதம்')}</TableHead>
                      <TableHead className="text-right">{t('Revenue', 'வருமானம்')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueSummaryRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-sm text-slate-500">
                          {t('No revenue data', 'வருமான தரவு இல்லை')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenueSummaryRows.map((r: any, idx: number) => (
                        <TableRow key={String(r?.month || idx)} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{String(r?.month || '')}</TableCell>
                          <TableCell className="text-right">₹{Number(r?.revenue || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={() => {
                    setSummaryModal(null);
                    scrollTo('admin-charts-section');
                  }}
                >
                  {t('Open charts', 'வரைபடம் திற')}
                </Button>
              </div>
            </div>
          ) : null}

          {summaryModal === 'maintenance' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">{t('Open', 'திறந்தது')} {openMaintenanceRows.length}</div>
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={() => {
                    setSummaryModal(null);
                    scrollTo('admin-maintenance-section');
                  }}
                >
                  {t('Open section', 'பகுதி திற')}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Issue', 'பிரச்சனை')}</TableHead>
                      <TableHead>{t('Property', 'சொத்து')}</TableHead>
                      <TableHead>{t('Raised By', 'யார்')}</TableHead>
                      <TableHead>{t('Priority', 'முன்னுரிமை')}</TableHead>
                      <TableHead>{t('Status', 'நிலை')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openMaintenanceRows.slice(0, 12).map((m: any) => (
                      <TableRow
                        key={String(m?._id || m?.id)}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => {
                          setSummaryModal(null);
                          setSelectedMaintenanceRow(m);
                        }}
                      >
                        <TableCell className="font-medium">{String(m?.issue || '-')}</TableCell>
                        <TableCell>{String(m?.property?.title || '-')}</TableCell>
                        <TableCell>{String(m?.tenant?.name || m?.tenant?.email || '-')}</TableCell>
                        <TableCell>{String(m?.priority || '-')}</TableCell>
                        <TableCell>{maintenanceBadge(String(m?.status || 'pending'))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-xs text-slate-500">
                {t('Tip: Click a row to open the request details.', 'குறிப்பு: விவரம் காண ஒரு வரியை கிளிக் செய்யவும்.')}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Add User', 'பயனர் சேர்க்க')}</DialogTitle>
            <DialogDescription>{t('Create a tenant/owner account instantly.', 'வாடகையாளர்/உரிமையாளர் கணக்கை உடனடியாக உருவாக்கவும்.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t('Name', 'பெயர்')}</Label>
              <Input value={userDraft.name} onChange={(e) => setUserDraft((s) => ({ ...s, name: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label>{t('Email', 'மின்னஞ்சல்')}</Label>
              <Input
                value={userDraft.email}
                onChange={(e) => setUserDraft((s) => ({ ...s, email: e.target.value }))}
                className="rounded-2xl"
                placeholder="name@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('Phone (optional)', 'தொலைபேசி (விருப்பம்)')}</Label>
              <Input
                value={userDraft.phone}
                onChange={(e) => setUserDraft((s) => ({ ...s, phone: e.target.value }))}
                className="rounded-2xl"
                placeholder="9876543210"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('Role', 'பங்கு')}</Label>
              <Select value={userDraft.tamilRole} onValueChange={(v) => setUserDraft((s) => ({ ...s, tamilRole: v }))}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t('Select role', 'பங்கை தேர்ந்தெடு')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customers">{t('Tenant', 'வாடகையாளர்')}</SelectItem>
                  <SelectItem value="owners">{t('Owner', 'உரிமையாளர்')}</SelectItem>
                  <SelectItem value="brokersBuilders">{t('Broker/Builder', 'தரகர்/கட்டுபவர்')}</SelectItem>
                  <SelectItem value="admin">{t('Admin', 'நிர்வாகம்')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setCreateUserOpen(false)}>
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700" onClick={onCreateUser} disabled={createUser.isPending}>
              {t('Create', 'உருவாக்கு')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdCredentials} onOpenChange={(open) => (!open ? setCreatedCredentials(null) : null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Login Details', 'உள்நுழைவு விவரங்கள்')}</DialogTitle>
            <DialogDescription>{t('Share these credentials securely with the user.', 'இந்த விவரங்களை பாதுகாப்பாக பகிரவும்.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs text-slate-500">{t('Email', 'மின்னஞ்சல்')}</div>
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0 truncate text-sm font-medium text-slate-900">{createdCredentials?.email || ''}</div>
                <Button
                  variant="outline"
                  className="h-8 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(createdCredentials?.email || ''));
                      toast.success(t('Copied', 'நகலெடுக்கப்பட்டது'));
                    } catch {
                      toast.error(t('Copy failed', 'நகலெடுக்க முடியவில்லை'));
                    }
                  }}
                >
                  {t('Copy', 'நகலெடு')}
                </Button>
              </div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-slate-500">{t('Temporary Password', 'தற்காலிக கடவுச்சொல்')}</div>
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0 truncate text-sm font-medium text-slate-900">{createdCredentials?.password || ''}</div>
                <Button
                  variant="outline"
                  className="h-8 rounded-2xl border-slate-200 bg-white px-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(createdCredentials?.password || ''));
                      toast.success(t('Copied', 'நகலெடுக்கப்பட்டது'));
                    } catch {
                      toast.error(t('Copy failed', 'நகலெடுக்க முடியவில்லை'));
                    }
                  }}
                >
                  {t('Copy', 'நகலெடு')}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700" onClick={() => setCreatedCredentials(null)}>
              {t('Done', 'முடிந்தது')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Send Announcement', 'அறிவிப்பு அனுப்பு')}</DialogTitle>
            <DialogDescription>{t('Send a message to the system feed.', 'சிஸ்டம் ஃபீடுக்கு செய்தியை அனுப்பவும்.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t('Title', 'தலைப்பு')}</Label>
              <Input
                value={announcementDraft.title}
                onChange={(e) => setAnnouncementDraft((s) => ({ ...s, title: e.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('Message', 'செய்தி')}</Label>
              <Textarea
                value={announcementDraft.message}
                onChange={(e) => setAnnouncementDraft((s) => ({ ...s, message: e.target.value }))}
                className="min-h-28 rounded-2xl"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setAnnouncementOpen(false)}>
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700" onClick={onSendAnnouncement} disabled={sendAnnouncement.isPending}>
              {t('Send', 'அனுப்பு')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTenantRow} onOpenChange={(open) => (!open ? setSelectedTenantRow(null) : null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Tenant Details', 'வாடகையாளர் விவரம்')}</DialogTitle>
            <DialogDescription>{selectedTenantRow?.tenantName || ''}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">{t('Property', 'சொத்து')}</div>
              <div className="text-sm font-medium text-slate-900">{selectedTenantRow?.propertyTitle || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Unit', 'அலகு')}</div>
              <div className="text-sm font-medium text-slate-900">{selectedTenantRow?.unit || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Rent Amount', 'வாடகை தொகை')}</div>
              <div className="text-sm font-medium text-slate-900">₹{Number(selectedTenantRow?.rentAmount || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Payment Status', 'கட்டண நிலை')}</div>
              <div className="pt-1">{paymentBadge(String(selectedTenantRow?.paymentStatus || 'Pending'))}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMaintenanceRow} onOpenChange={(open) => (!open ? setSelectedMaintenanceRow(null) : null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Maintenance Request', 'பராமரிப்பு கோரிக்கை')}</DialogTitle>
            <DialogDescription>{String(selectedMaintenanceRow?.issue || '')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">{t('Property', 'சொத்து')}</div>
                <div className="text-sm font-medium text-slate-900">{String(selectedMaintenanceRow?.property?.title || '-')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t('Raised By', 'யார்')}</div>
                <div className="text-sm font-medium text-slate-900">
                  {String(selectedMaintenanceRow?.tenant?.name || selectedMaintenanceRow?.tenant?.email || '-')}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t('Priority', 'முன்னுரிமை')}</div>
                <div className="text-sm font-medium text-slate-900">{String(selectedMaintenanceRow?.priority || '-')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t('Status', 'நிலை')}</div>
                <div className="pt-1">{maintenanceBadge(String(selectedMaintenanceRow?.status || 'pending'))}</div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('Update Status', 'நிலையை மாற்று')}</Label>
              <Select value={maintenanceStatusDraft} onValueChange={setMaintenanceStatusDraft}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setSelectedMaintenanceRow(null)}>
              {t('Close', 'மூடு')}
            </Button>
            <Button
              className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700"
              disabled={updateMaintenance.isPending}
              onClick={async () => {
                const id = String(selectedMaintenanceRow?._id || selectedMaintenanceRow?.id || '');
                if (!id) return;
                try {
                  await updateMaintenance.mutateAsync({ id, status: maintenanceStatusDraft });
                  setManualActivities((prev) => [
                    {
                      id: `mnt-upd-${Date.now()}`,
                      title: t('Maintenance updated', 'பராமரிப்பு புதுப்பிக்கப்பட்டது'),
                      subtitle: `${String(selectedMaintenanceRow?.property?.title || '')} • ${String(selectedMaintenanceRow?.issue || '')}`,
                      icon: Wrench,
                      ts: Date.now()
                    },
                    ...prev
                  ]);
                  toast.success(t('Updated', 'புதுப்பிக்கப்பட்டது'));
                  setSelectedMaintenanceRow(null);
                } catch (e: any) {
                  toast.error(e?.response?.data?.msg || e?.message || t('Failed to update', 'புதுப்பிக்க முடியவில்லை'));
                }
              }}
            >
              {t('Save', 'சேமி')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createPropertyOpen} onOpenChange={setCreatePropertyOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Add Property', 'சொத்து சேர்க்க')}</DialogTitle>
            <DialogDescription>{t('Create a new property with minimal details.', 'குறைந்த விவரங்களுடன் புதிய சொத்தை உருவாக்கவும்.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t('Owner', 'உரிமையாளர்')}</Label>
              <Select value={propertyDraft.ownerId} onValueChange={(v) => setPropertyDraft((s) => ({ ...s, ownerId: v }))}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t('Select owner', 'உரிமையாளரை தேர்ந்தெடு')} />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o: any) => (
                    <SelectItem key={String(o._id || o.id)} value={String(o._id || o.id)}>
                      {String(o.name || o.email || '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('Property Name', 'சொத்து பெயர்')}</Label>
              <Input
                value={propertyDraft.title}
                onChange={(e) => setPropertyDraft((s) => ({ ...s, title: e.target.value }))}
                className="rounded-2xl"
                placeholder={t('e.g. Skyline Apartments', 'உதா. Skyline Apartments')}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('Property Type', 'சொத்து வகை')}</Label>
              <Select value={propertyDraft.propertyType} onValueChange={(v) => setPropertyDraft((s) => ({ ...s, propertyType: v }))}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Apartment">Apartment</SelectItem>
                  <SelectItem value="House">House</SelectItem>
                  <SelectItem value="Villa">Villa</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('Location', 'இடம்')}</Label>
              <Input
                value={propertyDraft.location}
                onChange={(e) => setPropertyDraft((s) => ({ ...s, location: e.target.value }))}
                className="rounded-2xl"
                placeholder={t('City / Area', 'நகரம் / பகுதி')}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('Monthly Rent', 'மாத வாடகை')}</Label>
              <Input
                value={propertyDraft.price}
                onChange={(e) => setPropertyDraft((s) => ({ ...s, price: e.target.value }))}
                className="rounded-2xl"
                placeholder="10000"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setCreatePropertyOpen(false)}>
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700" onClick={onCreateProperty} disabled={createProperty.isPending}>
              {t('Create', 'உருவாக்கு')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProperty} onOpenChange={(open) => (!open ? setSelectedProperty(null) : null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('Property Details', 'சொத்து விவரம்')}</DialogTitle>
            <DialogDescription>{selectedProperty?.title || ''}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">{t('Owner', 'உரிமையாளர்')}</div>
              <div className="text-sm font-medium text-slate-900">{selectedProperty?.owner?.name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Location', 'இடம்')}</div>
              <div className="text-sm font-medium text-slate-900">{selectedProperty?.location || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Monthly Rent', 'மாத வாடகை')}</div>
              <div className="text-sm font-medium text-slate-900">₹{Number(selectedProperty?.price || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Occupancy', 'குடியேற்றம்')}</div>
              <div className="text-sm font-medium text-slate-900">
                {String(selectedProperty?.occupancyStatus || (selectedProperty?.tenant ? 'occupied' : 'vacant'))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  return <AdminDashboardModern />;
  const { t } = useLanguage();
  const { data: me } = useGetCallerUserProfile();
  const { data: properties = [] } = useAdminProperties();
  const { data: users = [] } = useAdminUsers();
  const queryClient = useQueryClient();
  const totals = {
    properties: properties.length,
    owners:
      users.filter((u: any) => {
        const r = String(u?.tamilRole || u?.role || '').toLowerCase();
        return r.includes('owner');
      }).length,
    tenants:
      users.filter((u: any) => {
        const r = String(u?.tamilRole || u?.role || '').toLowerCase();
        return r.includes('tenant') || r.includes('customer');
      }).length,
    occupied:
      properties.filter((p: any) => {
        const s = String(p?.occupancyStatus || (p?.tenant ? 'occupied' : 'vacant')).toLowerCase();
        return s === 'occupied';
      }).length
  };
  const [activeNav, setActiveNav] = useState<'dashboard' | 'users' | 'properties' | 'reports' | 'settings'>('dashboard');
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const filteredUsers = (users || []).filter((u: any) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u?.name || '').toLowerCase().includes(q) ||
      String(u?.email || '').toLowerCase().includes(q) ||
      String(u?.tamilRole || u?.role || '').toLowerCase().includes(q)
    );
  });
  const filteredProps = (properties || []).filter((p: any) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p?.title || '').toLowerCase().includes(q) ||
      String(p?.location || '').toLowerCase().includes(q) ||
      String(p?.owner?.name || '').toLowerCase().includes(q)
    );
  });
  const blockUser = useAdminBlockUser();

  const sectionTitle = useMemo(() => {
    if (activeNav === 'users') return t('Users', 'பயனர்கள்');
    if (activeNav === 'properties') return t('Properties', 'சொத்துகள்');
    if (activeNav === 'reports') return t('Reports', 'அறிக்கைகள்');
    if (activeNav === 'settings') return t('Settings', 'அமைப்புகள்');
    return t('Admin Dashboard', 'நிர்வாக கட்டுப்பாட்டு அறை');
  }, [activeNav, t]);

  const recentActivities = useMemo(() => {
    const pickDate = (x: any) => {
      const d = x?.updatedAt || x?.createdAt;
      const ms = d ? new Date(d).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };

    const isOwner = (u: any) => {
      const r = String(u?.tamilRole || u?.role || '').toLowerCase();
      return r.includes('owner');
    };
    const isTenant = (u: any) => {
      const r = String(u?.tamilRole || u?.role || '').toLowerCase();
      return r.includes('tenant') || r.includes('customer');
    };

    const lastOwner = [...(users || [])].filter(isOwner).sort((a: any, b: any) => pickDate(b) - pickDate(a))[0];
    const lastTenant = [...(users || [])].filter(isTenant).sort((a: any, b: any) => pickDate(b) - pickDate(a))[0];
    const lastCreatedProperty = [...(properties || [])].sort((a: any, b: any) => pickDate(b?.createdAt ? b : { createdAt: b?.createdAt }) - pickDate(a?.createdAt ? a : { createdAt: a?.createdAt }))[0];
    const lastUpdatedProperty = [...(properties || [])].sort((a: any, b: any) => pickDate(b) - pickDate(a))[0];

    const rows: Array<{ id: string; title: string; subtitle: string; icon: any }> = [];
    if (lastOwner) {
      rows.push({
        id: `owner-${String(lastOwner._id || lastOwner.id || lastOwner.email)}`,
        title: t('New owner registered', 'புதிய உரிமையாளர் பதிவு'),
        subtitle: String(lastOwner.email || lastOwner.name || ''),
        icon: Users
      });
    }
    if (lastTenant) {
      rows.push({
        id: `tenant-${String(lastTenant._id || lastTenant.id || lastTenant.email)}`,
        title: t('New tenant added', 'புதிய வாடகையாளர் சேர்க்கப்பட்டது'),
        subtitle: String(lastTenant.email || lastTenant.name || ''),
        icon: Users
      });
    }
    if (lastCreatedProperty) {
      rows.push({
        id: `prop-created-${String(lastCreatedProperty._id || lastCreatedProperty.id)}`,
        title: t('Property created', 'சொத்து உருவாக்கப்பட்டது'),
        subtitle: String(lastCreatedProperty.title || ''),
        icon: Building
      });
    }
    if (lastUpdatedProperty) {
      rows.push({
        id: `prop-updated-${String(lastUpdatedProperty._id || lastUpdatedProperty.id)}`,
        title: t('Property updated', 'சொத்து புதுப்பிக்கப்பட்டது'),
        subtitle: String(lastUpdatedProperty.title || ''),
        icon: Building
      });
    }
    return rows.slice(0, 6);
  }, [properties, t, users]);

  const downloadCsv = useCallback((fileName: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">{sectionTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-9 rounded-xl border-slate-200 bg-white"
              onClick={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
                  queryClient.invalidateQueries({ queryKey: ['adminProperties'] })
                ]);
                toast.success(t('Refreshed', 'புதுப்பிக்கப்பட்டது'));
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {t('Refresh', 'புதுப்பி')}
            </Button>
            <div className="hidden sm:block text-sm text-slate-500">{me?.email || ''}</div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              {(me?.name || me?.email || 'A').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-4 py-6 lg:grid-cols-[240px_1fr] sm:px-6">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-blue-50 ${activeNav === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Home className="h-4 w-4" />
              <span className="font-medium">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveNav('users')}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-blue-50 ${activeNav === 'users' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Users className="h-4 w-4" />
              <span className="font-medium">Users</span>
            </button>
            <button
              onClick={() => setActiveNav('properties')}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-blue-50 ${activeNav === 'properties' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Building className="h-4 w-4" />
              <span className="font-medium">Properties</span>
            </button>
            <button
              onClick={() => setActiveNav('reports')}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-blue-50 ${activeNav === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <LineChartIcon className="h-4 w-4" />
              <span className="font-medium">Reports</span>
            </button>
            <button
              onClick={() => setActiveNav('settings')}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-blue-50 ${activeNav === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Wrench className="h-4 w-4" />
              <span className="font-medium">Settings</span>
            </button>
          </nav>
        </aside>

        <main className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-[460px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search users, properties, locations', 'பயனர்கள், சொத்துகள், இடங்கள் தேட...')}
                className="h-10 rounded-xl border-slate-200 bg-white pl-10"
              />
            </div>
          </div>

          {activeNav === 'dashboard' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="h-full rounded-2xl border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <CardContent className="grid grid-cols-[40px_1fr] items-center gap-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold leading-none text-slate-900">{totals.properties}</div>
                      <div className="text-xs text-slate-500">Total Properties</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="h-full rounded-2xl border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <CardContent className="grid grid-cols-[40px_1fr] items-center gap-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold leading-none text-slate-900">{totals.owners}</div>
                      <div className="text-xs text-slate-500">Total Owners</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="h-full rounded-2xl border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <CardContent className="grid grid-cols-[40px_1fr] items-center gap-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold leading-none text-slate-900">{totals.tenants}</div>
                      <div className="text-xs text-slate-500">Total Tenants</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="h-full rounded-2xl border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <CardContent className="grid grid-cols-[40px_1fr] items-center gap-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Home className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold leading-none text-slate-900">{totals.occupied}</div>
                      <div className="text-xs text-slate-500">Occupied Properties</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-900">Recent Activities</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recentActivities.length ? (
                      recentActivities.map((a) => {
                        const Icon = a.icon;
                        return (
                          <div key={a.id} className="grid grid-cols-[32px_1fr] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">{a.title}</div>
                              <div className="truncate text-xs text-slate-500">{a.subtitle}</div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-slate-500">{t('No recent activity yet', 'சமீப செயல்பாடு இல்லை')}</div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-slate-900">User Management</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <Table className="min-w-[860px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">Name</TableHead>
                              <TableHead className="whitespace-nowrap">Role</TableHead>
                              <TableHead className="whitespace-nowrap">Email</TableHead>
                              <TableHead className="whitespace-nowrap">Status</TableHead>
                              <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredUsers.slice(0, 8).map((u: any) => (
                              <TableRow key={String(u._id || u.id || u.email)}>
                                <TableCell className="max-w-[240px] truncate font-medium">{u.name || 'User'}</TableCell>
                                <TableCell className="whitespace-nowrap">{u.tamilRole || u.role || ''}</TableCell>
                                <TableCell className="max-w-[320px] truncate">{u.email || ''}</TableCell>
                                <TableCell>
                                  <Badge variant={u.blocked ? 'destructive' : 'secondary'} className="whitespace-nowrap">
                                    {u.blocked ? 'Blocked' : 'Active'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right">
                                  <Button variant="outline" size="sm" className="mr-2 rounded-lg" onClick={() => setSelectedUser(u)}>
                                    View
                                  </Button>
                                  <Button
                                    variant={u.blocked ? 'outline' : 'destructive'}
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() =>
                                      blockUser.mutate(
                                        { id: String(u._id || u.id), blocked: !u.blocked },
                                        {
                                          onSuccess: () => toast.success(u.blocked ? 'User unblocked' : 'User blocked'),
                                          onError: () => toast.error('Action failed')
                                        }
                                      )
                                    }
                                  >
                                    {u.blocked ? 'Unblock' : 'Block'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-slate-900">Property Monitoring</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <Table className="min-w-[860px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">Property Name</TableHead>
                              <TableHead className="whitespace-nowrap">Owner</TableHead>
                              <TableHead className="whitespace-nowrap">Location</TableHead>
                              <TableHead className="whitespace-nowrap">Rent</TableHead>
                              <TableHead className="whitespace-nowrap">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProps.slice(0, 8).map((p: any) => {
                              const status = String(p.occupancyStatus || (p.tenant ? 'occupied' : 'vacant')).toLowerCase();
                              return (
                                <TableRow
                                  key={String(p._id || p.id)}
                                  className="cursor-pointer"
                                  onClick={() => setSelectedProperty(p)}
                                >
                                  <TableCell className="max-w-[260px] truncate font-medium">{p.title || 'Property'}</TableCell>
                                  <TableCell className="max-w-[180px] truncate">{p.owner?.name || ''}</TableCell>
                                  <TableCell className="max-w-[240px] truncate">{p.location || ''}</TableCell>
                                  <TableCell className="whitespace-nowrap">₹{Number(p.price || 0).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={status === 'occupied' ? 'default' : 'secondary'}
                                      className="whitespace-nowrap"
                                    >
                                      {status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-slate-900">Reports</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="h-10 rounded-xl bg-blue-600 px-4 hover:bg-blue-700"
                          onClick={() => {
                            downloadCsv(
                              'property-report.csv',
                              ['Property Name', 'Owner', 'Location', 'Rent', 'Status'],
                              filteredProps.map((p: any) => [
                                p.title || '',
                                p.owner?.name || '',
                                p.location || '',
                                Number(p.price || 0),
                                String(p.occupancyStatus || (p.tenant ? 'occupied' : 'vacant'))
                              ])
                            );
                            toast.success('Property report downloaded');
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Property Report
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl border-slate-200 bg-white px-4"
                          onClick={() => {
                            downloadCsv(
                              'user-report.csv',
                              ['Name', 'Role', 'Email', 'Status'],
                              filteredUsers.map((u: any) => [
                                u.name || '',
                                u.tamilRole || u.role || '',
                                u.email || '',
                                u.blocked ? 'Blocked' : 'Active'
                              ])
                            );
                            toast.success('User report downloaded');
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          User Report
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl border-slate-200 bg-white px-4"
                          onClick={() => {
                            downloadCsv(
                              'occupancy-report.csv',
                              ['Total Properties', 'Occupied Properties', 'Vacant Properties'],
                              [[totals.properties, totals.occupied, Math.max(0, totals.properties - totals.occupied)]]
                            );
                            toast.success('Occupancy report downloaded');
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Occupancy Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}

          {activeNav === 'users' ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Name</TableHead>
                        <TableHead className="whitespace-nowrap">Role</TableHead>
                        <TableHead className="whitespace-nowrap">Email</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u: any) => (
                        <TableRow key={String(u._id || u.id || u.email)}>
                          <TableCell className="max-w-[240px] truncate font-medium">{u.name || 'User'}</TableCell>
                          <TableCell className="whitespace-nowrap">{u.tamilRole || u.role || ''}</TableCell>
                          <TableCell className="max-w-[320px] truncate">{u.email || ''}</TableCell>
                          <TableCell>
                            <Badge variant={u.blocked ? 'destructive' : 'secondary'} className="whitespace-nowrap">
                              {u.blocked ? 'Blocked' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <Button variant="outline" size="sm" className="mr-2 rounded-lg" onClick={() => setSelectedUser(u)}>
                              View
                            </Button>
                            <Button
                              variant={u.blocked ? 'outline' : 'destructive'}
                              size="sm"
                              className="rounded-lg"
                              onClick={() =>
                                blockUser.mutate(
                                  { id: String(u._id || u.id), blocked: !u.blocked },
                                  {
                                    onSuccess: () => toast.success(u.blocked ? 'User unblocked' : 'User blocked'),
                                    onError: () => toast.error('Action failed')
                                  }
                                )
                              }
                            >
                              {u.blocked ? 'Unblock' : 'Block'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeNav === 'properties' ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Property Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Property Name</TableHead>
                        <TableHead className="whitespace-nowrap">Owner</TableHead>
                        <TableHead className="whitespace-nowrap">Location</TableHead>
                        <TableHead className="whitespace-nowrap">Rent</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProps.map((p: any) => {
                        const status = String(p.occupancyStatus || (p.tenant ? 'occupied' : 'vacant')).toLowerCase();
                        return (
                          <TableRow
                            key={String(p._id || p.id)}
                            className="cursor-pointer"
                            onClick={() => setSelectedProperty(p)}
                          >
                            <TableCell className="max-w-[260px] truncate font-medium">{p.title || 'Property'}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{p.owner?.name || ''}</TableCell>
                            <TableCell className="max-w-[240px] truncate">{p.location || ''}</TableCell>
                            <TableCell className="whitespace-nowrap">₹{Number(p.price || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={status === 'occupied' ? 'default' : 'secondary'} className="whitespace-nowrap">
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeNav === 'reports' ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="h-10 rounded-xl bg-blue-600 px-4 hover:bg-blue-700"
                    onClick={() => {
                      downloadCsv(
                        'property-report.csv',
                        ['Property Name', 'Owner', 'Location', 'Rent', 'Status'],
                        filteredProps.map((p: any) => [
                          p.title || '',
                          p.owner?.name || '',
                          p.location || '',
                          Number(p.price || 0),
                          String(p.occupancyStatus || (p.tenant ? 'occupied' : 'vacant'))
                        ])
                      );
                      toast.success('Property report downloaded');
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Property Report
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white px-4"
                    onClick={() => {
                      downloadCsv(
                        'user-report.csv',
                        ['Name', 'Role', 'Email', 'Status'],
                        filteredUsers.map((u: any) => [u.name || '', u.tamilRole || u.role || '', u.email || '', u.blocked ? 'Blocked' : 'Active'])
                      );
                      toast.success('User report downloaded');
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    User Report
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white px-4"
                    onClick={() => {
                      downloadCsv(
                        'occupancy-report.csv',
                        ['Total Properties', 'Occupied Properties', 'Vacant Properties'],
                        [[totals.properties, totals.occupied, Math.max(0, totals.properties - totals.occupied)]]
                      );
                      toast.success('Occupancy report downloaded');
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Occupancy Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeNav === 'settings' ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {t('No critical settings required for now.', 'தற்போது முக்கிய அமைப்புகள் தேவையில்லை.')}
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => (!open ? setSelectedUser(null) : null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>{selectedUser?.email || ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Name</div>
                <div className="text-sm font-medium text-slate-900">{selectedUser?.name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Role</div>
                <div className="text-sm font-medium text-slate-900">{selectedUser?.tamilRole || selectedUser?.role || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm font-medium text-slate-900">{selectedUser?.blocked ? 'Blocked' : 'Active'}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProperty} onOpenChange={(open) => (!open ? setSelectedProperty(null) : null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Property Details</DialogTitle>
            <DialogDescription>{selectedProperty?.title || ''}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">Owner</div>
              <div className="text-sm font-medium text-slate-900">{selectedProperty?.owner?.name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Location</div>
              <div className="text-sm font-medium text-slate-900">{selectedProperty?.location || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Rent</div>
              <div className="text-sm font-medium text-slate-900">₹{Number(selectedProperty?.price || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm font-medium text-slate-900">
                {String(selectedProperty?.occupancyStatus || (selectedProperty?.tenant ? 'occupied' : 'vacant'))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminOverview({
  overview,
  analytics,
  onNavigate
}: {
  overview: any;
  analytics: any;
  onNavigate: (s: Section) => void;
}) {
  const { t } = useLanguage();
  const totals = overview?.totals || {};
  const pending = overview?.pending || {};

  const alerts = Array.isArray(overview?.alerts) ? overview.alerts : [];
  const alertsTotal = alerts.reduce((sum: number, a: any) => sum + Number(a?.count || 0), 0);

  const revenueByMonth = Array.isArray(analytics?.revenueByMonth) ? analytics.revenueByMonth : [];
  const occupancyObj = analytics?.occupancy || {};
  const occupancyRows = Object.keys(occupancyObj).map((k) => ({ name: k, value: Number(occupancyObj[k] || 0) }));

  const { data: users = [] } = useAdminUsers();
  const { data: maintenance = [] } = useAdminMaintenance();
  const { data: payments = [] } = useAdminPayments();

  const activity = useMemo(() => {
    const pickDate = (x: any) => {
      const d = x?.updatedAt || x?.createdAt || x?.date || x?.timestamp;
      const ms = d ? new Date(d).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };

    const items: Array<{ id: string; ts: number; title: string; subtitle: string; icon: any; nav: Section }> = [];

    (Array.isArray(users) ? users : []).slice(0, 50).forEach((u: any) => {
      items.push({
        id: `user-${String(u._id || u.id || u.email || Math.random())}`,
        ts: pickDate(u),
        title: t('User updated', 'பயனர் புதுப்பிப்பு'),
        subtitle: String(u.email || u.name || ''),
        icon: Users,
        nav: 'users'
      });
    });

    (Array.isArray(maintenance) ? maintenance : []).slice(0, 50).forEach((r: any) => {
      items.push({
        id: `maint-${String(r._id || r.id || Math.random())}`,
        ts: pickDate(r),
        title: t('Maintenance request', 'பராமரிப்பு கோரிக்கை'),
        subtitle: String(r.property?.title || r.issue || ''),
        icon: Wrench,
        nav: 'maintenance'
      });
    });

    (Array.isArray(payments) ? payments : []).slice(0, 50).forEach((p: any) => {
      items.push({
        id: `pay-${String(p._id || p.id || Math.random())}`,
        ts: pickDate(p),
        title: t('Payment activity', 'கட்டண நடவடிக்கை'),
        subtitle: `${t('₹', '₹')}${Number(p.amount || 0).toLocaleString()} • ${String(p.status || '')}`,
        icon: CreditCard,
        nav: 'payments'
      });
    });

    return items
      .filter((i) => i.subtitle || i.title)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 8);
  }, [maintenance, payments, t, users]);

  const statCards = [
    {
      key: 'users',
      title: t('Users', 'பயனர்கள்'),
      value: Number(totals.users ?? 0).toLocaleString(),
      subtitle: t('Total accounts', 'மொத்த கணக்குகள்'),
      icon: Users,
      nav: 'users' as Section,
      gradient: 'from-violet-600 to-indigo-600'
    },
    {
      key: 'revenue',
      title: t('Revenue', 'வருமானம்'),
      value: `₹${Number(totals.revenueThisMonth ?? 0).toLocaleString()}`,
      subtitle: t('This month', 'இந்த மாதம்'),
      icon: LineChartIcon,
      nav: 'analytics' as Section,
      gradient: 'from-emerald-600 to-teal-600'
    },
    {
      key: 'properties',
      title: t('Properties', 'சொத்துகள்'),
      value: Number(totals.properties ?? 0).toLocaleString(),
      subtitle: t('Listed in system', 'முறைமையில் உள்ளவை'),
      icon: Building,
      nav: 'properties' as Section,
      gradient: 'from-sky-600 to-blue-600'
    },
    {
      key: 'alerts',
      title: t('Alerts', 'எச்சரிக்கைகள்'),
      value: Number(alertsTotal || pending.overduePayments || 0).toLocaleString(),
      subtitle: t('Requires attention', 'கவனம் தேவை'),
      icon: TriangleAlert,
      nav: 'notifications' as Section,
      gradient: 'from-rose-600 to-orange-600'
    }
  ];

  const toSectionForAlert = (key: any): Section => {
    const k = String(key || '');
    if (k === 'pendingUsers') return 'users';
    if (k === 'pendingMaintenance') return 'maintenance';
    if (k === 'overduePayments' || k === 'submittedPayments') return 'payments';
    if (k === 'pendingPropertyRequests') return 'properties';
    return 'overview';
  };

  const alertIcon = (severity: any) => {
    if (severity === 'high') return TriangleAlert;
    return CheckCircle2;
  };

  const money = (value: any) => `₹${Number(value || 0).toLocaleString()}`;
  type ReportKey = 'revenue' | 'payment' | 'property' | 'occupancy' | 'maintenance';
  const [openReport, setOpenReport] = useState<ReportKey | null>(null);

  const reportCards = useMemo(
    () => [
      {
        key: 'revenue' as ReportKey,
        title: t('Revenue Report', 'வருமான அறிக்கை'),
        subtitle: t('Total rent collected, pending, monthly/yearly revenue.', 'மொத்த வசூல், நிலுவை, மாத/வருட வருமானம்.'),
        gradient: 'from-indigo-600 to-violet-700'
      },
      {
        key: 'payment' as ReportKey,
        title: t('Payment Status Report', 'கட்டண நிலை அறிக்கை'),
        subtitle: t('Paid / unpaid / overdue tenants with due date and amount.', 'செலுத்திய/செலுத்தாத/காலாவதி – தேதி/தொகையுடன்.'),
        gradient: 'from-rose-600 to-orange-600'
      },
      {
        key: 'property' as ReportKey,
        title: t('Property Performance Report', 'சொத்து செயல்திறன் அறிக்கை'),
        subtitle: t('Income, occupancy status, maintenance count per property.', 'வருமானம், குடியேற்றம், பராமரிப்பு எண்ணிக்கை.'),
        gradient: 'from-emerald-600 to-teal-600'
      },
      {
        key: 'occupancy' as ReportKey,
        title: t('Occupancy Report', 'குடியேற்ற அறிக்கை'),
        subtitle: t('Total, occupied, vacant, occupancy %.', 'மொத்தம், குடியிருப்பு, காலி, சதவீதம்.'),
        gradient: 'from-sky-600 to-blue-600'
      },
      {
        key: 'maintenance' as ReportKey,
        title: t('Maintenance Report', 'பராமரிப்பு அறிக்கை'),
        subtitle: t('Complaints, pending/completed, issue types.', 'புகார்கள், நிலுவை/முடிந்தவை, வகைகள்.'),
        gradient: 'from-amber-600 to-yellow-500'
      }
    ],
    [t]
  );

  const esc = (v: any) => {
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const downloadCsv = (fileName: string, lines: string[]) => {
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const [reportMonths, setReportMonths] = useState<number>(12);
  const { data: revenueReportData } = useAdminRevenueReport(reportMonths, openReport === 'revenue');
  const reportSummary = revenueReportData?.summary || {};
  const reportByMonth = Array.isArray(revenueReportData?.byMonth) ? revenueReportData.byMonth : [];
  const reportByYear = Array.isArray(revenueReportData?.byYear) ? revenueReportData.byYear : [];

  const downloadRevenueReportCsv = () => {
    const now = new Date();
    const fileName = `revenue-report-${now.toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [];

    lines.push('Revenue Report');
    lines.push(`Generated At,${esc(now.toISOString())}`);
    lines.push(`Range (Months),${esc(reportMonths)}`);
    lines.push('');
    lines.push(`Total Rent Collected,${esc(reportSummary.totalRentCollected ?? 0)}`);
    lines.push(`Pending Payments Amount,${esc(reportSummary.pendingPaymentsAmount ?? 0)}`);
    lines.push(`Pending Payments Count,${esc(reportSummary.pendingPaymentsCount ?? 0)}`);
    lines.push(`Monthly Revenue (This Month),${esc(reportSummary.monthlyRevenue ?? 0)}`);
    lines.push(`Yearly Revenue (This Year),${esc(reportSummary.yearlyRevenue ?? 0)}`);
    lines.push('');
    lines.push('Monthly Revenue');
    lines.push('Month,Revenue,Transactions');
    reportByMonth.forEach((r: any) => lines.push(`${esc(r.month)},${esc(r.revenue ?? 0)},${esc(r.transactions ?? 0)}`));
    lines.push('');
    lines.push('Yearly Revenue');
    lines.push('Year,Revenue,Transactions');
    reportByYear.forEach((r: any) => lines.push(`${esc(r.year)},${esc(r.revenue ?? 0)},${esc(r.transactions ?? 0)}`));
    downloadCsv(fileName, lines);
  };

  const [paymentMonths, setPaymentMonths] = useState<number>(1);
  const { data: paymentStatusData } = useAdminPaymentStatusReport(paymentMonths, openReport === 'payment');
  const paymentSummary = paymentStatusData?.summary || {};
  const paymentRows = Array.isArray(paymentStatusData?.rows) ? paymentStatusData.rows : [];

  const downloadPaymentStatusCsv = () => {
    const now = new Date();
    const fileName = `payment-status-report-${now.toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [];
    lines.push('Payment Status Report');
    lines.push(`Generated At,${esc(now.toISOString())}`);
    lines.push(`Range (Months),${esc(paymentMonths)}`);
    lines.push('');
    lines.push(`Paid tenants,${esc(paymentSummary.paidTenants ?? 0)}`);
    lines.push(`Unpaid tenants,${esc(paymentSummary.unpaidTenants ?? 0)}`);
    lines.push(`Overdue payments,${esc(paymentSummary.overduePayments ?? 0)}`);
    lines.push(`Expected rent,${esc(paymentSummary.expectedRent ?? 0)}`);
    lines.push(`Collected,${esc(paymentSummary.collected ?? 0)}`);
    lines.push(`Outstanding,${esc(paymentSummary.outstanding ?? 0)}`);
    lines.push(`Overdue outstanding,${esc(paymentSummary.overdueOutstanding ?? 0)}`);
    lines.push('');
    lines.push('Tenant,Property,Due Date,Rent Amount,Paid,Balance,Status');
    paymentRows.forEach((r: any) => {
      const due = r?.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : '';
      lines.push(
        `${esc(r.tenantName || '')},${esc(r.propertyTitle || '')},${esc(due)},${esc(r.rentAmount ?? 0)},${esc(
          r.totalPaid ?? 0
        )},${esc(r.balance ?? 0)},${esc(r.status || '')}`
      );
    });
    downloadCsv(fileName, lines);
  };

  const [propertyMonths, setPropertyMonths] = useState<number>(12);
  const { data: propertyPerformanceData } = useAdminPropertyPerformanceReport(propertyMonths, openReport === 'property');
  const propertyRows = Array.isArray(propertyPerformanceData?.rows) ? propertyPerformanceData.rows : [];
  const bestProperty = propertyPerformanceData?.bestProperty || null;
  const problemProperty = propertyPerformanceData?.problemProperty || null;

  const downloadPropertyPerformanceCsv = () => {
    const now = new Date();
    const fileName = `property-performance-report-${now.toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [];
    lines.push('Property Performance Report');
    lines.push(`Generated At,${esc(now.toISOString())}`);
    lines.push(`Range (Months),${esc(propertyMonths)}`);
    lines.push('');
    lines.push('Property,Location,Occupancy,Income Generated,Expected Income,Outstanding,Maintenance Count,Rent Records');
    propertyRows.forEach((r: any) => {
      lines.push(
        `${esc(r.propertyTitle || '')},${esc(r.propertyLocation || '')},${esc(r.occupancyStatus || '')},${esc(
          r.incomeGenerated ?? 0
        )},${esc(r.expectedIncome ?? 0)},${esc(r.outstanding ?? 0)},${esc(r.maintenanceCount ?? 0)},${esc(
          r.rentRecords ?? 0
        )}`
      );
    });
    downloadCsv(fileName, lines);
  };

  const { data: occupancyReportData } = useAdminOccupancyReport(openReport === 'occupancy');
  const downloadOccupancyCsv = () => {
    const now = new Date();
    const fileName = `occupancy-report-${now.toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [];
    lines.push('Occupancy Report');
    lines.push(`Generated At,${esc(now.toISOString())}`);
    lines.push('');
    lines.push(`Total properties,${esc(occupancyReportData?.totalProperties ?? 0)}`);
    lines.push(`Occupied,${esc(occupancyReportData?.occupied ?? 0)}`);
    lines.push(`Vacant,${esc(occupancyReportData?.vacant ?? 0)}`);
    lines.push(`Maintenance,${esc(occupancyReportData?.maintenance ?? 0)}`);
    lines.push(`Occupancy %,${esc(Number(occupancyReportData?.occupancyPercent ?? 0).toFixed(2))}`);
    downloadCsv(fileName, lines);
  };

  const [maintenanceMonths, setMaintenanceMonths] = useState<number>(12);
  const { data: maintenanceReportData } = useAdminMaintenanceReport(maintenanceMonths, openReport === 'maintenance');
  const maintenanceSummary = maintenanceReportData?.summary || {};
  const maintenanceByCategory = Array.isArray(maintenanceReportData?.byCategory) ? maintenanceReportData.byCategory : [];
  const maintenanceRows = Array.isArray(maintenanceReportData?.rows) ? maintenanceReportData.rows : [];

  const downloadMaintenanceCsv = () => {
    const now = new Date();
    const fileName = `maintenance-report-${now.toISOString().slice(0, 10)}.csv`;
    const lines: string[] = [];
    lines.push('Maintenance Report');
    lines.push(`Generated At,${esc(now.toISOString())}`);
    lines.push(`Range (Months),${esc(maintenanceMonths)}`);
    lines.push('');
    lines.push(`Total complaints,${esc(maintenanceSummary.totalComplaints ?? 0)}`);
    lines.push(`Pending,${esc(maintenanceSummary.pending ?? 0)}`);
    lines.push(`In progress,${esc(maintenanceSummary.inProgress ?? 0)}`);
    lines.push(`Completed,${esc(maintenanceSummary.completed ?? 0)}`);
    lines.push('');
    lines.push('Issue Types');
    lines.push('Category,Count');
    maintenanceByCategory.forEach((c: any) => lines.push(`${esc(c.category || '')},${esc(c.count ?? 0)}`));
    lines.push('');
    lines.push('Recent Complaints');
    lines.push('Created At,Status,Category,Priority,Issue,Tenant,Property');
    maintenanceRows.forEach((r: any) => {
      const created = r?.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '';
      lines.push(
        `${esc(created)},${esc(r.status || '')},${esc(r.category || '')},${esc(r.priority || '')},${esc(
          r.issue || ''
        )},${esc(r.tenantName || '')},${esc(r.propertyTitle || '')}`
      );
    });
    downloadCsv(fileName, lines);
  };

  const activeReport = reportCards.find((r) => r.key === openReport) || null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              onClick={() => onNavigate(c.nav)}
              className={`group cursor-pointer rounded-2xl bg-gradient-to-br ${c.gradient} p-[1px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
            >
              <div className="rounded-2xl bg-black/10 p-4 text-white backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white/90">{c.title}</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">{c.value}</div>
                    <div className="mt-1 text-xs text-white/80">{c.subtitle}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition-transform duration-200 group-hover:scale-105">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((r) => (
          <div
            key={r.key}
            onClick={() => setOpenReport(r.key)}
            className={`group cursor-pointer rounded-2xl bg-gradient-to-br ${r.gradient} p-[1px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className="rounded-2xl bg-black/10 p-5 text-white backdrop-blur-sm">
              <div className="text-base font-semibold">{r.title}</div>
              <div className="mt-1 text-xs text-white/80">{r.subtitle}</div>
              <div className="mt-3 inline-flex items-center text-xs font-medium text-white/90">
                {t('Open report', 'அறிக்கையை திற')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openReport !== null} onOpenChange={(open) => !open && setOpenReport(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeReport?.title}</DialogTitle>
            <DialogDescription>{activeReport?.subtitle}</DialogDescription>
          </DialogHeader>

          {openReport === 'revenue' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={String(reportMonths)} onValueChange={(v) => setReportMonths(Number(v))}>
                  <SelectTrigger className="h-9 w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">{t('Last 6 months', 'கடைசி 6 மாதங்கள்')}</SelectItem>
                    <SelectItem value="12">{t('Last 12 months', 'கடைசி 12 மாதங்கள்')}</SelectItem>
                    <SelectItem value="24">{t('Last 24 months', 'கடைசி 24 மாதங்கள்')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl" onClick={downloadRevenueReportCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('Download', 'பதிவிறக்கு')}
                  </Button>
                  <Button className="h-9 rounded-xl" onClick={() => onNavigate('payments')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t('Open Payments', 'கட்டணங்களை திற')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-sm font-medium">{t('Summary', 'சுருக்கம்')}</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Total rent collected', 'மொத்த வாடகை வசூல்')}</div>
                      <div className="font-medium">{money(reportSummary.totalRentCollected ?? totals.revenueTotal ?? 0)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Pending payments', 'நிலுவை கட்டணங்கள்')}</div>
                      <div className="font-medium">
                        {money(reportSummary.pendingPaymentsAmount ?? totals.pendingRentAmount ?? 0)}{' '}
                        <span className="text-muted-foreground">
                          ({Number(reportSummary.pendingPaymentsCount ?? totals.pendingRentCount ?? 0)} {t('dues', 'நிலுவை')})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Monthly revenue (this month)', 'மாத வருமானம் (இந்த மாதம்)')}</div>
                      <div className="font-medium">{money(reportSummary.monthlyRevenue ?? totals.revenueThisMonth ?? 0)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Yearly revenue (this year)', 'வருட வருமானம் (இந்த ஆண்டு)')}</div>
                      <div className="font-medium">{money(reportSummary.yearlyRevenue ?? totals.revenueThisYear ?? 0)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <div className="text-sm font-medium">{t('Yearly Revenue', 'வருட வருமானம்')}</div>
                  <div className="mt-3 space-y-2">
                    {reportByYear.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{t('No yearly data available.', 'வருட தரவு இல்லை.')}</div>
                    ) : (
                      reportByYear.slice(-6).reverse().map((y: any) => (
                        <div key={String(y.year)} className="flex items-center justify-between gap-3 text-sm">
                          <div className="text-muted-foreground">{String(y.year)}</div>
                          <div className="font-medium">{money(y.revenue ?? 0)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="text-sm font-medium">{t('Monthly Revenue', 'மாத வருமானம்')}</div>
                  <Badge variant="secondary">{Number(reportByMonth.length).toLocaleString()}</Badge>
                </div>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Month', 'மாதம்')}</TableHead>
                        <TableHead className="text-right">{t('Revenue', 'வருமானம்')}</TableHead>
                        <TableHead className="text-right">{t('Transactions', 'பரிவர்த்தனைகள்')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportByMonth.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground">
                            {t('No data for this period.', 'இந்த காலத்திற்கு தரவு இல்லை.')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        reportByMonth.map((r: any) => (
                          <TableRow key={String(r.month)}>
                            <TableCell className="font-medium">{String(r.month)}</TableCell>
                            <TableCell className="text-right">{money(r.revenue ?? 0)}</TableCell>
                            <TableCell className="text-right">{Number(r.transactions ?? 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}

          {openReport === 'payment' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={String(paymentMonths)} onValueChange={(v) => setPaymentMonths(Number(v))}>
                  <SelectTrigger className="h-9 w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('This month', 'இந்த மாதம்')}</SelectItem>
                    <SelectItem value="3">{t('Last 3 months', 'கடைசி 3 மாதங்கள்')}</SelectItem>
                    <SelectItem value="6">{t('Last 6 months', 'கடைசி 6 மாதங்கள்')}</SelectItem>
                    <SelectItem value="12">{t('Last 12 months', 'கடைசி 12 மாதங்கள்')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl" onClick={downloadPaymentStatusCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('Download', 'பதிவிறக்கு')}
                  </Button>
                  <Button className="h-9 rounded-xl" onClick={() => onNavigate('payments')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t('Open Payments', 'கட்டணங்களை திற')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{t('Paid tenants', 'செலுத்தியவர்கள்')}</div>
                  <div className="mt-1 text-2xl font-semibold">{Number(paymentSummary.paidTenants ?? 0).toLocaleString()}</div>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{t('Unpaid tenants', 'செலுத்தாதவர்கள்')}</div>
                  <div className="mt-1 text-2xl font-semibold">{Number(paymentSummary.unpaidTenants ?? 0).toLocaleString()}</div>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{t('Overdue payments', 'காலாவதி')}</div>
                  <div className="mt-1 text-2xl font-semibold">{Number(paymentSummary.overduePayments ?? 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{t('Collected', 'வசூல்')}</div>
                  <div className="mt-1 text-xl font-semibold">{money(paymentSummary.collected ?? 0)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('Expected', 'எதிர்பார்ப்பு')}: {money(paymentSummary.expectedRent ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{t('Outstanding', 'நிலுவை')}</div>
                  <div className="mt-1 text-xl font-semibold">{money(paymentSummary.outstanding ?? 0)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('Overdue', 'காலாவதி')}: {money(paymentSummary.overdueOutstanding ?? 0)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="text-sm font-medium">{t('Tenant Payments', 'வாடகையாளர் கட்டணங்கள்')}</div>
                  <Badge variant="secondary">{Number(paymentRows.length).toLocaleString()}</Badge>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Tenant', 'வாடகையாளர்')}</TableHead>
                        <TableHead>{t('Property', 'சொத்து')}</TableHead>
                        <TableHead>{t('Due date', 'செலுத்த வேண்டிய தேதி')}</TableHead>
                        <TableHead className="text-right">{t('Amount', 'தொகை')}</TableHead>
                        <TableHead className="text-right">{t('Balance', 'நிலுவை')}</TableHead>
                        <TableHead>{t('Status', 'நிலை')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-sm text-muted-foreground">
                            {t('No payment records for this period.', 'இந்த காலத்திற்கு கட்டண பதிவுகள் இல்லை.')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paymentRows.slice(0, 200).map((r: any) => (
                          <TableRow key={String(r.id)}>
                            <TableCell className="font-medium">{String(r.tenantName || '')}</TableCell>
                            <TableCell>{String(r.propertyTitle || '')}</TableCell>
                            <TableCell>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : ''}</TableCell>
                            <TableCell className="text-right">{money(r.rentAmount ?? 0)}</TableCell>
                            <TableCell className="text-right">{money(r.balance ?? 0)}</TableCell>
                            <TableCell>
                              <Badge variant={String(r.status) === 'overdue' ? 'destructive' : String(r.status) === 'paid' ? 'default' : 'secondary'}>
                                {String(r.status || '')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}

          {openReport === 'occupancy' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" className="h-9 rounded-xl" onClick={downloadOccupancyCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('Download', 'பதிவிறக்கு')}
                </Button>
                <Button className="h-9 rounded-xl" onClick={() => onNavigate('properties')}>
                  <Building className="mr-2 h-4 w-4" />
                  {t('Open Properties', 'சொத்துகளை திற')}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">{t('Total properties', 'மொத்த சொத்துகள்')}</div>
                  <div className="mt-1 text-3xl font-semibold">{Number(occupancyReportData?.totalProperties ?? 0).toLocaleString()}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t('Occupancy', 'குடியேற்றம்')}: {Number(occupancyReportData?.occupancyPercent ?? 0).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Occupied', 'குடியிருப்பு')}</div>
                      <div className="font-medium">{Number(occupancyReportData?.occupied ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Vacant', 'காலி')}</div>
                      <div className="font-medium">{Number(occupancyReportData?.vacant ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Maintenance', 'பராமரிப்பு')}</div>
                      <div className="font-medium">{Number(occupancyReportData?.maintenance ?? 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {openReport === 'property' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={String(propertyMonths)} onValueChange={(v) => setPropertyMonths(Number(v))}>
                  <SelectTrigger className="h-9 w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">{t('Last 6 months', 'கடைசி 6 மாதங்கள்')}</SelectItem>
                    <SelectItem value="12">{t('Last 12 months', 'கடைசி 12 மாதங்கள்')}</SelectItem>
                    <SelectItem value="24">{t('Last 24 months', 'கடைசி 24 மாதங்கள்')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl" onClick={downloadPropertyPerformanceCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('Download', 'பதிவிறக்கு')}
                  </Button>
                  <Button className="h-9 rounded-xl" onClick={() => onNavigate('properties')}>
                    <Building className="mr-2 h-4 w-4" />
                    {t('Open Properties', 'சொத்துகளை திற')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">{t('Best property', 'சிறந்த சொத்து')}</div>
                  <div className="mt-1 text-sm font-medium">{String(bestProperty?.propertyTitle || t('N/A', 'இல்லை'))}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t('Income', 'வருமானம்')}: {money(bestProperty?.incomeGenerated ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">{t('Problem property', 'பிரச்சனை சொத்து')}</div>
                  <div className="mt-1 text-sm font-medium">{String(problemProperty?.propertyTitle || t('N/A', 'இல்லை'))}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t('Maintenance', 'பராமரிப்பு')}: {Number(problemProperty?.maintenanceCount ?? 0).toLocaleString()} • {t('Outstanding', 'நிலுவை')}:{' '}
                    {money(problemProperty?.outstanding ?? 0)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="text-sm font-medium">{t('Per-property performance', 'சொத்து வாரியாக')}</div>
                  <Badge variant="secondary">{Number(propertyRows.length).toLocaleString()}</Badge>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Property', 'சொத்து')}</TableHead>
                        <TableHead>{t('Occupancy', 'குடியேற்றம்')}</TableHead>
                        <TableHead className="text-right">{t('Income', 'வருமானம்')}</TableHead>
                        <TableHead className="text-right">{t('Outstanding', 'நிலுவை')}</TableHead>
                        <TableHead className="text-right">{t('Maintenance', 'பராமரிப்பு')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propertyRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-muted-foreground">
                            {t('No property performance data for this period.', 'இந்த காலத்திற்கு சொத்து தரவு இல்லை.')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        propertyRows
                          .slice()
                          .sort((a: any, b: any) => Number(b.incomeGenerated || 0) - Number(a.incomeGenerated || 0))
                          .slice(0, 200)
                          .map((r: any) => (
                            <TableRow key={String(r.propertyId)}>
                              <TableCell className="font-medium">{String(r.propertyTitle || '')}</TableCell>
                              <TableCell>
                                <Badge variant={String(r.occupancyStatus) === 'occupied' ? 'default' : String(r.occupancyStatus) === 'vacant' ? 'secondary' : 'outline'}>
                                  {String(r.occupancyStatus || '')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{money(r.incomeGenerated ?? 0)}</TableCell>
                              <TableCell className="text-right">{money(r.outstanding ?? 0)}</TableCell>
                              <TableCell className="text-right">{Number(r.maintenanceCount ?? 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}

          {openReport === 'maintenance' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={String(maintenanceMonths)} onValueChange={(v) => setMaintenanceMonths(Number(v))}>
                  <SelectTrigger className="h-9 w-[170px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">{t('Last 6 months', 'கடைசி 6 மாதங்கள்')}</SelectItem>
                    <SelectItem value="12">{t('Last 12 months', 'கடைசி 12 மாதங்கள்')}</SelectItem>
                    <SelectItem value="24">{t('Last 24 months', 'கடைசி 24 மாதங்கள்')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl" onClick={downloadMaintenanceCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('Download', 'பதிவிறக்கு')}
                  </Button>
                  <Button className="h-9 rounded-xl" onClick={() => onNavigate('maintenance')}>
                    <Wrench className="mr-2 h-4 w-4" />
                    {t('Open Maintenance', 'பராமரிப்பு திற')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">{t('Total complaints', 'மொத்த புகார்கள்')}</div>
                  <div className="mt-1 text-3xl font-semibold">{Number(maintenanceSummary.totalComplaints ?? 0).toLocaleString()}</div>
                  <div className="mt-2 grid gap-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Pending', 'நிலுவை')}</div>
                      <div className="font-medium">{Number(maintenanceSummary.pending ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('In progress', 'நடந்து கொண்டிருக்கிறது')}</div>
                      <div className="font-medium">{Number(maintenanceSummary.inProgress ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{t('Completed', 'முடிந்தது')}</div>
                      <div className="font-medium">{Number(maintenanceSummary.completed ?? 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="text-sm font-medium">{t('Issue types', 'வகைகள்')}</div>
                    <Badge variant="secondary">{Number(maintenanceByCategory.length).toLocaleString()}</Badge>
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Category', 'வகை')}</TableHead>
                          <TableHead className="text-right">{t('Count', 'எண்ணிக்கை')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {maintenanceByCategory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-sm text-muted-foreground">
                              {t('No maintenance data for this period.', 'இந்த காலத்திற்கு பராமரிப்பு தரவு இல்லை.')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          maintenanceByCategory.slice(0, 12).map((c: any) => (
                            <TableRow key={String(c.category)}>
                              <TableCell className="font-medium">{String(c.category || '')}</TableCell>
                              <TableCell className="text-right">{Number(c.count ?? 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="text-sm font-medium">{t('Recent complaints', 'சமீபத்திய புகார்கள்')}</div>
                  <Badge variant="secondary">{Number(maintenanceRows.length).toLocaleString()}</Badge>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Date', 'தேதி')}</TableHead>
                        <TableHead>{t('Property', 'சொத்து')}</TableHead>
                        <TableHead>{t('Issue', 'பிரச்சனை')}</TableHead>
                        <TableHead>{t('Status', 'நிலை')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            {t('No complaints for this period.', 'இந்த காலத்திற்கு புகார்கள் இல்லை.')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        maintenanceRows.slice(0, 200).map((r: any) => (
                          <TableRow key={String(r.id)}>
                            <TableCell>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</TableCell>
                            <TableCell className="font-medium">{String(r.propertyTitle || '')}</TableCell>
                            <TableCell>{String(r.issue || '')}</TableCell>
                            <TableCell>
                              <Badge variant={String(r.status) === 'pending' ? 'secondary' : String(r.status) === 'completed' ? 'default' : 'outline'}>
                                {String(r.status || '')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border bg-background/80 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('Revenue Trend', 'வருமான போக்கு')}</CardTitle>
            <Button variant="ghost" className="h-9 rounded-xl px-3" onClick={() => onNavigate('analytics')}>
              {t('View', 'பார்')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`₹${Number(value || 0).toLocaleString()}`, t('Revenue', 'வருமானம்')]} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-background/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('Occupancy', 'குடியேற்றம்')}</CardTitle>
            <Button variant="ghost" className="h-9 rounded-xl px-3" onClick={() => onNavigate('analytics')}>
              {t('View', 'பார்')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={occupancyRows} dataKey="value" nameKey="name" outerRadius={110} label>
                  {occupancyRows.map((_: any, index: number) => (
                    <Cell key={index} fill={OCCUPANCY_COLORS[index % OCCUPANCY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border bg-background/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('Alerts', 'எச்சரிக்கைகள்')}</CardTitle>
            <Button variant="ghost" className="h-9 rounded-xl px-3" onClick={() => onNavigate('notifications')}>
              {t('All', 'அனைத்தும்')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('No alerts right now.', 'இப்போது எச்சரிக்கைகள் இல்லை.')}</div>
            ) : (
              alerts.map((a: any) => {
                const severity = String(a?.severity || 'low');
                const Icon = alertIcon(severity);
                const nav = toSectionForAlert(a?.key);
                const left =
                  severity === 'high'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : severity === 'medium'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';

                return (
                  <button
                    key={String(a?.key)}
                    type="button"
                    onClick={() => onNavigate(nav)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${left}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{formatAdminKey(t, a?.key)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t('Click to review and act', 'பார்த்து நடவடிக்கை எடுக்க கிளிக் செய்யவும்')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'secondary' : 'outline'}>
                        {Number(a?.count || 0)}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-background/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('Activity Feed', 'சமீப நடவடிக்கைகள்')}</CardTitle>
            <Button variant="ghost" className="h-9 rounded-xl px-3" onClick={() => onNavigate('overview')}>
              {t('Live', 'நேரலை')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('No recent activity found.', 'சமீப நடவடிக்கைகள் இல்லை.')}</div>
            ) : (
              activity.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onNavigate(a.nav)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.subtitle}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminUsers({ searchQuery }: { searchQuery: string }) {
  const { t } = useLanguage();
  const { data: users = [], isLoading } = useAdminUsers();
  const approveUser = useAdminApproveUser();
  const blockUser = useAdminBlockUser();
  const assignRole = useAdminAssignUserRole();
  const assignTamilRole = useAdminAssignUserTamilRole();

  const safeUsers = Array.isArray(users) ? users : [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return safeUsers;
    return safeUsers.filter((u: any) => {
      const hay = `${u?.name || ''} ${u?.email || ''} ${u?.tamilRole || ''} ${u?.role || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [q, safeUsers]);

  return (
    <Card className="rounded-2xl border bg-background/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t('User Management', 'பயனர் நிர்வாகம்')}</CardTitle>
        <Badge variant="secondary">{Number(filtered.length).toLocaleString()}</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t('Loading...', 'ஏற்றுகிறது...')}</div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name', 'பெயர்')}</TableHead>
                  <TableHead>{t('Email', 'மின்னஞ்சல்')}</TableHead>
                  <TableHead>{t('Tamil Role', 'பங்கு')}</TableHead>
                  <TableHead>{t('Internal', 'உள்')}</TableHead>
                  <TableHead>{t('Status', 'நிலை')}</TableHead>
                  <TableHead>{t('Actions', 'செயல்கள்')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => {
                  const id = String(u._id || u.id || '');
                  const approved = !!u.approved;
                  const blocked = !!u.blocked;
                  const internalRole = String(u.role || 'user');
                  const tamilRole = String(u.tamilRole || '');

                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={tamilRole}
                          onValueChange={(value) => assignTamilRole.mutate({ id, tamilRole: value })}
                          disabled={assignTamilRole.isPending}
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder={t('Select', 'தேர்வு')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t('Admin', 'நிர்வாகம்')}</SelectItem>
                            <SelectItem value="owners">{t('Owner', 'உரிமையாளர்')}</SelectItem>
                            <SelectItem value="brokersBuilders">{t('Broker/Builder', 'தரகர்/கட்டுபவர்')}</SelectItem>
                            <SelectItem value="customers">{t('Customer', 'வாடிக்கையாளர்')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={internalRole}
                          onValueChange={(value) => assignRole.mutate({ id, role: value })}
                          disabled={assignRole.isPending}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue placeholder={t('Select', 'தேர்வு')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t('User', 'பயனர்')}</SelectItem>
                            <SelectItem value="admin">{t('Admin', 'நிர்வாகம்')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge variant={approved ? 'default' : 'secondary'}>
                            {approved ? t('Approved', 'அங்கீகரிக்கப்பட்டது') : t('Pending', 'நிலுவையில்')}
                          </Badge>
                          {blocked ? <Badge variant="destructive">{t('Blocked', 'தடை')}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {!approved ? (
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await approveUser.mutateAsync(id);
                                  toast.success(t('User approved', 'பயனர் அங்கீகரிக்கப்பட்டார்'));
                                } catch (e: any) {
                                  toast.error(e?.message || t('Failed', 'தோல்வி'));
                                }
                              }}
                              disabled={approveUser.isPending}
                            >
                              {t('Approve', 'அங்கீகரி')}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant={blocked ? 'outline' : 'destructive'}
                            onClick={async () => {
                              try {
                                await blockUser.mutateAsync({ id, blocked: !blocked });
                                toast.success(blocked ? t('User unblocked', 'தடை நீக்கப்பட்டது') : t('User blocked', 'பயனர் தடை செய்யப்பட்டார்'));
                              } catch (e: any) {
                                toast.error(e?.message || t('Failed', 'தோல்வி'));
                              }
                            }}
                            disabled={blockUser.isPending}
                          >
                            {blocked ? t('Unblock', 'தடை நீக்கு') : t('Block', 'தடை')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminProperties({ searchQuery, createSignal }: { searchQuery: string; createSignal: number }) {
  const { t } = useLanguage();
  const { data: properties = [] } = useAdminProperties();
  const createProperty = useAdminCreateProperty();
  const updateProperty = useAdminUpdateProperty();
  const deleteProperty = useAdminDeleteProperty();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [form, setForm] = useState<any>({
    ownerId: '',
    title: '',
    propertyType: 'flat',
    location: '',
    price: '',
    transactionType: 'rent',
    totalArea: '',
    bedrooms: '',
    facing: 'North',
    status: 'approved',
    occupancyStatus: 'vacant',
    tenantId: ''
  });

  const openNew = useCallback(() => {
    setEditing(null);
    setForm({
      ownerId: '',
      title: '',
      propertyType: 'flat',
      location: '',
      price: '',
      transactionType: 'rent',
      totalArea: '',
      bedrooms: '',
      facing: 'North',
      status: 'approved',
      occupancyStatus: 'vacant',
      tenantId: ''
    });
    setOpen(true);
  }, []);

  const openEdit = useCallback((p: any) => {
    setEditing(p);
    setForm({
      ownerId: p.owner?._id || p.owner || '',
      title: p.title || '',
      propertyType: p.propertyType || 'flat',
      location: p.location || '',
      price: String(p.price ?? ''),
      transactionType: p.transactionType || 'rent',
      totalArea: String(p.totalArea ?? ''),
      bedrooms: String(p.bedrooms ?? ''),
      facing: p.facing || p.propertyFacing || 'North',
      status: p.status || 'approved',
      occupancyStatus: p.occupancyStatus || 'vacant',
      tenantId: p.tenant?._id || p.tenant || ''
    });
    setOpen(true);
  }, []);

  const submit = async () => {
    const ownerId = String(form.ownerId || '').trim();
    const title = String(form.title || '').trim();
    const location = String(form.location || '').trim();
    const price = Number(form.price);
    if (!ownerId || !title || !location || !form.propertyType || !form.transactionType || !price) {
      toast.error(t('Please fill required fields', 'அவசியமான புலங்களை நிரப்பவும்'));
      return;
    }

    const payload = {
      ownerId,
      title,
      propertyType: form.propertyType,
      location,
      price,
      transactionType: form.transactionType,
      totalArea: form.totalArea ? Number(form.totalArea) : undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      facing: form.facing,
      status: form.status,
      occupancyStatus: form.occupancyStatus,
      tenantId: String(form.tenantId || '').trim() || undefined
    };

    try {
      if (editing) {
        await updateProperty.mutateAsync({ id: String(editing._id || editing.id), data: payload });
        toast.success(t('Property updated', 'சொத்து புதுப்பிக்கப்பட்டது'));
      } else {
        await createProperty.mutateAsync(payload);
        toast.success(t('Property created', 'சொத்து சேர்க்கப்பட்டது'));
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || e?.message || t('Failed', 'தோல்வி'));
    }
  };

  const safe = Array.isArray(properties) ? properties : [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return safe;
    return safe.filter((p: any) => {
      const hay = `${p?.title || ''} ${p?.location || ''} ${p?.owner?.email || ''} ${p?.status || ''} ${p?.occupancyStatus || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [q, safe]);

  useEffect(() => {
    if (createSignal > 0) openNew();
  }, [createSignal, openNew]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {t('Add, edit, delete, and view properties.', 'சொத்துகளை சேர்க்கவும், திருத்தவும், நீக்கவும், பார்க்கவும்.')}
        </div>
        <Button className="rounded-xl" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t('Add Property', 'சொத்து சேர்க்கவும்')}
        </Button>
      </div>

      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardContent className="pt-6">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Title', 'தலைப்பு')}</TableHead>
                  <TableHead>{t('Location', 'இடம்')}</TableHead>
                  <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                  <TableHead>{t('Occupancy', 'குடியேற்றம்')}</TableHead>
                  <TableHead>{t('Status', 'நிலை')}</TableHead>
                  <TableHead>{t('Actions', 'செயல்கள்')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => {
                  const id = String(p._id || p.id || '');
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{p.location}</TableCell>
                      <TableCell>{p.owner?.email || ''}</TableCell>
                      <TableCell>
                        <Badge variant={p.occupancyStatus === 'occupied' ? 'default' : 'secondary'}>
                          {String(p.occupancyStatus || 'vacant')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'approved' ? 'default' : p.status === 'pending' ? 'secondary' : 'outline'}>
                          {String(p.status || '')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            {t('Edit', 'திருத்து')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              try {
                                await deleteProperty.mutateAsync(id);
                                toast.success(t('Deleted', 'நீக்கப்பட்டது'));
                              } catch (e: any) {
                                toast.error(e?.response?.data?.msg || e?.message || t('Failed', 'தோல்வி'));
                              }
                            }}
                            disabled={deleteProperty.isPending}
                          >
                            {t('Delete', 'நீக்கு')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('Edit Property', 'சொத்தை திருத்தவும்') : t('Add Property', 'சொத்து சேர்க்கவும்')}</DialogTitle>
            <DialogDescription>
              {t('Admin create/edit requires ownerId. Images are optional here.', 'Admin create/edit-க்கு ownerId அவசியம். படங்கள் இங்கு விருப்பம்.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t('Owner ID', 'உரிமையாளர் ID')}</Label>
              <Input value={form.ownerId} onChange={(e) => setForm((s: any) => ({ ...s, ownerId: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t('Title', 'தலைப்பு')}</Label>
              <Input value={form.title} onChange={(e) => setForm((s: any) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t('Location', 'இடம்')}</Label>
              <Input value={form.location} onChange={(e) => setForm((s: any) => ({ ...s, location: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('Property Type', 'சொத்து வகை')}</Label>
                <Select value={form.propertyType} onValueChange={(v) => setForm((s: any) => ({ ...s, propertyType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="pg">PG</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t('Transaction', 'பரிவர்த்தனை')}</Label>
                <Select value={form.transactionType} onValueChange={(v) => setForm((s: any) => ({ ...s, transactionType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">{t('Rent', 'வாடகை')}</SelectItem>
                    <SelectItem value="lease">{t('Lease', 'லீஸ்')}</SelectItem>
                    <SelectItem value="purchase">{t('Purchase', 'வாங்க')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('Price', 'விலை')}</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm((s: any) => ({ ...s, price: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t('Facing', 'திசை')}</Label>
                <Select value={form.facing} onValueChange={(v) => setForm((s: any) => ({ ...s, facing: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="North">{t('North', 'வடக்கு')}</SelectItem>
                    <SelectItem value="South">{t('South', 'தெற்கு')}</SelectItem>
                    <SelectItem value="East">{t('East', 'கிழக்கு')}</SelectItem>
                    <SelectItem value="West">{t('West', 'மேற்கு')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('Occupancy', 'குடியேற்றம்')}</Label>
                <Select value={form.occupancyStatus} onValueChange={(v) => setForm((s: any) => ({ ...s, occupancyStatus: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacant">{t('Vacant', 'காலி')}</SelectItem>
                    <SelectItem value="occupied">{t('Occupied', 'குடியேற்றப்பட்டது')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('Status', 'நிலை')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((s: any) => ({ ...s, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">{t('Approved', 'அங்கீகரிக்கப்பட்டது')}</SelectItem>
                    <SelectItem value="pending">{t('Pending', 'நிலுவையில்')}</SelectItem>
                    <SelectItem value="rejected">{t('Rejected', 'நிராகரிக்கப்பட்டது')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t('Tenant ID (optional)', 'குத்தகைதாரர் ID (விருப்பம்)')}</Label>
              <Input value={form.tenantId} onChange={(e) => setForm((s: any) => ({ ...s, tenantId: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button onClick={submit} disabled={createProperty.isPending || updateProperty.isPending}>
              {editing ? t('Save', 'சேமி') : t('Create', 'சேர்க்க')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminMaintenance({ searchQuery }: { searchQuery: string }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<string>('all');
  const { data: requests = [] } = useAdminMaintenance(status === 'all' ? undefined : status);
  const update = useAdminUpdateMaintenance();

  const safe = Array.isArray(requests) ? requests : [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return safe;
    return safe.filter((r: any) => {
      const hay = `${r?.property?.title || ''} ${r?.issue || ''} ${r?.tenant?.email || ''} ${r?.owner?.email || ''} ${r?.status || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [q, safe]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {t('View, filter, and update maintenance requests.', 'பார்க்கவும், வடிகட்டவும், மற்றும் பராமரிப்பு கோரிக்கைகளை புதுப்பிக்கவும்.')}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('Filter', 'வடிகட்டி')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All', 'அனைத்து')}</SelectItem>
            <SelectItem value="pending">{t('Pending', 'நிலுவையில்')}</SelectItem>
            <SelectItem value="in-progress">{t('In Progress', 'செயலில்')}</SelectItem>
            <SelectItem value="completed">{t('Completed', 'முடிந்தது')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardContent className="pt-6">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Property', 'சொத்து')}</TableHead>
                  <TableHead>{t('Issue', 'பிரச்சனை')}</TableHead>
                  <TableHead>{t('Tenant', 'குத்தகைதாரர்')}</TableHead>
                  <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                  <TableHead>{t('Status', 'நிலை')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const id = String(r._id || r.id || '');
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{r.property?.title || ''}</TableCell>
                      <TableCell>{r.issue}</TableCell>
                      <TableCell>{r.tenant?.email || ''}</TableCell>
                      <TableCell>{r.owner?.email || ''}</TableCell>
                      <TableCell>
                        <Select
                          value={String(r.status || 'pending')}
                          onValueChange={(v) => update.mutate({ id, status: v })}
                          disabled={update.isPending}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t('Pending', 'நிலுவையில்')}</SelectItem>
                            <SelectItem value="in-progress">{t('In Progress', 'செயலில்')}</SelectItem>
                            <SelectItem value="completed">{t('Completed', 'முடிந்தது')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminPayments({ searchQuery }: { searchQuery: string }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<string>('all');
  const { data: payments = [] } = useAdminPayments(status === 'all' ? undefined : status);
  const { data: overdue = [] } = useAdminOverduePayments();

  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOverdue = Array.isArray(overdue) ? overdue : [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const filteredPayments = useMemo(() => {
    if (!q) return safePayments;
    return safePayments.filter((p: any) => {
      const hay = `${p?.tenant?.email || ''} ${p?.owner?.email || ''} ${p?.rentRecord?.property?.title || ''} ${p?.status || ''} ${p?.amount || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [q, safePayments]);
  const filteredOverdue = useMemo(() => {
    if (!q) return safeOverdue;
    return safeOverdue.filter((r: any) => {
      const hay = `${r?.property?.title || ''} ${r?.tenant?.email || ''} ${r?.owner?.email || ''} ${r?.balance ?? r?.rentAmount ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [q, safeOverdue]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {t('Track rent payments and view overdue dues.', 'வாடகை கட்டணங்களை கண்காணிக்கவும், காலாவதியை பார்க்கவும்.')}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('Filter', 'வடிகட்டி')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All', 'அனைத்து')}</SelectItem>
            <SelectItem value="submitted">{t('Submitted', 'சமர்ப்பிக்கப்பட்டது')}</SelectItem>
            <SelectItem value="approved">{t('Approved', 'அங்கீகரிக்கப்பட்டது')}</SelectItem>
            <SelectItem value="rejected">{t('Rejected', 'நிராகரிக்கப்பட்டது')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardHeader>
          <CardTitle>{t('Payments', 'கட்டணங்கள்')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Amount', 'தொகை')}</TableHead>
                  <TableHead>{t('Tenant', 'குத்தகைதாரர்')}</TableHead>
                  <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                  <TableHead>{t('Property', 'சொத்து')}</TableHead>
                  <TableHead>{t('Status', 'நிலை')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p: any) => (
                  <TableRow key={String(p._id || p.id)}>
                    <TableCell className="font-medium">₹{Number(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>{p.tenant?.email || ''}</TableCell>
                    <TableCell>{p.owner?.email || ''}</TableCell>
                    <TableCell>{p.rentRecord?.property?.title || ''}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'approved' ? 'default' : p.status === 'submitted' ? 'secondary' : 'outline'}>
                        {String(p.status || '')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardHeader>
          <CardTitle>{t('Overdue', 'காலாவதி')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Property', 'சொத்து')}</TableHead>
                  <TableHead>{t('Tenant', 'குத்தகைதாரர்')}</TableHead>
                  <TableHead>{t('Owner', 'உரிமையாளர்')}</TableHead>
                  <TableHead>{t('Due', 'கடைசி தேதி')}</TableHead>
                  <TableHead>{t('Balance', 'இருப்பு')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOverdue.map((r: any) => (
                  <TableRow key={String(r._id || r.id)}>
                    <TableCell className="font-medium">{r.property?.title || ''}</TableCell>
                    <TableCell>{r.tenant?.email || ''}</TableCell>
                    <TableCell>{r.owner?.email || ''}</TableCell>
                    <TableCell>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : ''}</TableCell>
                    <TableCell>₹{Number(r.balance ?? r.rentAmount ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminAnalytics({ analytics }: { analytics: any }) {
  const { t } = useLanguage();
  const revenueByMonth = Array.isArray(analytics?.revenueByMonth) ? analytics.revenueByMonth : [];
  const occupancyObj = analytics?.occupancy || {};
  const occupancyRows = Object.keys(occupancyObj).map((k) => ({ name: k, value: Number(occupancyObj[k] || 0) }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardHeader>
          <CardTitle>{t('Revenue', 'வருமானம்')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`₹${Number(value || 0).toLocaleString()}`, t('Revenue', 'வருமானம்')]} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-background/80 shadow-sm">
        <CardHeader>
          <CardTitle>{t('Occupancy', 'குடியேற்றம்')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={occupancyRows} dataKey="value" nameKey="name" outerRadius={110} label>
                {occupancyRows.map((_, index) => (
                  <Cell key={index} fill={OCCUPANCY_COLORS[index % OCCUPANCY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminNotifications({ notifications, searchQuery }: { notifications: any; searchQuery: string }) {
  const { t } = useLanguage();
  const items = Array.isArray(notifications?.items) ? notifications.items : [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter((n: any) => {
      const hay = `${n?.key || ''} ${formatAdminKey(t, n?.key)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, q, t]);

  return (
    <Card className="rounded-2xl border bg-background/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t('Notifications', 'அறிவிப்புகள்')}</CardTitle>
        <Badge variant="secondary">{Number(filtered.length).toLocaleString()}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('No notifications.', 'அறிவிப்புகள் இல்லை.')}</div>
        ) : (
          filtered.map((n: any) => {
            const severity = String(n?.severity || 'low');
            const Icon = severity === 'high' ? TriangleAlert : Bell;
            const left =
              severity === 'high'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                : severity === 'medium'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400';

            return (
              <div
                key={String(n.key)}
                className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${left}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{formatAdminKey(t, n.key)}</div>
                    <div className="truncate text-xs text-muted-foreground">{t('System notification', 'முறைமை அறிவிப்பு')}</div>
                  </div>
                </div>
                <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'secondary' : 'outline'}>
                  {Number(n.count || 0)}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
