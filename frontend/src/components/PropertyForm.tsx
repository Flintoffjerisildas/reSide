import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddProperty, useUpdateProperty } from '../hooks/useQueries';
import { PropertyStatus, ExternalBlob, Property } from '../types';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import ImageUploadSection from './ImageUploadSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Images, Compass } from 'lucide-react';
import { sqftToCent, centToSqft, formatCent, formatSqft } from '../utils/areaConversion';
import LocationPickerMap, { LocationCoordinates } from './LocationPickerMap';

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Property | null;
}

export default function PropertyForm({ open, onOpenChange, initialData }: PropertyFormProps) {
  const [title, setTitle] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [location, setLocation] = useState('');
  const [geoLocation, setGeoLocation] = useState<LocationCoordinates | null>(null);
  const [price, setPrice] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [totalArea, setTotalArea] = useState('');
  const [cent, setCent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [landDimensions, setLandDimensions] = useState({
    ab: '',
    bc: '',
    cd: '',
    da: '',
  });
  const [facing, setFacing] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<(ExternalBlob | string)[]>([]);
  const [currentTab, setCurrentTab] = useState('details');
  const { t } = useLanguage();
  
  const addPropertyMutation = useAddProperty();
  const updatePropertyMutation = useUpdateProperty();

  const formatInr = (value: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);

  const parseAmenities = (raw: string) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

  const toTitleCase = (value: string) =>
    value
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim();

  const generateDescription = (input: {
    bhkLabel: string;
    location: string;
    rentAmount: number;
    amenities?: string[];
    propertyCategory?: string;
  }) => {
    const bhk = input.bhkLabel.trim();
    const city = toTitleCase(input.location.trim());
    const rent = formatInr(input.rentAmount);
    const amenities = (input.amenities || []).filter(Boolean);
    const categoryRaw = String(input.propertyCategory || '').toLowerCase();
    const homeWord =
      categoryRaw === 'house'
        ? 'house'
        : categoryRaw === 'pg'
          ? 'PG'
          : categoryRaw === 'land'
            ? 'plot'
            : 'apartment';

    const isPg = categoryRaw === 'pg';
    const isLand = categoryRaw === 'land';
    const b = Number.parseInt(bhk.replace(/[^0-9]/g, ''), 10);
    const audience =
      isPg
        ? 'students and working professionals'
        : isLand
          ? 'investors and home builders'
          : b >= 3
            ? 'families'
            : 'working professionals';

    const amenityPhrase =
      amenities.length > 0
        ? `Includes modern amenities like ${amenities
            .map((a) => a.trim())
            .filter(Boolean)
            .map((a) => (a.toLowerCase() === 'wifi' ? 'WiFi' : a))
            .slice(0, 6)
            .join(', ')
            .replace(/, ([^,]*)$/, ' and $1')}.`
        : 'Well-connected location with easy access to daily essentials.';

    const bhkPrefix = bhk ? `${bhk} ` : '';
    const templates = [
      `Spacious ${bhkPrefix}${homeWord} in ${city} available for ₹${rent}. ${amenityPhrase} Ideal for ${audience}.`,
      `Discover a well-maintained ${bhkPrefix}${homeWord} in ${city} for ₹${rent}. ${amenityPhrase} Perfect for ${audience}.`,
      `Looking for a prime ${homeWord} in ${city}? This property is available for ₹${rent}. ${amenityPhrase} Great opportunity for ${audience}.`,
    ];

    const pick = (bhk.length + city.length + String(rent).length + amenities.length) % templates.length;
    return templates[pick];
  };

  const handlePropertyTypeChange = (value: string) => {
    setPropertyType(value);
    if (value.toLowerCase() === 'land') {
      // Clear bedroom value when switching to Land so stale data is not submitted
      setBedrooms('');
    } else {
      // Clear land dimensions when switching to a non-land property
      setLandDimensions({ ab: '', bc: '', cd: '', da: '' });
    }
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTotalArea(val);
    if (val.trim() === '') {
      setCent('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setCent('');
      return;
    }
    setCent(formatCent(sqftToCent(num)));
  };

  const handleCentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCent(val);
    if (val.trim() === '') {
      setTotalArea('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setTotalArea('');
      return;
    }
    setTotalArea(formatSqft(centToSqft(num)));
  };

  const handleGenerateDescription = () => {
    const isLand = propertyType.toLowerCase() === 'land';
    const priceNum = parseFloat(price);

    if (isLand) {
      if (!location.trim() || isNaN(priceNum) || priceNum <= 0) {
        toast.error(
          t(
            'Enter Location and Price/Rent to generate a description',
            'விவரத்தை உருவாக்க இடம் மற்றும் வாடகை/விலை தொகையை உள்ளிடவும்'
          )
        );
        return;
      }
    } else {
      const bedroomsNum = parseInt(bedrooms, 10);
      if (!location.trim() || isNaN(priceNum) || priceNum <= 0 || isNaN(bedroomsNum) || bedroomsNum <= 0) {
        toast.error(
          t(
            'Enter Bedrooms, Location, and Rent Amount to generate a description',
            'விவரத்தை உருவாக்க Bedrooms, இடம் மற்றும் வாடகை தொகையை உள்ளிடவும்'
          )
        );
        return;
      }
    }

    const bhkLabel = isLand ? '' : `${parseInt(bedrooms, 10)}BHK`;
    const amenities = parseAmenities(amenitiesText);
    setDescription(
      generateDescription({
        bhkLabel,
        location,
        rentAmount: priceNum,
        amenities,
        propertyCategory: propertyType,
      })
    );
  };

  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title || '');
      const pType = initialData.propertyType || '';
      setPropertyType(pType);
      setLocation(initialData.location || '');
      setPrice(initialData.price?.toString() || '');
      setTransactionType(initialData.transactionType || '');
      
      const areaStr = initialData.totalArea?.toString() || '';
      setTotalArea(areaStr);
      if (initialData.cent !== undefined && initialData.cent !== null) {
        setCent(initialData.cent.toString());
      } else if (initialData.totalArea) {
        setCent(formatCent(sqftToCent(Number(initialData.totalArea))));
      } else {
        setCent('');
      }

      setBedrooms(pType.toLowerCase() === 'land' ? '' : (initialData.bedrooms?.toString() || ''));
      setFacing(initialData.facing || '');
      setAmenitiesText(Array.isArray((initialData as any).amenities) ? (initialData as any).amenities.join(', ') : '');
      setDescription(initialData.description || '');
      setImages(initialData.images || []);

      if (initialData.landDimensions) {
        setLandDimensions({
          ab: initialData.landDimensions.ab !== undefined && initialData.landDimensions.ab !== null ? initialData.landDimensions.ab.toString() : '',
          bc: initialData.landDimensions.bc !== undefined && initialData.landDimensions.bc !== null ? initialData.landDimensions.bc.toString() : '',
          cd: initialData.landDimensions.cd !== undefined && initialData.landDimensions.cd !== null ? initialData.landDimensions.cd.toString() : '',
          da: initialData.landDimensions.da !== undefined && initialData.landDimensions.da !== null ? initialData.landDimensions.da.toString() : '',
        });
      } else {
        setLandDimensions({ ab: '', bc: '', cd: '', da: '' });
      }

      if (initialData.geoLocation && typeof initialData.geoLocation.latitude === 'number' && typeof initialData.geoLocation.longitude === 'number') {
        setGeoLocation({
          latitude: Number(initialData.geoLocation.latitude),
          longitude: Number(initialData.geoLocation.longitude),
          accuracy: initialData.geoLocation.accuracy !== undefined ? Number(initialData.geoLocation.accuracy) : undefined,
        });
      } else {
        setGeoLocation(null);
      }
    } else if (open && !initialData) {
      // Reset form for new entry
      setTitle('');
      setPropertyType('');
      setLocation('');
      setGeoLocation(null);
      setPrice('');
      setTransactionType('');
      setTotalArea('');
      setCent('');
      setBedrooms('');
      setFacing('');
      setAmenitiesText('');
      setDescription('');
      setImages([]);
      setLandDimensions({ ab: '', bc: '', cd: '', da: '' });
      setCurrentTab('details');
    }
  }, [open, initialData]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async () => {
    const isLand = propertyType.toLowerCase() === 'land';

    if (!title.trim() || !propertyType || !location.trim() || !price || !transactionType || !totalArea || (!isLand && !bedrooms) || !facing) {
      toast.error(t('Please fill all required fields', 'அனைத்து அவசியமான புலங்களையும் நிரப்பவும்'));
      return;
    }

    if (images.length === 0) {
      toast.error(
        t(
          'Please upload at least one image',
          'குறைந்தது ஒரு படத்தையாவது பதிவேற்றவும்'
        )
      );
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t('Please enter a valid price', 'சரியான விலையை உள்ளிடவும்'));
      return;
    }

    const totalAreaNum = parseFloat(totalArea);
    if (isNaN(totalAreaNum) || totalAreaNum <= 0) {
      toast.error(t('Please enter a valid total area', 'சரியான மொத்த பரப்பளவைக் குறிப்பிடவும்'));
      return;
    }

    if (cent.trim() !== '') {
      const centNum = parseFloat(cent);
      if (isNaN(centNum) || centNum <= 0) {
        toast.error(t('Please enter a valid cent area', 'சரியான சென்ட் பரப்பளவை உள்ளிடவும்'));
        return;
      }
    }

    let bedroomsNum: number | undefined = undefined;
    if (!isLand) {
      const parsedBedrooms = parseInt(bedrooms, 10);
      if (isNaN(parsedBedrooms) || parsedBedrooms <= 0) {
        toast.error(t('Please enter a valid number of bedrooms', 'சரியான படுக்கையறை எண்ணிக்கையை உள்ளிடவும்'));
        return;
      }
      bedroomsNum = parsedBedrooms;
    }

    let validatedLandDimensions: { ab?: number; bc?: number; cd?: number; da?: number } | undefined = undefined;
    if (isLand) {
      const dims: { key: 'ab' | 'bc' | 'cd' | 'da'; label: string; val: string }[] = [
        { key: 'ab', label: 'A → B', val: landDimensions.ab },
        { key: 'bc', label: 'B → C', val: landDimensions.bc },
        { key: 'cd', label: 'C → D', val: landDimensions.cd },
        { key: 'da', label: 'D → A', val: landDimensions.da },
      ];

      const parsed: { ab?: number; bc?: number; cd?: number; da?: number } = {};
      for (const d of dims) {
        if (d.val.trim() !== '') {
          const num = parseFloat(d.val);
          if (isNaN(num) || num < 0) {
            toast.error(t(
              `Please enter a valid non-negative length for ${d.label}`,
              `${d.label}-க்கு சரியான நேர்மறை நீளத்தை உள்ளிடவும்`
            ));
            return;
          }
          parsed[d.key] = num;
        }
      }

      if (Object.keys(parsed).length > 0) {
        validatedLandDimensions = parsed;
      }
    }

    const calculatedCent = cent.trim() !== ''
      ? parseFloat(cent)
      : (totalAreaNum ? Number(sqftToCent(totalAreaNum).toFixed(4)) : undefined);

    try {
      // Separate new blobs and existing strings
      const newImages = images.filter(img => typeof img !== 'string') as ExternalBlob[];
      const existingImages = images.filter(img => typeof img === 'string') as string[];

      // Convert new images to Base64
      const base64NewImages = await Promise.all(newImages.map(img => blobToBase64(img.blob)));
      
      // Combine all images
      const allImages = [...existingImages, ...base64NewImages];

      if (initialData) {
        const propertyId = (initialData as any)._id || initialData.id;
        console.log('[DEBUG] Updating property. ID:', propertyId, 'Full initialData:', initialData);
        
        if (!propertyId) {
          console.error('Property ID is missing');
          toast.error("Property ID is missing");
          return;
        }

        await updatePropertyMutation.mutateAsync({
          id: propertyId,
          data: {
            title: title.trim(),
            propertyType,
            location: location.trim(),
            price: Number(priceNum),
            transactionType: (transactionType as any),
            totalArea: Number(totalAreaNum),
            cent: calculatedCent,
            landDimensions: isLand ? validatedLandDimensions : undefined,
            bedrooms: isLand ? undefined : bedroomsNum,
            facing,
            amenities: parseAmenities(amenitiesText),
            description: description.trim() || undefined,
            images: allImages,
            geoLocation: geoLocation || null,
          }
        });
        toast.success(t('Property updated successfully!', 'சொத்து வெற்றிகரமாக புதுப்பிக்கப்பட்டது!'));
      } else {
        await addPropertyMutation.mutateAsync({
          title: title.trim(),
          propertyType,
          location: location.trim(),
          price: Number(priceNum), // Send as number
          transactionType: (transactionType as any),
          totalArea: Number(totalAreaNum),
          cent: calculatedCent,
          landDimensions: isLand ? validatedLandDimensions : undefined,
          bedrooms: isLand ? undefined : bedroomsNum,
          facing,
          amenities: parseAmenities(amenitiesText),
          description: description.trim() || undefined,
          status: PropertyStatus.pending,
          images: base64NewImages, // For new property, all images are new
          geoLocatedImage: null,
          geoLocation: geoLocation || null,
        });
        toast.success(
          t(
            'Property added successfully! Pending approval.',
            'சொத்து வெற்றிகரமாக சேர்க்கப்பட்டது! அங்கீகாரத்திற்காக காத்திருக்கிறது.'
          )
        );
      }
      
      // Reset form
      setTitle('');
      setPropertyType('');
      setLocation('');
      setGeoLocation(null);
      setPrice('');
      setTransactionType('');
      setTotalArea('');
      setCent('');
      setBedrooms('');
      setFacing('');
      setAmenitiesText('');
      setDescription('');
      setImages([]);
      setLandDimensions({ ab: '', bc: '', cd: '', da: '' });
      setCurrentTab('details');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Save property error:', error);
      toast.error(error.message || t('Failed to save property', 'சொத்தை சேமிக்க முடியவில்லை'));
    }
  };

  const handleDialogChange = (open: boolean) => {
    // Reset logic is now in useEffect when opening
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? t('Edit Property', 'சொத்தை திருத்தவும்') : t('Add Property', 'சொத்து சேர்க்கவும்')}</DialogTitle>
          <DialogDescription>
            {t(
              'Fill in the details and upload images to list your property',
              'உங்கள் சொத்தை பட்டியலிட விவரங்களையும் படங்களையும் பதிவேற்றவும்'
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">
              {t('Details', 'விவரங்கள்')}
            </TabsTrigger>
            <TabsTrigger value="images">
              <Images className="w-4 h-4 mr-2" />
              {t('Images', 'படங்கள்')} ({images.length}/20)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                {t('Title', 'தலைப்பு')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder={t('e.g., 3BHK Luxury Apartment', 'எ.கா., 3BHK ஆடம்பர அபார்ட்மெண்ட்')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="type">
                {t('Property Type', 'சொத்து வகை')} <span className="text-destructive">*</span>
              </Label>
              <Select value={propertyType} onValueChange={handlePropertyTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue placeholder={t('Select type', 'வகையை தேர்ந்தெடுக்கவும்')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">{t('Apartment / Flat', 'அபார்ட்மென்ட் / பிளாட்')}</SelectItem>
                  <SelectItem value="house">{t('House', 'வீடு')}</SelectItem>
                  <SelectItem value="pg">PG</SelectItem>
                  <SelectItem value="land">{t('Land', 'நிலம்')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location & GPS Interactive Map */}
            <LocationPickerMap
              value={geoLocation}
              onChange={setGeoLocation}
              address={location}
              onAddressChange={setLocation}
            />

            <div className="grid gap-2">
              <Label htmlFor="price">
                {t('Price (₹)', 'விலை (₹)')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                placeholder={t('e.g., 8500000', 'எ.கா., 8500000')}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Total Area and Cent inputs side-by-side on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="totalArea">
                  {t('Total Area (sq ft)', 'மொத்த பரப்பளவு (சதுர அடி)')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="totalArea"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={t('e.g., 1200', 'எ.கா., 1200')}
                  value={totalArea}
                  onChange={handleAreaChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cent">
                  {t('Cent', 'சென்ட்')}
                </Label>
                <Input
                  id="cent"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={t('e.g., 2.75', 'எ.கா., 2.75')}
                  value={cent}
                  onChange={handleCentChange}
                />
              </div>
            </div>

            {/* Optional Land Dimensions Section: Displayed only when Property Type is Land */}
            {propertyType.toLowerCase() === 'land' && (
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-primary" />
                    {t('Land Dimensions (Optional)', 'நில அளவுகள் (விருப்பத்திற்குரியது)')}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'Enter the boundary lengths of your land to help describe its shape. These measurements are optional.',
                      'உங்கள் நிலத்தின் வடிவத்தைப் புரிந்துகொள்ள அதன் எல்லை நீளங்களை உள்ளிடவும். இந்த அளவீடுகள் விருப்பத்திற்குரியவை.'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dimAB" className="text-xs font-medium">
                      {t('A → B (Length)', 'A → B (நீளம்)')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="dimAB"
                        type="number"
                        step="any"
                        min="0"
                        placeholder={t('e.g., 40.5', 'எ.கா., 40.5')}
                        value={landDimensions.ab}
                        onChange={(e) => setLandDimensions(prev => ({ ...prev, ab: e.target.value }))}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {t('ft', 'அடி')}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dimBC" className="text-xs font-medium">
                      {t('B → C (Length)', 'B → C (நீளம்)')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="dimBC"
                        type="number"
                        step="any"
                        min="0"
                        placeholder={t('e.g., 60', 'எ.கா., 60')}
                        value={landDimensions.bc}
                        onChange={(e) => setLandDimensions(prev => ({ ...prev, bc: e.target.value }))}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {t('ft', 'அடி')}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dimCD" className="text-xs font-medium">
                      {t('C → D (Length)', 'C → D (நீளம்)')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="dimCD"
                        type="number"
                        step="any"
                        min="0"
                        placeholder={t('e.g., 40', 'எ.கா., 40')}
                        value={landDimensions.cd}
                        onChange={(e) => setLandDimensions(prev => ({ ...prev, cd: e.target.value }))}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {t('ft', 'அடி')}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dimDA" className="text-xs font-medium">
                      {t('D → A (Length)', 'D → A (நீளம்)')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="dimDA"
                        type="number"
                        step="any"
                        min="0"
                        placeholder={t('e.g., 60.5', 'எ.கா., 60.5')}
                        value={landDimensions.da}
                        onChange={(e) => setLandDimensions(prev => ({ ...prev, da: e.target.value }))}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {t('ft', 'அடி')}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/80 leading-normal">
                  {t(
                    'Note: These measurements represent the four consecutive boundary lengths of the land in feet. Area is measured separately above and cannot be derived from four boundary lengths alone.',
                    'குறிப்பு: இந்த அளவுகள் நிலத்தின் நான்கு தொடர்ச்சியான எல்லை நீளங்களை அடிகளில் குறிக்கின்றன. பரப்பளவு மேலே தனித்தனியாக அளவிடப்படுகிறது மற்றும் நான்கு எல்லை நீளங்களிலிருந்து மட்டுமே பெற முடியாது.'
                  )}
                </p>
              </div>
            )}

            {/* Bedroom field: Hidden completely when Land is selected */}
            {propertyType.toLowerCase() !== 'land' && (
              <div className="grid gap-2">
                <Label htmlFor="bedrooms">
                  {t('Number of Bedrooms (BHK)', 'படுக்கையறை எண்ணிக்கை (BHK)')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bedrooms"
                  type="number"
                  placeholder={t('e.g., 2', 'எ.கா., 2')}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="facing">
                {t('Property Facing', 'சொத்து திசை')} <span className="text-destructive">*</span>
              </Label>
              <Select value={facing} onValueChange={setFacing}>
                <SelectTrigger id="facing">
                  <SelectValue placeholder={t('Select facing', 'திசையைத் தேர்ந்தெடுக்கவும்')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="North">{t('North', 'வடக்கு')}</SelectItem>
                  <SelectItem value="South">{t('South', 'தெற்கு')}</SelectItem>
                  <SelectItem value="East">{t('East', 'கிழக்கு')}</SelectItem>
                  <SelectItem value="West">{t('West', 'மேற்கு')}</SelectItem>
                  <SelectItem value="North-East">{t('North-East', 'வடகிழக்கு')}</SelectItem>
                  <SelectItem value="North-West">{t('North-West', 'வடமேற்கு')}</SelectItem>
                  <SelectItem value="South-East">{t('South-East', 'தென்கிழக்கு')}</SelectItem>
                  <SelectItem value="South-West">{t('South-West', 'தென்மேற்கு')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction">
                {t('Transaction Type', 'பரிவர்த்தனை வகை')} <span className="text-destructive">*</span>
              </Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger id="transaction">
                  <SelectValue placeholder={t('Select type', 'வகையை தேர்ந்தெடுக்கவும்')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">{t('Rent', 'வாடகை')}</SelectItem>
                  <SelectItem value="purchase">{t('Purchase', 'வாங்க')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amenities">
                {t('Amenities (optional)', 'வசதிகள் (விருப்பம்)')}
              </Label>
              <Input
                id="amenities"
                placeholder={t('e.g., parking, WiFi, lift', 'எ.கா., parking, WiFi, lift')}
                value={amenitiesText}
                onChange={(e) => setAmenitiesText(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="description">{t('Description', 'விவரம்')}</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleGenerateDescription}>
                  {t('Generate Description', 'விவரத்தை உருவாக்கவும்')}
                </Button>
              </div>
              <Textarea
                id="description"
                placeholder={t(
                  'A short, professional description will appear here…',
                  'சுருக்கமான, தொழில்முறை விவரம் இங்கே தோன்றும்…'
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            <Button 
              onClick={() => setCurrentTab('images')} 
              variant="outline" 
              className="w-full"
            >
              {t('Next: Upload Images', 'அடுத்தது: படங்களை பதிவேற்றவும்')}
            </Button>
          </TabsContent>

          <TabsContent value="images" className="mt-4">
            <ImageUploadSection images={images} onImagesChange={setImages} />
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={() => setCurrentTab('details')} 
                variant="outline"
                className="flex-1"
              >
                {t('Back', 'பின்னால்')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleDialogChange(false)}>
            {t('Cancel', 'ரத்து செய்')}
          </Button>
          <Button onClick={handleSubmit} disabled={addPropertyMutation.isPending || updatePropertyMutation.isPending}>
            {addPropertyMutation.isPending || updatePropertyMutation.isPending
              ? (initialData ? t('Updating...', 'புதுப்பிக்கிறது...') : t('Adding...', 'சேர்க்கிறது...'))
              : (initialData ? t('Save Changes', 'மாற்றங்களைச் சேமிக்கவும்') : t('Add Property', 'சேர்க்கவும்'))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
