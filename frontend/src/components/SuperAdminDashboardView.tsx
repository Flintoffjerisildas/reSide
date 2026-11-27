import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  KeyRound,
  MailCheck,
  Megaphone,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OverviewData {
  totalUsers: number;
  totalAdmins: number;
  totalRegularUsers: number;
  verifiedUsers: number;
  suspendedUsers: number;
  totalProperties: number;
  vacantProperties: number;
  occupiedProperties: number;
  totalAgreements: number;
  totalMaintenanceRequests: number;
}

interface AnalyticsData {
  roleBreakdown: {
    tenants: number;
    landlords: number;
    admins: number;
    superadmins: number;
    total: number;
  };
  verificationStats: {
    emailVerified: number;
    phoneVerified: number;
    aadhaarVerified: number;
    unverified: number;
  };
  propertyStats: {
    total: number;
    vacant: number;
    occupied: number;
    rent: number;
    purchase: number;
    approved: number;
    pending: number;
  };
  growthTrends: Array<{ date: string; users: number; properties: number }>;
}

interface UserRow {
  _id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  role: string;
  registrationPurpose?: string;
  isSuspended?: boolean;
  blocked?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isAadhaarVerified?: boolean;
  createdAt?: string;
}

interface PropertyRow {
  _id: string;
  title: string;
  location: string;
  price: number;
  transactionType: string;
  occupancyStatus?: string;
  status?: string;
  owner?: {
    _id: string;
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
  tenant?: {
    _id: string;
    name?: string;
    email?: string;
  } | null;
  createdAt?: string;
}

interface AgreementRow {
  _id: string;
  status?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  property?: { title?: string; location?: string };
  owner?: { name?: string; email?: string; phone?: string };
  tenant?: { name?: string; email?: string; phone?: string };
}

interface MaintenanceRow {
  _id: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  property?: { title?: string; location?: string };
  tenant?: { name?: string; email?: string; phone?: string };
  createdAt?: string;
}

interface AuditLogRow {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

interface SystemSettings {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requirePhoneVerificationForListing: boolean;
  globalBannerMessage: string;
}

type ExecutiveTab = 'overview' | 'admins' | 'users' | 'oversight' | 'audit';
type OversightSubTab = 'properties' | 'agreements' | 'maintenance';

function BreakdownBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        <span className="font-bold text-slate-900 dark:text-white">
          {value} <span className="text-slate-400 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SuperAdminDashboardView() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ExecutiveTab>('overview');
  const [oversightSubTab, setOversightSubTab] = useState<OversightSubTab>('properties');

