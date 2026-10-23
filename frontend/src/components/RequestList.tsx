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

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs">
            <Clock className="w-3 h-3 mr-1 inline" />
            {t('Pending Response', 'நிலுவையில்')}
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
        return (
          <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-300 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {t('Offer Accepted', 'ஏற்றுக்கொள்ளப்பட்டது')}
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="bg-emerald-600 text-white text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            {t('Approved', 'அங்கீகரிக்கப்பட்டது')}
          </Badge>
        );
      case 'terms_confirmed':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300 text-xs">
            <ShieldCheck className="w-3 h-3 mr-1 inline" />
            {t('Terms Confirmed', 'விதிமுறைகள் உறுதி')}
          </Badge>
        );
      case 'payment_pending':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-300 text-xs">
            <CreditCard className="w-3 h-3 mr-1 inline" />
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
      default:
        return <Badge variant="secondary" className="text-xs">{st}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('No requests found', 'கோரிக்கைகள் எதுவும் காணப்படவில்லை')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => (
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
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span>
                    {t('Listed: ', 'பட்டியல்: ')} <b>₹{Number(request.property?.price || 0).toLocaleString('en-IN')}</b>
                  </span>
                  {request.offerAmount && (
                    <span>
                      {t('My Offer: ', 'என் சலுகை: ')} <b className="text-primary">₹{Number(request.offerAmount).toLocaleString('en-IN')}</b>
                    </span>
                  )}
                  {request.counterOfferAmount && request.status === 'counteroffer' && (
                    <span className="text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200">
                      {t('Counteroffer: ', 'எதிர் சலுகை: ')} ₹{Number(request.counterOfferAmount).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {request.message && (
                  <p className="text-xs text-muted-foreground italic truncate mt-1">
                    "{request.message}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
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
        ))}
      </div>

      <RequestDetailsModal
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedRequest(null);
        }}
      />
    </>
  );
}
