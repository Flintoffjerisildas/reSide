import { useEffect, useState } from 'react';
import { useGetTenantRequests } from '../hooks/useQueries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2, Eye, Clock, CheckCircle2, XCircle, CreditCard, ShieldCheck, IndianRupee } from 'lucide-react';
import { translateText } from '../lib/api';
import RequestDetailsModal from './RequestDetailsModal';
import { PropertyRequest } from '../types';

export default function RequestList() {
  const { t, language } = useLanguage();
  const { data: requests, isLoading } = useGetTenantRequests();
  const [taTextMap, setTaTextMap] = useState<Record<string, string>>({});
  const [selectedRequest, setSelectedRequest] = useState<PropertyRequest | null>(null);

  useEffect(() => {
    if (language !== 'ta') {
      if (Object.keys(taTextMap).length > 0) setTaTextMap({});
      return;
    }

    const texts = new Set<string>();
    (requests || []).forEach((r: any) => {
      const title = String(r?.property?.title || '').trim();
      const loc = String(r?.property?.location || '').trim();
      if (title) texts.add(title);
      if (loc) texts.add(loc);
    });

    const missing = Array.from(texts).filter((s) => !taTextMap[s]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const additions: Record<string, string> = {};
      for (const s of missing) {
        try {
          const res = await translateText(s, 'ta');
          const out = typeof res?.translatedText === 'string' ? res.translatedText : '';
          if (out && out.trim()) additions[s] = out;
        } catch {
          continue;
        }
      }
      if (cancelled) return;
      if (Object.keys(additions).length > 0) setTaTextMap((prev) => ({ ...prev, ...additions }));
    })();

    return () => {
      cancelled = true;
    };
  }, [language, requests, taTextMap]);

  const displayTa = (text: any) => {
    const raw = typeof text === 'string' ? text : '';
    if (language !== 'ta') return raw || text;
    if (!raw) return raw || text;
    return taTextMap[raw] || raw;
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'awaiting_payment' | 'completed_rejected'>('all');

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending Owner Approval', 'உரிமையாளர் ஒப்புதலுக்கு காத்திருக்கிறது')}
          </Badge>
        );
      case 'counteroffer':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-300 text-xs">
            <IndianRupee className="w-3 h-3 mr-1 inline" />
            {t('Counteroffer Received', 'எதிர் சலுகை')}
          </Badge>
        );
      case 'accepted':
      case 'approved':
      case 'terms_confirmed':
        return (
          <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-300 text-xs">
            <CreditCard className="w-3 h-3 mr-1 inline" />
            {t('Accepted — Awaiting Payment', 'ஏற்றுக்கொள்ளப்பட்டது — கட்டணம் நிலுவை')}
          </Badge>
        );
      case 'payment_pending':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-300 text-xs">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Payment Verification Pending', 'கட்டண சரிபார்ப்பு')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-emerald-600 text-white text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {t('Completed', 'முடிந்தது')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="w-3 h-3 mr-1 inline" />
            {t('Declined', 'நிராகரிக்கப்பட்டது')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="text-xs">
            {t('Withdrawn', 'திரும்பப்பெறப்பட்டது')}
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-xs">{st}</Badge>;
    }
  };

  const counts = {
    all: (requests || []).length,
    pending: (requests || []).filter((r: any) => r.status === 'pending' || r.status === 'counteroffer').length,
    awaiting_payment: (requests || []).filter((r: any) => ['accepted', 'approved', 'terms_confirmed'].includes(r.status)).length,
    completed_rejected: (requests || []).filter((r: any) => ['completed', 'rejected', 'cancelled', 'payment_pending'].includes(r.status)).length
  };

  const filteredRequests = (requests || []).filter((r: any) => {
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'counteroffer';
    if (statusFilter === 'awaiting_payment') return ['accepted', 'approved', 'terms_confirmed'].includes(r.status);
    if (statusFilter === 'completed_rejected') return ['completed', 'rejected', 'cancelled', 'payment_pending'].includes(r.status);
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            statusFilter === 'all'
              ? 'bg-background shadow-xs text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('My Requests', 'என் கோரிக்கைகள்')}
          <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px]">{counts.all}</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            statusFilter === 'pending'
              ? 'bg-background shadow-xs text-amber-600 font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          {t('Pending Owner Approval', 'ஒப்புதலுக்கு காத்திருக்கிறது')}
          {counts.pending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {counts.pending}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('awaiting_payment')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            statusFilter === 'awaiting_payment'
              ? 'bg-background shadow-xs text-emerald-600 font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
          {t('Awaiting Payment', 'கட்டணம் செலுத்த தயார்')}
          {counts.awaiting_payment > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
              {counts.awaiting_payment}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('completed_rejected')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            statusFilter === 'completed_rejected'
              ? 'bg-background shadow-xs text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          {t('Completed / Rejected', 'முடிந்தது / நிராகரிப்பு')}
          <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px]">{counts.completed_rejected}</span>
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-xl bg-card">
          <p className="font-medium">{t('No requests in this category.', 'இந்த பிரிவில் கோரிக்கைகள் எதுவும் இல்லை.')}</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRequests.map((request: any) => {
            const isAccepted = ['accepted', 'approved', 'terms_confirmed'].includes(request.status);
            return (
              <Card key={request._id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={request.type === 'buy' ? 'default' : 'secondary'} className="text-[11px]">
                        {request.type === 'buy' ? t('Buy Offer', 'வாங்க சலுகை') : t('Rental Application', 'வாடகை')}
                      </Badge>
                      {getStatusBadge(request.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-semibold text-base truncate">{displayTa(request.property?.title)}</h4>
                    <p className="text-xs text-muted-foreground">{displayTa(request.property?.location)}</p>
                    <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
                      <span>
                        {t('Listed: ', 'பட்டியல்: ')} <b>₹{Number(request.property?.price || 0).toLocaleString('en-IN')}</b>
                      </span>
                      {request.offerAmount && (
                        <span>
                          {t('My Offer: ', 'என் சலுகை: ')} <b className="text-primary">₹{Number(request.offerAmount).toLocaleString('en-IN')}</b>
                        </span>
                      )}
                      {request.agreedAmount && isAccepted && (
                        <span>
                          {t('Agreed: ', 'ஒப்பந்த தொகை: ')} <b className="text-emerald-600">₹{Number(request.agreedAmount).toLocaleString('en-IN')}</b>
                        </span>
                      )}
                    </div>
                    {request.rejectionReason && (
                      <p className="text-xs text-destructive italic mt-1">
                        {t('Declined Reason: ', 'காரணம்: ')} {request.rejectionReason}
                      </p>
                    )}
                    {request.message && (
                      <p className="text-xs text-muted-foreground italic truncate mt-1">
                        "{request.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {isAccepted && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm gap-1.5"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {t('Pay Now', 'கட்டணம் செலுத்து')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRequest(request)}
                      className="gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t('View & Manage', 'விவரங்களை காண்க')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RequestDetailsModal
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedRequest(null);
        }}
      />
    </div>
  );
}
