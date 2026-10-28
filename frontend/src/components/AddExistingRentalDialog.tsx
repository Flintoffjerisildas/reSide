import { useState } from 'react';
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
import { useCreateSelfManagedRental } from '../hooks/useQueries';
import { toast } from 'sonner';
import {
  Home,
  Building,
  KeyRound,
  Calendar,
  IndianRupee,
  User,
  Phone,
  Mail,
  FileText,
  Upload,
  Info,
  X,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface AddExistingRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdRental: any) => void;
}

export default function AddExistingRentalDialog({
  open,
  onOpenChange,
  onSuccess
}: AddExistingRentalDialogProps) {
  const { t } = useLanguage();
  const createMutation = useCreateSelfManagedRental();

  // Active form section tab
  const [activeTab, setActiveTab] = useState<'property' | 'terms' | 'landlord' | 'documents'>('property');

  // Property info
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');

  // Rental & agreement terms
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMonthToMonth, setIsMonthToMonth] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [rentDueDay, setRentDueDay] = useState('5');
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [moveInDate, setMoveInDate] = useState('');
  const [notes, setNotes] = useState('');

  // Landlord contact (optional)
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [landlordNotes, setLandlordNotes] = useState('');

  // Documents (optional)
  const [documents, setDocuments] = useState<Array<{ name: string; data: string; category: string }>>([]);
  const [docCategory, setDocCategory] = useState<'agreement' | 'receipt' | 'condition_report' | 'other'>('agreement');

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t('Image size must be under 8MB', 'படத்தின் அளவு 8MB-க்கு குறைவாக இருக்க வேண்டும்'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Document upload handler
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t('Document size must be under 15MB', 'ஆவணத்தின் அளவு 15MB-க்கு குறைவாக இருக்க வேண்டும்'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((prev) => [
        ...prev,
        {
          name: file.name,
          data: reader.result as string,
          category: docCategory
        }
      ]);
      toast.success(t('Document attached', 'ஆவணம் இணைக்கப்பட்டது'));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeDoc = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Reset form
  const resetForm = () => {
    setActiveTab('property');
    setPropertyTitle('');
    setPropertyType('Apartment');
    setAddress('');
    setCity('');
    setPostalCode('');
    setLatitude('');
    setLongitude('');
    setDescription('');
    setImage('');
    setMonthlyRent('');
    setSecurityDeposit('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsMonthToMonth(true);
    setEndDate('');
    setRentDueDay('5');
    setPaymentFrequency('monthly');
    setMoveInDate('');
    setNotes('');
    setLandlordName('');
    setLandlordPhone('');
    setLandlordEmail('');
    setLandlordNotes('');
    setDocuments([]);
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!propertyTitle.trim()) {
      toast.error(t('Please enter property or rental title', 'சொத்து அல்லது வாடகை தலைப்பை உள்ளிடவும்'));
      setActiveTab('property');
      return;
    }

    if (!address.trim()) {
      toast.error(t('Please enter the full address', 'முழு முகவரியை உள்ளிடவும்'));
      setActiveTab('property');
      return;
    }

    const rentNum = Number(monthlyRent);
    if (!monthlyRent || isNaN(rentNum) || rentNum <= 0) {
      toast.error(t('Please enter a valid monthly rent amount', 'செல்லுபடியாகும் மாத வாடகைத் தொகையை உள்ளிடவும்'));
      setActiveTab('terms');
      return;
    }

    if (!startDate) {
      toast.error(t('Please select the rental start date', 'வாடகை தொடக்க தேதியைத் தேர்ந்தெடுக்கவும்'));
      setActiveTab('terms');
      return;
    }

    if (!isMonthToMonth && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        toast.error(t('Lease end date cannot precede start date', 'குத்தகை முடிவு தேதி தொடக்க தேதிக்கு முன் இருக்க முடியாது'));
        setActiveTab('terms');
        return;
      }
    }

    const payload = {
      propertyTitle: propertyTitle.trim(),
      propertyType,
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      geoLocation: {
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      },
      image,
      description: description.trim(),
      monthlyRent: rentNum,
      securityDeposit: securityDeposit ? Number(securityDeposit) : 0,
      startDate: new Date(startDate),
      endDate: !isMonthToMonth && endDate ? new Date(endDate) : null,
      rentDueDay: rentDueDay ? Number(rentDueDay) : 5,
      paymentFrequency,
      moveInDate: moveInDate ? new Date(moveInDate) : null,
      notes: notes.trim(),
      landlord: {
        name: landlordName.trim(),
        phone: landlordPhone.trim(),
        email: landlordEmail.trim().toLowerCase(),
        notes: landlordNotes.trim()
      },
      documents
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      toast.success(t('Self-managed rental added successfully!', 'சுய-நிர்வகிக்கப்பட்ட வாடகை வெற்றிகரமாக சேர்க்கப்பட்டது!'));
      resetForm();
      onOpenChange(false);
      onSuccess?.(created);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to create rental record', 'வாடகை பதிவை உருவாக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl glass-panel">
        <DialogHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle className="text-lg font-bold text-foreground">
              {t('Add Existing Rental', 'ஏற்கனவே உள்ள வாடகையைச் சேர்க்க')}
            </DialogTitle>
            <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
              {t('Self-Managed', 'சுய-நிர்வாகம்')}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {t(
              'Register a property you currently rent to independently track rent, receipts, lease dates, and maintenance expenses. Landlord participation is optional.',
              'வாடகை, ரசீதுகள் மற்றும் பராமரிப்பு செலவுகளை கண்காணிக்க உங்கள் தற்போதைய வாடகை சொத்தை பதிவு செய்யவும். உரிமையாளர் கணக்கு தேவையில்லை.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl text-xs font-semibold my-2">
          <button
            type="button"
            onClick={() => setActiveTab('property')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'property'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{t('Property', 'சொத்து')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'terms'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="truncate">{t('Rental Terms', 'வாடகை')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('landlord')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'landlord'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5 text-indigo-600" />
            <span className="truncate">{t('Landlord', 'உரிமையாளர்')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'documents'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" />
            <span className="truncate">{t('Documents', 'ஆவணங்கள்')}</span>
            {documents.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary text-[10px]">
                {documents.length}
              </span>
            )}
          </button>
        </div>

        {/* Informational Disclaimer Box */}
        <div className="bg-sky-500/10 border border-sky-400/20 text-sky-800 dark:text-sky-300 p-2.5 rounded-xl text-xs flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
          <p className="leading-tight">
            {t(
              'This record is private to your account for personal management. It is never displayed as a public listing, verified tenancy, or proof of property ownership.',
              'இந்த பதிவு உங்கள் தனிப்பட்ட பயன்பாட்டிற்கு மட்டுமே. பொதுப் பட்டியலில் தோன்றாது மற்றும் உரிமைக்கான சான்றாகாது.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* TAB 1: PROPERTY INFORMATION */}
          {activeTab === 'property' && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="prop-title" className="text-xs font-semibold">
                  {t('Rental / Property Name', 'சொத்தின் பெயர்')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="prop-title"
                  placeholder="e.g. Greenfield Apartments Flat 4B"
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prop-type" className="text-xs font-semibold">
                    {t('Property Type', 'சொத்து வகை')}
                  </Label>
                  <select
                    id="prop-type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                  >
                    <option value="Apartment">{t('Apartment', 'அபார்ட்மெண்ட்')}</option>
                    <option value="House">{t('House', 'தனி வீடு')}</option>
                    <option value="Villa">{t('Villa', 'வில்லா')}</option>
                    <option value="Room">{t('Single Room / PG', 'தனி அறை')}</option>
                    <option value="Commercial">{t('Commercial', 'வணிக இடம்')}</option>
                    <option value="Other">{t('Other', 'மற்றவை')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prop-city" className="text-xs font-semibold">
                    {t('City', 'நகரம்')}
                  </Label>
                  <Input
                    id="prop-city"
                    placeholder="e.g. Chennai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="prop-address" className="text-xs font-semibold">
                  {t('Full Address', 'முழு முகவரி')} <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="prop-address"
                  placeholder="Street, locality, area details"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prop-postal" className="text-xs font-semibold">
                    {t('Postal Code', 'அஞ்சல் குறியீடு')}
                  </Label>
                  <Input
                    id="prop-postal"
                    placeholder="e.g. 600001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prop-lat" className="text-xs font-semibold">
                    {t('Latitude (optional)', 'அட்சரேகை')}
                  </Label>
                  <Input
                    id="prop-lat"
                    type="number"
                    step="any"
                    placeholder="e.g. 13.0827"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prop-lng" className="text-xs font-semibold">
                    {t('Longitude (optional)', 'தீர்க்கரேகை')}
                  </Label>
                  <Input
                    id="prop-lng"
                    type="number"
                    step="any"
                    placeholder="e.g. 80.2707"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-1 pt-1">
                <Label className="text-xs font-semibold block">
                  {t('Property Photo (optional)', 'புகைப்படம் (விருப்பத்தேர்வு)')}
                </Label>
                <div className="flex items-center gap-3">
                  {image ? (
                    <div className="relative h-16 w-24 rounded-xl overflow-hidden border border-border/60">
                      <img src={image} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImage('')}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-border/80 rounded-xl p-3 flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/30 cursor-pointer transition-all">
                      <Upload className="h-4 w-4 text-primary" />
                      <span>{t('Upload Photo', 'புகைப்படம் பதிவேற்ற')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="prop-desc" className="text-xs font-semibold">
                  {t('Description / Private Notes (optional)', 'குறிப்புகள்')}
                </Label>
                <Textarea
                  id="prop-desc"
                  placeholder="Key features, parking space, meter details, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          {/* TAB 2: RENTAL & AGREEMENT TERMS */}
          {activeTab === 'terms' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="monthly-rent" className="text-xs font-semibold">
                    {t('Monthly Rent (₹)', 'மாத வாடகை (₹)')} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                    <Input
                      id="monthly-rent"
                      type="number"
                      placeholder="e.g. 15000"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      className="h-9 pl-8 text-xs rounded-xl font-semibold"
                      required
                      min={1}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sec-deposit" className="text-xs font-semibold">
                    {t('Security Deposit (₹)', 'முன்பணம் (₹)')}
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="sec-deposit"
                      type="number"
                      placeholder="e.g. 50000"
                      value={securityDeposit}
                      onChange={(e) => setSecurityDeposit(e.target.value)}
                      className="h-9 pl-8 text-xs rounded-xl"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-xs font-semibold">
                    {t('Lease / Rental Start Date', 'குத்தகை தொடக்க தேதி')} <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="due-day" className="text-xs font-semibold">
                    {t('Monthly Rent Due Day', 'மாத தவணை நாள் (1-31)')}
                  </Label>
                  <Input
                    id="due-day"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="5"
                    value={rentDueDay}
                    onChange={(e) => setRentDueDay(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Month-to-Month vs Fixed Lease Toggle */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      {t('Month-to-Month Rental', 'மாதாந்திர வாடகை (நிலையான முடிவு தேதி இல்லை)')}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {t('Enable if you do not have a fixed lease end date', 'முடிவு தேதி இல்லையெனில் இதைத் தேர்ந்தெடுக்கவும்')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isMonthToMonth}
                    onChange={(e) => setIsMonthToMonth(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>

                {!isMonthToMonth && (
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <Label htmlFor="end-date" className="text-xs font-semibold">
                      {t('Lease End Date', 'குத்தகை முடிவு தேதி')}
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="freq" className="text-xs font-semibold">
                    {t('Payment Frequency', 'கட்டண இடைவெளி')}
                  </Label>
                  <select
                    id="freq"
                    value={paymentFrequency}
                    onChange={(e) => setPaymentFrequency(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                  >
                    <option value="monthly">{t('Monthly', 'மாதாந்திர')}</option>
                    <option value="quarterly">{t('Quarterly', 'மூன்று மாதங்களுக்கு ஒருமுறை')}</option>
                    <option value="yearly">{t('Yearly', 'ஆண்டுதோறும்')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="move-in" className="text-xs font-semibold">
                    {t('Move-in Date (optional)', 'குடியேறிய தேதி')}
                  </Label>
                  <Input
                    id="move-in"
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs font-semibold">
                  {t('Renewal Terms & Agreement Notes (optional)', 'புதுப்பித்தல் விதிமுறைகள்')}
                </Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. 5% annual increase clause, 1-month notice requirement, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          {/* TAB 3: LANDLORD CONTACT (OPTIONAL) */}
          {activeTab === 'landlord' && (
            <div className="space-y-3.5">
              <div className="bg-amber-500/10 border border-amber-400/20 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl text-xs flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <p className="leading-tight">
                  {t(
                    'Landlord contact information is completely optional and kept private. Providing details does not create a reSide account or verify identity. You can invite your landlord later if desired.',
                    'உரிமையாளர் விவரங்கள் விருப்பத்தேர்வாகும். இது ஒரு கணக்கை தானாக உருவாக்காது.'
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ll-name" className="text-xs font-semibold">
                  {t("Landlord's Name (optional)", 'உரிமையாளரின் பெயர்')}
                </Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ll-name"
                    placeholder="e.g. Rajesh Kumar"
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    className="h-9 pl-8 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ll-phone" className="text-xs font-semibold">
                    {t('Phone Number (optional)', 'தொலைபேசி எண்')}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ll-phone"
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={landlordPhone}
                      onChange={(e) => setLandlordPhone(e.target.value)}
                      className="h-9 pl-8 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ll-email" className="text-xs font-semibold">
                    {t('Email Address (optional)', 'மின்னஞ்சல்')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ll-email"
                      type="email"
                      placeholder="e.g. landlord@example.com"
                      value={landlordEmail}
                      onChange={(e) => setLandlordEmail(e.target.value)}
                      className="h-9 pl-8 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ll-notes" className="text-xs font-semibold">
                  {t('Landlord Notes / Preferred Payment Method (optional)', 'உரிமையாளர் குறிப்புகள்')}
                </Label>
                <Textarea
                  id="ll-notes"
                  placeholder="e.g. UPI ID: rajesh@okaxis, prefers payment on 1st of month, contact via WhatsApp."
                  value={landlordNotes}
                  onChange={(e) => setLandlordNotes(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          {/* TAB 4: DOCUMENTS (OPTIONAL) */}
          {activeTab === 'documents' && (
            <div className="space-y-3.5">
              <div className="bg-primary/10 border border-primary/20 text-primary p-2.5 rounded-xl text-xs flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <p className="leading-tight">
                  {t(
                    'Attach digital copies of your rental agreement, initial move-in inspection, or deposit receipts. Uploads are strictly stored in your private account.',
                    'உங்கள் வாடகை ஒப்பந்தம் அல்லது ரசீதுகளை தனிப்பட்ட முறையில் பதிவேற்றி நிர்வகிக்கலாம்.'
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-muted/20">
                <div className="w-full sm:w-auto">
                  <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    {t('Document Type', 'ஆவண வகை')}
                  </Label>
                  <select
                    value={docCategory}
                    onChange={(e: any) => setDocCategory(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs w-full sm:w-44"
                  >
                    <option value="agreement">{t('Rental Agreement', 'வாடகை ஒப்பந்தம்')}</option>
                    <option value="receipt">{t('Deposit / Advance Receipt', 'முன்பண ரசீது')}</option>
                    <option value="condition_report">{t('Condition Report', 'வீட்டு நிலை அறிக்கை')}</option>
                    <option value="other">{t('Other Document', 'மற்றவை')}</option>
                  </select>
                </div>

                <div className="w-full sm:w-auto self-end">
                  <label className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t('Upload File', 'கோப்பு பதிவேற்ற')}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Document List */}
              {documents.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('Attached Documents', 'இணைக்கப்பட்ட ஆவணங்கள்')} ({documents.length})
                  </span>
                  <div className="space-y-1.5">
                    {documents.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border/50 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate font-medium">{doc.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {doc.category}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc(i)}
                          className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                          title="Remove document"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-border/70 rounded-xl text-center text-xs text-muted-foreground">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1.5" />
                  <span>{t('No documents attached yet (optional)', 'ஆவணங்கள் எதுவும் இணைக்கப்படவில்லை')}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground order-2 sm:order-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t('Private tenant tracking record', 'தனிப்பட்ட பதிவு')}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2 justify-end">
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
                disabled={createMutation.isPending}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                {createMutation.isPending ? t('Saving...', 'சேமிக்கிறது...') : t('Create Rental Record', 'வாடகை பதிவை உருவாக்கு')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
