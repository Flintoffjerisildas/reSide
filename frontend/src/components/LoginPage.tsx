import { useState, useEffect } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { ArrowUpRight, Building2, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';

export type LoginView = 'login' | 'register' | 'register-otp' | 'forgot-email' | 'forgot-otp';

interface LoginPageProps {
  defaultView?: LoginView;
  onSuccess?: () => void;
  onNavigateView?: (view: LoginView) => void;
}

export default function LoginPage({
  defaultView = 'login',
  onSuccess,
  onNavigateView
}: LoginPageProps) {
  const { t } = useLanguage();
  const {
    login,
    register,
    verifyRegisterOtp,
    forgotPasswordStart,
    resetPasswordWithOtp,
    loading,
  } = useAuth();

  const [view, setView] = useState<LoginView>(defaultView);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [registrationPurpose, setRegistrationPurpose] = useState<string>('Customer');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const switchView = (newView: LoginView) => {
    setView(newView);
    onNavigateView?.(newView);
  };

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
      onSuccess?.();
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
    if (!email.trim() || !password.trim() || !name.trim() || !registrationPurpose) {
      toast.error(t('Please fill in all required fields', 'அனைத்து கட்டாய புலங்களையும் நிரப்பவும்'));
      return;
    }
    try {
      const data = await register(name, email, password, registrationPurpose);
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
      switchView('register-otp');
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
      switchView('login');
      onSuccess?.();
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
      switchView('forgot-otp');
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
      switchView('login');
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
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl transition-opacity duration-500 dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-teal-300/15 blur-3xl transition-opacity duration-500 dark:bg-teal-500/10" />

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px] lg:items-stretch">
        <aside className="glass-panel ambient-glow-login group relative hidden overflow-hidden rounded-[2rem] p-8 text-slate-900 shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:shadow-blue-900/25 md:block dark:text-white">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl transition-transform duration-700 group-hover:scale-125 dark:bg-blue-500/20" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl transition-transform duration-700 group-hover:scale-125 dark:bg-teal-400/15" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
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
                  className="glass-pill flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-300 hover:translate-x-1 hover:border-primary/40 dark:text-slate-200"
                >
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  <span>{text}</span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="glass-panel group relative w-full rounded-[2rem] shadow-2xl transition-all duration-500 hover:border-blue-400/50 hover:shadow-blue-900/20">
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
                    onClick={() => switchView('forgot-email')}
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
                  onClick={() => switchView('register')}
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
                  <Label htmlFor="register-purpose">
                    {t('Registration Purpose', 'பதிவு நோக்கம்')} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={registrationPurpose}
                    onValueChange={(value) => setRegistrationPurpose(value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="register-purpose">
                      <SelectValue placeholder={t('Select registration purpose', 'பதிவு நோக்கத்தைத் தேர்ந்தெடுக்கவும்')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">
                        {t('Owner', 'சொத்து உரிமையாளர்')}
                      </SelectItem>
                      <SelectItem value="Builder">
                        {t('Builder', 'கட்டுமான நிறுவனம்')}
                      </SelectItem>
                      <SelectItem value="Dealer">
                        {t('Dealer', 'முகவர் / டீலர்')}
                      </SelectItem>
                      <SelectItem value="Customer">
                        {t('Customer', 'வாடிக்கையாளர் / வாடகைதாரர்')}
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
                    onClick={() => switchView('login')}
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
                    onClick={() => switchView('login')}
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
                    onClick={() => switchView('login')}
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
                    onClick={() => switchView('login')}
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
