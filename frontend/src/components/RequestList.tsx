import { useEffect, useState } from 'react';
import { useGetTenantRequests } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2 } from 'lucide-react';
import { translateText } from '../lib/api';

export default function RequestList() {
  const { t, language } = useLanguage();
  const { data: requests, isLoading } = useGetTenantRequests();
  const [taTextMap, setTaTextMap] = useState<Record<string, string>>({});

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
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request._id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{displayTa(request.property?.title)}</h4>
              <p className="text-sm text-muted-foreground">{displayTa(request.property?.location)}</p>
              <p className="text-sm mt-1">
                <span className="font-medium">{t('Type:', 'வகை:')}</span> {request.type === 'rent' ? t('Rent', 'வாடகை') : t('Buy', 'வாங்க')}
              </p>
              {request.message && (
                <p className="text-sm mt-1 text-muted-foreground">
                  "{request.message}"
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge 
                variant={
                  request.status === 'approved' ? 'default' : 
                  request.status === 'rejected' ? 'destructive' : 
                  'secondary'
                }
              >
                {request.status.toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
