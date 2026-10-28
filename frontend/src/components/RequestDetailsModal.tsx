import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PropertyRequest } from '../types';
import {
  useApproveRequest,
  useRejectRequest,
  useCounterOfferRequest,
  useAcceptCounterOffer,
  useConfirmRequestTerms,
  useSubmitRequestPayment,
  useVerifyRequestPayment,
  useRejectRequestPayment,
  useCancelRequest,
  useCompleteTransaction,
} from '../hooks/useQueries';
import {
  User,
  Mail,
  Phone,
  Home,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  FileText,
  IndianRupee,
  Loader2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { translateText } from '../lib/api';

interface RequestDetailsModalProps {
  request: PropertyRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onNavigateToRentals?: () => void;
  isLoading?: boolean;
}

export default function RequestDetailsModal({
  request,
  open,
  onOpenChange,
  onNavigateToRentals,
}: RequestDetailsModalProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const counterMutation = useCounterOfferRequest();
  const acceptCounterMutation = useAcceptCounterOffer();
  const confirmTermsMutation = useConfirmRequestTerms();
  const submitPaymentMutation = useSubmitRequestPayment();
  const verifyPaymentMutation = useVerifyRequestPayment();
  const rejectPaymentMutation = useRejectRequestPayment();
  const cancelMutation = useCancelRequest();
  const completeMutation = useCompleteTransaction();

  // Dialog sub-action states
  const [activeAction, setActiveAction] = useState<
    'none' | 'counter' | 'terms' | 'pay' | 'reject' | 'reject-payment' | 'cancel'
  >('none');

  // Input states for actions
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentTxId, setPaymentTxId] = useState('');
  const [paymentReceiptImg, setPaymentReceiptImg] = useState('');

  const [propertyTitleTa, setPropertyTitleTa] = useState<string | null>(null);
  const [propertyLocationTa, setPropertyLocationTa] = useState<string | null>(null);

  const title = String(request?.property?.title || '').trim();
  const loc = String(request?.property?.location || '').trim();

  useEffect(() => {
    setActiveAction('none');
    setCounterAmount('');
    setCounterNote('');
    setCustomTerms('');
    setRejectionReason('');
    setPaymentAmount(request?.agreedAmount ? String(request.agreedAmount) : '');
    setPaymentTxId('');
    setPaymentReceiptImg('');
  }, [request, open]);

  useEffect(() => {
    if (!open || language !== 'ta' || !request?.property) {
      setPropertyTitleTa(null);
      setPropertyLocationTa(null);
      return;
    }

    (async () => {
      try {
        if (title) {
          const res = await translateText(title, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setPropertyTitleTa(out && out.trim() ? out : null);
        } else {
          setPropertyTitleTa(null);
        }

        if (loc) {
          const res = await translateText(loc, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          setPropertyLocationTa(out && out.trim() ? out : null);
        } else {
          setPropertyLocationTa(null);
        }
      } catch {
        setPropertyTitleTa(null);
        setPropertyLocationTa(null);
      }
    })();
  }, [open, language, request?.property, title, loc]);

  if (!request) return null;

  const currentUserId = String(user?.id || (user as any)?._id || '');
  const ownerId = String(
    typeof request.owner === 'object' && request.owner?._id
      ? request.owner._id
      : request.owner || ''
  );
  const tenantId = String(
    typeof request.tenant === 'object' && request.tenant?._id
      ? request.tenant._id
      : request.tenant || ''
  );

  const isOwner = currentUserId === ownerId;
  const isBuyerOrTenant = currentUserId === tenantId;
  const isBuy = request.type === 'buy';

  const { tenant, property, status, paymentDetails } = request;

  // Handlers
  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(request._id);
      toast.success(
        isBuy
          ? t('Purchase offer accepted! Property is now under contract.', 'கொள்முதல் சலுகை அங்கீகரிக்கப்பட்டது!')
          : t('Rental application approved! Agreement generated.', 'வாடகை விண்ணப்பம் அங்கீகரிக்கப்பட்டது!')
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to accept request', 'கோரிக்கையை ஏற்க முடியவில்லை'));
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ requestId: request._id, reason: rejectionReason });
      toast.success(t('Request declined successfully.', 'கோரிக்கை நிராகரிக்கப்பட்டது.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to decline request', 'கோரிக்கையை நிராகரிக்க முடியவில்லை'));
    }
  };

  const handleCounterOffer = async () => {
    const numeric = Number(counterAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error(t('Please enter a valid counteroffer amount', 'சரியான சலுகைத் தொகையை உள்ளிடவும்'));
      return;
    }
    try {
      await counterMutation.mutateAsync({
        requestId: request._id,
        counterOfferAmount: numeric,
        note: counterNote,
      });
      toast.success(t('Counteroffer sent to the buyer.', 'வாங்குபவருக்கு எதிர் சலுகை அனுப்பப்பட்டது.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to send counteroffer', 'எதிர் சலுகையை அனுப்ப முடியவில்லை'));
    }
  };

  const handleAcceptCounter = async () => {
    try {
      await acceptCounterMutation.mutateAsync(request._id);
      toast.success(t('Counteroffer accepted! Terms awaiting confirmation.', 'எதிர் சலுகை ஏற்றுக்கொள்ளப்பட்டது!'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to accept counteroffer', 'எதிர் சலுகையை ஏற்க முடியவில்லை'));
    }
  };

  const handleConfirmTerms = async () => {
    try {
      await confirmTermsMutation.mutateAsync({
        requestId: request._id,
        terms: customTerms || request.terms,
      });
      toast.success(t('Transaction terms confirmed successfully.', 'நிபந்தனைகள் வெற்றிகரமாக உறுதிப்படுத்தப்பட்டன.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to confirm terms', 'நிபந்தனைகளை உறுதிப்படுத்த முடியவில்லை'));
    }
  };

  const handleSubmitPayment = async () => {
    const numeric = Number(paymentAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error(t('Please enter a valid payment amount', 'சரியான கட்டணத் தொகையை உள்ளிடவும்'));
      return;
    }
    try {
      await submitPaymentMutation.mutateAsync({
        requestId: request._id,
        amount: numeric,
        mode: paymentMode,
        transactionId: paymentTxId,
        screenshot: paymentReceiptImg,
      });
      toast.success(t('Payment submitted for owner verification.', 'கட்டணம் சரிபார்ப்புக்கு சமர்ப்பிக்கப்பட்டது.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to submit payment', 'கட்டணத்தை சமர்ப்பிக்க முடியவில்லை'));
    }
  };

  const handleVerifyPayment = async () => {
    try {
      await verifyPaymentMutation.mutateAsync(request._id);
      toast.success(
        isBuy
          ? t('Payment verified! Property marked as SOLD.', 'கட்டணம் சரிபார்க்கப்பட்டது! சொத்து விற்கப்பட்டது.')
          : t('Payment verified successfully.', 'கட்டணம் வெற்றிகரமாக சரிபார்க்கப்பட்டது.')
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to verify payment', 'கட்டணத்தை சரிபார்க்க முடியவில்லை'));
    }
  };

  const handleRejectPayment = async () => {
    try {
      await rejectPaymentMutation.mutateAsync({
        requestId: request._id,
        reason: rejectionReason,
      });
      toast.success(t('Payment rejected. Buyer notified to resubmit.', 'கட்டணம் நிராகரிக்கப்பட்டது.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to reject payment', 'கட்டணத்தை நிராகரிக்க முடியவில்லை'));
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({
        requestId: request._id,
        reason: rejectionReason,
      });
      toast.success(t('Request withdrawn successfully.', 'கோரிக்கை திரும்பப் பெறப்பட்டது.'));
      setActiveAction('none');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to withdraw request', 'கோரிக்கையை திரும்பப் பெற முடியவில்லை'));
    }
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync(request._id);
      toast.success(
        isBuy
          ? t('Transaction completed successfully!', 'பரிவர்த்தனை வெற்றிகரமாக முடிந்தது!')
          : t('Tenancy finalized and confirmed active!', 'குத்தகை இறுதி செய்யப்பட்டு செயலில் உள்ளது!')
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to complete transaction', 'பரிவர்த்தனையை முடிக்க முடியவில்லை'));
    }
  };

  const handleReceiptImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentReceiptImg(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending Owner Approval', 'உரிமையாளர் ஒப்புதலுக்கு காத்திருக்கிறது')}
          </Badge>
        );
      case 'counteroffer':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-300">
            <IndianRupee className="w-3 h-3 mr-1 inline" />
            {t('Counteroffer Received', 'எதிர் சலுகை பெறப்பட்டது')}
          </Badge>
        );
      case 'accepted':
      case 'approved':
      case 'terms_confirmed':
        return (
          <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-300">
            <CreditCard className="w-3 h-3 mr-1 inline" />
            {t('Accepted — Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது — கட்டணம் நிலுவையில் உள்ளது')}
          </Badge>
        );
      case 'payment_pending':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-300">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Payment Verification Pending', 'கட்டண சரிபார்ப்பு நிலுவையில் உள்ளது')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-emerald-600 text-white">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {isBuy ? t('Sold & Completed', 'விற்பனை முடிந்தது') : t('Lease Active & Completed', 'வாடகை முடிந்தது')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1 inline" />
            {t('Declined', 'நிராகரிக்கப்பட்டது')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary">
            {t('Withdrawn / Cancelled', 'திரும்பப் பெறப்பட்டது')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{st}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              {isBuy
                ? t('Purchase Offer & Closing Workflow', 'கொள்முதல் சலுகை மற்றும் விற்பனை விவரங்கள்')
                : t('Rental Application & Lease Details', 'வாடகை விண்ணப்பம் மற்றும் குத்தகை விவரங்கள்')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isBuy ? 'default' : 'secondary'} className="text-xs px-2.5 py-0.5">
                {isBuy ? t('Buy Transaction', 'வாங்க பரிவர்த்தனை') : t('Rental Transaction', 'வாடகை பரிவர்த்தனை')}
              </Badge>
              {getStatusBadge(status)}
            </div>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {t(
              'Unified property transaction tracker with multi-party review, terms confirmation, and backend payment verification.',
              'இரு தரப்பு ஆய்வு, விதிமுறை உறுதி மற்றும் கட்டண சரிபார்ப்புடன் கூடிய பரிவர்த்தனை கண்காணிப்பாளர்.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Property Card Summary */}
          <Card className="border bg-muted/30 shadow-none">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {property?.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-16 h-16 object-cover rounded-lg border flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-lg text-2xl border flex-shrink-0">
                    🏠
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-base">
                    {language === 'ta' ? propertyTitleTa || property?.title : property?.title}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {language === 'ta' ? propertyLocationTa || property?.location : property?.location}
                  </p>
                  <p className="text-xs font-semibold text-primary mt-1">
                    {t('Listed Price:', 'பட்டியல் விலை:')} ₹{Number(property?.price || 0).toLocaleString('en-IN')}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1 capitalize">
                      ({property?.transactionType})
                    </span>
                  </p>
                </div>
              </div>

              {property?.saleStatus === 'sold' && (
                <Badge variant="default" className="bg-emerald-600 text-white">
                  ✓ {t('Sold', 'விற்கப்பட்டது')}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Transaction Financial & Terms Progression Box */}
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                {t('Transaction & Terms Progression', 'பரிவர்த்தனை & விதிமுறைகள் முன்னேற்றம்')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border">
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Asking Price', 'கேட்கப்படும் விலை')}</span>
                  <span className="font-semibold text-sm">₹{Number(property?.price || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Initial Offer', 'ஆரம்ப சலுகை')}</span>
                  <span className="font-semibold text-sm">
                    ₹{Number(request.offerAmount || property?.price || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Counteroffer', 'எதிர் சலுகை')}</span>
                  <span className="font-semibold text-sm">
                    {request.counterOfferAmount
                      ? `₹${Number(request.counterOfferAmount).toLocaleString('en-IN')}`
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Agreed Amount', 'ஒப்புக்கொள்ளப்பட்ட தொகை')}</span>
                  <span className="font-bold text-sm text-primary">
                    ₹{Number(request.agreedAmount || request.offerAmount || property?.price || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {request.counterOfferNote && (
                <div className="p-3 bg-purple-500/10 border border-purple-300 rounded-lg text-xs">
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    {t('Owner Counteroffer Note: ', 'உரிமையாளர் குறிப்பு: ')}
                  </span>
                  {request.counterOfferNote}
                </div>
              )}

              {/* Terms / Lease Agreement confirmation states */}
              {!isBuy && ['approved', 'completed'].includes(status) ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      {t('Standard 11-Month Lease Agreement Active', 'நிலையான 11 மாத குத்தகை ஒப்பந்தம் செயலில் உள்ளது')}
                    </span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] bg-emerald-500/15">
                      ✓ {t('Both Parties Signed & Confirmed', 'இரு தரப்பும் கையொப்பமிட்டன')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {request.terms ||
                      t(
                        'Standard 11-month rental agreement. Monthly rent due on 5th of each calendar month.',
                        'நிலையான 11 மாத வாடகை ஒப்பந்தம். மாத வாடகை ஒவ்வொரு மாதமும் 5 ஆம் தேதி செலுத்தப்பட வேண்டும்.'
                      )}
                  </p>
                  {onNavigateToRentals && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => {
                          onOpenChange(false);
                          onNavigateToRentals();
                        }}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        {t('View in My Rentals (Schedule & Rent Records)', 'எனது வாடகைகளில் பார்க்கவும் (அட்டவணை & பதிவுகள்)')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{t('Agreed Closing Terms:', 'விதிமுறைகள்:')}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        {request.termsConfirmedByOwner ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        {t('Owner Confirmed', 'உரிமையாளர் உறுதி')}
                      </span>
                      <span className="flex items-center gap-1">
                        {request.termsConfirmedByBuyer ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        {t('Buyer Confirmed', 'வாங்குபவர் உறுதி')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-foreground italic">
                    {request.terms
                      ? `"${request.terms}"`
                      : t(
                          'Standard statutory terms apply (property delivered vacant and unencumbered upon full verification).',
                          'நிலையான சட்டப்பூர்வ விதிமுறைகள் பொருந்தும்.'
                        )}
                  </p>
                </div>
              )}

              {request.rejectionReason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
                  <span className="font-semibold">{t('Declined Reason: ', 'நிராகரிக்கப்பட்ட காரணம்: ')}</span>
                  {request.rejectionReason}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Details Section (if payment was submitted) */}
          {paymentDetails && paymentDetails.status !== 'unpaid' && (
            <Card className="border bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <CreditCard className="w-4 h-4" />
                    {t('Payment Record & Proof', 'கட்டண பதிவு & ஆதாரம்')}
                  </CardTitle>
                  <Badge variant={paymentDetails.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                    {paymentDetails.status === 'verified'
                      ? t('Verified', 'சரிபார்க்கப்பட்டது')
                      : t('Submitted (Pending)', 'சமர்ப்பிக்கப்பட்டது')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-muted-foreground block">{t('Amount', 'தொகை')}</span>
                    <span className="font-bold text-sm text-foreground">
                      ₹{Number(paymentDetails.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('Payment Mode', 'கட்டண முறை')}</span>
                    <span className="font-medium text-foreground">{paymentDetails.mode || 'UPI'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('Transaction Ref', 'பரிவர்த்தனை குறிப்பு')}</span>
                    <span className="font-mono text-foreground">{paymentDetails.transactionId || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('Receipt Number', 'ரசீது எண்')}</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {paymentDetails.receiptNumber || t('Pending Owner Verification', 'சரிபார்ப்பு நிலுவையில்')}
                    </span>
                  </div>
                </div>

                {paymentDetails.screenshot && (
                  <div className="pt-2">
                    <span className="text-muted-foreground block mb-1">{t('Payment Receipt Screenshot:', 'ரசீது படம்:')}</span>
                    <a
                      href={paymentDetails.screenshot}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block border rounded-lg overflow-hidden max-w-xs hover:opacity-90"
                    >
                      <img
                        src={paymentDetails.screenshot}
                        alt="Payment Proof"
                        className="max-h-36 object-contain bg-white"
                      />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tenant / Buyer Profile Card */}
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                {isBuy ? t('Buyer Details', 'வாங்குபவர் விவரங்கள்') : t('Tenant Details', 'குத்தகைதாரர் விவரங்கள்')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Name', 'பெயர்')}</span>
                  <span className="font-semibold">{tenant?.name || 'Applicant'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Email', 'மின்னஞ்சல்')}</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {tenant?.email || '-'}
                  </span>
                </div>
              </div>

              {tenant?.phone && (
                <div>
                  <span className="text-xs text-muted-foreground block">{t('Phone', 'தொலைபேசி')}</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {tenant.phone}
                  </span>
                </div>
              )}

              {request.message && (
                <div className="p-3 bg-muted/40 rounded-lg border mt-2">
                  <span className="text-xs font-semibold text-muted-foreground block mb-0.5">
                    {t('Applicant Message:', 'விண்ணப்பதாரர் செய்தி:')}
                  </span>
                  <p className="text-xs text-foreground italic">"{request.message}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sub-Action Panels */}
          {activeAction === 'counter' && (
            <div className="p-4 rounded-xl border border-purple-300 bg-purple-500/5 space-y-3">
              <h4 className="font-semibold text-sm text-purple-800 dark:text-purple-300">
                {t('Propose Counteroffer', 'எதிர் சலுகை முன்மொழியவும்')}
              </h4>
              <div className="space-y-2">
                <Label htmlFor="counter-amt" className="text-xs font-medium">
                  {t('Counteroffer Amount (₹)', 'எதிர் சலுகைத் தொகை (₹)')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="counter-amt"
                  type="number"
                  placeholder={String(request.agreedAmount || property?.price || '')}
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="counter-note" className="text-xs font-medium">
                  {t('Note to Buyer (Optional)', 'வாங்குபவருக்கு குறிப்பு (விரும்பினால்)')}
                </Label>
                <Textarea
                  id="counter-note"
                  placeholder={t('e.g. Willing to close at this price including car parking...', 'குறிப்பு...')}
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  className="text-xs h-20"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActiveAction('none')}>
                  {t('Cancel', 'ரத்து')}
                </Button>
                <Button size="sm" onClick={handleCounterOffer} disabled={counterMutation.isPending}>
                  {counterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {t('Send Counteroffer', 'எதிர் சலுகையை அனுப்பு')}
                </Button>
              </div>
            </div>
          )}

          {activeAction === 'terms' && (
            <div className="p-4 rounded-xl border border-blue-300 bg-blue-500/5 space-y-3">
              <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                {t('Confirm Closing / Transaction Terms', 'பரிவர்த்தனை விதிமுறைகளை உறுதிப்படுத்தவும்')}
              </h4>
              <div className="space-y-2">
                <Label htmlFor="custom-terms" className="text-xs font-medium">
                  {t('Terms & Closing Conditions', 'விதிமுறைகள் & நிபந்தனைகள்')}
                </Label>
                <Textarea
                  id="custom-terms"
                  placeholder={t('Enter agreed payment timelines, advance deposit, possession date...', 'விதிமுறைகள்...')}
                  value={customTerms}
                  onChange={(e) => setCustomTerms(e.target.value)}
                  className="text-xs h-24"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActiveAction('none')}>
                  {t('Cancel', 'ரத்து')}
                </Button>
                <Button size="sm" onClick={handleConfirmTerms} disabled={confirmTermsMutation.isPending}>
                  {confirmTermsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {t('Confirm Terms', 'விதிமுறைகளை உறுதிசெய்')}
                </Button>
              </div>
            </div>
          )}

          {activeAction === 'pay' && (
            <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-500/5 space-y-3">
              <h4 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                {isBuy
                  ? t('Submit Purchase Advance / Deposit Payment', 'முன்பண கட்டணத்தை சமர்ப்பிக்கவும்')
                  : t('Submit Rental Deposit Payment', 'வாடகை கட்டணத்தை சமர்ப்பிக்கவும்')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amt" className="text-xs font-medium">
                    {t('Payment Amount (₹)', 'கட்டணத் தொகை (₹)')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pay-amt"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-mode" className="text-xs font-medium">
                    {t('Payment Mode', 'கட்டண முறை')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger id="pay-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer (NEFT/IMPS)</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-tx" className="text-xs font-medium">
                  {t('Transaction Reference / UTR Number', 'பரிவர்த்தனை குறிப்பு எண்')}
                </Label>
                <Input
                  id="pay-tx"
                  placeholder="e.g. UPI1234567890"
                  value={paymentTxId}
                  onChange={(e) => setPaymentTxId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-file" className="text-xs font-medium">
                  {t('Upload Payment Screenshot / Receipt (Optional)', 'ரசீது படம் பதிவேற்றவும்')}
                </Label>
                <Input id="pay-file" type="file" accept="image/*" onChange={handleReceiptImageUpload} className="text-xs" />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActiveAction('none')}>
                  {t('Cancel', 'ரத்து')}
                </Button>
                <Button size="sm" onClick={handleSubmitPayment} disabled={submitPaymentMutation.isPending}>
                  {submitPaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {t('Submit Payment', 'கட்டணத்தை சமர்ப்பி')}
                </Button>
              </div>
            </div>
          )}

          {(activeAction === 'reject' || activeAction === 'reject-payment' || activeAction === 'cancel') && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
              <h4 className="font-semibold text-sm text-destructive">
                {activeAction === 'reject-payment'
                  ? t('Reject Payment Verification', 'கட்டண சரிபார்ப்பை நிராகரிக்கவும்')
                  : activeAction === 'cancel'
                  ? t('Withdraw Request', 'கோரிக்கையை திரும்பப் பெறவும்')
                  : t('Decline Request', 'கோரிக்கையை நிராகரிக்கவும்')}
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="action-reason" className="text-xs font-medium">
                  {t('Reason / Notes (Optional)', 'காரணம் / குறிப்புகள்')}
                </Label>
                <Textarea
                  id="action-reason"
                  placeholder={t('Enter explanation...', 'விளக்கத்தை உள்ளிடவும்...')}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="text-xs h-20"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActiveAction('none')}>
                  {t('Cancel', 'ரத்து')}
                </Button>
                {activeAction === 'reject-payment' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRejectPayment}
                    disabled={rejectPaymentMutation.isPending}
                  >
                    {t('Confirm Reject Payment', 'கட்டணத்தை நிராகரி')}
                  </Button>
                )}
                {activeAction === 'cancel' && (
                  <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelMutation.isPending}>
                    {t('Confirm Withdrawal', 'திரும்பப் பெறுதலை உறுதிசெய்')}
                  </Button>
                )}
                {activeAction === 'reject' && (
                  <Button variant="destructive" size="sm" onClick={handleReject} disabled={rejectMutation.isPending}>
                    {t('Confirm Decline', 'நிராகரிப்பை உறுதிசெய்')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action Button Bar */}
          {activeAction === 'none' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t('Close', 'மூடு')}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {/* OWNER ACTIONS */}
                {isOwner && status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setActiveAction('reject')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      {t('Reject', 'நிராகரி')}
                    </Button>
                    {isBuy && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => setActiveAction('counter')}
                      >
                        {t('Counteroffer', 'எதிர் சலுகை')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {isBuy ? t('Accept Offer', 'சலுகையை ஏற்றுக்கொள்') : t('Accept Application', 'விண்ணப்பத்தை ஏற்றுக்கொள்')}
                    </Button>
                  </>
                )}

                {isOwner && status === 'counteroffer' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setActiveAction('reject')}
                  >
                    {t('Decline / Cancel', 'நிராகரி')}
                  </Button>
                )}

                {isOwner && (status === 'accepted' || status === 'approved') && (
                  <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-medium bg-sky-50 dark:bg-sky-950/50 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800">
                    <Clock className="w-3.5 h-3.5" />
                    {t('Accepted — Awaiting Customer Payment', 'ஏற்றுக்கொள்ளப்பட்டது — வாடிக்கையாளர் கட்டணத்திற்கு காத்திருக்கிறது')}
                  </div>
                )}

                {isOwner && status === 'payment_pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setActiveAction('reject-payment')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      {t('Reject Payment', 'கட்டணத்தை நிராகரி')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      onClick={handleVerifyPayment}
                      disabled={verifyPaymentMutation.isPending}
                    >
                      {verifyPaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {t('Verify Payment & Complete', 'கட்டணத்தை சரிபார்த்து முடி')}
                    </Button>
                  </>
                )}

                {/* BUYER / TENANT ACTIONS */}
                {isBuyerOrTenant && status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setActiveAction('cancel')}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    {t('Withdraw Request', 'கோரிக்கையை திரும்பப்பெறு')}
                  </Button>
                )}

                {isBuyerOrTenant && status === 'counteroffer' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setActiveAction('cancel')}
                    >
                      {t('Decline Counter', 'எதிர் சலுகையை நிராகரி')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleAcceptCounter}
                      disabled={acceptCounterMutation.isPending}
                    >
                      {acceptCounterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      {t('Accept Counteroffer', 'எதிர் சலுகையை ஏற்றுக்கொள்')}
                    </Button>
                  </>
                )}

                {/* Accepted request proceeds directly to payment! */}
                {isBuyerOrTenant && ['accepted', 'approved', 'terms_confirmed'].includes(status) && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                    onClick={() => setActiveAction('pay')}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    {isBuy ? t('Pay Now (Advance / Deposit)', 'இப்போது செலுத்தவும் (முன்பணம்)') : t('Pay Now (First Month Rent)', 'இப்போது செலுத்தவும் (வாடகை)')}
                  </Button>
                )}

                {isBuyerOrTenant && status === 'payment_pending' && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    {t('Payment submitted — awaiting owner verification', 'கட்டணம் சமர்ப்பிக்கப்பட்டது — சரிபார்ப்புக்கு காத்திருக்கிறது')}
                  </div>
                )}

                {/* COMPLETED STATUS FOR BOTH */}
                {status === 'completed' && !isBuy && onNavigateToRentals && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onNavigateToRentals();
                    }}
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    {t('Go to My Rentals', 'எனது வாடகைகளுக்கு செல்')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
