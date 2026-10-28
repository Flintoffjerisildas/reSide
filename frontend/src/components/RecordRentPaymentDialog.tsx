import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import { useRecordRentPayment } from '../hooks/useQueries';
import { toast } from 'sonner';
import {
  IndianRupee,
  Calendar,
  CreditCard,
  FileText,
  Upload,
  Info,
  CheckCircle2,
  X
} from 'lucide-react';

interface RecordRentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  defaultAmount?: number;
  monthlyRent?: number;
  rentDueDay?: number;
  onSuccess?: () => void;
}

export default function RecordRentPaymentDialog({
  open,
  onOpenChange,
  rentalId,
  defaultAmount = 0,
  monthlyRent = 0,
  rentDueDay = 5,
  onSuccess
}: RecordRentPaymentDialogProps) {
  const { t } = useLanguage();
  const recordPaymentMutation = useRecordRentPayment();

  const initialRent = monthlyRent || defaultAmount || 0;
  const [amount, setAmount] = useState<string>(initialRent ? String(initialRent) : '');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodMonth, setPeriodMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [mode, setMode] = useState<string>('Bank Transfer');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [receiptDocument, setReceiptDocument] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (defaultAmount) setAmount(String(defaultAmount));
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPeriodMonth(new Date().toISOString().substring(0, 7));
      setMode('Bank Transfer');
      setTransactionReference('');
      setReceiptNumber('');
      setReceiptDocument('');
      setReceiptFileName('');
      setNotes('');
    }
  }, [open, defaultAmount]);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Receipt file size must be under 10MB', 'ரசீது கோப்பின் அளவு 10MB-க்கு குறைவாக இருக்க வேண்டும்'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptDocument(reader.result as string);
      setReceiptFileName(file.name);
      toast.success(t('Receipt attached', 'ரசீது இணைக்கப்பட்டது'));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('Please enter a valid payment amount', 'செல்லுபடியாகும் கட்டணத் தொகையை உள்ளிடவும்'));
      return;
    }

    if (!paymentDate) {
      toast.error(t('Please select the payment date', 'கட்டண தேதியைத் தேர்ந்தெடுக்கவும்'));
      return;
    }

    if (!periodMonth) {
      toast.error(t('Please select the rent period month', 'வாடகை கால மாதத்தைத் தேர்ந்தெடுக்கவும்'));
      return;
    }

    // Convert YYYY-MM to 1st of month ISO string
    const periodDate = new Date(`${periodMonth}-01T00:00:00Z`);

    try {
      await recordPaymentMutation.mutateAsync({
        rentalId,
        payment: {
          amount: parsedAmount,
          paymentDate: new Date(paymentDate),
          periodMonth: periodDate,
          mode,
          transactionReference: transactionReference.trim(),
          receiptNumber: receiptNumber.trim(),
          receiptDocument,
          notes: notes.trim()
        }
      });

      toast.success(t('Rent payment recorded successfully!', 'வாடகைக் கட்டணம் வெற்றிகரமாக பதிவு செய்யப்பட்டது!'));
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to record payment', 'கட்டணத்தை பதிவு செய்ய முடியவில்லை');
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl glass-panel">
        <DialogHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              {t('Record Rent Payment', 'வாடகைக் கட்டணத்தைப் பதிவு செய்க')}
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
              {t('Manual Tracking', 'கைமுறை பதிவு')}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {t(
              'Log rent paid outside reSide (via UPI, Bank Transfer, Cash, or Cheque) to track your payment history and rent schedule.',
              'வங்கி பரிமாற்றம் அல்லது UPI மூலம் நேரடியாக உரிமையாளருக்கு செலுத்திய வாடகையை உங்கள் பதிவில் சேர்க்கவும்.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Clear Notice: Tenant-Recorded */}
        <div className="bg-amber-500/10 border border-amber-400/20 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl text-xs flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p className="leading-tight">
            {t(
              'This entry will be marked as "Tenant-Recorded". It acts as a personal ledger record and does not imply payment gateway verification or landlord confirmation.',
              'இது "குத்தகைதாரரால் பதிவு செய்யப்பட்டது" எனக் குறிக்கப்படும். இது உங்களின் தனிப்பட்ட கணக்கீடு மட்டுமே.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pay-amount" className="text-xs font-semibold">
                {t('Amount Paid (₹)', 'செலுத்திய தொகை (₹)')} <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                <Input
                  id="pay-amount"
                  type="number"
                  placeholder="e.g. 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9 pl-8 text-xs rounded-xl font-bold"
                  required
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pay-date" className="text-xs font-semibold">
                {t('Payment Date', 'செலுத்திய தேதி')} <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 pl-8 text-xs rounded-xl"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="period-month" className="text-xs font-semibold">
                {t('Rent Period Month', 'வாடகை மாதம்')} <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="period-month"
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="h-9 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pay-mode" className="text-xs font-semibold">
                {t('Payment Method', 'செலுத்தும் முறை')}
              </Label>
              <select
                id="pay-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
              >
                <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-ref" className="text-xs font-semibold">
                {t('Transaction Ref / UTR (optional)', 'பரிவர்த்தனை குறிப்பு எண்')}
              </Label>
              <Input
                id="tx-ref"
                placeholder="e.g. UPI Ref / UTR / Cheque #"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rcpt-num" className="text-xs font-semibold">
                {t('Receipt Number (optional)', 'ரசீது எண்')}
              </Label>
              <Input
                id="rcpt-num"
                placeholder="e.g. RCP-2026-10"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Receipt File Upload */}
          <div className="space-y-1 pt-1">
            <Label className="text-xs font-semibold block">
              {t('Proof of Payment / Receipt (optional)', 'ரசீது அல்லது சான்று')}
            </Label>
            {receiptDocument ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/50 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-medium">{receiptFileName || 'Receipt Attached'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptDocument('');
                    setReceiptFileName('');
                  }}
                  className="text-rose-500 hover:text-rose-700 p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="border border-dashed border-border/80 rounded-xl p-3 flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/30 cursor-pointer transition-all">
                <Upload className="h-4 w-4 text-emerald-600" />
                <span>{t('Upload Receipt Screenshot or PDF', 'ரசீதை பதிவேற்றவும்')}</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay-notes" className="text-xs font-semibold">
              {t('Payment Notes (optional)', 'குறிப்புகள்')}
            </Label>
            <Textarea
              id="pay-notes"
              placeholder="e.g. Paid via GPay to landlord directly, includes water charges, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              {t('Cancel', 'ரத்து')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={recordPaymentMutation.isPending}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
            >
              {recordPaymentMutation.isPending ? t('Recording...', 'பதிவாகிறது...') : t('Save Payment Record', 'கட்டணத்தை சேமி')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