  const [overview, setOverview] = useState<OverviewData>({
    totalUsers: 0,
    totalAdmins: 0,
    totalRegularUsers: 0,
    verifiedUsers: 0,
    suspendedUsers: 0,
    totalProperties: 0,
    vacantProperties: 0,
    occupiedProperties: 0,
    totalAgreements: 0,
    totalMaintenanceRequests: 0,
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    maintenanceMode: false,
    allowNewRegistrations: true,
    requirePhoneVerificationForListing: false,
    globalBannerMessage: '',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'tenants' | 'landlords' | 'admins' | 'suspended'>('all');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditRoleFilter, setAuditRoleFilter] = useState('all');

  // Create Admin Modal
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Force Password Reset Modal
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [exportingCollection, setExportingCollection] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const loadAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [
        overviewRes,
        analyticsRes,
        usersRes,
        propertiesRes,
        agreementsRes,
        maintenanceRes,
        auditRes,
        settingsRes,
      ] = await Promise.all([
        api.get('/superadmin/overview'),
        api.get('/superadmin/analytics'),
        api.get('/superadmin/users'),
        api.get('/superadmin/properties'),
        api.get('/superadmin/agreements'),
        api.get('/superadmin/maintenance'),
        api.get('/superadmin/audit-logs?limit=100'),
        api.get('/superadmin/system-settings'),
      ]);

      setOverview(overviewRes.data?.counts || overviewRes.data);
      setAnalytics(analyticsRes.data || null);
      setUsers(usersRes.data?.users || []);
      setProperties(propertiesRes.data?.properties || []);
      setAgreements(agreementsRes.data?.agreements || []);
      setMaintenanceRequests(maintenanceRes.data?.requests || []);
      setAuditLogs(auditRes.data?.logs || []);
      if (settingsRes.data) {
        setSystemSettings({
          maintenanceMode: Boolean(settingsRes.data.maintenanceMode),
          allowNewRegistrations: settingsRes.data.allowNewRegistrations !== false,
          requirePhoneVerificationForListing: Boolean(settingsRes.data.requirePhoneVerificationForListing),
          globalBannerMessage: settingsRes.data.globalBannerMessage || '',
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to load Super Admin Control Center');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter === 'tenants') {
        const isTenant =
          u.role === 'tenant' ||
          u.registrationPurpose === 'Customer' ||
          (!u.registrationPurpose && u.role === 'user');
        if (!isTenant) return false;
      } else if (roleFilter === 'landlords') {
        const isLandlord =
          u.role === 'landlord' ||
          u.registrationPurpose === 'Owner' ||
          u.registrationPurpose === 'Builder' ||
          u.registrationPurpose === 'Dealer';
        if (!isLandlord) return false;
      } else if (roleFilter === 'admins') {
        if (u.role !== 'admin') return false;
      } else if (roleFilter === 'suspended') {
        if (!u.isSuspended && !u.blocked) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = `${u.name || ''} ${u.username || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, roleFilter, searchTerm]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      if (auditRoleFilter !== 'all' && log.actorRole !== auditRoleFilter) return false;
      return true;
    });
  }, [auditLogs, auditActionFilter, auditRoleFilter]);

  const uniqueAuditActions = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.action))).sort(),
    [auditLogs]
  );

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error('Name, email, and password are required');
      return;
    }
    setCreatingAdmin(true);
    try {
      await api.post('/superadmin/admins', {
        name: adminName.trim(),
        username: adminUsername.trim() || undefined,
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        password: adminPassword,
      });
      toast.success('Admin account created successfully');
      setCreateAdminOpen(false);
      setAdminName('');
      setAdminUsername('');
      setAdminEmail('');
      setAdminPhone('');
      setAdminPassword('');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to create admin account');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleRoleChange = async (userId: string, nextRole: 'admin' | 'user') => {
    setBusyActionId(userId);
    try {
      await api.patch(`/superadmin/users/${userId}/role`, { role: nextRole });
      toast.success(nextRole === 'admin' ? 'User promoted to Admin' : 'Admin demoted to User');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to update role');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleToggleSuspend = async (userRow: UserRow) => {
    const currentlySuspended = Boolean(userRow.isSuspended || userRow.blocked);
    setBusyActionId(userRow._id);
    try {
      await api.patch(`/superadmin/users/${userRow._id}/status`, {
        isSuspended: !currentlySuspended,
      });
      toast.success(!currentlySuspended ? 'Account suspended' : 'Account activated');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to update account status');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (tempPassword.length < 6) {
      toast.error('Temporary password must be at least 6 characters');
      return;
    }
    setResettingPassword(true);
    try {
      await api.post(`/superadmin/users/${resetTarget._id}/reset-password`, {
        newPassword: tempPassword,
      });
      toast.success(`Temporary password set for ${resetTarget.email}`);
      setResetTarget(null);
      setTempPassword('');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userRow: UserRow) => {
    if (!window.confirm(`Delete account for ${userRow.name} (${userRow.email})? This cannot be undone.`)) {
      return;
    }
    setBusyActionId(userRow._id);
    try {
      await api.delete(`/superadmin/users/${userRow._id}`);
      toast.success('Account deleted successfully');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to delete user');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleForceVerifyProperty = async (property: PropertyRow) => {
    setBusyActionId(property._id);
    try {
      await api.patch(`/superadmin/properties/${property._id}/verify`);
      toast.success(`"${property.title}" force-verified and listed`);
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to verify property');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRemoveProperty = async (property: PropertyRow) => {
    if (!window.confirm(`Force-delete listing "${property.title}"? Associated records will also be removed.`)) {
      return;
    }
    setBusyActionId(property._id);
    try {
      await api.delete(`/superadmin/properties/${property._id}`);
      toast.success('Listing force-deleted');
      await loadAll(true);
    } catch (err: any) {
      // Fallback to standard delete if superadmin route fails
      try {
        await api.delete(`/properties/${property._id}`);
        toast.success('Listing force-deleted');
        await loadAll(true);
      } catch (innerErr: any) {
        toast.error(err?.response?.data?.msg || innerErr?.response?.data?.msg || 'Failed to delete listing');
      }
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/superadmin/system-settings', systemSettings);
      toast.success('System controls saved');
      await loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || 'Failed to update system settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = async (collection: 'users' | 'properties' | 'agreements') => {
    setExportingCollection(collection);
    try {
      const response = await api.get(`/superadmin/export/${collection}?format=csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reside-${collection}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${collection} CSV`);
    } catch (err: any) {
      toast.error(`Failed to export ${collection} CSV`);
    } finally {
      setExportingCollection(null);
    }
  };

  const tabs: Array<{ id: ExecutiveTab; label: string; icon: any; badge?: number | null }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3, badge: null },
    { id: 'admins', label: 'Admin Governance', icon: ShieldCheck, badge: admins.length },
    { id: 'users', label: 'Global Users', icon: Users, badge: users.length || overview.totalUsers },
    { id: 'oversight', label: 'Properties & Exports', icon: Building2, badge: properties.length || overview.totalProperties },
    { id: 'audit', label: 'Audit Logs & Controls', icon: Settings2, badge: null },
  ];

  return (
    <div className="relative z-10 w-full max-w-none min-h-[calc(100vh-60px)] bg-slate-50/70 dark:bg-slate-950/60 pb-24">
      <div className="w-full max-w-none px-3 sm:px-4 pt-2 pb-24 space-y-3">
        {/* Compact Executive Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3.5 py-2.5 shadow-sm backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Super Admin Control Center
              </h1>
              <Badge className="bg-blue-600 text-white border-0 font-bold px-2 py-0.5 text-[10px] shadow-xs">
                Root
              </Badge>
              {systemSettings.maintenanceMode && (
                <Badge variant="destructive" className="rounded-full text-[10px] px-2 py-0.5 font-semibold">
                  Maintenance Mode Active
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="h-8.5 rounded-lg bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 text-slate-600 dark:text-slate-300 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateAdminOpen(true)}
              className="h-8.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm gap-1 cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Admin
            </Button>
          </div>
        </div>

        {/* Sleek Sub-Navigation Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border shrink-0 ${active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-blue-600 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700'
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Persistent Sub-view Header / Back Button when not in Overview */}
        {activeTab !== 'overview' && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('overview')}
              className="h-8.5 rounded-lg bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <span>Back to Overview</span>
            </Button>
          </div>
        )}

        {/* TAB 1: EXECUTIVE OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* 6 Top KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Users</span>
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.totalUsers}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{overview.totalRegularUsers} regular users</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Admins</span>
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.totalAdmins}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Delegated admins</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Verified Users</span>
                    <MailCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.verifiedUsers}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Email / Phone verified</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Properties</span>
                    <Building2 className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.totalProperties}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {overview.vacantProperties} vacant · {overview.occupiedProperties} occupied
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Agreements</span>
                    <FileText className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.totalAgreements}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{overview.totalMaintenanceRequests} maintenance tickets</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Suspended</span>
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '—' : overview.suspendedUsers}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Blocked accounts</p>
                </CardContent>
              </Card>
            </div>

            {/* 3 Analytics Cards */}
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                  <CardHeader className="p-3.5 pb-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">User Role Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-1 space-y-2.5">
                    <BreakdownBar
                      label="Tenants / Customers"
                      value={analytics.roleBreakdown.tenants}
                      total={analytics.roleBreakdown.total}
                      colorClass="bg-blue-600"
                    />
                    <BreakdownBar
                      label="Landlords / Builders"
                      value={analytics.roleBreakdown.landlords}
                      total={analytics.roleBreakdown.total}
                      colorClass="bg-sky-500"
                    />
                    <BreakdownBar
                      label="Admins"
                      value={analytics.roleBreakdown.admins}
                      total={analytics.roleBreakdown.total}
                      colorClass="bg-indigo-600"
                    />
                    <BreakdownBar
                      label="Super Admins"
                      value={analytics.roleBreakdown.superadmins}
                      total={analytics.roleBreakdown.total}
                      colorClass="bg-emerald-600"
                    />
                  </CardContent>
                </Card>

                <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                  <CardHeader className="p-3.5 pb-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Property &amp; Verification Health</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-1 space-y-2.5">
                    <BreakdownBar
                      label="Occupied Properties"
                      value={analytics.propertyStats.occupied}
                      total={analytics.propertyStats.total}
                      colorClass="bg-amber-500"
                    />
                    <BreakdownBar
                      label="Vacant Properties"
                      value={analytics.propertyStats.vacant}
                      total={analytics.propertyStats.total}
                      colorClass="bg-emerald-500"
                    />
                    <BreakdownBar
                      label="Email Verified Users"
                      value={analytics.verificationStats.emailVerified}
                      total={analytics.roleBreakdown.total}
                      colorClass="bg-blue-600"
                    />
                    <BreakdownBar
                      label="Phone / KYC Verified"
                      value={analytics.verificationStats.phoneVerified + analytics.verificationStats.aadhaarVerified}
                      total={analytics.roleBreakdown.total * 2}
                      colorClass="bg-indigo-500"
                    />
                  </CardContent>
                </Card>

                <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
                  <CardHeader className="p-3.5 pb-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">30-Day Platform Growth</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-1">
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.growthTrends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="users" name="New Users" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.35} />
                          <Area type="monotone" dataKey="properties" name="New Listings" stroke="#0d9488" fill="#5eead4" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Admin & Recent Activity Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Delegated Admin Team Card */}
              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm flex flex-col justify-between">
                <div>
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 pb-2.5 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Delegated Admin Team
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Active platform administrators</p>
                    </div>
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold">
                      {admins.length} {admins.length === 1 ? 'Admin' : 'Admins'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {admins.length === 0 ? (
                      <div className="text-center py-5 text-xs text-slate-500">
                        No delegated admin accounts yet. Click "Create Admin" to add one.
                      </div>
                    ) : (
                      admins.slice(0, 4).map((adm) => {
                        const isSuspended = Boolean(adm.isSuspended || adm.blocked);
                        return (
                          <div
                            key={adm._id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs">
                                {adm.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                                  {adm.name}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">{adm.email}</div>
                              </div>
                            </div>
                            <Badge
                              variant={isSuspended ? 'destructive' : 'default'}
                              className={`text-[10px] rounded-full shrink-0 font-semibold ${!isSuspended ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''
                                }`}
                            >
                              {isSuspended ? 'Suspended' : 'Active'}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </div>
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('admins')}
                    className="h-8 text-xs rounded-lg font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                  >
                    Manage All Admins
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setCreateAdminOpen(true)}
                    className="h-8 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm cursor-pointer"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Create Admin
                  </Button>
                </div>
              </Card>

              {/* Recent Platform Activity & Audit Logs Card */}
              <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm flex flex-col justify-between">
                <div>
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 pb-2.5 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <Activity className="h-4 w-4 text-blue-600" />
                        Recent Platform Activity
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time administrative &amp; security audit trail</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold border-slate-300">
                      Live Stream
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-5 text-xs text-slate-500">
                        No audit activities recorded yet.
                      </div>
                    ) : (
                      auditLogs.slice(0, 5).map((log) => (
                        <div
                          key={log._id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-100"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                                {log.actorName}
                              </span>
                              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 text-[10px] font-mono mr-1">
                                {log.action}
                              </Badge>
                              <span className="text-slate-500 capitalize">({log.targetType})</span>
                            </div>
                          </div>
                          <span className="text-slate-400 text-[11px] shrink-0 ml-2 font-medium">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </div>
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('audit')}
                    className="h-8 text-xs rounded-lg font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                  >
                    View Full Audit Trail
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN GOVERNANCE */}
        {activeTab === 'admins' && (
          <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="w-full min-w-0">
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                    <span>Admin Governance Roster</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Exclusive Super Admin controls: create admins, demote to user, force-reset passwords, suspend, or delete.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setCreateAdminOpen(true)}
                  className="h-8.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Create Admin
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Admin</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Email</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Phone</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                      <TableHead className="text-right font-bold text-slate-800 dark:text-slate-200">Governance Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                          No delegated admin accounts yet. Click "Create Admin" or promote a user from Global Users Directory.
                        </TableCell>
                      </TableRow>
                    ) : (
                      admins.map((admin) => {
                        const suspended = Boolean(admin.isSuspended || admin.blocked);
                        const isBusy = busyActionId === admin._id;
                        return (
                          <TableRow key={admin._id} className="hover:bg-slate-50/60">
                            <TableCell className="font-bold text-slate-900 dark:text-white">
                              <div>{admin.name}</div>
                              {admin.username && <div className="text-xs text-slate-500 font-normal">@{admin.username}</div>}
                            </TableCell>
                            <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{admin.email}</TableCell>
                            <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{admin.phone || '—'}</TableCell>
                            <TableCell>
                              {suspended ? (
                                <Badge variant="destructive" className="rounded-full font-semibold">Suspended</Badge>
                              ) : (
                                <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => {
                                  setResetTarget(admin);
                                  setTempPassword('');
                                }}
                                className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                              >
                                <KeyRound className="mr-1 h-3.5 w-3.5 text-slate-600" />
                                Reset Password
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleRoleChange(admin._id, 'user')}
                                className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                              >
                                <UserMinus className="mr-1 h-3.5 w-3.5 text-slate-600" />
                                Demote
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleToggleSuspend(admin)}
                                className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                              >
                                {suspended ? (
                                  <>
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                    Activate
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-1 h-3.5 w-3.5 text-amber-600" />
                                    Suspend
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleDeleteUser(admin)}
                                className="h-8 rounded-lg text-xs font-semibold bg-white text-rose-600 border border-rose-200 shadow-sm hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: GLOBAL USERS DIRECTORY */}
        {activeTab === 'users' && (
          <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="w-full min-w-0">
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Users className="h-5 w-5 text-blue-600 shrink-0" />
                    <span>Global Users Directory</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Inspect verification status (Email, Phone, KYC), promote to Admin, force-reset passwords, or suspend.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search name, username, email..."
                      className="pl-8 h-9 rounded-lg text-xs bg-white/95 border-slate-200/90 shadow-2xs w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center gap-2 pt-3 flex-wrap">
                <span className="text-xs text-slate-600 font-bold mr-1">Filter by:</span>
                {[
                  { id: 'all', label: 'All Users', count: users.length },
                  { id: 'tenants', label: 'Tenants' },
                  { id: 'landlords', label: 'Landlords' },
                  { id: 'admins', label: 'Admins', count: admins.length },
                  { id: 'suspended', label: 'Suspended', count: overview.suspendedUsers },
                ].map((pill) => {
                  const active = roleFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setRoleFilter(pill.id as any)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors border ${active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-sm hover:border-blue-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700'
                        }`}
                    >
                      <span>{pill.label}</span>
                      {typeof pill.count === 'number' && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                          {pill.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">User</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Contact</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Verification</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Role</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                      <TableHead className="text-right font-bold text-slate-800 dark:text-slate-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 font-medium">
                          No users match your filter criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => {
                        const suspended = Boolean(u.isSuspended || u.blocked);
                        const isSuper = u.role === 'superadmin';
                        const isAdminRow = u.role === 'admin';
                        const isBusy = busyActionId === u._id;

                        return (
                          <TableRow key={u._id} className="hover:bg-slate-50/60">
                            <TableCell className="font-bold text-slate-900 dark:text-white">
                              <div>{u.name}</div>
                              {u.username && <div className="text-xs text-slate-500 font-normal">@{u.username}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.email}</div>
                              <div className="text-xs text-slate-500 font-medium">{u.phone || 'No phone'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant={u.isEmailVerified ? 'default' : 'secondary'} className="text-[10px] rounded-full font-semibold">
                                  Email {u.isEmailVerified ? '✓' : '✗'}
                                </Badge>
                                <Badge variant={u.isPhoneVerified ? 'default' : 'secondary'} className="text-[10px] rounded-full font-semibold">
                                  Phone {u.isPhoneVerified ? '✓' : '✗'}
                                </Badge>
                                <Badge variant={u.isAadhaarVerified ? 'default' : 'secondary'} className="text-[10px] rounded-full font-semibold">
                                  KYC {u.isAadhaarVerified ? '✓' : '✗'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isSuper ? (
                                <Badge className="rounded-full bg-blue-600 text-white font-bold">superadmin</Badge>
                              ) : isAdminRow ? (
                                <Badge className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                                  admin
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="rounded-full font-semibold">
                                  {u.registrationPurpose || u.role}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {suspended ? (
                                <Badge variant="destructive" className="rounded-full font-semibold">Suspended</Badge>
                              ) : (
                                <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                              {isSuper ? (
                                <span className="text-xs text-slate-400 italic font-medium">Protected</span>
                              ) : (
                                <>
                                  {!isAdminRow ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusy}
                                      onClick={() => handleRoleChange(u._id, 'admin')}
                                      className="h-8 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-100 cursor-pointer"
                                    >
                                      <UserCheck className="mr-1 h-3.5 w-3.5" />
                                      Promote
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusy}
                                      onClick={() => handleRoleChange(u._id, 'user')}
                                      className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                                    >
                                      <UserMinus className="mr-1 h-3.5 w-3.5" />
                                      Demote
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setResetTarget(u);
                                      setTempPassword('');
                                    }}
                                    title="Force Reset Password"
                                    className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer px-2.5"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleToggleSuspend(u)}
                                    className="h-8 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                                  >
                                    {suspended ? 'Activate' : 'Suspend'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleDeleteUser(u)}
                                    className="h-8 rounded-lg text-xs font-semibold bg-white text-rose-600 border border-rose-200 shadow-sm hover:bg-rose-50 cursor-pointer px-2.5"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: PLATFORM OVERSIGHT & CSV EXPORT */}
        {activeTab === 'oversight' && (
          <div className="space-y-3">
            {/* CSV Export Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-sm">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Bulk Platform Data Export (CSV)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportingCollection === 'users'}
                  onClick={() => handleExportCsv('users')}
                  className="h-8.5 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  Export Users CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportingCollection === 'properties'}
                  onClick={() => handleExportCsv('properties')}
                  className="h-8.5 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  Export Properties CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportingCollection === 'agreements'}
                  onClick={() => handleExportCsv('agreements')}
                  className="h-8.5 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  Export Agreements CSV
                </Button>
              </div>
            </div>

            <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="w-full min-w-0">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
                      <span>Global Properties, Agreements &amp; Maintenance</span>
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Platform-wide management: force verify, force delete listings, inspect active agreements.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 p-1 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setOversightSubTab('properties')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${oversightSubTab === 'properties'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700'
                        }`}
                    >
                      Listings ({properties.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOversightSubTab('agreements')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${oversightSubTab === 'agreements'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700'
                        }`}
                    >
                      Agreements ({agreements.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOversightSubTab('maintenance')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${oversightSubTab === 'maintenance'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-2xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700'
                        }`}
                    >
                      Maintenance ({maintenanceRequests.length})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {oversightSubTab === 'properties' && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Property</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Type / Price</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Owner Contact</TableHead>
                          <TableHead className="text-right font-bold text-slate-800 dark:text-slate-200">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {properties.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                              No properties found on the platform.
                            </TableCell>
                          </TableRow>
                        ) : (
                          properties.map((prop) => {
                            const isOccupied = prop.occupancyStatus === 'occupied' || Boolean(prop.tenant);
                            const ownerName = prop.owner?.name || prop.owner?.fullName || 'Unknown Owner';
                            const isBusy = busyActionId === prop._id;
                            return (
                              <TableRow key={prop._id} className="hover:bg-slate-50/60">
                                <TableCell>
                                  <div className="font-bold text-slate-900 dark:text-white">{prop.title}</div>
                                  <div className="text-xs text-slate-500 font-medium">{prop.location}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-bold text-slate-900 dark:text-white">₹{Number(prop.price || 0).toLocaleString()}</div>
                                  <div className="text-xs text-slate-500 capitalize font-medium">{prop.transactionType}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      className={`rounded-full font-semibold ${prop.status === 'approved'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                    >
                                      {prop.status || 'pending'}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full font-semibold border-slate-300">
                                      {isOccupied ? 'Occupied' : 'Vacant'}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ownerName}</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
                                    {prop.owner?.phone && (
                                      <a
                                        href={`tel:${prop.owner.phone.replace(/\s+/g, '')}`}
                                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                                      >
                                        <Phone className="h-3 w-3" /> {prop.owner.phone}
                                      </a>
                                    )}
                                    {prop.owner?.email && <span>{prop.owner.email}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right space-x-2 whitespace-nowrap">
                                  {prop.status !== 'approved' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusy}
                                      onClick={() => handleForceVerifyProperty(prop)}
                                      className="h-8 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-100 cursor-pointer"
                                    >
                                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                      Force Verify
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleRemoveProperty(prop)}
                                    className="h-8 rounded-lg text-xs font-semibold bg-white text-rose-600 border border-rose-200 shadow-sm hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remove Listing
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {oversightSubTab === 'agreements' && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Property</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Owner</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Tenant</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Monthly Rent</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agreements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                              No rental agreements found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          agreements.map((ag) => (
                            <TableRow key={ag._id} className="hover:bg-slate-50/60">
                              <TableCell className="font-bold text-slate-900 dark:text-white">{ag.property?.title || 'Property'}</TableCell>
                              <TableCell className="font-medium text-slate-700 dark:text-slate-300">{ag.owner?.name || ag.owner?.email || '—'}</TableCell>
                              <TableCell className="font-medium text-slate-700 dark:text-slate-300">{ag.tenant?.name || ag.tenant?.email || '—'}</TableCell>
                              <TableCell className="font-bold text-slate-900 dark:text-white">₹{Number(ag.monthlyRent || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-full capitalize font-semibold">
                                  {ag.status || 'active'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {oversightSubTab === 'maintenance' && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Issue</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Property</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Tenant</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Priority</TableHead>
                          <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {maintenanceRequests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                              No maintenance tickets found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          maintenanceRequests.map((m) => (
                            <TableRow key={m._id} className="hover:bg-slate-50/60">
                              <TableCell className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{m.title || m.description || 'Maintenance Request'}</span>
                              </TableCell>
                              <TableCell className="font-medium text-slate-700 dark:text-slate-300">{m.property?.title || '—'}</TableCell>
                              <TableCell className="font-medium text-slate-700 dark:text-slate-300">{m.tenant?.name || m.tenant?.email || '—'}</TableCell>
                              <TableCell className="capitalize font-semibold text-slate-800 dark:text-slate-200">{m.priority || 'normal'}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-full capitalize font-semibold">
                                  {m.status || 'pending'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 5: SECURITY AUDIT LOGS & SYSTEM CONTROLS */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            {/* System Controls Card */}
            <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5 pb-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="w-full min-w-0">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Settings2 className="h-5 w-5 text-blue-600 shrink-0" />
                      <span>Global Platform System Controls</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Configure core platform access, maintenance states, and announcements in real-time.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 p-3.5 shadow-2xs">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Maintenance Mode</div>
                      <div className="text-xs text-slate-500 mt-0.5">Display maintenance banner platform-wide</div>
                    </div>
                    <Switch
                      checked={systemSettings.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSystemSettings((prev) => ({ ...prev, maintenanceMode: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 p-3.5 shadow-2xs">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Allow New Registrations</div>
                      <div className="text-xs text-slate-500 mt-0.5">Enable or pause public user signups</div>
                    </div>
                    <Switch
                      checked={systemSettings.allowNewRegistrations}
                      onCheckedChange={(checked) =>
                        setSystemSettings((prev) => ({ ...prev, allowNewRegistrations: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 p-3.5 shadow-2xs">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Require Phone Verification</div>
                      <div className="text-xs text-slate-500 mt-0.5">Require verified phone to post property</div>
                    </div>
                    <Switch
                      checked={systemSettings.requirePhoneVerificationForListing}
                      onCheckedChange={(checked) =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          requirePhoneVerificationForListing: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="banner-msg" className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                      <Megaphone className="h-3.5 w-3.5 text-blue-600" />
                      Platform Announcement Banner
                    </Label>
                    <Input
                      id="banner-msg"
                      value={systemSettings.globalBannerMessage}
                      onChange={(e) =>
                        setSystemSettings((prev) => ({ ...prev, globalBannerMessage: e.target.value }))
                      }
                      placeholder="Optional site-wide notice shown to users (leave blank to hide)"
                      className="bg-white/95 border-slate-200/90 shadow-2xs text-xs"
                    />
                  </div>
                  <Button
                    onClick={() => handleSaveSettings()}
                    disabled={savingSettings}
                    className="h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    {savingSettings ? 'Saving...' : 'Save System Controls'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Audit Logs Table */}
            <Card className="border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Security Audit Logs
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Immutable record of administrative and Super Admin actions across the platform.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                      <SelectTrigger className="w-52 h-9 rounded-lg bg-white text-slate-800 border border-slate-200 shadow-sm text-xs font-semibold">
                        <SelectValue placeholder="Filter action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        {uniqueAuditActions.map((act) => (
                          <SelectItem key={act} value={act}>
                            {act}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={auditRoleFilter} onValueChange={setAuditRoleFilter}>
                      <SelectTrigger className="w-36 h-9 rounded-lg bg-white text-slate-800 border border-slate-200 shadow-sm text-xs font-semibold">
                        <SelectValue placeholder="Actor role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="superadmin">superadmin</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/90 dark:bg-slate-800/60">
                        <TableHead className="font-bold text-slate-800 dark:text-slate-200">Timestamp</TableHead>
                        <TableHead className="font-bold text-slate-800 dark:text-slate-200">Actor</TableHead>
                        <TableHead className="font-bold text-slate-800 dark:text-slate-200">Action</TableHead>
                        <TableHead className="font-bold text-slate-800 dark:text-slate-200">Target</TableHead>
                        <TableHead className="font-bold text-slate-800 dark:text-slate-200">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAuditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                            No audit log entries recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAuditLogs.map((log) => (
                          <TableRow key={log._id} className="hover:bg-slate-50/60">
                            <TableCell className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">{log.actorName}</div>
                              <Badge variant="outline" className="text-[10px] rounded-full font-semibold border-slate-300">
                                {log.actorRole}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px] font-bold">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                              <span className="capitalize">{log.targetType}</span>
                              {log.targetId ? ` (${String(log.targetId).slice(-6)})` : ''}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate font-medium">
                              {log.details ? JSON.stringify(log.details) : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Admin Dialog */}
      <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Create New Admin Account
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Create a verified admin account with delegated administrative privileges.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-name" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Full Name</Label>
              <Input
                id="admin-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. John Doe"
                className="bg-white/95 border-slate-200 shadow-2xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-username" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Username (optional)</Label>
              <Input
                id="admin-username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="e.g. admin_john"
                className="bg-white/95 border-slate-200 shadow-2xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-white/95 border-slate-200 shadow-2xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-phone" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Phone Number (optional)</Label>
              <Input
                id="admin-phone"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="bg-white/95 border-slate-200 shadow-2xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="bg-white/95 border-slate-200 shadow-2xs"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateAdminOpen(false)}
                disabled={creatingAdmin}
                className="h-8.5 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingAdmin}
                className="h-8.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
              >
                {creatingAdmin ? 'Creating...' : 'Create Admin'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Force Password Reset Dialog */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Force Password Reset
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Set a temporary password for <strong>{resetTarget?.name}</strong> ({resetTarget?.email}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="temp-password" className="font-semibold text-xs text-slate-800 dark:text-slate-200">Temporary Password</Label>
              <Input
                id="temp-password"
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="bg-white/95 border-slate-200 shadow-2xs"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetTarget(null)}
                disabled={resettingPassword}
                className="h-8.5 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={resettingPassword}
                className="h-8.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
              >
                {resettingPassword ? 'Resetting...' : 'Set Temporary Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
