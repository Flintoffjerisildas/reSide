import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import { PropertyRequest } from '../types';
import {
  User,
  Mail,
  Phone,
  Home,
  MapPin,
  Calendar,
  Users,
  Briefcase,
  Heart,
  FileText
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import RequestPropertyDialog from './RequestPropertyDialog';
import AuthDialog from './AuthDialog';
import { translateText } from '../lib/api';

interface RequestDetailsModalProps {
  request: PropertyRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  isLoading?: boolean;
}

export default function RequestDetailsModal({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isLoading = false
}: RequestDetailsModalProps) {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [propertyTitleTa, setPropertyTitleTa] = useState<string | null>(null);
  const [propertyLocationTa, setPropertyLocationTa] = useState<string | null>(null);

  const title = String(request?.property?.title || '').trim();
  const loc = String(request?.property?.location || '').trim();

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

  const { tenant, property, tenantDetails, type, status } = request;

  const tenantProfile: any = tenant || {};
  const hasExtendedProfile =
    tenantProfile.address ||
    tenantProfile.dateOfBirth ||
    tenantProfile.gender ||
    tenantProfile.age !== undefined ||
    tenantProfile.familyMembers !== undefined ||
    tenantProfile.religion ||
    tenantProfile.occupation ||
    tenantProfile.companyName ||
    tenantProfile.monthlyIncome !== undefined ||
    tenantProfile.maritalStatus ||
    tenantProfile.idType ||
    tenantProfile.idNumber ||
    tenantProfile.aadhar ||
    tenantProfile.idProofImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Rental Request Details', 'வாடகை கோரிக்கை விவரங்கள்')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Type and Status */}
          <div className="flex items-center gap-3">
            <Badge variant={type === 'rent' ? 'default' : 'secondary'}>
              {type === 'rent' ? t('Rent Request', 'வாடகை கோரிக்கை') : t('Buy Request', 'வாங்க கோரிக்கை')}
            </Badge>
            <Badge variant={
              status === 'pending' ? 'secondary' :
              status === 'approved' ? 'default' :
              'destructive'
            }>
              {status.toUpperCase()}
            </Badge>
          </div>

          {/* Property Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                {t('Property Information', 'சொத்து தகவல்')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Property Name', 'சொத்து பெயர்')}</p>
                <p className="text-lg font-semibold">
                  {language === 'ta' ? (propertyTitleTa || property?.title) : property?.title}
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{language === 'ta' ? (propertyLocationTa || property?.location) : property?.location}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Property Type', 'சொத்து வகை')}</p>
                  <p className="capitalize">{property?.propertyType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Price', 'விலை')}</p>
                  <p className="font-semibold">₹{property?.price?.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('Tenant Information', 'குத்தகைதாரர் தகவல்')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Name', 'பெயர்')}</p>
                  <p className="font-semibold">{tenant?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Email', 'மின்னஞ்சல்')}</p>
                  <p className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {tenant?.email}
                  </p>
                </div>
              </div>
              {tenant?.phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Phone', 'தொலைபேசி')}</p>
                  <p className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {tenant?.phone}
                  </p>
                </div>
              )}
              {tenantProfile.address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Address', 'முகவரி')}</p>
                  <p className="text-sm">{tenantProfile.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tenant Detailed Profile Information */}
          {hasExtendedProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('Tenant Profile Details', 'குத்தகைதாரர் சுயவிவர விவரங்கள்')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Age', 'வயது')}</p>
                    <p className="font-semibold">
                      {tenantProfile.age !== undefined ? tenantProfile.age : '-'}
                      {tenantProfile.age !== undefined && <> {t('years', 'வருடங்கள்')}</>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Date of Birth', 'பிறந்த தேதி')}</p>
                    {tenantProfile.dateOfBirth ? (
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(tenantProfile.dateOfBirth).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Gender', 'பாலினம்')}</p>
                    <p className="font-semibold">
                      {tenantProfile.gender || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Marital Status', 'திருமண நிலை')}</p>
                    <p className="font-semibold">
                      {tenantProfile.maritalStatus || '-'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Family Members', 'குடும்ப உறுப்பினர்கள்')}</p>
                    <p className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {tenantProfile.familyMembers !== undefined ? tenantProfile.familyMembers : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Religion', 'மதம்')}</p>
                    <p className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {tenantProfile.religion || '-'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Occupation', 'தொழில்')}</p>
                    <p className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {tenantProfile.occupation || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('Company Name', 'நிறுவனத்தின் பெயர்')}</p>
                    <p className="text-sm">
                      {tenantProfile.companyName || '-'}
                    </p>
                  </div>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">
                       {t('Monthly Income (Optional)', 'மாத வருமானம் (விருப்பம்)')}
                     </p>
                     <p className="text-sm">
                       {tenantProfile.monthlyIncome !== undefined
                         ? `₹${Number(tenantProfile.monthlyIncome).toLocaleString()}`
                         : '-'}
                     </p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">{t('Notifications', 'அறிவிப்புகள்')}</p>
                     <p className="text-sm">
                       {tenantProfile.notificationsEnabled === false
                         ? t('Off', 'ஆஃப்')
                         : t('On', 'ஆன்')}
                     </p>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">{t('ID Type', 'அடையாள வகை')}</p>
                     <p className="text-sm">
                       {tenantProfile.idType || '-'}
                     </p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">{t('ID Number', 'அடையாள எண்')}</p>
                     <p className="font-mono text-sm">
                       {tenantProfile.idNumber || tenantProfile.aadhar || '-'}
                     </p>
                   </div>
                 </div>

                 {tenantProfile.idProofImage && (
                   <div className="space-y-2">
                     <p className="text-sm font-medium text-muted-foreground">
                       {t('ID Proof', 'அடையாள ஆதாரம்')}
                     </p>
                     <div className="border rounded-md p-2 inline-block bg-muted">
                       <img
                         src={tenantProfile.idProofImage}
                         alt="ID Proof"
                         className="max-h-40 max-w-full object-contain"
                       />
                     </div>
                   </div>
                 )}
              </CardContent>
            </Card>
          )}

          {!hasExtendedProfile && (
            <Card className="border-dashed bg-muted/50">
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  {t('Tenant detailed information not provided', 'குத்தகைதாரர் விரிவான தகவல் வழங்கப்படவில்லை')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {status === 'pending' && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="destructive"
                onClick={() => onReject(request._id)}
                disabled={isLoading}
                className="flex-1"
              >
                {t('Reject Request', 'கோரிக்கையை நிராகரிக்கவும்')}
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => onApprove(request._id)}
                disabled={isLoading}
              >
                {t('Approve Request', 'கோரிக்கையை அங்கீகரிக்கவும்')}
              </Button>
            </div>
          )}

          {status !== 'pending' && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-center text-sm font-medium text-muted-foreground">
                {status === 'approved'
                  ? t('This request has been approved', 'இந்த கோரிக்கை அங்கீகரிக்கப்பட்டுவிட்டது')
                  : t('This request has been rejected', 'இந்த கோரிக்கை நிராகரிக்கப்பட்டுவிட்டது')}
              </p>
            </div>
          )}

          {/* Request Property Button (hidden in owner dashboard usage) */}
          {/* Intentionally removed for owner view as per requirement */}
        </div>
      </DialogContent>

      <RequestPropertyDialog
        property={request.property}
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        onSuccess={() => {
          setShowRequestDialog(false);
        }}
      />

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog} 
      />
    </Dialog>
  );
}
