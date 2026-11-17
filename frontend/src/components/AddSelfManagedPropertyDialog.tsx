import React, { useState, useEffect } from 'react';
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
import { useLanguage } from '../contexts/LanguageContext';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  Building2,
  Home,
  MapPin,
  User,
  Phone,
  IndianRupee,
  Calendar,
  Image as ImageIcon,
  Upload,
  Check,
  Wrench,
  ShieldCheck,
  KeyRound,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AddSelfManagedPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdProperty: any) => void;
}

const PROPERTY_TYPES = [
  'Apartment',
  'House',
  'Villa',
  'Shop',
  'Office',
  'Commercial',
  'Plot'
];

const PRESET_IMAGES = [
  {
    label: 'Modern 3BHK Apartment',
    url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80'
  },
  {
    label: 'Contemporary House',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'
  },
  {
    label: 'Luxury Villa with Garden',
    url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80'
  },
  {
    label: 'Urban Living Space',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'
  }
];

export default function AddSelfManagedPropertyDialog({
  open,
  onOpenChange,
  onSuccess
}: AddSelfManagedPropertyDialogProps) {
  const { t } = useLanguage();
  const { data: userProfile } = useGetCallerUserProfile();

  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [ownerDetails, setOwnerDetails] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [totalUnits, setTotalUnits] = useState('1');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [rentDueDay, setRentDueDay] = useState('5');
  const [leaseStartDate, setLeaseStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaseEndDate, setLeaseEndDate] = useState(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  });
  const [propertyStatus, setPropertyStatus] = useState<'Vacant' | 'Occupied'>('Vacant');
  const [maintenanceDetails, setMaintenanceDetails] = useState('₹2,500/mo');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-fill owner and phone when profile loads
  useEffect(() => {
    if (userProfile?.name && !ownerDetails) {
      setOwnerDetails(userProfile.name);
    }
    if (userProfile?.phone && !contactNumber) {
      setContactNumber(userProfile.phone);
    }
  }, [userProfile, ownerDetails, contactNumber]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Image size exceeds 5MB limit', 'படத்தின் அளவு 5MB-ஐ விட அதிகமாக உள்ளது'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!propertyName.trim()) {
      setErrorMsg(t('Please enter the Property Name', 'சொத்தின் பெயரை உள்ளிடவும்'));
      return;
    }
    if (!propertyAddress.trim()) {
      setErrorMsg(t('Please enter the Property Address', 'சொத்தின் முகவரியை உள்ளிடவும்'));
      return;
    }
    if (!monthlyRent || Number(monthlyRent) <= 0) {
      setErrorMsg(t('Please enter a valid Monthly Rent', 'சரியான மாத வாடகையை உள்ளிடவும்'));
      return;
    }

    try {
      setIsSubmitting(true);

      const finalImage = imageUrl.trim() || PRESET_IMAGES[0].url;

      // Extract numeric maintenance if available
      const parsedMaintenance = parseInt(maintenanceDetails.replace(/[^0-9]/g, '')) || 0;

      const payload = {
        title: propertyName.trim(),
        propertyType: propertyType,
        location: propertyAddress.trim(),
        price: Number(monthlyRent),
        transaction: 'Rent',
        transactionType: 'rent',
        description: `${totalUnits ? `${totalUnits} Units. ` : ''}${maintenanceDetails ? `Maintenance: ${maintenanceDetails}. ` : ''}Self-managed residential property portfolio.`,
        images: [finalImage],
        securityDeposit: securityDeposit ? Number(securityDeposit) : Number(monthlyRent) * 2,
        monthlyMaintenance: parsedMaintenance,
        maintenanceDetails: maintenanceDetails.trim() || 'Included',
        ownerName: ownerDetails.trim() || userProfile?.name || 'Owner',
        contactNumber: contactNumber.trim(),
        totalUnits: Number(totalUnits) || 1,
        rentDueDay: Number(rentDueDay) || 5,
        rentDueDate: `${rentDueDay}th of month`,
        leaseStartDate: leaseStartDate || undefined,
        leaseEndDate: leaseEndDate || undefined,
        occupancyStatus: propertyStatus.toLowerCase() === 'occupied' ? 'occupied' : 'vacant',
        isSelfManaged: true,
        category: 'owned',
        status: 'approved',
        listingStatus: 'unlisted',
        isListed: false
      };

      const res = await api.post('/properties', payload);

      toast.success(
        t('Self-Managed property successfully added!', 'சுய-நிர்வகிக்கப்பட்ட சொத்து வெற்றிகரமாக சேர்க்கப்பட்டது!')
      );

      // Reset form
      setPropertyName('');
      setPropertyAddress('');
      setMonthlyRent('');
      setSecurityDeposit('');
      setImageUrl('');

      if (onSuccess) {
        onSuccess(res.data);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error adding self-managed property:', err);
      const msg = err.response?.data?.msg || err.message || t('Failed to save property', 'சொத்தை சேமிக்க முடியவில்லை');
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 bg-white dark:bg-[#070e1b] rounded-3xl border border-blue-100/90 dark:border-slate-800 shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-900/40">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('Self Manage Property', 'சுய மேலாண்மை சொத்து')}</span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  Self-Managed
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'Add a property you own and manage independently to track active units, rent dues, leases, and tenant details.',
                  'குத்தகை மற்றும் வாடகை நிலுவைகளை சுயாதீனமாக கண்காணிக்க உங்கள் சொத்தை சேர்க்கவும்.'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* SECTION 1: Core Property Details */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 text-blue-500" />
              <span>{t('Property Identification', 'சொத்து அடையாளம்')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Property Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Property Name', 'சொத்தின் பெயர்')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  required
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder={t('e.g. Greenfield Heights 3BHK', 'உதா. கிரீன்ஃபீல்ட் ஹைட்ஸ்')}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Property Type */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Property Type', 'சொத்து வகை')} <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border border-slate-200/90 dark:border-slate-700 px-3 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Address */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-500" />
                  <span>{t('Property Address / Location', 'சொத்து முகவரி / இடம்')}</span>
                  <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  required
                  rows={2}
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder={t('e.g. Flat 402, 12th Cross, Anna Nagar, Chennai - 600040', 'முழு முகவரியை உள்ளிடவும்')}
                  className="text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700 min-h-[56px]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Owner & Contact Details */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-500" />
              <span>{t('Owner & Management Contact', 'உரிமையாளர் தொடர்பு')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Owner Details */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Owner Details', 'உரிமையாளர் பெயர்')}
                </Label>
                <Input
                  value={ownerDetails}
                  onChange={(e) => setOwnerDetails(e.target.value)}
                  placeholder={t('Owner Name', 'பெயர்')}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Contact Number */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>{t('Contact Number', 'தொடர்பு எண்')}</span>
                </Label>
                <Input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Units, Rental Dues & Financials */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t('Rental Dues & Financial Terms', 'வாடகை & நிதி விதிமுறைகள்')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Units / Rooms */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Layers className="h-3 w-3 text-slate-400" />
                  <span>{t('Total Units / Rooms', 'மொத்த அலகுகள் / அறைகள்')}</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={totalUnits}
                  onChange={(e) => setTotalUnits(e.target.value)}
                  placeholder="e.g. 10"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Monthly Rent */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <IndianRupee className="h-3 w-3 text-emerald-500" />
                  <span>{t('Monthly Rent', 'மாத வாடகை')} (₹)</span>
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  required
                  min="0"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder="e.g. 25000"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700 font-semibold"
                />
              </div>

              {/* Security Deposit */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Security Deposit', 'முன்பணம்')} (₹)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  placeholder="e.g. 50000"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Rent Due Date (Day of Month) */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-500" />
                  <span>{t('Rent Due Day of Month', 'வாடகை தவணை நாள்')}</span>
                </Label>
                <select
                  value={rentDueDay}
                  onChange={(e) => setRentDueDay(e.target.value)}
                  className="w-full h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border border-slate-200/90 dark:border-slate-700 px-3 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day} {t('of every month', 'ஆம் தேதி')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Status */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Property Status', 'சொத்தின் நிலை')}
                </Label>
                <select
                  value={propertyStatus}
                  onChange={(e) => setPropertyStatus(e.target.value as any)}
                  className="w-full h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border border-slate-200/90 dark:border-slate-700 px-3 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Vacant">{t('Vacant (Available)', 'காலியாக')}</option>
                  <option value="Occupied">{t('Occupied (Tenancy Active)', 'குடியேற்றப்பட்டது')}</option>
                </select>
              </div>

              {/* Maintenance Details */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-slate-400" />
                  <span>{t('Maintenance Details', 'பராமரிப்பு விவரம்')}</span>
                </Label>
                <Input
                  value={maintenanceDetails}
                  onChange={(e) => setMaintenanceDetails(e.target.value)}
                  placeholder="e.g. ₹2,500/mo or Included"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Lease Start Date */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-blue-500" />
                  <span>{t('Lease Start Date', 'குத்தகை தொடக்கம்')}</span>
                </Label>
                <Input
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>

              {/* Lease End Date */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-blue-500" />
                  <span>{t('Lease End Date', 'குத்தகை முடிவு')}</span>
                </Label>
                <Input
                  type="date"
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Image Upload / URL & Presets */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
              <span>{t('Property Photo / Media', 'சொத்து புகைப்படம்')}</span>
            </h4>

            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={t('Enter Image URL or select preset below...', 'படத்தின் இணைய முகவரி...')}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-[#0a1628] border-slate-200/90 dark:border-slate-700 flex-1"
                />
                <label className="h-9 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0 transition-colors">
                  <Upload className="h-3.5 w-3.5 text-blue-600" />
                  <span>{t('Upload File', 'பதிவேற்று')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Preset Thumbnails */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium block">
                  {t('Or choose a curated architectural preset:', 'அல்லது மாதிரி புகைப்படத்தைத் தேர்வுசெய்க:')}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_IMAGES.map((preset, idx) => {
                    const isSelected = imageUrl === preset.url || (!imageUrl && idx === 0);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className={`relative rounded-xl overflow-hidden border-2 text-left p-1 transition cursor-pointer group ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-800'
                        }`}
                      >
                        <div className="aspect-[16/10] w-full rounded-lg overflow-hidden bg-slate-100 relative">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5 shadow-xs">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 block truncate pt-1">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-9 text-xs rounded-xl"
            >
              {t('Cancel', 'ரத்து')}
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto h-9 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5"
            >
              {isSubmitting ? (
                <span>{t('Saving Property...', 'சேமிக்கிறது...')}</span>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('Save Property', 'சொத்தை சேமி')}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

