import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import { useRejectRequestPayment } from '../hooks/useQueries';
import { toast } from 'sonner';
import { PropertyRequest } from '../types';
import {
  AlertCircle,
  XCircle,
  Loader2,
  CreditCard,
  MessageSquare
} from 'lucide-react';

interface RejectPaymentModalProps {
  request: PropertyRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function RejectPaymentModal({
  request,
  open,
  onOpenChange,
  onSuccess,
}: RejectPaymentModalProps) {
  const { t } = useLanguage();
  const rejectPaymentMutation = useRejectRequestPayment();
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!request) return null;

  const quickReasons = [
    'UTR reference not found in bank statement',
    'Payment amount does not match agreed price',
    'Transaction receipt is unclear or illegible',
    'Amount not yet credited to account'
  ];

  const handleQuickReasonClick = (r: string) => {
    setReason(r);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setErrorMsg(t('Please provide a reason for rejecting the payment', 'கட்டணத்தை நிராகரிப்பதற்கான காரணத்தை உள்ளிடவும்'));
      return;
    }

    try {
      await rejectPaymentMutation.mutateAsync({
        requestId: request._id,
        reason: trimmed,
      });

      toast.success(
        t(
          'Payment rejected. Buyer notified to review reason and re-submit.',
          'கட்டணம் நிராகரிக்கப்பட்டது. காரணத்தை சரிபார்த்து மீண்டும் சமர்ப்பிக்க வாங்குபவருக்கு தெரிவிக்கப்பட்டது.'
        )
      );
      setReason('');
      setErrorMsg('');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to reject payment', 'கட்டணத்தை நிராகரிக்க முடியவில்லை');
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-border/60 bg-gradient-to-r from-rose-50/70 to-white dark:from-rose-950/30 dark:to-card">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {t('Reject Payment with Reason', 'காரணத்துடன் கட்டணத்தை நிராகரிக்கவும்')}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    'Explain why this payment could not be verified. The buyer will review and re-submit.',
                    'கட்டணத்தை சரிபார்க்க முடியாத காரணத்தை விளக்குங்கள். வாங்குபவர் மீண்டும் சமர்ப்பிப்பார்.'
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Payment summary context */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-muted/30 border border-slate-200/80 dark:border-border/60 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground truncate max-w-[220px]">
                {request.property?.title || 'Property'}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                UTR: {request.paymentDetails?.transactionId || '-'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('Submitted Amount:', 'சமர்ப்பிக்கப்பட்ட தொகை:')} <b className="text-foreground">₹{Number(request.paymentDetails?.amount || request.agreedAmount || 0).toLocaleString('en-IN')}</b>
              {' • '}{request.paymentDetails?.mode || 'UPI'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>{t('Rejection Reason / Explanation', 'நிராகரிப்பு காரணம் / விளக்கம்')}</span>
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              placeholder={t(
                'e.g., UTR reference not found in bank statement, amount is less than agreed, etc.',
                'எ.கா., வங்கி அறிக்கையில் UTR குறிப்பு எண் கிடைக்கவில்லை...'
              )}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              rows={3}
              className="text-xs rounded-xl"
              required
            />
          </div>

          {/* Quick Reason Suggestions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {t('Quick Suggestions:', 'விரைவு பரிந்துரைகள்:')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((qr) => (
                <button
                  type="button"
                  key={qr}
                  onClick={() => handleQuickReasonClick(qr)}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-border/80 bg-slate-50 dark:bg-muted/40 hover:bg-slate-100 dark:hover:bg-muted text-slate-700 dark:text-slate-300 transition-colors text-left"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
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
              disabled={rejectPaymentMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl px-4 shadow-sm"
            >
              {rejectPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t('Rejecting...', 'நிராகரிக்கிறது...')}
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  {t('Confirm Rejection', 'நிராகரிப்பை உறுதிசெய்')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

