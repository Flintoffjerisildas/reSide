import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Header from './components/Header';
import Footer from './components/Footer';
import PropertyListings from './components/PropertyListings';
import FloatingChat from './components/FloatingChat';
import { AIProvider } from './contexts/AIContext';
import { PropertyProvider } from './contexts/PropertyContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { useGetCallerUserProfile, useIsCallerApproved } from './hooks/useQueries';
import OwnerDashboard from './components/OwnerDashboard';
import BrokerDashboard from './components/BrokerDashboard';
import CustomerDashboard from './components/CustomerDashboard';
import AdminDashboard from './components/AdminDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import { useQueryClient } from '@tanstack/react-query';
import { TamilRole } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { toast } from 'sonner';
import { AuthServiceAvailabilityProvider } from './contexts/AuthServiceContext';
import AuthServiceGate from './components/AuthServiceGate';
import { ArrowUpRight, Building2, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-lg font-medium text-foreground">Reside</p>
        <p className="text-sm text-muted-foreground">Initializing application...</p>
      </div>
    </div>
  );
}

function LoginPage() {
  const { t } = useLanguage();
  const {
    login,
    register,
    verifyRegisterOtp,
    forgotPasswordStart,
    resetPasswordWithOtp,
    loading,
  } = useAuth();

  const [view, setView] = useState<'login' | 'register' | 'register-otp' | 'forgot-email' | 'forgot-otp'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<TamilRole | ''>('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'register-otp' || view === 'forgot-otp') {
      setOtpCountdown(60);
    } else {
      setOtpCountdown(0);
      setDevOtp(null);
    }
  }, [view]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t('Please fill in all required fields', 'அனைத்து கட்டாய புலங்களையும் நிரப்பவும்'));
      return;
    }
    try {
      await login(email, password);
      toast.success(t('Logged in successfully', 'வெற்றிகரமாக உள்நுழைந்தது'));
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const text = typeof data === 'string' ? data : '';
      const looksLikeProxy =
        status === 500 && (text.toLowerCase().includes('proxy') || text.toLowerCase().includes('econnrefused'));
      const msg =
        looksLikeProxy || !error?.response
          ? t(
              'Backend server is not running. Start the server on port 5000 and try again.',
              'Backend server இயங்கவில்லை. Port 5000-ல் server-ஐ தொடங்கி மீண்டும் முயற்சிக்கவும்.'
            )
          : data?.msg || error?.message || t('Authentication failed', 'அங்கீகாரம் தோல்வியடைந்தது');
      toast.error(String(msg));
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !name.trim() || !role) {
      toast.error(t('Please fill in all required fields', 'அனைத்து கட்டாய புலங்களையும் நிரப்பவும்'));
      return;
    }
    try {
      const data = await register(name, email, password, role as string);
      setOtpEmail(email);
      if (data?.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      } else {
        setDevOtp(null);
        setOtp('');
      }
      toast.success(t('OTP sent to your email', 'OTP உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது'));
      setView('register-otp');
    } catch (error: any) {
      const msg =
        error?.response?.data?.msg ||
        error?.message ||
        t('Registration failed', 'பதிவு தோல்வியடைந்தது');
      toast.error(msg);
    }
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || !otp.trim()) {
      toast.error(t('Please enter the OTP', 'OTP-ஐ உள்ளிடவும்'));
      return;
    }
    try {
      await verifyRegisterOtp(otpEmail, otp.trim());
      toast.success(t('Account verified successfully', 'கணக்கு வெற்றிகரமாக சரிபார்க்கப்பட்டது'));
      setView('login');
    } catch (error: any) {
      const msg =
        error?.response?.data?.msg ||
        error?.message ||
        t('OTP verification failed', 'OTP சரிபார்ப்பு தோல்வியடைந்தது');
      toast.error(msg);
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('Please enter your email', 'உங்கள் மின்னஞ்சலை உள்ளிடவும்'));
      return;
    }
    try {
      const data = await forgotPasswordStart(email.trim());
      setOtpEmail(email.trim());
      if (data?.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      } else {
        setDevOtp(null);
        setOtp('');
      }
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success(
        t(
          'If this email is registered and verified, an OTP has been sent.',
          'இந்த மின்னஞ்சல் பதிவு செய்யப்பட்டு சரிபார்க்கப்பட்டிருந்தால், OTP அனுப்பப்பட்டுள்ளது.'
        )
      );
      setView('forgot-otp');
    } catch (error: any) {
      const msg =
        error?.response?.data?.msg ||
        error?.message ||
        t('Request failed', 'கோரிக்கை தோல்வியடைந்தது');
      toast.error(msg);
    }
  };

  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      toast.error(t('Please fill in all required fields', 'அனைத்து கட்டாய புலங்களையும் நிரப்பவும்'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error(t('New passwords do not match', 'புதிய கடவுச்சொற்கள் பொருந்தவில்லை'));
      return;
    }
    try {
      await resetPasswordWithOtp(otpEmail, otp.trim(), newPassword);
      toast.success(t('Password reset successfully', 'கடவுச்சொல் வெற்றிகரமாக மீட்டமைக்கப்பட்டது'));
      setView('login');
      setOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      const msg =
        error?.response?.data?.msg ||
        error?.message ||
        t('OTP verification failed', 'OTP சரிபார்ப்பு தோல்வியடைந்தது');
      toast.error(msg);
    }
  };

  const handleResendOtp = async () => {
    if (!otpEmail) return;
    if (otpCountdown > 0) return;
    try {
      const purpose = view === 'register-otp' ? 'register' : 'forgot';
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: otpEmail, purpose }),
      });
      const data = await response.json();
      if (data?.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      }
      toast.success(t('OTP resent successfully', 'OTP மீண்டும் அனுப்பப்பட்டது'));
      setOtpCountdown(60);
    } catch (error: any) {
      toast.error(t('Failed to resend OTP', 'OTP-ஐ மீண்டும் அனுப்ப முடியவில்லை'));
    }
  };

  const title =
    view === 'login'
      ? t('Login', 'உள்நுழைய')
      : view === 'register'
        ? t('Register', 'பதிவு செய்யுங்கள்')
        : view === 'register-otp'
          ? t('Verify Email', 'மின்னஞ்சலை சரிபார்க்கவும்')
          : view === 'forgot-email'
            ? t('Forgot Password', 'கடவுச்சொல் மறந்துவிட்டதா')
            : t('Reset Password', 'கடவுச்சொல்லை மீட்டமைக்கவும்');

  const description =
    view === 'login'
      ? t('Enter your credentials to access your account', 'உங்கள் கணக்கை அணுக உங்கள் சான்றுகளை உள்ளிடவும்')
      : view === 'register'
        ? t('Create your account to access Reside features', 'Reside அம்சங்களை அணுக உங்கள் கணக்கை உருவாக்கவும்')
        : view === 'register-otp'
          ? t('Enter the OTP sent to your email to verify your account', 'உங்கள் கணக்கை சரிபார்க்க உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்ட OTP-ஐ உள்ளிடவும்')
          : view === 'forgot-email'
            ? t('Enter your registered email to reset your password', 'கடவுச்சொல்லை மீட்டமைக்க உங்கள் பதிவு செய்யப்பட்ட மின்னஞ்சலை உள்ளிடவும்')
            : t('Enter the OTP and your new password', 'OTP மற்றும் உங்கள் புதிய கடவுச்சொல்லை உள்ளிடவும்');

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-background to-teal-50/50 px-4 py-10 dark:from-[#081426] dark:via-background dark:to-[#102d3d]">
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl transition-opacity duration-500 dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl transition-opacity duration-500 dark:bg-teal-500/10" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-t-[3rem] bg-white/45 backdrop-blur-3xl dark:bg-[#0c1a2b]/55" />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px] lg:items-stretch">
        <aside className="group relative hidden overflow-hidden rounded-[2rem] border border-blue-100/80 bg-gradient-to-br from-white via-blue-50 to-teal-50 p-8 text-slate-900 shadow-2xl shadow-blue-950/15 transition-all duration-500 hover:-translate-y-1 hover:shadow-blue-900/25 md:block dark:border-blue-900/60 dark:bg-none dark:bg-slate-950 dark:text-white">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl transition-transform duration-700 group-hover:scale-125 dark:bg-blue-500/30" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-teal-300/25 blur-3xl transition-transform duration-700 group-hover:scale-125 dark:bg-teal-400/20" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-blue-600 dark:text-blue-300">
              {t('Welcome to Reside', 'Reside-க்கு வரவேற்கிறோம்')}
            </p>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
              {t('A better way to find your next place.', 'உங்கள் அடுத்த இடத்தை கண்டுபிடிக்க சிறந்த வழி.')}
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t(
                'Explore verified homes, connect with trusted people, and make your next move with confidence.',
                'சரிபார்க்கப்பட்ட வீடுகளை ஆராய்ந்து, நம்பகமானவர்களுடன் இணைந்து, நம்பிக்கையுடன் உங்கள் அடுத்த நகர்வை மேற்கொள்ளுங்கள்.'
              )}
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: CheckCircle2, text: t('Verified properties', 'சரிபார்க்கப்பட்ட சொத்துகள்') },
              { icon: KeyRound, text: t('Simple, secure access', 'எளிய, பாதுகாப்பான அணுகல்') },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 rounded-2xl border border-blue-200/70 bg-white/65 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur transition-all duration-300 hover:translate-x-1 hover:border-blue-300 hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:border-blue-300/40 dark:hover:bg-white/15"
              >
                <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                <span>{text}</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-slate-400" />
              </div>
            ))}
          </div>
        </div>
        </aside>

        <div className="group relative w-full rounded-[2rem] border border-blue-100/70 bg-card/95 shadow-2xl shadow-blue-950/10 backdrop-blur transition-all duration-500 hover:border-blue-300/80 hover:shadow-blue-900/20 dark:border-blue-900/60 dark:shadow-black/30 dark:hover:border-blue-700/80">
        <div className="pointer-events-none absolute right-6 top-6 text-blue-500/20 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="flex flex-col items-center px-8 pt-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">{description}</p>
        </div>
        <div className="px-8 pb-8 pt-6">
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">
                  {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">
                  {t('Password', 'கடவுச்சொல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setView('forgot-email')}
                  disabled={loading}
                  className="text-xs font-medium text-sky-600 transition-colors hover:text-sky-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {t('Forgot password?', 'கடவுச்சொல் மறந்துவிட்டதா?')}
                </button>
              </div>

              <Button type="submit" className="mt-2 w-full rounded-full bg-sky-600 shadow-lg shadow-sky-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-sky-600/35" disabled={loading}>
                {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Login', 'உள்நுழைய')}
              </Button>

              <button
                type="button"
                onClick={() => setView('register')}
                disabled={loading}
                className="mt-2 w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("Don't have an account? Register", "கணக்கு இல்லையா? பதிவு செய்யுங்கள்")}
              </button>
            </form>
          )}

          {view === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="register-name">
                  {t('Name', 'பெயர்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="register-name"
                  placeholder={t('Enter your name', 'உங்கள் பெயரை உள்ளிடவும்')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="register-email">
                  {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="register-password">
                  {t('Password', 'கடவுச்சொல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="register-role">
                  {t('Role', 'பாத்திரம்')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as TamilRole)}
                  disabled={loading}
                >
                  <SelectTrigger id="register-role">
                    <SelectValue placeholder={t('Select a role', 'பாத்திரத்தை தேர்ந்தெடுக்கவும்')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TamilRole.admin}>
                      {t('Admin', 'நிர்வாகம்')}
                    </SelectItem>
                    <SelectItem value={TamilRole.owners}>
                      {t('Owner', 'உரிமையாளர்')}
                    </SelectItem>
                    <SelectItem value={TamilRole.brokersBuilders}>
                      {t('Broker/Builder', 'தரகர்/கட்டுபவர்')}
                    </SelectItem>
                    <SelectItem value={TamilRole.customers}>
                      {t('Customer (Tenant/Buyer)', 'வாடிக்கையாளர்')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Register', 'பதிவு')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setView('login')}
                  disabled={loading}
                >
                  {t('Already have an account? Login', 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைய')}
                </Button>
              </div>
            </form>
          )}

          {view === 'register-otp' && (
            <form onSubmit={handleVerifyRegisterOtp} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="register-otp">
                  {t('OTP', 'OTP')} <span className="text-destructive">*</span>
                </Label>
                {devOtp && (
                  <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-2.5 text-xs text-blue-400 flex items-center justify-between">
                    <span>
                      {t('OTP Code:', 'OTP குறியீடு:')}{' '}
                      <strong className="font-mono text-sm tracking-widest">{devOtp}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-xs underline font-medium hover:text-blue-300"
                      onClick={() => setOtp(devOtp)}
                    >
                      {t('Autofill', 'தானாக நிரப்பு')}
                    </button>
                  </div>
                )}
                <Input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {otpCountdown > 0
                    ? t('Resend OTP in', 'OTP-ஐ மீண்டும் அனுப்ப') + ` ${otpCountdown}s`
                    : t('You can resend OTP now', 'நீங்கள் இப்போது OTP-ஐ மீண்டும் அனுப்பலாம்')}
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Verify OTP', 'OTP-ஐ சரிபார்க்கவும்')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOtp}
                  disabled={loading || otpCountdown > 0}
                >
                  {t('Resend OTP', 'OTP-ஐ மீண்டும் அனுப்பவும்')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setView('login')}
                  disabled={loading}
                >
                  {t('Back to login', 'உள்நுழைவுக்கு திரும்புங்கள்')}
                </Button>
              </div>
            </form>
          )}

          {view === 'forgot-email' && (
            <form onSubmit={handleForgotEmailSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="forgot-email">
                  {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Send OTP', 'OTP-ஐ அனுப்பவும்')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setView('login')}
                  disabled={loading}
                >
                  {t('Back to login', 'உள்நுழைவுக்கு திரும்புங்கள்')}
                </Button>
              </div>
            </form>
          )}

          {view === 'forgot-otp' && (
            <form onSubmit={handleForgotOtpSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="forgot-otp">
                  {t('OTP', 'OTP')} <span className="text-destructive">*</span>
                </Label>
                {devOtp && (
                  <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-2.5 text-xs text-blue-400 flex items-center justify-between">
                    <span>
                      {t('OTP Code:', 'OTP குறியீடு:')}{' '}
                      <strong className="font-mono text-sm tracking-widest">{devOtp}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-xs underline font-medium hover:text-blue-300"
                      onClick={() => setOtp(devOtp)}
                    >
                      {t('Autofill', 'தானாக நிரப்பு')}
                    </button>
                  </div>
                )}
                <Input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {otpCountdown > 0
                    ? t('Resend OTP in', 'OTP-ஐ மீண்டும் அனுப்ப') + ` ${otpCountdown}s`
                    : t('You can resend OTP now', 'நீங்கள் இப்போது OTP-ஐ மீண்டும் அனுப்பலாம்')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">
                  {t('New Password', 'புதிய கடவுச்சொல்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-new-password">
                  {t('Confirm New Password', 'புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Reset Password', 'கடவுச்சொல்லை மீட்டமைக்கவும்')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOtp}
                  disabled={loading || otpCountdown > 0}
                >
                  {t('Resend OTP', 'OTP-ஐ மீண்டும் அனுப்பவும்')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setView('login')}
                  disabled={loading}
                >
                  {t('Back to login', 'உள்நுழைவுக்கு திரும்புங்கள்')}
                </Button>
              </div>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isInitializing: authInitializing, logout } = useAuth();
  const { data: userProfile, isLoading: profileLoading, isFetched: profileFetched } = useGetCallerUserProfile();
  const { data: isApproved, isLoading: approvalLoading } = useIsCallerApproved();
  const queryClient = useQueryClient();
  const [showDashboard, setShowDashboard] = useState(() => !!localStorage.getItem('token'));
  const [showLoginPage, setShowLoginPage] = useState(false);

  const isAuthenticated = !!user;
  
  const showPendingApproval = isAuthenticated && userProfile && !approvalLoading && isApproved === false;

  // Use userProfile from query or fallback to auth user context
  const roleToCheck = userProfile?.role || user?.role;
  const internalRoleToCheck = (userProfile as any)?.internalRole || (user as any)?.internalRole;

  const isAdmin = internalRoleToCheck === 'admin';
  const isOwner = roleToCheck === TamilRole.owners || roleToCheck === 'owners' || roleToCheck === 'Owner';
  const isBroker = roleToCheck === TamilRole.brokersBuilders || roleToCheck === 'brokersBuilders' || roleToCheck === 'Broker' || roleToCheck === 'Builder';
  const isCustomer = roleToCheck === TamilRole.customers || roleToCheck === 'customers' || roleToCheck === 'Customer' || roleToCheck === 'Tenant' || roleToCheck === 'Buyer';

  console.log('Debug App State:', {
    isAuthenticated,
    userProfile,
    role: userProfile?.role,
    isApproved,
    showPendingApproval,
    isOwner,
    isBroker,
    isCustomer
  });

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };
  
  const handleLoginClick = () => {
    setShowDashboard(false);
    setShowLoginPage(true);
  };
  
  const handleDashboardClick = () => {
    setShowDashboard(prev => !prev);
  };

  const handleHomeClick = () => {
    setShowDashboard(false);
    setShowLoginPage(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setShowLoginPage(false);
      setShowDashboard(true);
    }
  }, [isAuthenticated]);

  // Show loading screen while initializing (but not when bypass is active)
  if (authInitializing || (isAuthenticated && profileLoading)) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header 
        onLogout={handleLogout}
        onDashboardClick={handleDashboardClick}
        onHomeClick={handleHomeClick}
        onLoginClick={handleLoginClick}
        isDashboardActive={showDashboard}
      />
      <main className="flex-1">
        {showPendingApproval ? (
          <PendingApprovalScreen />
        ) : showDashboard && isAuthenticated ? (
          isAdmin ? (
            <AdminDashboard />
          ) : isOwner ? (
            <OwnerDashboard />
          ) : isBroker ? (
            <BrokerDashboard />
          ) : isCustomer ? (
            <CustomerDashboard />
          ) : (
            <div className="flex h-[50vh] items-center justify-center flex-col gap-4">
              <p className="text-lg font-medium text-muted-foreground">
                Dashboard not available for your role ({String(roleToCheck || 'Unknown')}).
              </p>
              <p className="text-sm text-muted-foreground">Please contact support if this is an error.</p>
            </div>
          )
        ) : showLoginPage && !isAuthenticated ? (
          <LoginPage />
        ) : (
          <PropertyListings />
        )}
        <FloatingChat />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <AuthServiceAvailabilityProvider>
          <AuthServiceGate>
            <PropertyProvider>
              <AIProvider>
                <AppContent />
                <Toaster />
              </AIProvider>
            </PropertyProvider>
          </AuthServiceGate>
        </AuthServiceAvailabilityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
