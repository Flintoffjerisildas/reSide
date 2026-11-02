'use client';

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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '../contexts/LanguageContext';
import { useUpdateProperty, useUpdateListingStatus } from '../hooks/useQueries';
import { toast } from 'sonner';
import { Property } from '../types';
import {
  Settings,
  Globe,
  EyeOff,
  User,
  Check,
  Search,
  Building,
  Trash2,
  Loader2,
  Tag,
  SlidersHorizontal
} from 'lucide-react';

interface ListingControlsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  onPropertyUpdated?: () => void;
  onUpdateProperty?: (propertyId: string, updates: Partial<Property>) => void;
}

export default function ListingControlsDialog({
  open,
  onOpenChange,
  properties,
  onPropertyUpdated,
  onUpdateProperty,
}: ListingControlsDialogProps) {
  const { t } = useLanguage();
  const updatePropertyMutation = useUpdateProperty();
  const updateListingStatusMutation = useUpdateListingStatus();

  const [internalProperties, setInternalProperties] = useState<Property[]>(properties);

  // Keep internal properties synced when parent properties change
  useEffect(() => {
    setInternalProperties(properties);
  }, [properties]);

  const activeProperties = internalProperties && internalProperties.length > 0 ? internalProperties : properties;

  const [searchQuery, setSearchQuery] = useState('');
  const [tenantNameInputs, setTenantNameInputs] = useState<Record<string, string>>({});
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);
  const [addingSectionPropId, setAddingSectionPropId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  const getPropId = (prop: Property): string => {
    return (prop as any)?._id || prop?.id || '';
  };

  const filteredProperties = activeProperties.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (p.title || '').toLowerCase();
    const loc = (p.location || '').toLowerCase();
    const type = (p.propertyType || '').toLowerCase();
    return title.includes(q) || loc.includes(q) || type.includes(q);
  });

  const getTenantInputValue = (prop: Property): string => {
    const id = getPropId(prop);
    if (tenantNameInputs[id] !== undefined) {
      return tenantNameInputs[id];
    }
    return (
      (prop as any)?.tenantName ||
      (typeof prop.tenant === 'object' && prop.tenant ? (prop.tenant as any).name : '') ||
      ''
    );
  };

  const handleTenantInputChange = (propId: string, value: string) => {
    setTenantNameInputs((prev) => ({
      ...prev,
      [propId]: value,
    }));
  };

  // Toggle Listing Status (Active / Disabled)
  const handleToggleListing = async (prop: Property) => {
    const propId = getPropId(prop);
    if (!propId) return;

    const isCurrentlyActive =
      (prop as any)?.isListed === true ||
      (prop as any)?.listingStatus === 'listed' ||
      (prop as any)?.status === 'Active (Listed)';

    const newIsListed = !isCurrentlyActive;
    const newListingStatus: 'listed' | 'unlisted' = newIsListed ? 'listed' : 'unlisted';
    const newStatus = newIsListed ? 'Active (Listed)' : 'Disabled (Unlisted)';

    const updates = {
      isListed: newIsListed,
      listingStatus: newListingStatus,
      status: newStatus,
    };

    // 1. Immediate local state flip for instantaneous UI re-render
    setInternalProperties((prev) =>
      prev.map((p) => {
        const id = getPropId(p);
        return id === propId || p.id === propId ? ({ ...p, ...updates } as Property) : p;
      })
    );

    // 2. Invoke parent handler if provided
    onUpdateProperty?.(prop.id || (prop as any)?._id || propId, {
      isListed: newIsListed,
      status: newStatus,
    });

    setSavingPropertyId(propId);

    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: updates as any,
      });

      toast.success(
        newIsListed
          ? t('Property listing enabled & active!', 'சொத்து பட்டியல் செயல்படுத்தப்பட்டது!')
          : t('Property listing disabled (private)', 'சொத்து பட்டியல் முடக்கப்பட்டது (தனிப்பட்டது)')
      );
      onPropertyUpdated?.();
    } catch (err: any) {
      // Fallback with listing-status endpoint
      try {
        await updateListingStatusMutation.mutateAsync({
          id: propId,
          listingStatus: newListingStatus,
          transactionType: prop.transactionType || (prop as any)?.transaction,
          price: prop.price,
        });
        toast.success(
          newIsListed
            ? t('Property listing enabled & active!', 'சொத்து பட்டியல் செயல்படுத்தப்பட்டது!')
            : t('Property listing disabled (private)', 'சொத்து பட்டியல் முடக்கப்பட்டது (தனிப்பட்டது)')
        );
        onPropertyUpdated?.();
      } catch (innerErr: any) {
        // Revert local state on error
        setInternalProperties((prev) =>
          prev.map((p) => {
            const id = getPropId(p);
            return id === propId || p.id === propId
              ? ({
                  ...p,
                  isListed: isCurrentlyActive,
                  listingStatus: isCurrentlyActive ? 'listed' : 'unlisted',
                  status: isCurrentlyActive ? 'Active (Listed)' : 'Disabled (Unlisted)',
                } as Property)
              : p;
          })
        );
        onUpdateProperty?.(prop.id || (prop as any)?._id || propId, {
          isListed: isCurrentlyActive,
          status: isCurrentlyActive ? 'Active (Listed)' : 'Disabled (Unlisted)',
        });
        toast.error(
          innerErr?.response?.data?.msg ||
            err?.response?.data?.msg ||
            t('Failed to update listing status', 'பட்டியல் நிலையைப் புதுப்பிக்க முடியவில்லை')
        );
      }
    } finally {
      setSavingPropertyId(null);
    }
  };

  // Assign or Update Customer/Tenant Name
  const handleSaveTenantName = async (prop: Property) => {
    const propId = getPropId(prop);
    if (!propId) return;

    const nameToAssign = getTenantInputValue(prop).trim();
    setSavingPropertyId(propId);

    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          tenantName: nameToAssign,
          occupancyStatus: nameToAssign ? 'occupied' : 'vacant',
        } as any,
      });

      toast.success(
        nameToAssign
          ? t(`Assigned customer/tenant: ${nameToAssign}`, `வாடிக்கையாளர்/வாடகைதாரர் ஒதுக்கப்பட்டார்: ${nameToAssign}`)
          : t('Tenant assignment cleared (marked vacant)', 'வாடகைதாரர் ஒதுக்கீடு நீக்கப்பட்டது (காலியாக குறிக்கப்பட்டது)')
      );
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.msg ||
        t('Failed to update tenant name', 'வாடகைதாரர் பெயரைப் புதுப்பிக்க முடியவில்லை')
      );
    } finally {
      setSavingPropertyId(null);
    }
  };

  const handleClearTenant = async (prop: Property) => {
    const propId = getPropId(prop);
    handleTenantInputChange(propId, '');

    setSavingPropertyId(propId);
    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          tenantName: '',
          occupancyStatus: 'vacant',
        } as any,
      });

      toast.success(t('Tenant assignment cleared', 'வாடகைதாரர் ஒதுக்கீடு நீக்கப்பட்டது'));
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to clear tenant', 'பிழை ஏற்பட்டது'));
    } finally {
      setSavingPropertyId(null);
    }
  };

  // Toggle Section Visibility (showPrice, showAddress, showAmenities, acceptOffers)
  const handleToggleSection = async (
    prop: Property,
    field: 'showPrice' | 'showAddress' | 'showAmenities' | 'acceptOffers',
    value: boolean
  ) => {
    const propId = getPropId(prop);
    if (!propId) return;

    // Immediate optimistic state updates
    setInternalProperties((prev) =>
      prev.map((p) => (getPropId(p) === propId ? { ...p, [field]: value } : p))
    );
    onUpdateProperty?.(propId, { [field]: value });

    setSavingPropertyId(propId);
    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          [field]: value,
        } as any,
      });

      const fieldLabels: Record<string, string> = {
        showPrice: t('Price visibility updated', 'விலை தெரிவுநிலை புதுப்பிக்கப்பட்டது'),
        showAddress: t('Address visibility updated', 'முகவரி தெரிவுநிலை புதுப்பிக்கப்பட்டது'),
        showAmenities: t('Amenities visibility updated', 'வசதிகள் தெரிவுநிலை புதுப்பிக்கப்பட்டது'),
        acceptOffers: t('Offer acceptance setting updated', 'சலுகைகள் ஏற்பு அமைப்பு புதுப்பிக்கப்பட்டது'),
      };

      toast.success(fieldLabels[field] || t('Setting updated', 'அமைப்பு புதுப்பிக்கப்பட்டது'));
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to update setting', 'அமைப்பை புதுப்பிக்க முடியவில்லை'));
    } finally {
      setSavingPropertyId(null);
    }
  };

  // Add Custom Section
  const handleSaveCustomSection = async (prop: Property) => {
    const propId = getPropId(prop);
    if (!propId) return;

    const trimmedName = newSectionName.trim();
    if (!trimmedName) {
      toast.error(t('Please enter section name', 'பிரிவின் பெயரை உள்ளிடவும்'));
      return;
    }

    const currentSections = Array.isArray(prop.customSections) ? [...prop.customSections] : [];
    const updatedSections = [...currentSections, { title: trimmedName, enabled: true }];

    // Immediate state updates
    setInternalProperties((prev) =>
      prev.map((p) => (getPropId(p) === propId ? { ...p, customSections: updatedSections } : p))
    );
    onUpdateProperty?.(propId, { customSections: updatedSections });

    setAddingSectionPropId(null);
    setNewSectionName('');

    setSavingPropertyId(propId);
    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          customSections: updatedSections,
        } as any,
      });

      toast.success(t(`Added section: ${trimmedName}`, `பிரிவு சேர்க்கப்பட்டது: ${trimmedName}`));
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to save section', 'பிரிவை சேமிக்க முடியவில்லை'));
    } finally {
      setSavingPropertyId(null);
    }
  };

  // Toggle Custom Section Switch
  const handleToggleCustomSection = async (prop: Property, indexToToggle: number, enabled: boolean) => {
    const propId = getPropId(prop);
    if (!propId) return;

    const currentSections = Array.isArray(prop.customSections) ? [...prop.customSections] : [];
    const updatedSections = currentSections.map((sec, idx) =>
      idx === indexToToggle ? { ...sec, enabled } : sec
    );

    // Immediate state updates
    setInternalProperties((prev) =>
      prev.map((p) => (getPropId(p) === propId ? { ...p, customSections: updatedSections } : p))
    );
    onUpdateProperty?.(propId, { customSections: updatedSections });

    setSavingPropertyId(propId);
    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          customSections: updatedSections,
        } as any,
      });

      toast.success(t('Section visibility updated', 'பிரிவு தெரிவுநிலை புதுப்பிக்கப்பட்டது'));
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to update section', 'பிரிவை புதுப்பிக்க முடியவில்லை'));
    } finally {
      setSavingPropertyId(null);
    }
  };

  // Delete Custom Section
  const handleDeleteCustomSection = async (prop: Property, indexToDelete: number) => {
    const propId = getPropId(prop);
    if (!propId) return;

    const currentSections = Array.isArray(prop.customSections) ? [...prop.customSections] : [];
    const target = currentSections[indexToDelete];
    const updatedSections = currentSections.filter((_, idx) => idx !== indexToDelete);

    // Immediate state updates
    setInternalProperties((prev) =>
      prev.map((p) => (getPropId(p) === propId ? { ...p, customSections: updatedSections } : p))
    );
    onUpdateProperty?.(propId, { customSections: updatedSections });

    setSavingPropertyId(propId);
    try {
      await updatePropertyMutation.mutateAsync({
        id: propId,
        data: {
          customSections: updatedSections,
        } as any,
      });

      toast.success(t(`Deleted section: ${target?.title || ''}`, `பிரிவு நீக்கப்பட்டது: ${target?.title || ''}`));
      onPropertyUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || t('Failed to delete section', 'பிரிவை நீக்க முடியவில்லை'));
    } finally {
      setSavingPropertyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-border/60 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-card">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {t('Listing Controls & Management', 'பட்டியல் கட்டுப்பாடுகள் & மேலாண்மை')}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    'Control listing visibility, toggle visible sections, configure custom details, and assign tenants.',
                    'பட்டியல் தெரிவுநிலை, தெரியும் பிரிவுகள், தனிப்பயன் விவரங்கள் மற்றும் வாடகைதாரர்களை நிர்வகிக்கவும்.'
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search filter if multiple properties */}
          {properties.length > 2 && (
            <div className="mt-3.5 relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Search properties by title, location...', 'சொத்து தலைப்பு, இடம் மூலம் தேடுங்கள்...')}
                className="pl-9 h-8.5 text-xs rounded-xl bg-white dark:bg-background border-slate-200 dark:border-border"
              />
            </div>
          )}
        </div>

        {/* Property List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {filteredProperties.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Building className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                {t('No properties found', 'சொத்துக்கள் எதுவும் இல்லை')}
              </p>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? t('No properties matched your search term.', 'தேடலுக்கு பொருந்தும் சொத்துக்கள் இல்லை.')
                  : t('Add a property to start managing its listing and tenants.', 'பட்டியல் மற்றும் வாடகைதாரர்களை நிர்வகிக்க ஒரு சொத்தைச் சேர்க்கவும்.')}
              </p>
            </div>
          ) : (
            filteredProperties.map((prop) => {
              const propId = getPropId(prop);
              const isBusy = savingPropertyId === propId;
              const isListed =
                (prop as any)?.isListed === true ||
                (prop as any)?.listingStatus === 'listed';
              const assignedTenant = getTenantInputValue(prop);
              const txType = (prop.transactionType || (prop as any)?.transaction || 'purchase').toLowerCase();

              return (
                <div
                  key={propId}
                  className="rounded-2xl border border-slate-200 dark:border-border/80 bg-slate-50/50 dark:bg-muted/20 p-4 space-y-3.5 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors"
                >
                  {/* Property Header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-foreground truncate max-w-sm">
                          {prop.title || t('Untitled Property', 'பெயரிடப்படாத சொத்து')}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        >
                          {prop.propertyType || 'Property'}
                        </Badge>
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white flex items-center gap-1 ${
                            txType === 'rent' ? 'bg-purple-600' : 'bg-blue-600'
                          }`}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {txType === 'rent' ? t('Rent', 'வாடகை') : t('Sale', 'விற்பனை')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {prop.location || t('No address provided', 'முகவரி இல்லை')}
                        {prop.price ? ` • ₹${Number(prop.price).toLocaleString('en-IN')}${txType === 'rent' ? '/mo' : ''}` : ''}
                      </p>
                    </div>

                    {/* Listing Status Badge */}
                    <Badge
                      variant="outline"
                      className={`text-xs px-2.5 py-1 font-semibold rounded-lg shrink-0 flex items-center gap-1.5 ${
                        isListed
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isListed ? (
                        <>
                          <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{t('Active (Listed)', 'செயலில் (பட்டியலிடப்பட்டது)')}</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                          <span>{t('Disabled (Unlisted)', 'முடக்கப்பட்டது (தனிப்பட்டது)')}</span>
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Primary Controls Row: Listing Visibility & Customer/Tenant */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-border/60">
                    {/* Control 1: Listing Toggle */}
                    <div className="p-3 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          {t('Listing Visibility', 'பட்டியல் தெரிவுநிலை')}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {isListed
                            ? t('Publicly visible in search & catalog', 'தேடலில் அனைவருக்கும் தெரியும்')
                            : t('Private to you, hidden from catalog', 'உங்களுக்கு மட்டுமே தெரியும்')}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => {
                          if (onUpdateProperty) {
                            onUpdateProperty(prop.id || (prop as any)?._id, {
                              isListed: !isListed,
                              status: isListed ? 'Disabled (Unlisted)' : 'Active (Listed)',
                            });
                          }
                          handleToggleListing(prop);
                        }}
                        className={`text-xs font-semibold rounded-xl h-8 px-3 shrink-0 transition-all ${
                          isListed
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isListed ? (
                          t('Disable Listing', 'பட்டியலை முடக்கு')
                        ) : (
                          t('Enable Listing', 'பட்டியலை செயல்படுத்து')
                        )}
                      </Button>
                    </div>

                    {/* Control 2: Customer / Tenant Name Assignment */}
                    <div className="p-3 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          {t('Assign Customer / Tenant', 'வாடிக்கையாளர் / வாடகைதாரரை ஒதுக்கு')}
                        </span>
                        {assignedTenant && (
                          <button
                            type="button"
                            onClick={() => handleClearTenant(prop)}
                            disabled={isBusy}
                            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                            title={t('Clear Tenant', 'வாடகைதாரரை நீக்கு')}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>{t('Clear', 'நீக்கு')}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Input
                          value={assignedTenant}
                          onChange={(e) => handleTenantInputChange(propId, e.target.value)}
                          placeholder={t('e.g., Naveen, Kumar, John', 'எ.கா., நவீன், குமார்')}
                          className="h-8 text-xs rounded-lg bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border"
                          disabled={isBusy}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveTenantName(prop);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleSaveTenantName(prop)}
                          className="h-8 px-3 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              {t('Save', 'சேமி')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Control 3: Configure Visible Sections */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-foreground">
                            {t('Configure Visible Sections', 'தெரியும் பகுதிகளை உள்ளமைக்கவும்')}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {t(
                            'Toggle which sections are visible to prospective buyers or tenants.',
                            'சாத்தியமான வாங்குபவர்கள் அல்லது வாடகைதாரர்களுக்கு எந்தப் பகுதிகள் தெரிய வேண்டும் என்பதைத் தேர்வுசெய்க.'
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (addingSectionPropId === propId) {
                            setAddingSectionPropId(null);
                            setNewSectionName('');
                          } else {
                            setAddingSectionPropId(propId);
                            setNewSectionName('');
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-sm cursor-pointer"
                        title={t('Add section', 'பிரிவைச் சேர்')}
                      >
                        +
                      </button>
                    </div>

                    {/* Inline Add Section Form */}
                    {addingSectionPropId === propId && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border/60">
                        <input
                          type="text"
                          value={newSectionName}
                          onChange={(e) => setNewSectionName(e.target.value)}
                          placeholder={t('Enter section name...', 'பிரிவின் பெயரை உள்ளிடவும்...')}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-background border border-slate-200 dark:border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveCustomSection(prop);
                            } else if (e.key === 'Escape') {
                              setAddingSectionPropId(null);
                              setNewSectionName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomSection(prop)}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                        >
                          {t('Save', 'சேமி')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSectionPropId(null);
                            setNewSectionName('');
                          }}
                          className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg cursor-pointer font-medium"
                        >
                          {t('Cancel', 'ரத்து')}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* Toggle 1: Show Price / Rent Rate */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-muted/30 border border-slate-200/60 dark:border-border/40">
                        <div className="space-y-0.5 min-w-0 pr-1">
                          <span className="text-xs font-semibold text-foreground block truncate">
                            {t('Show Price / Rent Rate', 'விலை / வாடகை விகிதத்தைக் காட்டு')}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {prop.showPrice !== false
                              ? t('Exact price shown', 'சரியான விலை காட்டப்படுகிறது')
                              : t('"Price upon request"', '"விலை கோரிக்கையின் பேரில்"')}
                          </span>
                        </div>
                        <Switch
                          checked={prop.showPrice !== false}
                          onCheckedChange={(checked) => handleToggleSection(prop, 'showPrice', checked)}
                          disabled={isBusy}
                        />
                      </div>

                      {/* Toggle 2: Show Full Street Address */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-muted/30 border border-slate-200/60 dark:border-border/40">
                        <div className="space-y-0.5 min-w-0 pr-1">
                          <span className="text-xs font-semibold text-foreground block truncate">
                            {t('Show Full Street Address', 'முழு தெரு முகவரியைக் காட்டு')}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {prop.showAddress !== false
                              ? t('Full street location', 'முழு தெரு இருப்பிடம்')
                              : t('"Location upon request"', '"இருப்பிடம் கோரிக்கையின் பேரில்"')}
                          </span>
                        </div>
                        <Switch
                          checked={prop.showAddress !== false}
                          onCheckedChange={(checked) => handleToggleSection(prop, 'showAddress', checked)}
                          disabled={isBusy}
                        />
                      </div>

                      {/* Toggle 3: Show Amenities & Features */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-muted/30 border border-slate-200/60 dark:border-border/40">
                        <div className="space-y-0.5 min-w-0 pr-1">
                          <span className="text-xs font-semibold text-foreground block truncate">
                            {t('Show Amenities & Features', 'வசதிகள் & அம்சங்களைக் காட்டு')}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {prop.showAmenities !== false
                              ? t('Parking, lift, security, etc.', 'பார்க்கிங், லிஃப்ட், பாதுகாப்பு')
                              : t('Amenities hidden', 'வசதிகள் மறைக்கப்பட்டுள்ளன')}
                          </span>
                        </div>
                        <Switch
                          checked={prop.showAmenities !== false}
                          onCheckedChange={(checked) => handleToggleSection(prop, 'showAmenities', checked)}
                          disabled={isBusy}
                        />
                      </div>

                      {/* Toggle 4: Accept Direct Offers / Inquiries */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-muted/30 border border-slate-200/60 dark:border-border/40">
                        <div className="space-y-0.5 min-w-0 pr-1">
                          <span className="text-xs font-semibold text-foreground block truncate">
                            {t('Accept Direct Offers / Inquiries', 'நேரடி சலுகைகள் / விசாரணைகளை ஏற்கவும்')}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {prop.acceptOffers !== false
                              ? t('Offers & inquiries open', 'சலுகைகள் & விசாரணைகள் திறக்கப்பட்டுள்ளன')
                              : t('Offers paused', 'சலுகைகள் இடைநிறுத்தப்பட்டன')}
                          </span>
                        </div>
                        <Switch
                          checked={prop.acceptOffers !== false}
                          onCheckedChange={(checked) => handleToggleSection(prop, 'acceptOffers', checked)}
                          disabled={isBusy}
                        />
                      </div>

                      {/* Dynamic Custom Sections */}
                      {Array.isArray(prop.customSections) &&
                        prop.customSections.map((sec, idx) => (
                          <div
                            key={`custom-sec-${idx}`}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-muted/30 border border-slate-200/60 dark:border-border/40"
                          >
                            <div className="space-y-0.5 min-w-0 pr-1 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-semibold text-foreground block truncate">
                                  {sec.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomSection(prop, idx)}
                                  className="text-slate-400 hover:text-rose-500 opacity-60 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                  title={t('Delete section', 'பிரிவை நீக்கு')}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {sec.enabled !== false
                                  ? t('Section visible', 'பிரிவு தெரியும்')
                                  : t('Section hidden', 'பிரிவு மறைக்கப்பட்டது')}
                              </span>
                            </div>
                            <Switch
                              checked={sec.enabled !== false}
                              onCheckedChange={(checked) => handleToggleCustomSection(prop, idx, checked)}
                              disabled={isBusy}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-border/60 bg-slate-50/80 dark:bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t(`Showing ${filteredProperties.length} property item(s)`, `${filteredProperties.length} சொத்து உருப்படிகள் காட்டப்படுகின்றன`)}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl"
          >
            {t('Done', 'முடிந்தது')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
