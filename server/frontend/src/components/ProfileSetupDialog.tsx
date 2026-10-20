import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegisterUser, useGetCallerUserProfile } from '../hooks/useQueries';
import { toast } from 'sonner';
import { TamilRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSetupDialog({ open, onOpenChange }: ProfileSetupDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TamilRole | ''>('');
  const registerMutation = useRegisterUser();
  const { refetch: refetchProfile } = useGetCallerUserProfile();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t('Please enter your name', 'உங்கள் பெயரை உள்ளிடவும்'));
      return;
    }

    if (!email.trim()) {
      toast.error(t('Please enter your email', 'உங்கள் மின்னஞ்சலை உள்ளிடவும்'));
      return;
    }

    if (!role) {
      toast.error(t('Please select your role', 'உங்கள் பங்கை தேர்ந்தெடுக்கவும்'));
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role as TamilRole,
      });

      await refetchProfile();
      toast.success(
        t(
          '✅ Registration successful!',
          '✅ பதிவு வெற்றிகரமாக!'
        ),
        { duration: 5000 }
      );

      onOpenChange(false);
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.msg || error.message || t('Registration failed', 'பதிவு தோல்வியடைந்தது'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('Complete Your Profile', 'உங்கள் சுயவிவரத்தை முடிக்கவும்')}</DialogTitle>
          <DialogDescription>
            {t(
              'Please provide your information to continue',
              'தொடர உங்கள் தகவலை வழங்கவும்'
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('Name', 'பெயர்')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t('Enter your name', 'உங்கள் பெயரை உள்ளிடவும்')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={registerMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              {t('Email', 'மின்னஞ்சல்')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t('Enter your email', 'உங்கள் மின்னஞ்சலை உள்ளிடவும்')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={registerMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">
              {t('Role', 'பங்கு')} <span className="text-destructive">*</span>
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as TamilRole)} disabled={registerMutation.isPending}>
              <SelectTrigger id="role">
                <SelectValue placeholder={t('Select your role', 'உங்கள் பங்கை தேர்ந்தெடுக்கவும்')} />
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
                  {t('Customer', 'வாடிக்கையாளர்')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending
              ? t('Registering...', 'பதிவு செய்கிறது...')
              : t('Complete Registration', 'பதிவை முடிக்கவும்')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
