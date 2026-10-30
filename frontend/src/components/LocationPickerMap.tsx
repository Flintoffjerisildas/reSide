import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLanguage } from '../contexts/LanguageContext';
import { MapPin, Navigation, Crosshair, Loader2, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationPickerMapProps {
  value: LocationCoordinates | null;
  onChange: (coords: LocationCoordinates | null) => void;
  address: string;
  onAddressChange: (address: string) => void;
  disabled?: boolean;
  hideMap?: boolean;
}

// Custom modern SVG pin marker for Leaflet with sharp pointer tail and high contrast on satellite imagery
const createMarkerIcon = (isGps: boolean = false) => {
  return L.divIcon({
    className: 'custom-property-marker !bg-transparent !border-0',
    html: `
      <div style="position: relative; width: 34px; height: 46px; background: transparent; border: none; overflow: visible; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 32" width="34" height="46" style="overflow: visible; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
          <path d="M12 1 C6.48 1 2 5.48 2 11 c0 7.5 8.5 17.5 9.4 18.6 a0.8 0.8 0 0 0 1.2 0 c0.9-1.1 9.4-11.1 9.4-18.6 0-5.52-4.48-10-10-10 z" fill="#2563eb" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="11" r="4.3" fill="#ffffff"/>
          <circle cx="12" cy="11" r="2.2" fill="#1d4ed8"/>
        </svg>
        ${isGps ? '<span style="position: absolute; width: 14px; height: 14px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 9px; left: 10px;"></span>' : ''}
      </div>
    `,
    iconSize: [34, 46],
    iconAnchor: [17, 44],
    popupAnchor: [0, -42],
  });
};

export default function LocationPickerMap({
  value,
  onChange,
  address,
  onAddressChange,
  disabled = false,
  hideMap = false,
}: LocationPickerMapProps) {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationStatusMessage, setLocationStatusMessage] = useState<{
    type: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);

  // Reverse geocoding helper using backend proxy with direct Nominatim fallback
  const fetchAddressFromCoords = useCallback(
    async (lat: number, lng: number) => {
      setIsGeocoding(true);
      try {
        let detectedAddress = '';

        try {
          const res = await api.get('/properties/reverse-geocode', {
            params: { lat, lon: lng },
            timeout: 6000,
          });
          if (res.data?.formattedAddress) {
            detectedAddress = res.data.formattedAddress;
          }
        } catch {
          // Direct fallback to OpenStreetMap Nominatim
          const fallbackRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            const addr = data.address || {};
            const parts = [
              addr.road || addr.street,
              addr.suburb || addr.neighbourhood,
              addr.city || addr.town || addr.village,
              addr.state,
            ].filter(Boolean);
            detectedAddress = parts.length > 0 ? parts.join(', ') : data.display_name || '';
          }
        }

        if (detectedAddress) {
          onAddressChange(detectedAddress);
          setLocationStatusMessage({
            type: 'success',
            text: t(
              `Address identified: ${detectedAddress}`,
              `முகவரி கண்டறியப்பட்டது: ${detectedAddress}`
            ),
          });
        }
      } catch (err: any) {
        console.warn('Reverse geocode warning:', err);
        setLocationStatusMessage({
          type: 'info',
          text: t(
            'Address lookup failed, but you can still adjust the marker.',
            'முகவரி தேடல் தோல்வியடைந்தது, ஆனால் நீங்கள் வரைபடத்தில் குறியீட்டை மாற்றலாம்.'
          ),
        });
      } finally {
        setIsGeocoding(false);
      }
    },
    [onAddressChange, t]
  );

  // Initialize and maintain map instance when map is enabled
  useEffect(() => {
    if (hideMap) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default initial view: property coords or Chennai / Tamil Nadu
      const initialLat = value?.latitude ?? 13.0827;
      const initialLng = value?.longitude ?? 80.2707;
      const initialZoom = value ? 16 : 13;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
      });

      // 100% Free Esri High-Resolution World Imagery (Satellite) tiles without API key
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }
      ).addTo(map);

      // Handle map click to drop/reposition marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (disabled) return;
        const { lat, lng } = e.latlng;
        onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
        fetchAddressFromCoords(lat, lng);
      });

      mapInstanceRef.current = map;

      // Invalidate size to ensure satellite tiles render cleanly after layout mount
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } else {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [hideMap]);

  // Sync marker position with coordinates
  useEffect(() => {
    if (hideMap) return;

    const map = mapInstanceRef.current;
    if (!map) return;

    if (value && typeof value.latitude === 'number' && typeof value.longitude === 'number') {
      const latLng: [number, number] = [value.latitude, value.longitude];

      if (markerRef.current) {
        markerRef.current.setLatLng(latLng);
        markerRef.current.setIcon(createMarkerIcon(!!value.accuracy));
      } else {
        const marker = L.marker(latLng, {
          draggable: !disabled,
          icon: createMarkerIcon(!!value.accuracy),
        }).addTo(map);

        marker.on('dragend', () => {
          if (disabled) return;
          const pos = marker.getLatLng();
          const newCoords = {
            latitude: Number(pos.lat.toFixed(6)),
            longitude: Number(pos.lng.toFixed(6)),
          };
          onChange(newCoords);
          fetchAddressFromCoords(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [value, disabled, fetchAddressFromCoords, onChange, hideMap]);

  // Recalculate map dimensions when visible or container changes
  const handleMapRefresh = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      if (value) {
        mapInstanceRef.current.setView([value.latitude, value.longitude], 17);
      }
    }
  };

  // GPS Geolocation Handler
  const handleGetCurrentLocation = async () => {
    if (disabled) return;

    if (!navigator.geolocation) {
      setLocationStatusMessage({
        type: 'error',
        text: t(
          'Geolocation is not supported by your browser.',
          'உங்கள் உலாவி புவிஇருப்பிடத்தை ஆதரிக்கவில்லை.'
        ),
      });
      return;
    }

    setIsLocating(true);
    setLocationStatusMessage(null);

    const getPosition = (opts: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
    };

    try {
      let position: GeolocationPosition;
      try {
        // High accuracy GPS request
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        });
      } catch (err: any) {
        if (err.code === 1) throw err; // Permission denied
        // Fallback to low accuracy for devices without dedicated GPS
        position = await getPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        });
      }

      const { latitude, longitude, accuracy } = position.coords;
      const formattedLat = Number(latitude.toFixed(6));
      const formattedLng = Number(longitude.toFixed(6));
      const roundedAccuracy = Math.round(accuracy);

      const newCoords: LocationCoordinates = {
        latitude: formattedLat,
        longitude: formattedLng,
        accuracy: roundedAccuracy,
      };

      onChange(newCoords);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([formattedLat, formattedLng], 17, {
          duration: 1.2,
        });
      }

      setLocationStatusMessage({
        type: 'success',
        text: t(
          `Current location captured (Accuracy: ±${roundedAccuracy}m). You can drag the pin to adjust if needed.`,
          `தற்போதைய இருப்பிடம் பெறப்பட்டது (துல்லியம்: ±${roundedAccuracy}மீ). தேவைப்பட்டால் குறியீட்டை நகர்த்தலாம்.`
        ),
      });

      // Automatically lookup readable address
      await fetchAddressFromCoords(formattedLat, formattedLng);
    } catch (error: any) {
      console.error('Geolocation error:', error);
      let message = t(
        'Unable to determine your current location. Try again or select a location manually.',
        'உங்கள் இருப்பிடத்தைக் கண்டறிய முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது வரைபடத்தில் கைமுறையாக தேர்ந்தெடுக்கவும்.'
      );

      if (error.code === 1) {
        message = t(
          'Location permission denied. You can select the property location on the map.',
          'இருப்பிட அனுமதி மறுக்கப்பட்டது. நீங்கள் வரைபடத்தில் நிலத்தின் இருப்பிடத்தைத் தேர்ந்தெடுக்கலாம்.'
        );
      } else if (error.code === 2) {
        message = t(
          'Unable to determine your current location. Try again or select a location manually.',
          'உங்கள் இருப்பிடத்தைக் கண்டறிய முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது வரைபடத்தில் தேர்ந்தெடுக்கவும்.'
        );
      } else if (error.code === 3) {
        message = t(
          'GPS request timed out. Please try again or tap the map directly.',
          'ஜிபிஎஸ் கோரிக்கை நேரம் முடிந்தது. மீண்டும் முயற்சிக்கவும் அல்லது வரைபடத்தில் நேரடியாக தொடவும்.'
        );
      }

      setLocationStatusMessage({
        type: 'error',
        text: message,
      });
      toast.error(message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleClearLocation = () => {
    onChange(null);
    setLocationStatusMessage(null);
  };

  const handleCenterOnMarker = () => {
    if (mapInstanceRef.current && value) {
      mapInstanceRef.current.setView([value.latitude, value.longitude], 17, { animate: true });
    }
  };

  // When hideMap is active (e.g., For Rent mode), render ONLY the clean text input
  if (hideMap) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor="property-location" className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" />
          {t('Property Address / Location', 'சொத்து முகவரி / இடம்')}{' '}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="property-location"
          placeholder={t(
            'Enter street address, building name, area, city',
            'தெரு முகவரி, கட்டிட பெயர், பகுதி, நகரத்தை உள்ளிடவும்'
          )}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          disabled={disabled}
          className="h-10"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Property Address / Location Input for Purchase / Sale mode */}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="property-location" className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-primary" />
            {t('Property Address / Location', 'சொத்து முகவரி / இடம்')}{' '}
            <span className="text-destructive">*</span>
          </Label>
          {isGeocoding && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              {t('Looking up address...', 'முகவரியைத் தேடுகிறது...')}
            </span>
          )}
        </div>
        <Input
          id="property-location"
          placeholder={t(
            'Enter street address, building name, area, city or pin on map',
            'தெரு முகவரி, கட்டிட பெயர், பகுதி, நகரம் அல்லது வரைபடத்தில் தேர்ந்தெடுக்கவும்'
          )}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          disabled={disabled}
          className="h-10"
        />
      </div>

      {/* Action Bar: Use Current Location & Map controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGetCurrentLocation}
          disabled={disabled || isLocating}
          className="flex items-center gap-2 border-primary/40 hover:border-primary hover:bg-primary/5 transition-all text-xs font-medium"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Navigation className="w-4 h-4 text-primary" />
          )}
          <span>{t('Use My Current Location', 'எனது தற்போதைய இருப்பிடத்தைப் பயன்படுத்து')}</span>
        </Button>

        <div className="flex items-center gap-2">
          {value && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCenterOnMarker}
                className="text-xs h-8 px-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                title={t('Center map on marker', 'குறியீட்டின் மீது வரைபடத்தை மையப்படுத்து')}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('Center Marker', 'மையப்படுத்து')}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearLocation}
                disabled={disabled}
                className="text-xs h-8 px-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                {t('Clear Pin', 'நீக்கு')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status / Error Message Banner */}
      {locationStatusMessage && (
        <div
          className={`text-xs p-2.5 rounded-lg flex items-start gap-2 border transition-all ${
            locationStatusMessage.type === 'error'
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : locationStatusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted/80 border-border text-muted-foreground'
          }`}
        >
          {locationStatusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{locationStatusMessage.text}</span>
        </div>
      )}

      {/* Free Esri High-Resolution World Imagery (Satellite) Map Preview */}
      <div className="relative rounded-xl border border-border/80 overflow-hidden bg-slate-900 shadow-inner">
        <div
          ref={mapContainerRef}
          className="w-full h-[220px] sm:h-[260px] z-0"
          style={{ minHeight: '220px' }}
        />

        {/* Satellite Map Helper Overlay */}
        <div className="absolute top-2 left-2 right-2 pointer-events-none z-[400] flex justify-between items-center gap-2">
          <div className="bg-slate-900/90 text-white backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-medium border border-white/20 shadow-sm pointer-events-auto flex items-center gap-1.5 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="truncate">
              {value
                ? t('Satellite View: Drag pin to exact boundary', 'செயற்கைக்கோள் பார்வை: எல்லையை குறிக்க குறியீட்டை இழுக்கவும்')
                : t('Satellite View: Click anywhere to drop plot pin', 'செயற்கைக்கோள் பார்வை: நிலத்தின் எல்லையை குறிக்க கிளிக் செய்யவும்')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleMapRefresh}
            className="bg-slate-900/90 text-white backdrop-blur-sm p-1.5 rounded-md hover:bg-slate-800 border border-white/20 shadow-sm pointer-events-auto text-[10px] shrink-0"
            title={t('Refresh Satellite View', 'செயற்கைக்கோள் காட்சியைப் புதுப்பிக்கவும்')}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selected Coordinates Display */}
      {value ? (
        <div className="p-3 bg-muted/30 border border-border/70 rounded-lg text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {t('Selected Coordinates', 'தேர்ந்தெடுக்கப்பட்ட ஒருங்கிணைப்புகள்')}
            </span>
            {value.accuracy ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {t(`GPS Accuracy: ±${value.accuracy}m`, `ஜிபிஎஸ் துல்லியம்: ±${value.accuracy}மீ`)}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {t('Manually Placed Satellite Pin', 'செயற்கைக்கோள் வரைபடத்தில் வைக்கப்பட்ட குறியீடு')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-muted-foreground font-mono">
            <div>
              <span className="text-[11px] text-muted-foreground/80 block uppercase tracking-wider">{t('Latitude', 'அட்சரேகை')}</span>
              <span className="font-semibold text-foreground text-xs">{value.latitude.toFixed(6)}°</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground/80 block uppercase tracking-wider">{t('Longitude', 'தீர்க்கரேகை')}</span>
              <span className="font-semibold text-foreground text-xs">{value.longitude.toFixed(6)}°</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          {t(
            'GPS coordinates optional. Capture current position or tap the satellite map to pinpoint exact plot boundary.',
            'ஜிபிஎஸ் அட்சரேகை/தீர்க்கரேகை விருப்பத்திற்குரியது. துல்லியமான இடத்தை சேமிக்க செயற்கைக்கோள் வரைபடத்தில் தொடவும்.'
          )}
        </p>
      )}
    </div>
  );
}
