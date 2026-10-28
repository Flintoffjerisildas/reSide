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
import { Wrench, Upload, IndianRupee, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { useRecordMaintenanceEntry } from '../hooks/useQueries';

interface LogMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
}

export default function LogMaintenanceDialog({
  open,
  onOpenChange,
  rentalId,
}: LogMaintenanceDialogProps) {
  const { t } = useLanguage();
  const recordMutation = useRecordMaintenanceEntry();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Plumbing' | 'Electrical' | 'Appliance' | 'Structural' | 'Cleaning' | 'Painting' | 'Other'>('Plumbing');
  const [dateReported, setDateReported] = useState(new Date().toISOString().split('T')[0]);
  const [amountSpent, setAmountSpent] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'resolved'>('resolved');
  const [attachment, setAttachment] = useState<{ name: string; data: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Attachment must be under 5MB', 'ஆவணம் 5MB-க்குள் இருக்க வேண்டும்'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment({
        name: file.name,
        data: reader.result as string,
      });
      toast.success(t('Attachment loaded', 'ஆவணம் இணைக்கப்பட்டது'));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('Please enter maintenance title', 'பராமரிப்பு தலைப்பை உள்ளிடவும்'));
      return;
    }

    try {
      await recordMutation.mutateAsync({
        rentalId,
        entry: {
          title: title.trim(),
          description: description.trim(),
          category,
          dateReported,
          amountSpent: amountSpent ? Number(amountSpent) : 0,
          status,
          receipt: attachment || undefined,
        },
      });

      toast.success(t('Maintenance entry recorded successfully', 'பராமரிப்பு பதிவு வெற்றிகரமாக சேர்க்கப்பட்டது'));
      // Reset form
      setTitle('');
      setDescription('');
      setAmountSpent('');
      setAttachment(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to record maintenance entry', 'பதிவு செய்வதில் பிழை'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Wrench className="h-5 w-5 text-emerald-600" />
            {t('Log Maintenance / Personal Expense', 'பராமரிப்பு / தனிப்பட்ட செலவை பதிவு செய்')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t(
              'Track repairs, property upkeep, and out-of-pocket expenses for your own records. Note: This log is private to you and is not automatically dispatched to your landlord.',
              'உங்கள் தனிப்பட்ட பதிவிற்காக பழுதுபார்ப்பு மற்றும் பராமரிப்புச் செலவுகளை இங்கே பதிவு செய்யுங்கள். இது தனிப்பட்டது, நிலப்பிரபுவுக்கு அனுப்பப்படாது.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{t('Issue / Service Title *', 'சேவை அல்லது பழுது தலைப்பு *')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Bathroom tap replacement, Geyser servicing', 'எ.கா. குளியலறை குழாய் மாற்றுதல்')}
              className="h-8 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t('Category', 'வகை')}</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="Appliance">Appliance</option>
                <option value="Structural">Structural</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Painting">Painting</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t('Status', 'நிலை')}</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                <option value="resolved">{t('Resolved / Done', 'முடிந்தது')}</option>
                <option value="in_progress">{t('In Progress', 'செயலில்')}</option>
                <option value="pending">{t('Pending Repair', 'நிலுவையில்')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {t('Date Incurred / Reported', 'தேதி')}
              </Label>
              <Input
                type="date"
                value={dateReported}
                onChange={(e) => setDateReported(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Amount Spent */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <IndianRupee className="h-3 w-3 text-muted-foreground" />
                {t('Amount Spent (₹)', 'செலவிடப்பட்ட தொகை (₹)')}
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={amountSpent}
                onChange={(e) => setAmountSpent(e.target.value)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{t('Description / Repair Notes', 'விளக்கம் / குறிப்புகள்')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Details of work done, plumber or technician notes, parts purchased...', 'செய்த பணி விவரங்கள்...')}
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* Receipt / Attachment Upload */}
          <div className="space-y-1.5 p-3 rounded-xl border border-dashed border-border/70 bg-muted/20">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-primary" />
              {t('Attach Receipt / Invoice / Photo (Optional)', 'ரசீது அல்லது புகைப்படம் இணைக்கவும் (விருப்பத்திற்குரியது)')}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {t('Max 5MB (JPG, PNG, PDF)', 'அதிகபட்சம் 5MB')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="file"
                id="maintenance-receipt-upload"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('maintenance-receipt-upload')?.click()}
                className="h-7 text-xs gap-1.5"
              >
                <Upload className="h-3 w-3" />
                {attachment ? t('Change Attachment', 'மாற்று') : t('Select File', 'கோப்பை தேர்ந்தெடு')}
              </Button>
              {attachment && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {attachment.name}
                </span>
              )}
            </div>
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
              disabled={recordMutation.isPending}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {recordMutation.isPending ? t('Saving...', 'சேமிக்கிறது...') : t('Save Maintenance Entry', 'பதிவைச் சேமிக்க')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
