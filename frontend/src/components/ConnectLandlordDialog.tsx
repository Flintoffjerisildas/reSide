import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { UserCheck, ShieldCheck, Mail, Phone, Info } from 'lucide-react';
import { useConnectLandlord } from '../hooks/useQueries';

interface ConnectLandlordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  propertyTitle?: string;
  initialLandlord?: any;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
}

export default function ConnectLandlordDialog({
  open,
  onOpenChange,
  rentalId,
  propertyTitle = '',
  initialLandlord,
  initialName = '',
  initialEmail = '',
  initialPhone = '',
}: ConnectLandlordDialogProps) {
  const { t } = useLanguage();
  const connectMutation = useConnectLandlord();

  const [name, setName] = useState(initialLandlord?.name || initialName || '');
  const [email, setEmail] = useState(initialLandlord?.email || initialEmail || '');
  const [phone, setPhone] = useState(initialLandlord?.phone || initialPhone || '');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      toast.error(t('Please provide at least a landlord email or phone number', 'மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்'));
      return;
    }

    try {
      await connectMutation.mutateAsync({
        rentalId,
        landlordData: {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          name: name.trim() || undefined,
          message: message.trim() || undefined,
        }
      });

      toast.success(t('Landlord connection invitation sent successfully', 'அழைப்பு வெற்றிகரமாக அனுப்பப்பட்டது'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to send connection invitation', 'அழைப்பு அனுப்புவதில் பிழை'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            {t('Invite Landlord to Connect', 'நிலப்பிரபுவை இணைக்க அழைக்கவும்')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t(
              'Connect your self-managed rental to a verified landlord account on reSide. Participation is optional — you can continue managing your rental independently at any time.',
              'உங்கள் வாடகையை reSide இல் சரிபார்க்கப்பட்ட நிலப்பிரபுவுடன் இணைக்கலாம். இது விருப்பத்திற்குரியது; நீங்கள் தனியாகவும் நிர்வகிக்கலாம்.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {/* Safeguard Notice */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>{t('Connection Safeguards', 'இணைப்பு பாதுகாப்பு விதிகள்')}</span>
            </div>
            <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('Landlords must independently authenticate and verify property authority before any connection.', 'நிலப்பிரபுக்கள் தங்கள் கணக்கை சரிபார்க்க வேண்டும்.')}</li>
              <li>{t('Your private payment records and personal receipts will remain private to you unless shared.', 'உங்கள் தனிப்பட்ட ரசீதுகள் மற்றும் குறிப்புகள் பாதுகாக்கப்படும்.')}</li>
              <li>{t('If the landlord never joins, your self-managed rental continues working normally.', 'நிலப்பிரபு இணையாவிட்டாலும் வாடகை வழக்கம் போல் செயல்படும்.')}</li>
            </ul>
          </div>

          {/* Landlord Name */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{t('Landlord Name', 'நிலப்பிரபு பெயர்')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. John Doe', 'எ.கா. முரளி')}
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Email */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground" />
                {t('Email Address', 'மின்னஞ்சல்')}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="landlord@example.com"
                className="h-8 text-xs"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {t('Phone Number', 'தொலைபேசி')}
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Optional Message */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{t('Invitation Note (Optional)', 'அழைப்பு குறிப்பு')}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('Hi, I am tracking our rental on reSide so we can share receipts and agreements...', 'வணக்கம், reSide இல் நமது வாடகையை பதிவு செய்துள்ளேன்...')}
              className="text-xs min-h-[50px]"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={connectMutation.isPending}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {connectMutation.isPending ? t('Sending...', 'அனுப்புகிறது...') : t('Send Invitation', 'அழைப்பை அனுப்பு')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
