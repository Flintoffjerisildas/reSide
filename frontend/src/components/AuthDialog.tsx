import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { TamilRole } from '../types';
import { toast } from 'sonner';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { t } = useLanguage();
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
  
  const { login, register, verifyRegisterOtp, forgotPasswordStart, resetPasswordWithOtp, loading } = useAuth();

  useEffect(() => {
    if (open) {
      setView('login');
      setName('');
      setEmail('');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtp('');
      setRole('');
      setOtpEmail('');
      setOtpCountdown(0);
    }
  }, [open]);

  useEffect(() => {
    if (view === 'register-otp' || view === 'forgot-otp') {
      setOtpCountdown(60);
    } else {
      setOtpCountdown(0);
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
      onOpenChange(false);
    } catch (error: any) {
      console.error('Auth error:', error);
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
          : data?.msg || error.message || t('Authentication failed', 'அங்கீகாரம் தோல்வியடைந்தது');
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
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      } else {
        setOtp('');
      }
      toast.success(t('OTP sent to your email', 'OTP உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது'));
      setView('register-otp');
    } catch (error: any) {
      console.error('Register error:', error);
      const msg = error.response?.data?.msg || error.message || t('Registration failed', 'பதிவு தோல்வியடைந்தது');
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
      onOpenChange(false);
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const msg = error.response?.data?.msg || error.message || t('OTP verification failed', 'OTP சரிபார்ப்பு தோல்வியடைந்தது');
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
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      } else {
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
      console.error('Forgot password error:', error);
      const msg = error.response?.data?.msg || error.message || t('Request failed', 'கோரிக்கை தோல்வியடைந்தது');
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
      console.error('Reset password error:', error);
      const msg = error.response?.data?.msg || error.message || t('OTP verification failed', 'OTP சரிபார்ப்பு தோல்வியடைந்தது');
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
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: otpEmail, purpose })
      });
      const data = await response.json();
      if (data?.devOtp) {
        setOtp(data.devOtp);
        toast.info(t(`OTP: ${data.devOtp}`, `OTP: ${data.devOtp}`), { duration: 10000 });
      }
      toast.success(t('OTP resent successfully', 'OTP மீண்டும் அனுப்பப்பட்டது'));
      setOtpCountdown(60);
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      toast.error(t('Failed to resend OTP', 'OTP-ஐ மீண்டும் அனுப்ப முடியவில்லை'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {view === 'login'
              ? t('Login', 'உள்நுழைய')
              : view === 'register'
                ? t('Register', 'பதிவு செய்யுங்கள்')
                : view === 'register-otp'
                  ? t('Verify Email', 'மின்னஞ்சலை சரிபார்க்கவும்')
                  : view === 'forgot-email'
                    ? t('Forgot Password', 'கடவுச்சொல் மறந்துவிட்டதா')
                    : t('Reset Password', 'கடவுச்சொல்லை மீட்டமைக்கவும்')}
          </DialogTitle>
          <DialogDescription>
            {view === 'login'
              ? t('Enter your credentials to access your account', 'உங்கள் கணக்கை அணுக உங்கள் சான்றுகளை உள்ளிடவும்')
              : view === 'register'
                ? t('Create your account to access Reside features', 'Reside அம்சங்களை அணுக உங்கள் கணக்கை உருவாக்கவும்')
                : view === 'register-otp'
                  ? t('Enter the OTP sent to your email to verify your account', 'உங்கள் கணக்கை சரிபார்க்க உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்ட OTP-ஐ உள்ளிடவும்')
                  : view === 'forgot-email'
                    ? t('Enter your registered email to reset your password', 'கடவுச்சொல்லை மீட்டமைக்க உங்கள் பதிவு செய்யப்பட்ட மின்னஞ்சலை உள்ளிடவும்')
                    : t('Enter the OTP and your new password', 'OTP மற்றும் உங்கள் புதிய கடவுச்சொல்லை உள்ளிடவும்')}
          </DialogDescription>
        </DialogHeader>
        
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">
                {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">
                {t('Password', 'கடவுச்சொல்')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Button type="submit" disabled={loading}>
                {loading ? t('Processing...', 'செயலாக்குகிறது...') : t('Login', 'உள்நுழைய')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setView('register')}
                disabled={loading}
              >
                {t("Don't have an account? Register", "கணக்கு இல்லையா? பதிவு செய்யுங்கள்")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setView('forgot-email')}
                disabled={loading}
              >
                {t('Forgot password?', 'கடவுச்சொல் மறந்துவிட்டதா?')}
              </Button>
            </div>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                {t('Name', 'பெயர்')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder={t('Enter your name', 'உங்கள் பெயரை உள்ளிடவும்')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">
                {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">
                {t('Password', 'கடவுச்சொல்')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">
                {t('Role', 'பாத்திரம்')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as TamilRole)}
                disabled={loading}
              >
                <SelectTrigger>
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
          <form onSubmit={handleVerifyRegisterOtp} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="otp">
                {t('OTP', 'OTP')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="otp"
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
          <form onSubmit={handleForgotEmailSubmit} className="grid gap-4 py-4">
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
          <form onSubmit={handleForgotOtpSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="forgot-otp">
                {t('OTP', 'OTP')} <span className="text-destructive">*</span>
              </Label>
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
      </DialogContent>
    </Dialog>
  );
}
