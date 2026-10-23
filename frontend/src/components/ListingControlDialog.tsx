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
import { Property } from '../types';
import { useUpdateListingStatus } from '../hooks/useQueries';
import { toast } from 'sonner';
import {
  Home,
  Building,
  IndianRupee,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  CheckCircle2,
  FileText,
  Users
} from 'lucide-react';

interface ListingControlDialogProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAction?: 'sale' | 'rent' | 'edit';
}

export default function ListingControlDialog({
  property,
  open,
  onOpenChange,
  defaultAction
}: ListingControlDialogProps) {
  const { t } = useLanguage();
  const updateListingStatus = useUpdateListingStatus();

  const [transactionType, setTransactionType] = useState<'purchase' | 'rent'>('purchase');
  const [price, setPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [confirmUnlist, setConfirmUnlist] = useState(false);

  useEffect(() => {
    if (property) {
      const isOccupiedProp = property.occupancyStatus === 'occupied' || !!property.tenant;
      const rawType = String(property.transactionType || '').toLowerCase();
      const initialType = defaultAction === 'rent'
        ? (isOccupiedProp ? 'purchase' : 'rent')
        : defaultAction === 'sale'
        ? 'purchase'
        : rawType === 'rent' && !isOccupiedProp
        ? 'rent'
        : 'purchase';

      setTransactionType(initialType);
      setPrice(property.price ? String(property.price) : '');
      setDescription(property.description || '');
      setConfirmUnlist(false);
    }
  }, [property, defaultAction, open]);

  if (!property) return null;

  const isCurrentlyListed = property.listingStatus === 'listed' || (property.isListed && property.listingStatus !== 'unlisted');
  const isOccupied = property.occupancyStatus === 'occupied' || !!property.tenant;
  const isUnderContract = property.saleStatus === 'under_contract';
  const isAcquired = property.saleStatus === 'sold' || !!property.buyer;

  // Rental listings require genuine vacancy (no tenant, not occupied)
  const cannotListForRent = isOccupied;
  // Sale listings cannot be published only if already under contract
  const cannotListForSale = isUnderContract;

  // Whether current selected transaction type is blocked from publishing
  const cannotPublishSelected = transactionType === 'rent' ? cannotListForRent : cannotListForSale;

  const handlePublish = async (targetType?: 'purchase' | 'rent') => {
    const finalType = targetType || transactionType;
    const numPrice = Number(price);

    if (finalType === 'rent' && isOccupied) {
      toast.error(t('Occupied properties cannot be listed for rent until vacated.', 'காலி செய்யும் வரை குடியேற்றப்பட்ட சொத்தை வாடகைக்கு வெளியிட முடியாது.'));
      return;
    }

    if (finalType !== 'rent' && isUnderContract) {
      toast.error(t('Property is under contract and cannot be published.', 'சொத்து ஒப்பந்தத்தில் உள்ளது, வெளியிட முடியாது.'));
      return;
    }

    if (isNaN(numPrice) || numPrice <= 0) {
      toast.error(t('Please enter a valid price greater than 0', '0-ஐ விட அதிகமான சரியான விலையை உள்ளிடவும்'));
      return;
    }

    try {
      await updateListingStatus.mutateAsync({
        id: property.id || (property as any)._id,
        listingStatus: 'listed',
        transactionType: finalType,
        price: numPrice,
        description: description.trim()
      });

      toast.success(
        finalType === 'rent'
          ? t('Property successfully listed for Rent!', 'சொத்து வாடகைக்கு வெற்றிகரமாக பட்டியலிடப்பட்டது!')
          : t('Property successfully listed for Sale!', 'சொத்து விற்பனைக்கு வெற்றிகரமாக பட்டியலிடப்பட்டது!')
      );
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to update listing status', 'பட்டியல் நிலையைப் புதுப்பிக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  const handleUnlist = async () => {
    try {
      await updateListingStatus.mutateAsync({
        id: property.id || (property as any)._id,
        listingStatus: 'unlisted'
      });

      toast.success(
        t('Property unlisted. It is now private and hidden from public search.', 'சொத்து பட்டியலிலிருந்து நீக்கப்பட்டது. இது இப்போது தனிப்பட்டதாக மறைக்கப்பட்டுள்ளது.')
      );
      setConfirmUnlist(false);
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to unlist property', 'சொத்தை பட்டியலிலிருந்து நீக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  const handleMarkUnavailable = async () => {
    try {
      await updateListingStatus.mutateAsync({
        id: property.id || (property as any)._id,
        listingStatus: 'unavailable'
      });

      toast.success(
        t('Property marked as unavailable.', 'சொத்து கிடைக்கவில்லை என குறிக்கப்பட்டது.')
      );
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || t('Failed to update status', 'நிலையைப் புதுப்பிக்க முடியவில்லை');
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 mr-6">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {isCurrentlyListed
                ? t('Manage Listing Visibility', 'பட்டியல் தெரிவுநிலையை நிர்வகிக்கவும்')
                : t('Publish Property to Public', 'பொதுப் பட்டியலுக்கு வெளியிடவும்')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {t(
              'Control whether this property is visible to buyers and tenants in public search listings.',
              'பொதுத் தேடலில் இந்த சொத்து வாங்குபவர்களுக்கும் வாடகைதாரர்களுக்கும் தெரிய வேண்டுமா என்பதைக் கட்டுப்படுத்தவும்.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Current State Summary Banner */}
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-semibold text-foreground truncate max-w-[220px]">
              {property.title}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAcquired && (
                <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-medium">
                  ✓ {t('Acquired / Owned', 'வாங்கப்பட்டது')}
                </Badge>
              )}
              {isOccupied && (
                <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t('Occupied', 'குடியேற்றப்பட்டது')}
                </Badge>
              )}
              {isCurrentlyListed ? (
                <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {property.transactionType?.toLowerCase() === 'rent'
                    ? t('Listed for Rent', 'வாடகைக்கு வெளியிடப்பட்டது')
                    : t('Listed for Sale', 'விற்பனைக்கு வெளியிடப்பட்டது')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  {t('Private / Unlisted', 'பட்டியலிடப்படவில்லை')}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isCurrentlyListed
              ? t('This property is currently active in public search results.', 'இந்த சொத்து தற்போது பொதுத் தேடல் முடிவுகளில் செயலில் உள்ளது.')
              : isOccupied
              ? t('This property currently has a tenant. It can be listed for sale (with tenant in place), but cannot be listed for rent until vacated.', 'இந்த சொத்தில் தற்போது குத்தகைதாரர் உள்ளார். விற்பனைக்கு பட்டியலிடலாம், ஆனால் காலி செய்யும் வரை வாடகைக்கு வெளியிட முடியாது.')
              : t('This property is private. Only you can view it in your dashboard until you publish.', 'இந்த சொத்து தனிப்பட்டது. நீங்கள் வெளியிடும் வரை உங்கள் கட்டுப்பாட்டு அறையில் மட்டுமே பார்க்க முடியும்.')}
          </div>
        </div>

        {/* Transaction-Specific Guidance Banner */}
        {transactionType === 'rent' && cannotListForRent && (
          <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 p-3 flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('Cannot publish a new rental listing while occupied', 'குடியேற்றப்பட்ட நிலையில் புதிய வாடகைக்கு வெளியிட முடியாது')}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {t(
                  'To prevent conflicting rental agreements, a property must be genuinely vacant before publishing for rent. If you wish to sell this property with the tenant in place, switch to "List for Sale".',
                  'முரண்பாடுகளைத் தவிர்க்க, வாடகைக்கு வெளியிடும் முன் சொத்து காலியாக இருக்க வேண்டும். குத்தகைதாரருடன் விற்க விரும்பினால், "விற்பனைக்கு" மாற்றவும்.'
                )}
              </p>
            </div>
          </div>
        )}

        {transactionType === 'purchase' && isOccupied && (
          <div className="rounded-xl border border-blue-300 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3 flex items-start gap-2.5 text-blue-800 dark:text-blue-300 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('Eligible for Sale (Tenant in Place)', 'விற்பனைக்கு தகுதியானது (குத்தகைதாரருடன்)')}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {t(
                  'This property is occupied. You can list it for sale as an investment property or subject to tenancy terms. Prospective buyers will see that the property currently has a tenant.',
                  'இந்த சொத்து குடியேற்றப்பட்டுள்ளது. இதை முதலீட்டு சொத்தாக அல்லது குத்தகை விதிமுறைகளுக்கு உட்பட்டு விற்கலாம். வாங்குபவர்கள் குத்தகை விவரங்களை அறிந்துகொள்ள முடியும்.'
                )}
              </p>
            </div>
          </div>
        )}

        {isUnderContract && (
          <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 p-3 flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('Property is currently under contract', 'சொத்து தற்போது ஒப்பந்தத்தில் உள்ளது')}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {t('Property cannot be republished while a purchase agreement is pending completion.', 'வாங்குதல் ஒப்பந்தம் முடியும் வரை சொத்தை மீண்டும் வெளியிட முடியாது.')}
              </p>
            </div>
          </div>
        )}

        {/* Unlist Confirmation View */}
        {confirmUnlist ? (
          <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
              <EyeOff className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {t('Confirm Unlist Property?', 'சொத்தை பட்டியலிலிருந்து நீக்கவா?')}
                </p>
                <p className="text-xs opacity-90 mt-1 leading-relaxed">
                  {t(
                    'Unlisting will remove this property from public Buy/Rent searches immediately. Your ownership, existing agreements, payments, and request records will NOT be deleted or altered.',
                    'பட்டியலிலிருந்து நீக்குவது உடனடியாக பொதுத் தேடலில் இருந்து நீக்கும். உங்கள் உரிமை, இருக்கும் ஒப்பந்தங்கள் மற்றும் கட்டணப் பதிவுகள் நீக்கப்படாது.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmUnlist(false)}
                disabled={updateListingStatus.isPending}
              >
                {t('Cancel', 'ரத்து')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnlist}
                disabled={updateListingStatus.isPending}
                className="gap-1.5"
              >
                <EyeOff className="h-3.5 w-3.5" />
                {updateListingStatus.isPending ? t('Unlisting...', 'நீக்குகிறது...') : t('Confirm Unlist', 'நீக்குவதை உறுதிசெய்')}
              </Button>
            </div>
          </div>
        ) : (
          /* Form Controls */
          <div className="space-y-4 py-1">
            {/* Transaction Type Choice */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t('Listing Transaction Type', 'பட்டியல் பரிவர்த்தனை வகை')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={transactionType === 'purchase' ? 'default' : 'outline'}
                  className={`h-11 justify-start gap-2 rounded-xl text-xs sm:text-sm font-medium ${
                    transactionType === 'purchase'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'hover:bg-muted/60'
                  }`}
                  onClick={() => setTransactionType('purchase')}
                  disabled={cannotListForSale}
                >
                  <Building className="h-4 w-4" />
                  <div className="text-left">
                    <div>{t('List for Sale', 'விற்பனைக்கு')}</div>
                    <div className="text-[10px] opacity-80 font-normal">
                      {t('Show in Buy listings', 'வாங்க பகுதியில் காட்டு')}
                    </div>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant={transactionType === 'rent' ? 'default' : 'outline'}
                  className={`h-11 justify-start gap-2 rounded-xl text-xs sm:text-sm font-medium ${
                    transactionType === 'rent'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'hover:bg-muted/60'
                  }`}
                  onClick={() => setTransactionType('rent')}
                  disabled={cannotListForRent}
                >
                  <Home className="h-4 w-4" />
                  <div className="text-left">
                    <div>{t('List for Rent', 'வாடகைக்கு')}</div>
                    <div className="text-[10px] opacity-80 font-normal">
                      {t('Show in Rent listings', 'வாடகை பகுதியில் காட்டு')}
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Price Input */}
            <div className="space-y-1.5">
              <Label htmlFor="listing-price" className="text-xs font-semibold flex items-center justify-between">
                <span>
                  {transactionType === 'rent'
                    ? t('Monthly Rent (₹)', 'மாத வாடகை (₹)')
                    : t('Selling Price (₹)', 'விற்பனை விலை (₹)')}
                </span>
                {price && Number(price) > 0 && (
                  <span className="text-[11px] text-primary font-mono">
                    ₹{Number(price).toLocaleString('en-IN')}
                    {transactionType === 'rent' ? '/mo' : ''}
                  </span>
                )}
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="listing-price"
                  type="number"
                  min="1"
                  step="1"
                  placeholder={transactionType === 'rent' ? 'e.g., 25000' : 'e.g., 7500000'}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-9 h-10 text-sm font-medium"
                  disabled={cannotPublishSelected}
                />
              </div>
            </div>

            {/* Description Input */}
            <div className="space-y-1.5">
              <Label htmlFor="listing-description" className="text-xs font-semibold">
                {t('Listing Description & Highlights', 'பட்டியல் விளக்கம் மற்றும் சிறப்பம்சங்கள்')}
              </Label>
              <Textarea
                id="listing-description"
                rows={3}
                placeholder={t(
                  'Describe key highlights, furnishing status, nearby landmarks, or terms...',
                  'முக்கிய சிறப்பம்சங்கள், வசதிகள், விதிமுறைகளை விவரிக்கவும்...'
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs sm:text-sm resize-none"
                disabled={cannotPublishSelected}
              />
            </div>
          </div>
        )}

        {/* Dialog Actions */}
        {!confirmUnlist && (
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
            {/* Unlist / Unavailable secondary actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
              {isCurrentlyListed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmUnlist(true)}
                  className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs h-9"
                >
                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                  {t('Unlist Property', 'பட்டியலில் இருந்து நீக்கு')}
                </Button>
              )}

              {!isCurrentlyListed && !cannotPublishSelected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkUnavailable}
                  disabled={updateListingStatus.isPending}
                  className="text-muted-foreground text-xs h-9"
                >
                  <Lock className="h-3 w-3 mr-1" />
                  {t('Mark as Unavailable', 'கிடைக்கவில்லை என குறி')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs"
              >
                {t('Cancel', 'ரத்து')}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handlePublish()}
                disabled={cannotPublishSelected || updateListingStatus.isPending || !price || Number(price) <= 0}
                className="h-9 text-xs font-semibold gap-1.5 bg-primary shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {updateListingStatus.isPending
                  ? t('Saving...', 'சேமிக்கிறது...')
                  : isCurrentlyListed
                  ? t('Save & Update Listing', 'சேமித்து புதுப்பிக்கவும்')
                  : transactionType === 'rent'
                  ? t('Publish for Rent', 'வாடகைக்கு வெளியிடு')
                  : t('Publish for Sale', 'விற்பனைக்கு வெளியிடு')}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
