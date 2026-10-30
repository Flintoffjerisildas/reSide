import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubmitRequestPayment } from '../hooks/useQueries';
import { toast } from 'sonner';
import { PropertyRequest } from '../types';
import {
  CreditCard,
  Building,
  MapPin,
  IndianRupee,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface SubmitPaymentModalProps {
  request: PropertyRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function SubmitPaymentModal({
  request,
  open,
  onOpenChange,
  onSuccess,
}: SubmitPaymentModalProps) {
  const { t } = useLanguage();
  const submitPaymentMutation = useSubmitRequestPayment();

  const [amount, setAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [receiptImage, setReceiptImage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open && request) {
      const defaultAmount =
        request.agreedAmount ||
        request.counterOfferAmount ||
        request.offerAmount ||
        request.property?.price ||
        '';
      setAmount(defaultAmount ? String(defaultAmount) : '');
      setUtrNumber(request.paymentDetails?.transactionId || '');
      setPaymentMode(request.paymentDetails?.mode || 'UPI');
      setReceiptImage(request.paymentDetails?.screenshot || '');
      setErrorMsg('');
    }
  }, [open, request]);

  if (!request) return null;

  const property = request.property;
  const isBuy = request.type === 'buy';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('Image must be under 5MB', 'படம் 5MB க்கும் குறைவாக இருக்க வேண்டும்'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg(t('Please enter a valid positive payment amount', 'சரியான கட்டணத் தொகையை உள்ளிடவும்'));
      return;
    }

    if (!utrNumber || !utrNumber.trim()) {
      setErrorMsg(t('Bank UTR or UPI Transaction Reference Number is required', 'வங்கி UTR அல்லது UPI குறிப்பு எண் தேவை'));
      return;
    }

    try {
      await submitPaymentMutation.mutateAsync({
        requestId: request._id,
        amount: numericAmount,
        mode: paymentMode,
        transactionId: utrNumber.trim(),
        screenshot: receiptImage,
      });

      toast.success(
        t(
          'Payment details submitted successfully! Awaiting owner verification.',
          'கட்டண விவரங்கள் சமர்ப்பிக்கப்பட்டன! உரிமையாளர் சரிபார்ப்புக்கு காத்திருக்கிறது.'
        )
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to submit payment details', 'கட்டண விவரங்களை சமர்ப்பிக்க முடியவில்லை');
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-border/60 bg-gradient-to-r from-emerald-50/70 to-white dark:from-emerald-950/30 dark:to-card">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {t('Submit Payment Details', 'கட்டண விவரங்களை சமர்ப்பிக்கவும்')}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isBuy
                    ? t('Enter your advance/settlement payment details to request ownership deed transfer.', 'உரிமை மாற்றத்திற்கு கட்டண விவரங்களை உள்ளிடவும்.')
                    : t('Enter your rent payment details for owner verification.', 'வாடகை கட்டண விவரங்களை உள்ளிடவும்.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Property Summary Pill */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-muted/30 border border-slate-200/80 dark:border-border/60 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground truncate max-w-[240px]">
                {property?.title || 'Property'}
              </span>
              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-semibold">
                {isBuy ? t('Purchase Closing', 'கொள்முதல்') : t('Rental Lease', 'வாடகை')}
              </Badge>
            </div>
            {property?.location && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{property.location}</span>
              </p>
            )}
          </div>

          {/* Previous Rejection Warning if applicable */}
          {(request.rejectionReason || request.paymentDetails?.rejectionReason) && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <span className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                {t('Previous Payment Rejected by Seller:', 'முந்தைய கட்டணம் விற்பனையாளரால் நிராகரிக்கப்பட்டது:')}
              </span>
              <p className="pl-5 text-[11px] font-medium italic">
                "{request.rejectionReason || request.paymentDetails?.rejectionReason}"
              </p>
              <p className="pl-5 text-[10px] text-amber-700 dark:text-amber-300">
                {t('Please enter the corrected UTR number and re-submit for verification.', 'சரியான UTR எண்ணை உள்ளிட்டு மீண்டும் சமர்ப்பிக்கவும்.')}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount Paid Field */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-modal-amount" className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>{t('Amount Paid (₹)', 'செலுத்தப்பட்ட தொகை (₹)')}</span>
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="pay-modal-amount"
                type="number"
                placeholder="e.g. 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-sm font-semibold h-9 rounded-xl font-mono"
                required
              />
            </div>
          </div>

          {/* Bank UTR / UPI Reference Number Field */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-modal-utr" className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>{t('Bank UTR / UPI Transaction Reference Number', 'வங்கி UTR / UPI குறிப்பு எண்')}</span>
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-modal-utr"
              type="text"
              placeholder="e.g. UPI/123456789012 or UTR/HDFC001293847"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              className="text-xs font-mono h-9 rounded-xl uppercase"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              {t('Found in your bank receipt, Google Pay, PhonePe, or net banking confirmation.', 'வங்கி ரசீது அல்லது UPI பயன்பாட்டில் உள்ள எண்.')}
            </p>
          </div>

          {/* Payment Mode Field */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-modal-mode" className="text-xs font-semibold text-foreground">
              {t('Payment Mode', 'கட்டண முறை')}
            </Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger id="pay-modal-mode" className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI (Google Pay, PhonePe, Paytm)</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</SelectItem>
                <SelectItem value="Cheque">Cheque / Demand Draft</SelectItem>
                <SelectItem value="Cash">Cash Deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Screenshot / Receipt Proof (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-modal-file" className="text-xs font-semibold text-foreground">
              {t('Payment Screenshot / Receipt (Optional)', 'ரசீது படம் (விரும்பினால்)')}
            </Label>
            <Input
              id="pay-modal-file"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="text-xs h-9 rounded-xl file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-slate-100"
            />
            {receiptImage && (
              <div className="pt-1 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[11px] text-emerald-700 font-medium">
                  {t('Receipt image attached', 'ரசீது படம் இணைக்கப்பட்டுள்ளது')}
                </span>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              {t(
                'Once submitted, the seller will verify the UTR number with their bank before finalizing the deed transfer.',
                'சமர்ப்பித்த பிறகு, உரிமை மாற்றத்திற்கு முன் விற்பனையாளர் UTR எண்ணை சரிபார்ப்பார்.'
              )}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-border/60">
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
              disabled={submitPaymentMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl px-4 shadow-sm"
            >
              {submitPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t('Submitting...', 'சமர்ப்பிக்கிறது...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('Submit Payment Details', 'கட்டண விவரங்களை சமர்ப்பி')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

