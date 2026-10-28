import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLanguage } from '../contexts/LanguageContext';
import { ExternalBlob } from '../types';
import { Camera, MapPin, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCamera } from '../camera/useCamera';

interface GeoLocatedImageCaptureProps {
  geoLocatedImage: ExternalBlob | null;
  geoLocation: { latitude: number; longitude: number } | null;
  onCapture: (image: ExternalBlob, location: { latitude: number; longitude: number }) => void;
}

export default function GeoLocatedImageCapture({
  geoLocatedImage,
  geoLocation,
  onCapture,
}: GeoLocatedImageCaptureProps) {
  const { t } = useLanguage();
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    isActive,
    isSupported,
    error: cameraError,
    isLoading: cameraLoading,
    startCamera,
    stopCamera,
    capturePhoto,
    videoRef,
    canvasRef,
  } = useCamera({
    facingMode: 'environment',
    width: 1920,
    height: 1080,
    quality: 0.9,
    format: 'image/jpeg',
  });

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    if (!navigator.geolocation) {
      throw new Error(t('Geolocation is not supported', 'புவிஇருப்பிடம் ஆதரிக்கப்படவில்லை'));
    }

    setIsGettingLocation(true);
    setLocationError(null);

    const getPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    try {
      // Try high accuracy first with a short timeout
      try {
        const position = await getPosition({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
        
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentLocation(location);
        setIsGettingLocation(false);
        return location;
      } catch (err: any) {
        // If permission denied, throw immediately
        if (err.code === 1) throw err;
        
        console.warn('High accuracy location failed, trying low accuracy...');
        
        // Fallback to low accuracy (better for desktops/laptops without GPS)
        const position = await getPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        });

        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentLocation(location);
        setIsGettingLocation(false);
        return location;
      }
    } catch (error: any) {
      setIsGettingLocation(false);
      let errorMessage = t('Failed to get location', 'இருப்பிடத்தைப் பெற முடியவில்லை');
      
      // GeolocationPositionError codes: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          errorMessage = t(
            'Location permission denied. Please enable location access in your browser.',
            'இருப்பிட அனுமதி மறுக்கப்பட்டது. உங்கள் உலாவியில் இருப்பிட அணுகலை இயக்கவும்.'
          );
          break;
        case 2: // POSITION_UNAVAILABLE
          errorMessage = t(
            'Location information unavailable. Ensure Location Services are enabled in your OS settings.',
            'இருப்பிட தகவல் கிடைக்கவில்லை. உங்கள் OS அமைப்புகளில் இருப்பிட சேவைகள் இயக்கப்பட்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.'
          );
          break;
        case 3: // TIMEOUT
          errorMessage = t(
            'Location request timed out. Please try again.',
            'இருப்பிட கோரிக்கை காலாவதியானது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.'
          );
          break;
      }
      
      setLocationError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleStartCamera = async () => {
    try {
      // Start camera first so user sees something working
      const success = await startCamera();
      if (!success) {
        toast.error(
          t(
            'Failed to start camera',
            'கேமராவைத் தொடங்க முடியவில்லை'
          )
        );
        return;
      }

      // Then try to get location
      try {
        await getCurrentLocation();
      } catch (error) {
        console.error("Location failed", error);
        // Error is already set in state by getCurrentLocation
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleManualLocation = () => {
    // Set a default location (e.g., Chennai) or 0,0 to allow proceeding
    const defaultLocation = {
      latitude: 13.0827,
      longitude: 80.2707
    };
    setCurrentLocation(defaultLocation);
    setLocationError(null);
    toast.info(t('Using default location', 'இயல்புநிலை இருப்பிடத்தைப் பயன்படுத்துகிறது'));
  };

  const handleCapture = async () => {
    if (!currentLocation) {
      toast.error(
        t(
          'Location not available. Please enable location access.',
          'இருப்பிடம் கிடைக்கவில்லை. இருப்பிட அணுகலை இயக்கவும்.'
        )
      );
      return;
    }

    try {
      const photoFile = await capturePhoto();
      if (!photoFile) {
        toast.error(
          t(
            'Failed to capture photo',
            'புகைப்படத்தை எடுக்க முடியவில்லை'
          )
        );
        return;
      }

      const arrayBuffer = await photoFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const blob: ExternalBlob = {
        blob: new Blob([uint8Array], { type: photoFile.type }),
        name: photoFile.name || `capture-${Date.now()}.jpg`,
        contentType: photoFile.type
      };

      // Create preview
      const url = URL.createObjectURL(photoFile);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);

      onCapture(blob, currentLocation);
      await stopCamera();

      toast.success(
        t(
          'Front-view image captured successfully with location data',
          'இருப்பிட தரவுடன் முன்-பார்வை படம் வெற்றிகரமாக எடுக்கப்பட்டது'
        )
      );
    } catch (error) {
      console.error('Error capturing photo:', error);
      toast.error(
        t(
          'Failed to capture photo',
          'புகைப்படத்தை எடுக்க முடியவில்லை'
        )
      );
    }
  };

  const handleRetake = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onCapture(null as any, null as any);
    await handleStartCamera();
  };

  if (isSupported === false) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t(
            'Camera is not supported on this device',
            'இந்த சாதனத்தில் கேமரா ஆதரிக்கப்படவில்லை'
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">
          {t('Mandatory Front-View Image', 'கட்டாய முன்-பார்வை படம்')} <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            'Capture a front-side image of the property from the road view with GPS location',
            'GPS இருப்பிடத்துடன் சாலை பார்வையில் இருந்து சொத்தின் முன்-பக்க படத்தை எடுக்கவும்'
          )}
        </p>
      </div>

      {locationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="flex flex-col gap-2">
            <AlertDescription>{locationError}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualLocation}
              className="w-fit mt-2 bg-background text-foreground hover:bg-accent"
            >
              <MapPin className="w-3 h-3 mr-2" />
              {t('Use Approximate Location (Bypass)', 'தோராயமான இருப்பிடத்தைப் பயன்படுத்தவும் (தவிர்க்கவும்)')}
            </Button>
          </div>
        </Alert>
      )}

      {cameraError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {cameraError.message}
          </AlertDescription>
        </Alert>
      )}

      {currentLocation && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            {t('Location acquired:', 'இருப்பிடம் பெறப்பட்டது:')} {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </AlertDescription>
        </Alert>
      )}

      {!geoLocatedImage && !isActive && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'Click the button below to start the camera and capture the front-view image',
              'கேமராவைத் தொடங்கி முன்-பார்வை படத்தை எடுக்க கீழே உள்ள பொத்தானைக் கிளிக் செய்யவும்'
            )}
          </p>
          <Button
            type="button"
            onClick={handleStartCamera}
            disabled={cameraLoading || isGettingLocation}
          >
            <Camera className="w-4 h-4 mr-2" />
            {isGettingLocation
              ? t('Getting Location...', 'இருப்பிடத்தைப் பெறுகிறது...')
              : t('Start Camera', 'கேமராவைத் தொடங்கவும்')}
          </Button>
        </div>
      )}

      {isActive && (
        <div className="space-y-4">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleCapture}
              disabled={!currentLocation}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              {t('Capture Photo', 'புகைப்படம் எடுக்கவும்')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={stopCamera}
            >
              {t('Cancel', 'ரத்து செய்')}
            </Button>
          </div>
        </div>
      )}

      {geoLocatedImage && previewUrl && (
        <div className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              {t(
                'Front-view image captured successfully with GPS location',
                'GPS இருப்பிடத்துடன் முன்-பார்வை படம் வெற்றிகரமாக எடுக்கப்பட்டது'
              )}
            </AlertDescription>
          </Alert>
          <div className="relative aspect-video rounded-lg overflow-hidden border">
            <img
              src={previewUrl}
              alt="Captured front view"
              className="w-full h-full object-cover"
            />
          </div>
          {geoLocation && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>
                {t('Location:', 'இருப்பிடம்:')} {geoLocation.latitude.toFixed(6)}, {geoLocation.longitude.toFixed(6)}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleRetake}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('Retake Photo', 'மீண்டும் புகைப்படம் எடுக்கவும்')}
          </Button>
        </div>
      )}
    </div>
  );
}
